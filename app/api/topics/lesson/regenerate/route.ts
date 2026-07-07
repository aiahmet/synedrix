import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { streamObject, type StreamObjectResult } from "ai";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { deepseek } from "@/lib/ai/provider";
import { chatModel } from "@/lib/ai/models";
import {
  buildCourseLessonPrompt,
  lessonSchema,
} from "@/lib/ai/prompts/lesson";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  topicId: z.string().min(1),
  depth: z.union([z.literal("simple"), z.literal("standard"), z.literal("rigorous")]),
  title: z.string().min(1),
  brief: z.string().min(1).max(2000),
  subjectTitle: z.string().min(1),
  subjectSlug: z.string().min(1),
  gradeLevel: z.string().optional(),
  objectives: z.array(z.string()).optional(),
  difficulty: z.union([z.literal("EASY"), z.literal("MEDIUM"), z.literal("HARD")]),
});

/**
 * POST /api/topics/lesson/regenerate.
 *
 * Streams a fresh lesson for an existing user-owned
 * topic via `streamObject`. On stream completion,
 * invokes `api.topics.regenerateTopicLesson` to write a
 * NEW `topicLessons.version`. The old version is
 * preserved (immutable history per plan §3.2).
 *
 * Same shape as `/api/topics/lesson/stream`.
 */
export async function POST(req: NextRequest) {
  const { userId: clerkId, getToken } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return new Response("Convex is not configured", { status: 500 });

  const token = await getToken({ template: "convex" }).catch(() => null);
  const convex = new ConvexHttpClient(convexUrl);
  if (token) convex.setAuth(token);

  const parsed = requestSchema.safeParse(
    await req.json().catch(() => null)
  );
  if (!parsed.success) return new Response("Bad request", { status: 400 });
  const input = parsed.data;

  const startedAt = Date.now();
  const modelId = chatModel();
  let so: StreamObjectResult<unknown, unknown, never> | null = null;
  try {
    so = streamObject({
      model: deepseek()(modelId),
      schema: lessonSchema,
      system: buildCourseLessonPrompt({
        subjectTitle: input.subjectTitle,
        subjectSlug: input.subjectSlug,
        topicTitle: input.title,
        brief: input.brief,
        objectives: input.objectives ?? [],
        gradeLevel: input.gradeLevel ?? null,
        difficulty: input.difficulty,
        depth: input.depth,
        language: "de",
      }),
      prompt:
        "Generate the lesson now. Return ONLY the structured object — no preamble.",
      maxOutputTokens: 5000,
      abortSignal: req.signal,
    });
  } catch (err) {
    console.error("lesson regenerate: streamObject init failed", err);
    return new Response("Internal error", { status: 500 });
  }
  const r = so;

  void (async () => {
    try {
      if (req.signal.aborted) return;
      // AI SDK v7: final object lives at `result.object`.
      const finalObject = await r.object;
      if (req.signal.aborted) return;

      const parseResult = lessonSchema.safeParse(finalObject);
      if (!parseResult.success) {
        console.error(
          "lesson regenerate: final object failed Zod",
          parseResult.error.message
        );
        // Skip commit on a malformed regenerate so we
        // don't bloat history with a degraded row.
        return;
      }

      await convex.mutation(api.topics.regenerateTopicLesson, {
        topicId: input.topicId as Id<"topics">,
        depth: input.depth,
        model: modelId,
        lesson: parseResult.data,
      });
    } catch (err) {
      console.error("lesson regenerate: background commit failed", err);
    } finally {
      try {
        const usage = await r.usage;
        await convex.mutation(api.telemetry.recordAiGeneration, {
          task: "generateCourseLesson",
          model: modelId,
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
          latencyMs: Date.now() - startedAt,
          schemaValid: true,
          relatedId: input.topicId,
        });
      } catch {}
    }
  })();

  return r.toTextStreamResponse();
}
