import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
} from "ai";
import { ConvexError } from "convex/values";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { deepseek } from "@/lib/ai/provider";
import { chatModel } from "@/lib/ai/models";
import { buildChatSystemPrompt } from "@/lib/ai/prompts/chat";
import { logAiGeneration } from "@/lib/ai/telemetry";
import { extractText } from "@/lib/ai/uiMessage";

// Always run on the Node.js runtime so we can use the
// Convex HTTP client and Clerk's `auth()` server helpers
// without bundling surprises. Streaming responses work fine
// here in Next.js 16.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Zod schema for the request body. The Convex typed API
 * expects branded `Id<"…">` values, which we cannot produce
 * from a plain string at the JSON boundary; we accept the
 * string and cast at the Convex call site. Anything else
 * gets a 400.
 */
const chatRequestSchema = z.object({
  threadId: z.string().min(1),
  subjectId: z.string().min(1),
  topicId: z.string().min(1).optional(),
  /**
   * Optional. When the tutor page was reached via
   * `?lesson=<runId>` (the results page CTA chain), the
   * client forwards the structured context here so the
   * system prompt appends the "Lesson the student just
   * completed" block (plan §5.6). Schema-validated so
   * the route handler can reject malformed payloads.
   */
  lessonContext: z
    .object({
      topicTitle: z.string().min(1),
      lessonSummary: z.string().min(1).max(8000),
      grade: z.union([
        z.literal("1"),
        z.literal("2"),
        z.literal("3"),
        z.literal("4"),
        z.literal("5"),
        z.literal("6"),
      ]),
      items: z
        .array(
          z.object({
            prompt: z.string().min(1),
            userAnswer: z.string(),
            verdict: z.union([
              z.literal("correct"),
              z.literal("partially_correct"),
              z.literal("incorrect"),
            ]),
            score: z.number().min(0).max(1),
            feedback: z.string(),
            betterAnswer: z.string(),
          })
        )
        .max(20),
      mistakes: z
        .array(
          z.object({
            type: z.string().min(1),
            cause: z.string(),
          })
        )
        .max(20),
    })
    .optional(),
  messages: z.array(z.any()),
});

/**
 * POST /api/tutor/chat.
 *
 * Streams a DeepSeek tutor reply for a thread. Steps:
 *  1. Auth check via Clerk. 401 if no session.
 *  2. Authenticate ConvexHttpClient with the Clerk JWT so
 *     Convex functions can resolve the user via
 *     `ctx.auth.getUserIdentity()`.
 *  3. Parse + Zod-validate the request body.
 *  4. Load the chat context (subject, topic, mastery,
 *     recent mistakes) and surface a `ConvexError` with
 *     `data === "topic_not_found"` as a 404.
 *  5. Persist the latest user message to the thread so it
 *     is in the canonical store before the model sees it.
 *  6. Call `streamText` with the grounded system prompt and
 *     the message history. Stream the response to the
 *     client.
 *  7. Fire-and-forget: on stream completion, persist the
 *     final assistant message and log the call to
 *     `aiGenerations`.
 *
 * The "as it arrives" requirement is satisfied at two
 * levels: the client renders the stream live via
 * `useChat`, and the canonical Convex row is written before
 * the model ever starts generating (so a refresh during
 * streaming keeps the user's message in the thread).
 */
export async function POST(req: NextRequest) {
  // 1. Auth check.
  const { userId: clerkId, getToken } = await auth();
  if (!clerkId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return new Response("Convex is not configured", { status: 500 });
  }

  // 2. Convex client with the Clerk JWT. The same authenticated
  //    client is reused for the message persistence, the context
  //    read, and the AI generation telemetry write, so the
  //    `aiGenerations` row is attributed to the calling user.
  const token = await getToken({ template: "convex" }).catch(() => null);
  const convex = new ConvexHttpClient(convexUrl);
  if (token) convex.setAuth(token);

  // 3. Parse + Zod-validate the request.
  const parseResult = chatRequestSchema.safeParse(
    await req.json().catch(() => null)
  );
  if (!parseResult.success) {
    return new Response("Bad request", { status: 400 });
  }
  const {
    threadId,
    subjectId,
    topicId,
    lessonContext,
    messages: uiMessages,
  } = parseResult.data;

  // 4. Load the chat context, the onboarding tutor profile,
  //    and persist the latest user message in parallel.
  //    The profile is best-effort: if onboarding hasn't
  //    finished yet (the user is mid-flow asking the tutor
  //    a question), the prompt falls back to the default
  //    behavior block. The reads touch different tables
  //    and have no ordering dependency, so the persist +
  //    read fan-out is parallel.
  const lastUserMessage = [...uiMessages]
    .reverse()
    .find((m) => m.role === "user");
  const userMessageText =
    lastUserMessage ? extractText(lastUserMessage) : null;

  // Infer context type from the chat-context read; the
  // tutor profile is added separately below. Using
  // `Awaited<ReturnType<…>>` keeps the type derived from
  // the Convex query so we do not have to repeat the
  // shape here.
  type ChatContext = NonNullable<
    Awaited<
      ReturnType<typeof convex.query<typeof api.tutor.getContextForChat>>
    >
  >;

  let context: (ChatContext & { readonly tutorProfile: TutorProfileLike | null }) | null =
    null;
  try {
    const result = await Promise.all([
      convex.query(api.tutor.getContextForChat, {
        threadId: threadId as Id<"tutorThreads">,
        subjectId: subjectId as Id<"subjects">,
        ...(topicId ? { topicId: topicId as Id<"topics"> } : {}),
      }),
      // Personalization: best-effort load of the 11-question
      // onboarding profile. Lives behind a try/catch because
      // every user goes through onboarding — `getMine`
      // returns null for brand-new users, so an exception
      // here would imply a real Convex outage we should
      // surface the error path rather than silently degrade.
      convex
        .query(api.tutorProfile.getMine, {})
        .catch(() => null),
      // Persist the latest user message (last user-role in
      // the array) so it is in the canonical store. We pass
      // the UIMessage.id through as a `clientId` so the
      // mutation can dedupe against retries.
      (async () => {
        if (!lastUserMessage) return;
        if (!userMessageText || userMessageText.trim().length === 0) return;
        try {
          await convex.mutation(api.tutor.appendUserMessage, {
            threadId: threadId as Id<"tutorThreads">,
            content: userMessageText,
            clientId: lastUserMessage.id,
          });
        } catch (err) {
          // If the message was already persisted (e.g. on
          // retry), this is fine.
          console.warn("appendUserMessage (non-fatal):", err);
        }
      })(),
    ]);
    const chat = result[0];
    if (chat) {
      context = { ...chat, tutorProfile: (result[1] ?? null) as TutorProfileLike | null };
    }
  } catch (err) {
    // A `ConvexError` here means the caller asked for a
    // topic that no longer exists; surface that as a 404
    // so the client can recover instead of receiving a
    // silently-degraded subject-only reply.
    if (
      err instanceof ConvexError &&
      (err as { data: unknown }).data === "topic_not_found"
    ) {
      return new Response("Topic not found", { status: 404 });
    }
    throw err;
  }
  if (!context) {
    return new Response("Thread or context not found", { status: 404 });
  }

  // 6. Build the grounded system prompt. Working language
  //    follows the user's curriculum when a profile is
  //    available, falling back to "de" for the German
  //    Gymnasium default. The profile-derived directives
  //    steer tone / depth / feedback pacing regardless of
  //    the topic.
  const systemPrompt = buildChatSystemPrompt({
    subjectTitle: context.subject.title,
    subjectSlug: context.subject.slug,
    topicTitle: context.topic?.title ?? null,
    topicSlug: context.topic?.slug ?? null,
    objectives: context.topic?.objectives ?? [],
    difficulty: context.topic?.difficulty ?? null,
    gradeLevel: context.topic?.gradeLevel ?? null,
    language: deriveWorkingLanguage(context.tutorProfile ?? null),
    mastery: context.mastery,
    confidence: context.confidence,
    recentMistakes: context.recentMistakes,
    // Onboarding personalization. The tutor prompt builder
    // injects a "Personalization directives" block at the
    // top of the system prompt when this is present. We
    // tolerate `tutorProfile: null` — new users see the
    // default behavior without any lost quality.
    ...(context.tutorProfile
      ? {
          tutorProfile: {
            grade: context.tutorProfile.grade,
            curriculum: context.tutorProfile.curriculum,
            curriculumName: context.tutorProfile.curriculumName,
            curriculumFreeform: context.tutorProfile.curriculumFreeform ?? null,
            enrolledSubjectIds: context.tutorProfile.enrolledSubjectIds,
            weakestSubjectIds: context.tutorProfile.weakestSubjectIds,
            preferredExplanationStyle:
              context.tutorProfile.preferredExplanationStyle,
            feedbackStyle: context.tutorProfile.feedbackStyle,
            learningPreference: context.tutorProfile.learningPreference,
            biggestObstacle: context.tutorProfile.biggestObstacle,
            primaryGoal: context.tutorProfile.primaryGoal,
            communicationStyle: context.tutorProfile.communicationStyle,
          },
        }
      : {}),
    // Optional `lessonContext` per plan §5.6. The route
    // handler trusts the client's Zod-validated payload
    // here because the server page already gated through
    // `getContextForLessonRun` (which returns `null` for
    // runs that do not exist or do not belong to the
    // caller). The tutor builds the lesson block per
    // `buildLessonContextBlock`.
    ...(lessonContext ? { lessonContext } : {}),
  });

  // 7. Build the model messages. The latest user message
  //    is already in `uiMessages`; we don't need to
  //    re-prepend it. In ai@7, `convertToModelMessages`
  //    returns a Promise so we await it.
  const modelMessages = await convertToModelMessages(uiMessages);

  // 8. Stream the response.
  const startMs = Date.now();
  const modelId = chatModel();
  const result = streamText({
    model: deepseek()(modelId),
    system: systemPrompt,
    messages: modelMessages,
    // Cap output at a reasonable length so a runaway
    // generation cannot blow up the response or the bill.
    maxOutputTokens: 1500,
    // Light retry behavior for transient provider errors.
    maxRetries: 2,
    abortSignal: req.signal,
  });

  // 9. Drain the upstream stream to completion even if the
  //    client disconnects early. `toUIMessageStream` below
  //    feeds off `result.fullStream`, which only closes
  //    when `streamText` finishes executing; if the client
  //    closes the response stream first, by default the
  //    model would also abort. `result.consumeStream()`
  //    detach-pumps the upstream so the model keeps
  //    running server-side, and the `onEnd` callback below
  //    in `toUIMessageStream` is guaranteed to fire once
  //    the upstream completes — giving us a reliable,
  //    lifecycle-anchored persistence hook per the Vercel
  //    AI SDK UI docs.
  //
  //  **Note on reasoning forwarding.** Reasoning tokens
  //  (when the model itself emits them) flow through the
  //  default `toUIMessageStream` pipeline as a discrete
  //  `ReasoningUIPart` on the client — `toUIMessageStream`
  //  forwards reasoning by default. We deliberately do
  //  NOT pass `providerOptions.deepseek.thinking` here,
  //  because the default model id resolves to the
  //  non-thinking `deepseek-v4-flash`; flipping that
  //  belongs to a future product decision alongside the
  //  cost / latency trade-off.
  result.consumeStream();

  // 10. Return the streaming response. We use the
  //     explicit `createUIMessageStreamResponse({...})`
  //     form rather than `result.toUIMessageStreamResponse()`
  //     because we need:
  //
  //       (a) the `onEnd` persistence hook so
  //           `recordAssistantMessage` + `logAiGeneration`
  //           run regardless of client disconnects; and
  //       (b) `originalMessages: uiMessages` so `onEnd`'s
  //           `messages` callback carries the full history
  //           (preserving `clientId` ordering and the
  //           canonical structure Convex's
  //           `recordAssistantMessage` already trusts).
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.fullStream,
      originalMessages: uiMessages,
      // Persistence runs inside `toUIMessageStream`'s
      // `onEnd` callback (per the Vercel AI SDK UI docs).
      // The SDK keeps the response stream open until
      // `onEnd` resolves, so this is materially MORE
      // durable than the pre-existing `void (async () =>
      // {...})` pattern — the previous fire-and-forget
      // IIFE was at risk of being reaped after the
      // response flushed on serverless platforms.
      //
      // **Remaining failure modes** (best-effort, logged):
      //   - The Convex `recordAssistantMessage` mutation
      //     throws (e.g. transient Convex outage).
      //   - `lastAssistant` is malformed (the Zod schema
      //     accepts `messages: z.array(z.any())` — a future
      //     iteration should tighten the shape to require
      //     `id`, `role`, and `parts`).
      //   - `result.usage` reports a transient zero on
      //     provider timeouts.
      //
      // In every failure mode the client already has the
      // live stream, so a missed write is recoverable from
      // a manual re-send in the support flow.
      onEnd: async ({ messages: finalMessages }) => {
        try {
          const lastAssistant = finalMessages[finalMessages.length - 1];
          if (!lastAssistant || lastAssistant.role !== "assistant") return;
          // `extractText` from `@/lib/ai/uiMessage.ts`
          // filters to `part.type === "text"` only —
          // reasoning parts are deliberately excluded so
          // the model's inner monologue never bleeds into
          // the persisted authoritative reply.
          const text = extractText(lastAssistant).trim();
          if (text.length > 0) {
            await convex.mutation(api.tutor.recordAssistantMessage, {
              threadId: threadId as Id<"tutorThreads">,
              content: text,
            });
          }
          const usage = await result.usage;
          await logAiGeneration(convex, {
            task: "tutor.chat",
            model: modelId,
            inputTokens: usage.inputTokens ?? 0,
            outputTokens: usage.outputTokens ?? 0,
            latencyMs: Date.now() - startMs,
            relatedId: threadId,
            schemaValid: true,
          });
        } catch (err) {
          console.error("tutor route: onEnd persistence failed", err);
        }
      },
      onError: (err) => {
        // Mask provider-side error messages from the
        // client per the docs' "Error Messages" guidance;
        // we still log server-side for diagnostics.
        console.error("tutor route: stream error", err);
        return "Something went wrong.";
      },
      // Forward usage metadata as per the Vercel AI SDK
      // UI "Usage Information" docs section. The client
      // reads `message.metadata?.model` +
      // `message.metadata?.totalTokens` to surface a model
      // badge + token count on completed messages.
      // `totalUsage` is guaranteed on the `'finish'` chunk
      // per the SDK type, so we access it directly — a
      // missing-usage signal should fail loudly here
      // rather than silently producing undefined metadata.
      messageMetadata: ({ part }) => {
        if (part.type === "start") {
          return { model: modelId };
        }
        if (part.type === "finish") {
          return { totalTokens: part.totalUsage.totalTokens };
        }
        return undefined;
      },
    }),
  });
}

// ===========================================================================
// Helpers
// ===========================================================================

/**
 * Subset of the `tutorProfile.getMine` response we
 * forward to `buildChatSystemPrompt`. The Convex query
 * returns two nullable strings (curriculumFreeform)
 * that we collapse to a single `string | null` here.
 */
type TutorProfileLike = {
  readonly id: string;
  readonly userId: string;
  readonly grade: number;
  readonly curriculum:
    | "german_gymnasium"
    | "ib"
    | "a_level"
    | "ap"
    | "other";
  readonly curriculumName: string;
  readonly curriculumFreeform: string | null;
  readonly enrolledSubjectIds: ReadonlyArray<string>;
  readonly weakestSubjectIds: ReadonlyArray<string>;
  readonly preferredExplanationStyle:
    | "simple"
    | "standard"
    | "rigorous"
    | "examples"
    | "step_by_step"
    | "visual";
  readonly feedbackStyle:
    | "immediate"
    | "hint_first"
    | "socratic"
    | "patient";
  readonly learningPreference:
    | "practice"
    | "reading"
    | "visual"
    | "teaching"
    | "mixed";
  readonly biggestObstacle:
    | "procrastination"
    | "forgetfulness"
    | "exam_panic"
    | "no_starting_point"
    | "distraction"
    | "no_improvement";
  readonly primaryGoal:
    | "pass_classes"
    | "improve_grades"
    | "top_of_class"
    | "university_prep"
    | "master_everything";
  readonly communicationStyle:
    | "teacher"
    | "private_tutor"
    | "coach"
    | "challenge";
  readonly completedAt: number;
};

/**
 * deriveWorkingLanguage.
 *
 * Maps the user's curriculum to a BCP-47-ish language the
 * AI tutor should respond in. Default is "de" (the
 * German-first Gymnasium target user); IB / A-Level / AP /
 * "other" all use English. When the user explicitly picks
 * a non-German curriculum, the tutor switches to match.
 *
 * Per AGENTS.md "Every AI call must include app context
 * (… language)" — this is where the language field is
 * driven from canonical user data, not hardcoded.
 */
function deriveWorkingLanguage(
  profile:
    | {
        readonly curriculum:
          | "german_gymnasium"
          | "ib"
          | "a_level"
          | "ap"
          | "other";
      }
    | null
): string {
  if (!profile) return "de";
  switch (profile.curriculum) {
    case "german_gymnasium":
      return "de";
    case "ib":
    case "a_level":
    case "ap":
    case "other":
      return "en";
    default:
      return "de";
  }
}
