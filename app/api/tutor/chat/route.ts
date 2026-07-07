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
import { buildStrategyPromptBlock } from "@/convex/tutorStrategy";

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
 *
 * NEW for Phase 1 §3.2: `sessionId` is now accepted so the
 * route handler can read the current teaching strategy state
 * and record turn-level engagement signals.
 */
const chatRequestSchema = z.object({
  threadId: z.string().min(1),
  subjectId: z.string().min(1),
  topicId: z.string().min(1).optional(),
  /**
   * Phase 1 §3.2: optional session id. When present, the
   * route handler reads the current teaching strategy state
   * and records turn-level engagement signals after the
   * assistant reply is persisted.
   */
  sessionId: z.string().min(1).optional(),
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
      focusItemId: z.string().optional(),
    })
    .optional(),
  messages: z.array(z.any()),
});

/**
 * POST /api/tutor/chat.
 *
 * Streams a DeepSeek tutor reply for a thread. Steps:
 *  1. Auth check via Clerk. 401 if no session.
 *  2. Authenticate ConvexHttpClient with the Clerk JWT.
 *  3. Parse + Zod-validate the request body.
 *  4. Load the chat context (subject, topic, mastery,
 *     recent mistakes) and strategy state.
 *  5. Persist the latest user message to the thread.
 *  6. Build the grounded system prompt with strategy block.
 *  7. Call `streamText` with the enriched system prompt.
 *  8. Fire-and-forget: on stream completion, persist the
 *     final assistant message (with structured content
 *     parsed from the AI's output per Phase 1 §3.1),
 *     log the call to `aiGenerations`, and record the
 *     strategy turn (Phase 1 §3.2).
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

  // 2. Convex client with the Clerk JWT.
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
    sessionId,
    lessonContext,
    messages: uiMessages,
  } = parseResult.data;

  // 4. Load the chat context, the onboarding tutor profile,
  //    the strategy state (Phase 1 §3.2), and persist the
  //    latest user message — all in parallel.
  const lastUserMessage = [...uiMessages]
    .reverse()
    .find((m) => m.role === "user");
  const userMessageText =
    lastUserMessage ? extractText(lastUserMessage) : null;

  type ChatContext = NonNullable<
    Awaited<
      ReturnType<typeof convex.query<typeof api.tutor.getContextForChat>>
    >
  >;

  // Phase 4 §6.3: strat is the per-session teaching
  // strategy row. The full nullable return of
  // `getStrategyState` — `NonNullable<>` strips the
  // `null` branch produced by the `v.union(...)` schema
  // wrap so the body can dereference `strat?.field`
  // without TS errors.
  //
  // We declare this shape inline (mirroring the
  // v.object(...) in `convex/tutorStrategy.ts`) rather
  // than going through `ReturnType<typeof convex.query<...>>`,
  // because Convex's HTTP-client typing for a query with a
  // `v.union(v.object(...), v.null())` return shape resolves
  // to `never` through the ReturnType path — the inline
  // shape is unambiguous and types the dereferences
  // correctly. Keep in sync with the schema field set.
  type StrategyState = {
    readonly currentStrategy: string;
    readonly lastSwitchReason: string | null;
    readonly userEngagementScore: number;
    readonly turnsInCurrentStrategy: number;
    readonly strategyHistory: ReadonlyArray<{
      readonly strategy: string;
      readonly turns: number;
      readonly switchedAt: number;
    }>;
    readonly socraticModeActive: boolean;
    readonly latestChoiceResponseTimeMs: number | null;
    readonly latestChoicePickedCorrect: boolean | null;
    readonly latestChoiceMessageId: string | null;
    readonly lastChoiceNudgeAt: number | null;
  };

  let context: (ChatContext & { readonly tutorProfile: TutorProfileLike | null }) | null =
    null;

  // Phase 1 §3.2: strategy state is loaded in the same
  // parallel fan-out as context + profile + persistence.
  // Phase 2 §4.1: memory chronicle is also loaded in
  // this parallel fan-out.
  // Phase 4 §6.3: `strat` is hoisted to function scope so
  // the subsequent prompt-builder code (which sits AFTER
  // the try block) can read it. Declared here, assigned
  // inside the try.
  let strat: StrategyState | null = null;
  let memoryChronicle: string | undefined;
  try {
    const results = await Promise.all([
      convex.query(api.tutor.getContextForChat, {
        threadId: threadId as Id<"tutorThreads">,
        subjectId: subjectId as Id<"subjects">,
        ...(topicId ? { topicId: topicId as Id<"topics"> } : {}),
      }),
      convex
        .query(api.tutorProfile.getMine, {})
        .catch(() => null),
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
          console.warn("appendUserMessage (non-fatal):", err);
        }
      })(),
      // Phase 1 §3.2: load strategy state (best-effort).
      // `api.tutorStrategy.getStrategyState` returns
      // `v.union(v.object(...), v.null())`. Convex's
      // HTTP-client typing collapses that top-level
      // nullable union query return to `Promise<never>`,
      // which would propagate through `.catch(() => null)`
      // and the assignment below and force TypeScript's
      // Control Flow Analysis to narrow `strat` to
      // `never`. We cast the Promise itself to the
      // shape we want so the ternary evaluates to
      // `Promise<StrategyState | null>`.
      sessionId
        ? (convex
            .query(api.tutorStrategy.getStrategyState, {
              sessionId: sessionId as Id<"studySessions">,
            }) as unknown as Promise<StrategyState | null>)
            .catch(() => null)
        : Promise.resolve(null),
      // Phase 2 §4.1: load memory chronicle (best-effort).
      convex
        .query(api.tutorMemory.getMemoryChronicle, {
          subjectId: subjectId as Id<"subjects">,
          ...(topicId ? { topicId: topicId as Id<"topics"> } : {}),
        })
        .catch(() => null),
    ]);

    const chat = results[0];
    if (chat) {
      context = { ...chat, tutorProfile: (results[1] ?? null) as TutorProfileLike | null };
    }

    // Phase 2 §4.1: extract memory chronicle from the
    // parallel results. When the chronicle query returns
    // null (no progress yet), we leave the field
    // undefined so the system prompt omits the block.
    const chronicleResult = results[4] ?? null;
    if (chronicleResult && typeof chronicleResult === "object" && "narrative" in chronicleResult) {
      memoryChronicle = String((chronicleResult as { narrative: string }).narrative);
    }

    // Build strategy prompt block from the loaded state.
    // The cast to `StrategyState | null` is explicit
    // because `results[3]`'s element type is inferred
    // through `Promise.all`'s element union; without
    // the cast TypeScript CFA collapses `strat` to
    // `never` because the upstream query call carries
    // a `Promise<never>` element (see comment at the
    // `convex.query(...)` site above).
    strat = (results[3] ?? null) as StrategyState | null;
    if (!strat && sessionId) {
      // Phase 1 §3.2: first turn of the session —
      // initialise the strategy row and start with
      // the default "explaining" strategy.
      // `initStrategy` is idempotent; it skips when
      // a row already exists.
      convex
        .mutation(api.tutorStrategy.initStrategy, {
          sessionId: sessionId as Id<"studySessions">,
        })
        .catch((err) =>
          console.error("tutor route: initStrategy failed", err)
        );
    }
  } catch (err) {
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

  // 5. Build the grounded system prompt. Working language
  //    follows the user's curriculum when a profile is
  //    available, falling back to "de" for the German
  //    Gymnasium default.
  //
  // Phase 4 §6.1 — note the OWNERSHIP of the nudge
  // block: the strategy block (built below) is the
  // SINGLE source of truth for the passive-dismissal
  // nudge. The prompt builder's `activeLearningNudge`
  // option exists for testing only and is NOT passed
  // here, because the strategy block sits at the
  // extreme end of the prompt and the model already
  // reads "drop the nudge line" from there. Sending
  // both would duplicate the instruction.
  //
  // We still compute `activeLearningNudge` locally
  // (without forwarding to the prompt builder) so the
  // onEnd block below can decide whether to call
  // `clearLatestChoiceClick`.
  let activeLearningNudge:
    | {
        assistantMessageId: string;
        responseTimeMs: number;
        pickedCorrect: boolean;
      }
    | undefined;
  if (strat && strat.latestChoiceMessageId !== null) {
    const ms = strat.latestChoiceResponseTimeMs;
    if (typeof ms === "number") {
      const pickedCorrect = strat.latestChoicePickedCorrect ?? false;
      if (
        strat.latestChoiceMessageId &&
        (ms < 1000 || (ms < 2000 && pickedCorrect === false))
      ) {
        activeLearningNudge = {
          assistantMessageId: strat.latestChoiceMessageId,
          responseTimeMs: ms,
          pickedCorrect,
        };
      }
    }
  }

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
    ...(memoryChronicle ? { memoryChronicle } : {}),
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
    ...(lessonContext ? { lessonContext } : {}),
    // Phase 4 §6.3: Socratic mode toggle. The route
    // handler reads `strat.socraticModeActive` from
    // the strategy state and forwards it to the prompt
    // builder, which renders the override block in
    // the main system prompt.
    ...(strat && strat.socraticModeActive
      ? { socraticModeActive: true as const }
      : {}),
    // Phase 7 §9.2: forward the current turn count
    // so the affirmation instructions can reference
    // a concrete session-progress signal.
    ...(strat ? { turnsInCurrentStrategy: strat.turnsInCurrentStrategy } : {}),
  });

  // 6. Build the strategy block at the extreme end of
  //    the prompt. Two design decisions:
  //
  //    a) The strategy block ITSELF owns the passive-
  //       dismissal nudge injection. `latestChoice` is
  //       forwarded when `activeLearningNudge` is set
  //       so the helper can decide to render the nudge
  //       block (same threshold as the route handler).
  //       The prompt builder does NOT need to see the
  //       nudge block — the strategy block already sits
  //       at the very last token of the prompt, which
  //       is the highest attention-weight position.
  //
  //    b) The Socratic override appears in the
  //       strategy block as well (deliberately
  //       redundant with the override rendered inside
  //       the main prompt). The plan calls for the
  //       override to appear at the extreme tail of
  //       the prompt so the model's first emitted
  //       token reads it as a binding constraint.
  const fullStrategyBlock = buildStrategyPromptBlock({
    strategy:
      strat?.currentStrategy ?? (sessionId ? "explaining" : "explaining"),
    engagement: strat?.userEngagementScore ?? 0.5,
    turns: strat?.turnsInCurrentStrategy ?? 0,
    socraticModeActive: Boolean(strat?.socraticModeActive),
    ...(activeLearningNudge
      ? {
          latestChoice: {
            responseTimeMs: activeLearningNudge.responseTimeMs,
            messageId: activeLearningNudge.assistantMessageId,
            pickedCorrect: activeLearningNudge.pickedCorrect,
            lastNudgeAt: strat?.lastChoiceNudgeAt ?? null,
          },
        }
      : {}),
  });
  const fullSystemPrompt = systemPrompt + "\n" + fullStrategyBlock;

  // 7. Build the model messages.
  const modelMessages = await convertToModelMessages(uiMessages);

  // 8. Stream the response.
  const startMs = Date.now();
  const modelId = chatModel();
  const result = streamText({
    model: deepseek()(modelId),
    instructions: fullSystemPrompt,
    messages: modelMessages,
    maxOutputTokens: 1500,
    maxRetries: 2,
    abortSignal: req.signal,
    onFinish: async ({ text, usage }) => {
      try {
        const trimmed = text.trim();
        if (trimmed.length > 0) {
          let structuredContent: string | undefined;
          try {
            const parsed = parseStructuredFromText(trimmed);
            if (parsed) {
              structuredContent = JSON.stringify(parsed);
            }
          } catch {
            // Parsing failed — raw text is still valid.
          }
          await convex.mutation(api.tutor.recordAssistantMessage, {
            threadId: threadId as Id<"tutorThreads">,
            content: trimmed,
            ...(structuredContent
              ? { structuredContent }
              : {}),
          });
        }
        await logAiGeneration(convex, {
          task: "tutor.chat",
          model: modelId,
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
          latencyMs: Date.now() - startMs,
          relatedId: threadId,
          schemaValid: true,
        });

        if (sessionId) {
          const userMsgLen = userMessageText?.length ?? 0;
          convex
            .mutation(api.tutorStrategy.recordTurn, {
              sessionId: sessionId as Id<"studySessions">,
              userMessageLength: userMsgLen,
              responseTimeMs: null,
              choiceCorrect: null,
            })
            .catch((err) =>
              console.error("tutor route: strategy recordTurn failed", err)
            );

          if (activeLearningNudge) {
            convex
              .mutation(api.tutorStrategy.clearLatestChoiceClick, {
                sessionId: sessionId as Id<"studySessions">,
              })
              .catch((err) =>
                console.error(
                  "tutor route: clearLatestChoiceClick failed",
                  err
                )
              );
          }
        }
      } catch (err) {
        console.error("tutor route: onFinish persistence failed", err);
      }
    },
    onError: (err) => {
      console.error("tutor route: stream error", err);
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}

// ===========================================================================
// Helpers
// ===========================================================================

/**
 * Phase 1 §3.1: parse the AI's text output into a structured
 * object. The AI emits sections delimited by markdown
 * conventions (blank lines, bold insight, choice widgets,
 * italic next). Returns `null` when the text cannot be
 * parsed into the 5-part structure.
 */
function parseStructuredFromText(
  text: string
): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const blocks = trimmed
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (blocks.length < 2) return null;

  const explanation = blocks[0] ?? "";

  let keyInsight = "";
  let nextSuggestion = "";
  let nextActionPrompt = "";
  let affirmation: string | null = null;

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i] ?? "";
    if (block.startsWith("**💡 Key insight:")) {
      keyInsight = block.replace(/^\*\*💡 Key insight:\*\*\s*/u, "").trim();
      continue;
    }
    if (block.startsWith("_Next:") && block.endsWith("_")) {
      const inner = block.slice(6, -1).trim();
      const tryIdx = inner.indexOf('— try: "');
      if (tryIdx > 0) {
        nextSuggestion = inner.slice(0, tryIdx).trim();
        nextActionPrompt = inner
          .slice(tryIdx + 8)
          .replace(/"$/, "")
          .trim();
      } else {
        nextSuggestion = inner;
      }
      continue;
    }
    if (block.startsWith("> ")) {
      affirmation = block.slice(2).trim();
      continue;
    }
  }

  if (!explanation || !keyInsight) return null;

  return {
    explanation,
    keyInsight,
    nextSuggestion: nextSuggestion || "Continue studying",
    nextActionPrompt:
      nextActionPrompt || "Let's keep going with the next concept.",
    ...(affirmation ? { affirmation } : {}),
    _rawText: trimmed,
    _hasCheck: blocks.some((b) => b.startsWith("[[choice:")),
    _hasVisual: blocks.some(
      (b) =>
        b.startsWith("[[formula:") ||
        b.startsWith("[[steps:") ||
        b.startsWith("[[diagram:") ||
        b === "(no visual needed)"
    ),
  };
}

// ===========================================================================
// Types & helpers
// ===========================================================================

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
