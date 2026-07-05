import { ConvexHttpClient } from "convex/browser";
import { generateObject, streamObject } from "ai";

import { deepseek } from "./provider";
import { chatModel } from "./models";
import { logAiGeneration } from "./telemetry";

import {
  lessonSchema,
  type LessonShape,
  type CourseLessonPromptInput,
  buildCourseLessonPrompt,
} from "./prompts/lesson";
import {
  practiceItemsSchema,
  type PracticeItemsShape,
  type PracticeFromLessonPromptInput,
  buildPracticeFromLessonPrompt,
} from "./prompts/practice";
import {
  gradingSchema,
  type GradingShape,
  type GradingPromptInput,
  buildGradingPrompt,
} from "./prompts/grading";

/**
 * invoke.ts.
 *
 * The single place where the AI SDK calls into DeepSeek
 * for `generateCourseLesson`, `generatePracticeFromLesson`,
 * and `gradeAnswer`. Per AGENTS.md:
 *
 *  - "Structured outputs: Always use `generateObject` or
 *    `streamObject` with Zod schemas. Never trust raw LLM
 *    text for structured data."
 *  - "Telemetry: Wrap all AI calls via
 *    `src/lib/ai/telemetry.ts`."
 *  - "No hand-rolled fetch."
 *
 * Centralizes the "wrap-with-telemetry, validate Zod"
 * rule so the Convex mutations stay free of AI plumbing
 * noise and so the schema-validation contract is the
 * same for every task.
 *
 * Callers pass an already-authenticated ConvexHttpClient
 * (mirrors the chat route handler — Clerk JWT set via
 * `convex.setAuth(token)`). The telemetry write fails
 * soft inside `logAiGeneration` so a telemetry outage
 * cannot break the AI call itself.
 */

/** Per-task maxOutputTokens caps from plan §11. */
const LESSON_MAX_OUTPUT_TOKENS = 5000;
const PRACTICE_MAX_OUTPUT_TOKENS = 1500;
const GRADING_MAX_OUTPUT_TOKENS = 800;

export type InvokeResult<T> =
  | { readonly ok: true; readonly value: T; readonly schemaValid: true }
  | {
      readonly ok: false;
      readonly reason: "zod_failed";
      readonly schemaValid: false;
    }
  | {
      readonly ok: false;
      readonly reason: "ai_error";
      readonly error: unknown;
      readonly schemaValid: false;
    };

/**
 * Internal: call `logAiGeneration` only on success OR when
 * Zod failed (so we can monitor the failure rate per plan §8).
 * Skip on hard AI error — we have no model/usage to report.
 */
async function recordGeneration(
  convex: ConvexHttpClient,
  args: {
    task: string;
    model: string;
    usage: { inputTokens: number; outputTokens: number };
    latencyMs: number;
    schemaValid: boolean;
    relatedId?: string;
  }
): Promise<void> {
  await logAiGeneration(convex, {
    task: args.task,
    model: args.model,
    inputTokens: args.usage.inputTokens,
    outputTokens: args.usage.outputTokens,
    latencyMs: args.latencyMs,
    schemaValid: args.schemaValid,
    ...(args.relatedId !== undefined ? { relatedId: args.relatedId } : {}),
  });
}

/**
 * Options for `streamLesson`.
 *
 * `abortSignal` lets the caller (typically a Next.js
 * Route Handler) cancel the AI run when the client
 * disconnects, which would otherwise burn per-call
 * tokens to the end of an unobserved stream. Without
 * an explicit signal we still cap the run at
 * 120 seconds via `AbortSignal.timeout` so a wedged
 * network cannot leak unbounded usage.
 */
export interface StreamLessonOptions {
  readonly abortSignal?: AbortSignal;
}

/**
 * Stream a lesson back to the caller. Returns the
 * Vercel AI SDK `streamObject` result object — the
 * caller (route handler) calls `.toTextStreamResponse()`
 * to stream the live event-stream OR awaits `.object`
 * to get the final structured value for canonical
 * persistence.
 *
 * Telemetry fires once and is recorded in
 * `aiGenerations` regardless of what the caller does
 * with the result. We catch and log telemetry
 * failures so a one-off logging outage cannot break
 * the AI call itself.
 */
export function streamLesson(
  convex: ConvexHttpClient,
  input: CourseLessonPromptInput,
  options: StreamLessonOptions = {}
) {
  const startMs = Date.now();
  const modelId = chatModel();
  // Combine caller-supplied cancellation with a hard
  // 2-minute cap so a disconnected client never burns
  // tokens to the end of a still-emitting stream.
  const linkedController = new AbortController();
  const timeoutId = setTimeout(() => linkedController.abort(), 120_000);
  options.abortSignal?.addEventListener("abort", () => linkedController.abort());
  const result = streamObject({
    model: deepseek()(modelId),
    schema: lessonSchema,
    system: buildCourseLessonPrompt(input),
    prompt:
      "Generate the lesson now. Return ONLY the structured object — no preamble, no commentary.",
    maxOutputTokens: LESSON_MAX_OUTPUT_TOKENS,
    abortSignal: linkedController.signal,
  });

  // Fire-and-forget telemetry: we record usage + latency
  // once the stream settles. Validation lives here (not
  // in the route handler) so the caller does not need
  // to re-validate Zod just to record the schemaValid
  // flag. AI SDK v7's `result.object` is the Promise<T>
  // for the final structured value.
  void (async () => {
    try {
      const [usage, finalObject] = await Promise.all([
        result.usage,
        result.object,
      ]);
      clearTimeout(timeoutId);
      const schemaValid = (() => {
        try {
          lessonSchema.parse(finalObject);
          return true;
        } catch {
          return false;
        }
      })();
      await recordGeneration(convex, {
        task: "generateCourseLesson",
        model: modelId,
        usage: {
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
        },
        latencyMs: Date.now() - startMs,
        schemaValid,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("streamLesson: telemetry failed", err);
    }
  })();

  return result;
}

/**
 * Generate the practice-item bundle for a lesson (atomic).
 * Returns a discriminated result so callers (the
 * `startLessonPractice` mutation in `convex/practice.ts`)
 * can decide whether to commit a degraded practice run.
 */
export async function generatePracticeFromLesson(
  convex: ConvexHttpClient,
  input: PracticeFromLessonPromptInput
): Promise<InvokeResult<PracticeItemsShape>> {
  const startMs = Date.now();
  const modelId = chatModel();
  try {
    const result = await generateObject({
      model: deepseek()(modelId),
      schema: practiceItemsSchema,
      system: buildPracticeFromLessonPrompt(input),
      prompt:
        "Generate the practice bundle now. Return ONLY the structured object — no preamble.",
      maxOutputTokens: PRACTICE_MAX_OUTPUT_TOKENS,
    });
    const value = result.object;
    const usage = result.usage;
    // Run the schema a second time on the returned value.
    // `generateObject` already validated against the schema,
    // but the additional Zod.parse is the explicit contract
    // surface for the caller. If it ever passes here, the
    // SDK satisfied the schema and the detected failure
    // ratio in our `aiGenerations` table would be zero.
    try {
      practiceItemsSchema.parse(value);
      await recordGeneration(convex, {
        task: "generatePracticeFromLesson",
        model: modelId,
        usage: {
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
        },
        latencyMs: Date.now() - startMs,
        schemaValid: true,
      });
      return { ok: true, value, schemaValid: true };
    } catch {
      await recordGeneration(convex, {
        task: "generatePracticeFromLesson",
        model: modelId,
        usage: {
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
        },
        latencyMs: Date.now() - startMs,
        schemaValid: false,
      });
      return { ok: false, reason: "zod_failed", schemaValid: false };
    }
  } catch (err) {
    return {
      ok: false,
      reason: "ai_error",
      error: err,
      schemaValid: false,
    };
  }
}

/**
 * Grade one student answer. Atomic. Returns the same
 * discriminated shape as `generatePracticeFromLesson`
 * so `submitAnswerAndGrade` can apply the surface-area
 * fallback described in plan §11 ("Zod fails on grading":
 * save attempt with verdict=partially_correct, etc.).
 */
export async function gradeAnswer(
  convex: ConvexHttpClient,
  input: GradingPromptInput,
  relatedId: string
): Promise<InvokeResult<GradingShape>> {
  const startMs = Date.now();
  const modelId = chatModel();
  try {
    const result = await generateObject({
      model: deepseek()(modelId),
      schema: gradingSchema,
      system: buildGradingPrompt(input),
      prompt:
        "Grade the answer now. Return ONLY the structured object — no preamble.",
      maxOutputTokens: GRADING_MAX_OUTPUT_TOKENS,
    });
    const value = result.object;
    const usage = result.usage;
    try {
      gradingSchema.parse(value);
      await recordGeneration(convex, {
        task: "gradeAnswer",
        model: modelId,
        usage: {
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
        },
        latencyMs: Date.now() - startMs,
        schemaValid: true,
        relatedId,
      });
      return { ok: true, value, schemaValid: true };
    } catch {
      await recordGeneration(convex, {
        task: "gradeAnswer",
        model: modelId,
        usage: {
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
        },
        latencyMs: Date.now() - startMs,
        schemaValid: false,
        relatedId,
      });
      return { ok: false, reason: "zod_failed", schemaValid: false };
    }
  } catch (err) {
    return {
      ok: false,
      reason: "ai_error",
      error: err,
      schemaValid: false,
    };
  }
}

/** Re-export the schemas so route handlers can parse
 *  artificial fallback values without re-importing. */
export { lessonSchema, practiceItemsSchema, gradingSchema };
export type { LessonShape, PracticeItemsShape, GradingShape };
