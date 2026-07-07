import { NextRequest } from "next/server";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
} from "ai";
import { z } from "zod";

import { deepseek } from "@/lib/ai/provider";
import { chatModel } from "@/lib/ai/models";
import { extractText } from "@/lib/ai/uiMessage";
import { verifyAuth } from "./_lib/authMiddleware";
import { loadChatContext } from "./_lib/contextLoader";
import { buildFullSystemPrompt } from "./_lib/promptBuilder";
import { createOnFinishHandler } from "./_lib/onFinishPipeline";

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
  /** Special mode: when set, the tutor uses mode-specific instructions. */
  mode: z.enum(["default", "summarize", "exam", "compare"]).optional(),
  /** Options for special modes (e.g., task count for exam mode). */
  modeOptions: z
    .object({
      taskCount: z.number().min(1).max(8).optional(),
    })
    .optional(),
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
 *  1. Auth check via Clerk (using `verifyAuth` helper).
 *  2. Parse + Zod-validate the request body.
 *  3. Load the chat context, strategy state, and memory
 *     chronicle (via `loadChatContext`).
 *  4. Build the grounded system prompt with strategy block
 *     (via `buildFullSystemPrompt`).
 *  5. Call `streamText` with the enriched system prompt.
 *  6. On stream completion, persist the assistant message,
 *     log telemetry, and record strategy turn
 *     (via `createOnFinishHandler`).
 */
export async function POST(req: NextRequest) {
  // 1. Auth check.
  const authResult = await verifyAuth();
  if (authResult instanceof Response) return authResult;
  const { convex } = authResult;

  // 2. Parse + Zod-validate the request.
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
    mode,
    modeOptions,
    lessonContext,
    messages: uiMessages,
  } = parseResult.data;

  // 3. Find the last user message for persistence.
  const lastUserMessage = [...uiMessages]
    .reverse()
    .find((m) => m.role === "user");
  const userMessageText =
    lastUserMessage ? extractText(lastUserMessage) : null;

  // 4. Load context, strategy state, and memory chronicle
  //    (parallel fan-out inside the helper).
  const ctxResult = await loadChatContext(convex, {
    threadId,
    subjectId,
    topicId,
    sessionId,
    lastUserMessage: lastUserMessage
      ? { id: lastUserMessage.id, role: lastUserMessage.role }
      : null,
    userMessageText,
  });
  if (ctxResult.kind === "error") return ctxResult.response;
  const { context, strat, memoryChronicle } = ctxResult;

  // 5. Build the grounded system prompt with strategy block.
  const fullSystemPrompt = buildFullSystemPrompt({
    context,
    strat,
    memoryChronicle,
    sessionId,
    lessonContext,
    mode,
    modeOptions,
  });

  // 6. Build the model messages.
  const modelMessages = await convertToModelMessages(uiMessages);

  // 7. Stream the response.
  const startMs = Date.now();
  const modelId = chatModel();

  const onFinish = createOnFinishHandler(convex, {
    threadId,
    sessionId,
    modelId,
    startMs,
    userMessageText,
    strat,
    mode,
  });

  const result = streamText({
    model: deepseek()(modelId),
    instructions: fullSystemPrompt,
    messages: modelMessages,
    maxOutputTokens: mode === "exam" ? 2500 : (mode === "compare" || mode === "summarize" ? 2000 : 1500),
    maxRetries: 2,
    abortSignal: req.signal,
    onFinish,
    onError: (err) => {
      console.error("tutor route: stream error", err);
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
