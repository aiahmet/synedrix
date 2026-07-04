import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { streamText, convertToModelMessages } from "ai";
import { ConvexError } from "convex/values";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { openrouter } from "@/lib/ai/provider";
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
  messages: z.array(z.any()),
});

/**
 * POST /api/tutor/chat.
 *
 * Streams an OpenRouter tutor reply for a thread. Steps:
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
  const { threadId, subjectId, topicId, messages: uiMessages } = parseResult.data;

  // 4. Load the chat context and persist the latest user
  //    message in parallel. They touch different tables and
  //    have no ordering dependency — a request that fails
  //    one can still surface the other, and the user
  //    message is already in the canonical store by the
  //    time the model starts generating, so a refresh
  //    during streaming keeps it visible.
  const lastUserMessage = [...uiMessages]
    .reverse()
    .find((m) => m.role === "user");
  const userMessageText =
    lastUserMessage ? extractText(lastUserMessage) : null;

  let context;
  try {
    [context] = await Promise.all([
      convex.query(api.tutor.getContextForChat, {
        threadId: threadId as Id<"tutorThreads">,
        subjectId: subjectId as Id<"subjects">,
        ...(topicId ? { topicId: topicId as Id<"topics"> } : {}),
      }),
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
  //    defaults to German; this is a Gymnasium-targeted
  //    app and the rest of the UI is German-first.
  const systemPrompt = buildChatSystemPrompt({
    subjectTitle: context.subject.title,
    subjectSlug: context.subject.slug,
    topicTitle: context.topic?.title ?? null,
    topicSlug: context.topic?.slug ?? null,
    objectives: context.topic?.objectives ?? [],
    difficulty: context.topic?.difficulty ?? null,
    gradeLevel: context.topic?.gradeLevel ?? null,
    language: "de",
    mastery: context.mastery,
    confidence: context.confidence,
    recentMistakes: context.recentMistakes,
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
    model: openrouter()(modelId),
    system: systemPrompt,
    messages: modelMessages,
    // Cap output at a reasonable length so a runaway
    // generation cannot blow up the response or the bill.
    maxOutputTokens: 1500,
    // Light retry behavior for transient provider errors.
    maxRetries: 2,
    abortSignal: req.signal,
  });

  // 9. Fire-and-forget: persist the final assistant
  //    message + log the call to `aiGenerations` once the
  //    stream finishes. The client already has the live
  //    stream; this just makes it durable.
  //
  //    ** Trade-off **: on serverless platforms (Vercel
  //    Functions, AWS Lambda) the function instance can be
  //    recycled after the response is flushed, which would
  //    kill this IIFE before it persists the assistant
  //    message and the AiGeneration row. To eliminate the
  //    risk we would need a Convex action (or
  //    `ctx.scheduler.runAfter` from inside a Convex
  //    function), which requires rearchitecting the
  //    persistence path. For now the data is best-effort:
  //    the client already has the live stream, so a missed
  //    write is recoverable from a manual re-send in the
  //    support flow. Logged failures are the safety net.
  void (async () => {
    try {
      // If the client disconnected mid-stream, do not persist
      // a half-formed assistant message. The client also
      // aborts, so its local state stays consistent.
      if (req.signal.aborted) return;

      const finalText = await result.text;
      if (req.signal.aborted) return;
      const trimmed = finalText.trim();
      if (trimmed.length > 0) {
        await convex.mutation(api.tutor.recordAssistantMessage, {
          threadId: threadId as Id<"tutorThreads">,
          content: trimmed,
        });
      }
      const usage = await result.usage;
      // In ai@5+, the usage shape is { inputTokens, outputTokens, totalTokens }.
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
      console.error("tutor route: post-stream persistence failed", err);
    }
  })();

  // 10. Return the streaming response to the client.
  return result.toUIMessageStreamResponse();
}
