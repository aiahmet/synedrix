import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { generateArenaPractice } from "@/lib/ai/invoke";
import type { ArenaMode, ArenaQuestionType } from "@/lib/ai/prompts/practiceArena";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const arenaModeSchema = z.enum([
  "sequential",
  "timed",
  "retry_wrong",
  "exam_simulation",
]);
const questionTypeSchema = z.enum([
  "essay_analysis",
  "translation_drill",
  "formula_derivation",
  "oral_recall",
  "user_text_answer",
  "mcq",
  "fill_blank",
  "step_problem",
]);
const difficultySchema = z.enum(["EASY", "MEDIUM", "HARD"]).optional();
const requestSchema = z.object({
  topicIds: z.array(z.string().min(1)).min(1),
  mode: arenaModeSchema,
  timeLimitSec: z.number().min(30).max(3600).optional(),
  itemCount: z.number().min(3).max(8),
  questionTypes: z.array(questionTypeSchema).min(1).optional(),
  difficulty: difficultySchema,
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
  const {
    topicIds: rawIds,
    mode,
    timeLimitSec,
    itemCount,
    questionTypes,
    difficulty,
  } = parsed.data;
  const topicIds = rawIds as Id<"topics">[];
  const lessonContents = await convex.query(
    api.practiceArena.getLessonContentForTopics,
    { topicIds }
  );
  if (lessonContents.length === 0) {
    return new Response("No lesson content found for the selected topics", {
      status: 404,
    });
  }
  const subjectSlug = lessonContents[0]?.subjectSlug ?? undefined;
  const defaultTypes: ArenaQuestionType[] =
    questionTypes && questionTypes.length > 0
      ? (questionTypes as ArenaQuestionType[])
      : ["user_text_answer"];
  const ai = await generateArenaPractice(convex, {
    topicContents: lessonContents.map((lc) => ({
      topicTitle: lc.topicTitle,
      content: lc.content,
      gradeLevel: lc.gradeLevel,
    })),
    count: itemCount,
    mode: mode as ArenaMode,
    questionTypes: defaultTypes,
    language: "de",
    difficulty: difficulty as "EASY" | "MEDIUM" | "HARD" | undefined,
    subjectSlug,
  });
  if (!ai.ok) {
    return new Response(
      JSON.stringify({ error: "ai_failed" }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }
  const items = ai.value.items.map((it) => ({
    prompt: it.prompt,
    expectedAnswer: it.expectedAnswer,
    skill: it.skill,
    rubric: it.rubric,
    type: it.type ?? "user_text_answer",
    ...(it.wordCountTarget !== undefined
      ? { wordCountTarget: it.wordCountTarget }
      : {}),
    ...(it.sourcePhrase !== undefined
      ? { sourcePhrase: it.sourcePhrase }
      : {}),
    ...(it.startingExpression !== undefined
      ? { startingExpression: it.startingExpression }
      : {}),
    ...(it.options !== undefined
      ? { options: it.options }
      : {}),
  }));
  try {
    const result = await convex.mutation(
      api.practiceArena.startArenaPractice,
      {
        topicIds,
        mode: mode as "sequential" | "timed" | "retry_wrong" | "exam_simulation",
        timeLimitSec,
        itemCount,
        items,
        ...(difficulty ? { difficulty: difficulty as "EASY" | "MEDIUM" | "HARD" } : {}),
      }
    );
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("/api/practice/arena/start: mutation failed", err);
    return new Response("Internal error", { status: 500 });
  }
}
