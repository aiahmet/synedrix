import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { generatePracticeFromLesson } from "@/lib/ai/invoke";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  lessonId: z.string().min(1),
  itemCount: z.number().min(3).max(8).optional(),
});

/**
 * POST /api/topics/practice/start.
 *
 * Generates the practice bundle from the lesson via
 * `generatePracticeFromLesson` (Vercel AI SDK,
 * `generateObject`, schema-validated). On success,
 * invokes `api.practice.startLessonPractice` to write the
 * `topicLessonPractice` + `practiceSets` + `practiceItems`
 * rows. Returns `{ runId, itemIds }`.
 *
 * On Zod failure at the AI layer (plan §11), returns 422
 * with `{ error: "ai_failed" }` so the client can
 * surface a retry CTA without inventing practice items.
 */
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
  const { lessonId, itemCount } = parsed.data;

  // 1. Pull the lesson row by id via `convex.query`.
  //    The mutation's ownership check fails closed so
  //    even if `lessonRow` resolves to a non-owner the
  //    caller can still see the practice page; we just
  //    want AI prompt data here.
  const lessonRow = await fetchLessonById(convex, lessonId as Id<"topicLessons">);
  if (!lessonRow) {
    return new Response("Lesson not found", { status: 404 });
  }

  // 2. Generate the practice bundle via the centralized
  //    AI call (with telemetry + Zod already wired in).
  const count = itemCount ?? 5;
  const ai = await generatePracticeFromLesson(convex, {
    lessonContent: lessonRow.content,
    lessonSections: lessonRow.sections,
    topicTitle: lessonRow.topicTitle,
    subjectSlug: lessonRow.subjectSlug,
    count,
    gradeLevel: lessonRow.gradeLevel,
    language: "de",
  });

  if (!ai.ok) {
    return new Response(
      JSON.stringify({ error: "ai_failed" }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }

  // 3. Invoke the Convex mutation to write the run + items.
  try {
    const result = await convex.mutation(api.practice.startLessonPractice, {
      lessonId: lessonId as Id<"topicLessons">,
      itemCount: count,
      items: ai.value.items,
    });
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("/api/topics/practice/start: mutation failed", err);
    return new Response("Internal error", { status: 500 });
  }
}

/**
 * Server-side read of a single `topicLessons` row by id.
 * Goes through `api.practice.getLessonForStart`, which
 * resolves the parent topic and returns the lesson
 * content + section headings + topic title + gradeLevel
 * the AI prompt expects to see.
 */
async function fetchLessonById(
  convex: ConvexHttpClient,
  lessonId: Id<"topicLessons">
): Promise<{
  content: string;
  sections: Array<{ heading: string; body: string }>;
  topicTitle: string;
  gradeLevel: string | null;
  subjectSlug: string;
} | null> {
  try {
    const result = await convex.query(
      api.practice.getLessonForStart,
      { lessonId }
    );
    if (!result) return null;
    return {
      content: result.content,
      sections: result.sections,
      topicTitle: result.topicTitle,
      gradeLevel: result.gradeLevel,
      subjectSlug: result.subjectSlug,
    };
  } catch (err) {
    console.error("fetchLessonById failed:", err);
    return null;
  }
}
