import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { generateArenaGrade } from "@/lib/ai/invoke";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  runId: z.string().min(1),
  itemId: z.string().min(1),
  userAnswer: z.string().min(1).max(8000),
});

export async function POST(req: NextRequest) {
  const { userId: clerkId, getToken } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return new Response("Convex is not configured", { status: 500 });
  }

  const token = await getToken({ template: "convex" }).catch(() => null);
  const convex = new ConvexHttpClient(convexUrl);
  if (token) convex.setAuth(token);

  const parsed = requestSchema.safeParse(
    await req.json().catch(() => null)
  );
  if (!parsed.success) {
    return new Response("Bad request", { status: 400 });
  }

  const { runId, itemId, userAnswer } = parsed.data;

  const runData = (await convex
    .query(api.practiceArena.getArenaRun, {
      runId: runId as Id<"topicLessonPractice">,
    })
    .catch(() => null)) as {
    practiceSetId: string;
    status: string;
    topicId: string;
  } | null;

  if (!runData) {
    return new Response("Run not found", { status: 404 });
  }

  const items = await convex.query(api.practiceArena.getArenaRunItems, {
    runId: runId as Id<"topicLessonPractice">,
  });

  const item = items.find((i: { itemId: string }) => i.itemId === itemId) ?? null;
  if (!item) {
    return new Response("Item not found", { status: 404 });
  }

  let subjectSlug: string | undefined;
  try {
    subjectSlug =
      (await convex
        .query(api.practiceArena.getSubjectSlugForTopic, {
          topicId: runData.topicId as Id<"topics">,
        })
        .catch(() => null)) ?? undefined;
  } catch {
    subjectSlug = undefined;
  }

  const fallbackGrade = {
    verdict: "partially_correct" as const,
    score: 0.5,
    feedback:
      "I couldn't grade this answer cleanly — please ask the tutor or retry.",
    betterAnswer:
      item.expectedAnswer.length > 0
        ? item.expectedAnswer.slice(0, 800)
        : "Anchor your answer against the lesson section.",
  };

  let grade: {
    verdict: "correct" | "partially_correct" | "incorrect";
    score: number;
    feedback: string;
    betterAnswer: string;
  };

  try {
    const ai = await generateArenaGrade(
      convex,
      {
        itemType: item.type as "essay_analysis" | "translation_drill" | "formula_derivation" | "oral_recall" | "user_text_answer" | "mcq" | "fill_blank" | "step_problem" | "short_answer",
        prompt: item.prompt,
        expectedAnswer: item.expectedAnswer,
        rubric: item.rubric,
        userAnswer,
        options: item.options,
        wordCountTarget: item.wordCountTarget,
        sourcePhrase: item.sourcePhrase,
        startingExpression: item.startingExpression,
        language: "de",
        subjectSlug,
      },
      runId
    );
    grade = ai.ok ? ai.value : fallbackGrade;
  } catch {
    grade = fallbackGrade;
  }

  try {
    const result = await convex.mutation(
      api.practiceArena.recordArenaAttempt,
      {
        runId: runId as Id<"topicLessonPractice">,
        practiceSetId: runData.practiceSetId as Id<"practiceSets">,
        itemId: itemId as Id<"practiceItems">,
        userAnswer,
        verdict: grade.verdict,
        score: grade.score,
        feedback: grade.feedback,
        betterAnswer: grade.betterAnswer,
      }
    );

    return new Response(
      JSON.stringify({
        attemptId: result.attemptId,
        verdict: grade.verdict,
        score: grade.score,
        feedback: grade.feedback,
        betterAnswer: grade.betterAnswer,
        mistakeEntryId: null,
        runFinished: result.runFinished,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("/api/practice/arena/grade: mutation failed", err);
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
