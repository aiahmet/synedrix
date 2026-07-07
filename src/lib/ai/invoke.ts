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
  type PracticeFromConversationPromptInput,
  buildPracticeFromConversationPrompt,
} from "./prompts/practice";
import {
  gradingSchema,
  type GradingShape,
  type GradingPromptInput,
  buildGradingPrompt,
} from "./prompts/grading";
import {
  arenaPracticeItemsSchema,
  type ArenaPracticeItemsShape,
  type ArenaPracticePromptInput,
  buildArenaPracticePrompt,
  buildEssayAnalysisPrompt,
  buildTranslationDrillPrompt,
  buildFormulaDerivationPrompt,
  buildOralRecallPrompt,
  buildMixedTopicPracticePrompt,
  buildArenaGradingPrompt,
  type IndividualPromptInput,
  type ArenaGradingPromptInput,
} from "./prompts/practiceArena";


const LESSON_MAX_OUTPUT_TOKENS = 5000;
const PRACTICE_MAX_OUTPUT_TOKENS = 1500;
const GRADING_MAX_OUTPUT_TOKENS = 800;
const ARENA_PRACTICE_MAX_OUTPUT_TOKENS = 2000;

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

export interface StreamLessonOptions {
  readonly abortSignal?: AbortSignal;
}

export function streamLesson(
  convex: ConvexHttpClient,
  input: CourseLessonPromptInput,
  options: StreamLessonOptions = {}
) {
  const startMs = Date.now();
  const modelId = chatModel();  
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

  void (async () => {
    try {
      const usage = await result.usage;
      clearTimeout(timeoutId);
      const finalObject = await result.object;
      const schemaOk = lessonSchema.safeParse(finalObject).success;
      await recordGeneration(convex, {
        task: "generateCourseLesson",
        model: modelId,
        usage: {
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
        },
        latencyMs: Date.now() - startMs,
        schemaValid: schemaOk,
      });
    } catch {
      clearTimeout(timeoutId);
      try {
        await recordGeneration(convex, {
          task: "generateCourseLesson",
          model: modelId,
          usage: { inputTokens: 0, outputTokens: 0 },
          latencyMs: Date.now() - startMs,
          schemaValid: false,
        });
      } catch {}
    }
  })();

  return result;
}

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

export async function generatePracticeFromConversation(
  convex: ConvexHttpClient,
  input: PracticeFromConversationPromptInput,
  relatedId: string
): Promise<InvokeResult<PracticeItemsShape>> {
  const startMs = Date.now();
  const modelId = chatModel();
  try {
    const result = await generateObject({
      model: deepseek()(modelId),
      schema: practiceItemsSchema,
      system: buildPracticeFromConversationPrompt(input),
      prompt:
        "Generate the practice bundle now. Return ONLY the structured object — no preamble.",
      maxOutputTokens: PRACTICE_MAX_OUTPUT_TOKENS,
    });
    const value = result.object;
    const usage = result.usage;
    try {
      practiceItemsSchema.parse(value);
      await recordGeneration(convex, {
        task: "generateInlineTutorPractice",
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
        task: "generateInlineTutorPractice",
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

export async function generateArenaPractice(
  convex: ConvexHttpClient,
  input: ArenaPracticePromptInput
): Promise<InvokeResult<ArenaPracticeItemsShape>> {
  const startMs = Date.now();
  const modelId = chatModel();
  try {
    const result = await generateObject({
      model: deepseek()(modelId),
      schema: arenaPracticeItemsSchema,
      system: buildArenaPracticePrompt(input),
      prompt:
        "Generate the practice bundle now. Return ONLY the structured object — no preamble.",
      maxOutputTokens: ARENA_PRACTICE_MAX_OUTPUT_TOKENS,
    });
    const value = result.object;
    const usage = result.usage;
    try {
      arenaPracticeItemsSchema.parse(value);
      await recordGeneration(convex, {
        task: "generateArenaPractice",
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
        task: "generateArenaPractice",
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

export async function generateArenaGrade(
  convex: ConvexHttpClient,
  input: ArenaGradingPromptInput,
  relatedId: string
): Promise<InvokeResult<GradingShape>> {
  const startMs = Date.now();
  const modelId = chatModel();
  try {
    const result = await generateObject({
      model: deepseek()(modelId),
      schema: gradingSchema,
      system: buildArenaGradingPrompt(input),
      prompt:
        "Grade the answer now. Return ONLY the structured object — no preamble.",
      maxOutputTokens: GRADING_MAX_OUTPUT_TOKENS,
    });
    const value = result.object;
    const usage = result.usage;
    try {
      gradingSchema.parse(value);
      await recordGeneration(convex, {
        task: "gradeArenaPractice",
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
        task: "gradeArenaPractice",
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

export {
  lessonSchema,
  practiceItemsSchema,
  gradingSchema,
  arenaPracticeItemsSchema,
  buildEssayAnalysisPrompt,
  buildTranslationDrillPrompt,
  buildFormulaDerivationPrompt,
  buildOralRecallPrompt,
  buildMixedTopicPracticePrompt,
  buildArenaGradingPrompt,
};
export type { LessonShape, PracticeItemsShape, GradingShape };
export type { IndividualPromptInput, ArenaGradingPromptInput };
