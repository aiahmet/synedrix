import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { gradeAnswer } from "@/lib/ai/invoke";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/tutor/practice/grade.
 *
 * Phase 3 §5.2: grades one inline-practice answer.
 *
 * Flow:
 *   1. Auth + Convex client (same pattern as the chat
 *      route handler).
 *   2. Resolve the per-item grading input via
 *      `api.tutorPractice.getInlineItemForGrading`.
 *   3. Call `gradeAnswer` (existing AI plumbing in
 *      `src/lib/ai/invoke.ts`) which validates against
 *      `gradingSchema`. Per AGENTS.md we never trust
 *      raw LLM text for structured data.
 *   4. Persist via `api.tutorPractice.recordInlineAttempt`,
 *      which writes the `practiceAttempts` row +
 *      (optionally) the `mistakeEntries` row.
 *
 * Idempotency: we do NOT enforce single-attempt here —
 * a user can re-submit an answer; the per-item latest
 * attempt query surfaces the most recent one. Mirrors
 * canonical practice behavior.
 */
const requestSchema = z.object({
  sessionId: z.string().min(1),
  itemId: z.string().min(1),
  userAnswer: z.string().min(1).max(8000),
  /**
   * The lesson "excerpt" the grader sees. Inline
   * practice has no `topicLessons` row, so we send the
   * model's `expectedAnswer` for the item — the same
   * fallback canonical baseline practice uses.
   */
  lessonExcerpt: z.union([z.string(), z.null()]).optional(),
  language: z.string().min(2).max(8),
});

export async function POST(req: NextRequest) {
  const { userId: clerkId, getToken } = await auth();
  if (!clerkId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return new Response("Convex is not configured", { status: 500 });
  }

  const token = await getToken({ template: "convex" }).catch(() => null);
  const convex = new ConvexHttpClient(convexUrl);
  if (token) convex.setAuth(token);

  const parseResult = requestSchema.safeParse(
    await req.json().catch(() => null)
  );
  if (!parseResult.success) {
    return new Response("Bad request", { status: 400 });
  }
  const body = parseResult.data;

  // Branded ids for the Convex query + mutation. Zod
  // accepted these as strings; the cast is the
  // explicit boundary.
  const sessionId = body.sessionId as Id<"inlineTutorSessions">;
  const itemId = body.itemId as Id<"practiceItems">;

  // 1. Resolve per-item grading input.
  const gradingInput = await convex
    .query(api.tutorPractice.getInlineItemForGrading, {
      sessionId,
      itemId,
    })
    .catch(() => null);

  if (!gradingInput) {
    return new Response("Item not found or forbidden", { status: 404 });
  }

  // 2. Grade. The fallback `lessonExcerpt` is the model's
  // own expected answer so the grader has grounding text
  // even when the caller did not pass one.
  const excerpt =
    body.lessonExcerpt && body.lessonExcerpt.length > 0
      ? body.lessonExcerpt
      : gradingInput.expectedAnswer;

  const result = await gradeAnswer(
    convex,
    {
      lessonExcerpt: excerpt,
      prompt: gradingInput.prompt,
      expectedAnswer: gradingInput.expectedAnswer,
      rubric: gradingInput.rubric,
      userAnswer: body.userAnswer,
      language: body.language,
    },
    sessionId
  );

  if (!result.ok) {
    // `result.error` only exists on the `ai_error`
    // branch — narrow before deref.
    if (result.reason === "zod_failed") {
      console.error("[tutor/practice/grade] AI output failed Zod validation");
    } else if (result.reason === "ai_error") {
      console.error("[tutor/practice/grade] AI call failed", result.error);
    }
    return new Response("AI grading failed", { status: 502 });
  }

  // 3. Persist the attempt.
  try {
    const persisted = await convex.mutation(
      api.tutorPractice.recordInlineAttempt,
      {
        sessionId,
        itemId,
        userAnswer: body.userAnswer,
        grade: {
          verdict: result.value.verdict,
          score: result.value.score,
          feedback: result.value.feedback,
          betterAnswer: result.value.betterAnswer,
          mistakeType: result.value.mistakeType,
          cause: result.value.cause,
        },
      }
    );
    return Response.json({
      verdict: persisted.verdict,
      score: persisted.score,
      feedback: persisted.feedback,
      betterAnswer: persisted.betterAnswer,
      mistakeEntryId: persisted.mistakeEntryId,
    });
  } catch (err) {
    console.error("[tutor/practice/grade] persistence failed", err);
    return new Response("Persistence failed", { status: 500 });
  }
}
