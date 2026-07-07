import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { gradeAnswer } from "@/lib/ai/invoke";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  runId: z.string().min(1),
  itemId: z.string().min(1),
  userAnswer: z.string().min(1).max(8000),
});

/**
 * POST /api/topics/practice/grade.
 *
 * 1. Verifies the run + item combo (run belongs to caller,
 *    item belongs to run).
 * 2. Calls the grader (`gradeAnswer` from invoke.ts) with
 *    the lesson excerpt + rubric the item carries.
 * 3. On success, invokes
 *    `api.practice.submitAnswerAndGrade` to persist the
 *    attempt + mistake entry.
 * 4. On Zod failure at the AI layer (plan §11), passes a
 *    degraded grade (verdict=partially_correct,
 *    score=0.5, "I couldn't grade this one") so the
 *    student always sees a clear path forward.
 * 5. Returns the unified grade shape.
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
  const { runId, itemId, userAnswer } = parsed.data;

  // 1. Pull the item to surface prompt + rubric + answer
  //    to the grader. The practice module exposes a
  //    server-side helper to do this in one round trip.
  type ItemForGrade = {
    prompt: string;
    expectedAnswer: string;
    skill: string;
    rubric: string[];
    lessonExcerpt: string;
    subjectSlug: string;
  } | null;

  let itemContext: ItemForGrade = null;
  try {
    itemContext = (await convex.query(api.practice.getItemForGrading, {
      runId: runId as Id<"topicLessonPractice">,
      itemId: itemId as Id<"practiceItems">,
    })) as ItemForGrade;
  } catch (err) {
    console.error("/api/topics/practice/grade: getItemForGrading failed", err);
  }
  if (!itemContext) {
    return new Response("Run or item not found", { status: 404 });
  }

  // 2. Run the grader (atomic — `generateObject`).
  const ai = await gradeAnswer(
    convex,
    {
      lessonExcerpt: itemContext.lessonExcerpt,
      prompt: itemContext.prompt,
      expectedAnswer: itemContext.expectedAnswer,
      rubric: itemContext.rubric,
      userAnswer,
      language: "de",
      subjectSlug: itemContext.subjectSlug,
    },
    runId
  );

  // Zod or AI failure: surface a degraded grade per plan
  // §11. The student sees a "I couldn't grade this one"
  // feedback and a clear path to the tutor.
  const grade = ai.ok
    ? ai.value
    : {
        verdict: "partially_correct" as const,
        score: 0.5,
        feedback:
          "I couldn't grade this answer cleanly — please ask the tutor or retry.",
        betterAnswer:
          itemContext.expectedAnswer.length > 0
            ? itemContext.expectedAnswer.slice(0, 800)
            : "Anchor your answer against the lesson section.",
        mistakeType: null as null,
        cause: null as null,
      };

  // 3. Persist. Fall through if the mutation fails so
  //    the client still surfaces a degraded grade view.
  try {
    const result = await convex.mutation(api.practice.submitAnswerAndGrade, {
      runId: runId as Id<"topicLessonPractice">,
      itemId: itemId as Id<"practiceItems">,
      userAnswer,
      grade,
    });
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("/api/topics/practice/grade: mutation failed", err);
    return new Response(
      JSON.stringify({
        attemptId: null,
        verdict: grade.verdict,
        score: grade.score,
        feedback: grade.feedback,
        betterAnswer: grade.betterAnswer,
        mistakeEntryId: null,
        degraded: true,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
