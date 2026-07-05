import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

import { resolveUserReadOnly as resolveUser } from "./users";

/**
 * tutorContext.ts.
 *
 * Per plan decision D12 and §4.4, this is the single read
 * surface for "give me everything I need to discuss a
 * completed lesson run with the student". Called by
 * `/tutor?subject=…&topic=…&lesson=<runId>` whenever the
 * `lesson` query param is present.
 *
 * Returns `null` when:
 *   - the run does not exist,
 *   - it does not belong to the calling user, OR
 *   - the run is not yet graded (in_progress / abandoned).
 *
 * In all three cases the route handler MUST degrade
 * gracefully — the tutor can still talk, just without the
 * lesson block in the system prompt.
 */

const depthArg = v.union(
  v.literal("simple"),
  v.literal("standard"),
  v.literal("rigorous")
);

const verdictArg = v.union(
  v.literal("correct"),
  v.literal("partially_correct"),
  v.literal("incorrect")
);

const gradeArg = v.union(
  v.literal("1"),
  v.literal("2"),
  v.literal("3"),
  v.literal("4"),
  v.literal("5"),
  v.literal("6")
);

const mistakeTypeArg = v.union(
  v.literal("CONCEPT_MISUNDERSTANDING"),
  v.literal("CALCULATION_MISTAKE"),
  v.literal("CARELESS_ERROR"),
  v.literal("FORMULA_RECALL_FAILURE"),
  v.literal("MISREAD_QUESTION"),
  v.literal("LANGUAGE_EXPRESSION_ISSUE")
);

export const getContextForLessonRun = query({
  args: { runId: v.id("topicLessonPractice") },
  returns: v.union(
    v.object({
      run: v.object({
        id: v.id("topicLessonPractice"),
        startedAt: v.number(),
        completedAt: v.number(),
        overallScore: v.number(),
        grade: gradeArg,
      }),
      topic: v.object({
        id: v.id("topics"),
        title: v.string(),
        slug: v.string(),
      }),
      subject: v.object({
        id: v.id("subjects"),
        title: v.string(),
        slug: v.string(),
      }),
      lesson: v.union(
        v.object({
          id: v.id("topicLessons"),
          title: v.string(),
          depth: depthArg,
          summary: v.string(),
          version: v.number(),
        }),
        v.null()
      ),
      items: v.array(
        v.object({
          prompt: v.string(),
          userAnswer: v.string(),
          verdict: verdictArg,
          score: v.number(),
          feedback: v.string(),
          betterAnswer: v.string(),
        })
      ),
      mistakes: v.array(
        v.object({
          type: mistakeTypeArg,
          cause: v.union(v.string(), v.null()),
        })
      ),
    }),
    v.null()
  ),
  handler: async (ctx, { runId }) => {
    const user = await resolveUser(ctx);
    if (!user) return null;

    const run = await ctx.db.get(runId);
    if (!run || run.userId !== user._id) return null;
    if (run.status !== "graded") return null;

    const topic = await ctx.db.get(run.topicId);
    if (!topic) return null;
    const chapter = await ctx.db.get(topic.chapterId);
    if (!chapter) return null;
    const subject = await ctx.db.get(chapter.subjectId);
    if (!subject) return null;

    // `run.lessonId` is OPTIONAL in the schema; canonical-
    // baseline practice has no lesson at all. The
    // `lesson` block in the prompt is therefore optional
    // in this surface — when the run is a user-generated
    // lesson practice we surface a real lesson summary;
    // when it is canonical, we surface `null` and the
    // route handler falls back to topic-only context.
    const lesson =
      run.lessonId !== undefined ? await ctx.db.get(run.lessonId) : null;

    // Pull item + attempt + mistake rows in three parallel
    // indexed reads (each scoped by user or set-id).
    const items = await ctx.db
      .query("practiceItems")
      .withIndex("by_practice_set", (q) =>
        q.eq("practiceSetId", run.practiceSetId)
      )
      .collect();
    items.sort((a, b) => a.order - b.order);

    const itemIdSet = new Set(items.map((i) => i._id));
    const allAttempts = await ctx.db
      .query("practiceAttempts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const latestByItem = new Map<
      Id<"practiceItems">,
      (typeof allAttempts)[number]
    >();
    for (const a of allAttempts) {
      if (!itemIdSet.has(a.practiceItemId)) continue;
      const existing = latestByItem.get(a.practiceItemId);
      if (!existing || a.attemptedAt > existing.attemptedAt) {
        latestByItem.set(a.practiceItemId, a);
      }
    }

    const allMistakes = await ctx.db
      .query("mistakeEntries")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const mistakeByAttempt = new Map<
      Id<"practiceAttempts">,
      (typeof allMistakes)[number]
    >();
    for (const m of allMistakes) {
      if (m.practiceAttemptId) mistakeByAttempt.set(m.practiceAttemptId, m);
    }

    const lessonItems = items.map((item) => {
      const attempt = latestByItem.get(item._id) ?? null;
      const mistake =
        attempt && mistakeByAttempt.has(attempt._id)
          ? mistakeByAttempt.get(attempt._id)!
          : null;
      return {
        item: {
          prompt: item.question,
          // Fall back through attempt → item expectedAnswer
          // so a missing attempt still renders readable
          // context.
          userAnswer: attempt?.userAnswer ?? "",
          verdict: attempt?.verdict ?? ("partially_correct" as const),
          score: attempt?.score ?? 0,
          feedback: attempt?.feedback ?? "",
          betterAnswer: attempt?.betterAnswer ?? item.answer,
          mistake: mistake
            ? {
                type: mistake.mistakeType,
                cause: mistake.cause ?? null,
              }
            : null,
        },
      };
    });

    return {
      run: {
        id: run._id,
        startedAt: run.startedAt,
        completedAt: run.completedAt ?? Date.now(),
        overallScore: run.overallScore ?? 0,
        grade: run.grade ?? "6",
      },
      topic: {
        id: topic._id,
        title: topic.title,
        slug: topic.slug,
      },
      subject: {
        id: subject._id,
        title: subject.title,
        slug: subject.slug,
      },
      lesson: lesson
        ? {
            id: lesson._id,
            title: topic.title,
            depth: lesson.depth,
            // Maintain a compact summary so the model grounds
            // itself without copying the whole lesson into the
            // prompt. Section headings + the first sentence of
            // each body is a fair representative.
            summary: lesson.sections
              .map(
                (s) =>
                  `${s.heading} — ${s.body.split(/(?<=[.!?])\s+/u)[0] ?? s.body}`
              )
              .join("\n"),
            version: lesson.version,
          }
        : null,
      items: lessonItems.map((li) => ({
        prompt: li.item.prompt,
        userAnswer: li.item.userAnswer,
        verdict: li.item.verdict,
        score: li.item.score,
        feedback: li.item.feedback,
        betterAnswer: li.item.betterAnswer,
      })),
      mistakes: lessonItems
        .filter((li) => li.item.mistake !== null)
        .map((li) => ({
          type: li.item.mistake!.type,
          cause: li.item.mistake!.cause,
        })),
    };
  },
});
