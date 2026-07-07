import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";

import { requireUser, resolveUserReadOnly as resolveUser } from "./users";
import {
  scoreToGermanGrade,
  type GermanLetterGrade,
} from "./_lib/grading";

const modeArg = v.union(
  v.literal("sequential"),
  v.literal("timed"),
  v.literal("retry_wrong"),
  v.literal("exam_simulation")
);

const gradeArg = v.union(
  v.literal("1"),
  v.literal("2"),
  v.literal("3"),
  v.literal("4"),
  v.literal("5"),
  v.literal("6")
);

const verdictArg = v.union(
  v.literal("correct"),
  v.literal("partially_correct"),
  v.literal("incorrect")
);

const arenaItemShapeArg = v.object({
  prompt: v.string(),
  expectedAnswer: v.string(),
  skill: v.string(),
  rubric: v.array(v.string()),
  type: v.union(
    v.literal("essay_analysis"),
    v.literal("translation_drill"),
    v.literal("formula_derivation"),
    v.literal("oral_recall"),
    v.literal("user_text_answer"),
    v.literal("mcq"),
    v.literal("fill_blank"),
    v.literal("step_problem"),
  ),
  wordCountTarget: v.optional(v.number()),
  sourcePhrase: v.optional(v.string()),
  startingExpression: v.optional(v.string()),
  options: v.optional(v.array(v.string())),
});

export const startArenaPractice = mutation({
  args: {
    topicIds: v.array(v.id("topics")),
    mode: modeArg,
    timeLimitSec: v.optional(v.number()),
    itemCount: v.number(),
    items: v.array(arenaItemShapeArg),
    difficulty: v.optional(
      v.union(v.literal("EASY"), v.literal("MEDIUM"), v.literal("HARD"))
    ),
  },
  returns: v.object({
    runId: v.id("topicLessonPractice"),
    itemIds: v.array(v.id("practiceItems")),
    practiceSetId: v.id("practiceSets"),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    if (args.topicIds.length === 0) {
      throw new ConvexError("topic_list_empty");
    }

    if (args.items.length === 0) {
      throw new ConvexError("practice_items_empty");
    }

    const primaryTopicId = args.topicIds[0];
    const primaryTopic = await ctx.db.get(primaryTopicId);
    if (!primaryTopic) throw new ConvexError("topic_not_found");

    const singleTopic = args.topicIds.length === 1;
    const setTitle = singleTopic
      ? `Arena — ${primaryTopic.title}`
      : `Arena — ${args.topicIds.length} topics`;

    const practiceSetId = await ctx.db.insert("practiceSets", {
      topicId: primaryTopicId,
      title: setTitle,
      difficulty: args.difficulty ?? primaryTopic.difficulty,
      generatedById: user._id,
      createdAt: Date.now(),
      source: "canonical_baseline",
    });

    const itemIds: Array<Id<"practiceItems">> = [];
    for (let i = 0; i < args.items.length; i++) {
      const it = args.items[i];
      const id = await ctx.db.insert("practiceItems", {
        practiceSetId,
        type: it.type,
        question: it.prompt,
        answer: it.expectedAnswer,
        explanation: it.expectedAnswer,
        skills: [it.skill],
        order: i,
        rubric: it.rubric,
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
      });
      itemIds.push(id);
    }

    if (!singleTopic) {
      const existingRuns = await ctx.db
        .query("topicLessonPractice")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      for (const r of existingRuns) {
        if (r.status === "in_progress") {
          await ctx.db.patch(r._id, { status: "abandoned" });
        }
      }
    } else {
      const existingRuns = await ctx.db
        .query("topicLessonPractice")
        .withIndex("by_user_topic", (q) =>
          q.eq("userId", user._id).eq("topicId", primaryTopicId)
        )
        .collect();
      for (const r of existingRuns) {
        if (r.status === "in_progress") {
          await ctx.db.patch(r._id, { status: "abandoned" });
        }
      }
    }

    const runId = await ctx.db.insert("topicLessonPractice", {
      userId: user._id,
      topicId: primaryTopicId,
      lessonId: undefined,
      practiceSetId,
      startedAt: Date.now(),
      status: "in_progress",
      itemCount: args.items.length,
      answeredCount: 0,
      mode: args.mode,
      ...(args.timeLimitSec !== undefined
        ? { timeLimitSec: args.timeLimitSec }
        : {}),
      ...(!singleTopic ? { topicIds: args.topicIds } : {}),
      currentRound: 1,
    });

    return { runId, itemIds, practiceSetId };
  },
});

export const retryWrongItems = mutation({
  args: {
    parentRunId: v.id("topicLessonPractice"),
    wrongItemIds: v.array(v.id("practiceItems")),
  },
  returns: v.object({
    runId: v.id("topicLessonPractice"),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const parentRun = await ctx.db.get(args.parentRunId);
    if (!parentRun) throw new ConvexError("run_not_found");
    if (parentRun.userId !== user._id) throw new ConvexError("forbidden");
    if (parentRun.status !== "graded") {
      throw new ConvexError("parent_run_not_graded");
    }

    if (args.wrongItemIds.length === 0) {
      throw new ConvexError("wrong_items_empty");
    }

    const topicIds = parentRun.topicIds ?? [parentRun.topicId];

    const runId = await ctx.db.insert("topicLessonPractice", {
      userId: user._id,
      topicId: parentRun.topicId,
      lessonId: undefined,
      practiceSetId: parentRun.practiceSetId,
      startedAt: Date.now(),
      status: "in_progress",
      itemCount: args.wrongItemIds.length,
      answeredCount: 0,
      mode: "retry_wrong",
      currentRound: (parentRun.currentRound ?? 1) + 1,
      wrongItemIds: args.wrongItemIds,
      ...(topicIds.length > 1 ? { topicIds } : {}),
    });

    return { runId };
  },
});

export const finishArenaPractice = mutation({
  args: { runId: v.id("topicLessonPractice") },
  returns: v.union(
    v.object({
      runId: v.id("topicLessonPractice"),
      overallScore: v.number(),
      grade: gradeArg,
    }),
    v.null()
  ),
  handler: async (ctx, { runId }) => {
    const user = await requireUser(ctx);
    const run = await ctx.db.get(runId);
    if (!run) throw new ConvexError("run_not_found");
    if (run.userId !== user._id) throw new ConvexError("forbidden");
    if (run.status !== "in_progress") return null;

    await finishArenaPracticeInner(ctx, run, user._id);

    const updated = await ctx.db.get(runId);
    if (!updated) return null;
    return {
      runId,
      overallScore: updated.overallScore ?? 0,
      grade: updated.grade ?? "6",
    };
  },
});

export const getArenaRun = query({
  args: { runId: v.id("topicLessonPractice") },
  returns: v.union(
    v.object({
      id: v.id("topicLessonPractice"),
      topicId: v.id("topics"),
      lessonId: v.union(v.id("topicLessons"), v.null()),
      practiceSetId: v.id("practiceSets"),
      status: v.union(
        v.literal("in_progress"),
        v.literal("graded"),
        v.literal("abandoned")
      ),
      itemCount: v.number(),
      answeredCount: v.number(),
      overallScore: v.union(v.number(), v.null()),
      grade: v.union(gradeArg, v.null()),
      startedAt: v.number(),
      completedAt: v.union(v.number(), v.null()),
      mode: v.union(modeArg, v.null()),
      timeLimitSec: v.union(v.number(), v.null()),
      topicIds: v.union(v.array(v.id("topics")), v.null()),
      currentRound: v.union(v.number(), v.null()),
      wrongItemIds: v.union(v.array(v.id("practiceItems")), v.null()),
    }),
    v.null()
  ),
  handler: async (ctx, { runId }) => {
    const user = await resolveUser(ctx);
    if (!user) return null;
    const run = await ctx.db.get(runId);
    if (!run || run.userId !== user._id) return null;
    return {
      id: run._id,
      topicId: run.topicId,
      lessonId: run.lessonId ?? null,
      practiceSetId: run.practiceSetId,
      status: run.status,
      itemCount: run.itemCount,
      answeredCount: run.answeredCount,
      overallScore: run.overallScore ?? null,
      grade: run.grade ?? null,
      startedAt: run.startedAt,
      completedAt: run.completedAt ?? null,
      mode: run.mode ?? null,
      timeLimitSec: run.timeLimitSec ?? null,
      topicIds: run.topicIds ?? null,
      currentRound: run.currentRound ?? null,
      wrongItemIds: run.wrongItemIds ?? null,
    };
  },
});

export const getArenaRunItems = query({
  args: { runId: v.id("topicLessonPractice") },
  returns: v.array(
    v.object({
      itemId: v.id("practiceItems"),
      order: v.number(),
      type: v.union(
        v.literal("mcq"),
        v.literal("short_answer"),
        v.literal("step_problem"),
        v.literal("fill_blank"),
        v.literal("user_text_answer"),
        v.literal("worked_walkthrough"),
        v.literal("essay_analysis"),
        v.literal("translation_drill"),
        v.literal("formula_derivation"),
        v.literal("oral_recall"),
      ),
      prompt: v.string(),
      options: v.union(v.array(v.string()), v.null()),
      expectedAnswer: v.string(),
      skill: v.string(),
      rubric: v.array(v.string()),
      wordCountTarget: v.union(v.number(), v.null()),
      sourcePhrase: v.union(v.string(), v.null()),
      startingExpression: v.union(v.string(), v.null()),
      attempt: v.union(
        v.object({
          attemptId: v.id("practiceAttempts"),
          userAnswer: v.string(),
          verdict: verdictArg,
          score: v.number(),
          feedback: v.string(),
          betterAnswer: v.string(),
          attemptedAt: v.number(),
        }),
        v.null()
      ),
    })
  ),
  handler: async (ctx, { runId }) => {
    const user = await resolveUser(ctx);
    if (!user) return [];

    const run = await ctx.db.get(runId);
    if (!run || run.userId !== user._id) return [];

    const items = await ctx.db
      .query("practiceItems")
      .withIndex("by_practice_set_order", (q) =>
        q.eq("practiceSetId", run.practiceSetId)
      )
      .collect();

    const attemptRows = await Promise.all(
      items.map((item) =>
        ctx.db
          .query("practiceAttempts")
          .withIndex("by_user_practice_item", (q) =>
            q.eq("userId", user._id).eq("practiceItemId", item._id)
          )
          .order("desc")
          .first()
      )
    );

    const attemptByItem = new Map<
      Id<"practiceItems">,
      NonNullable<(typeof attemptRows)[number]>
    >();
    for (let idx = 0; idx < items.length; idx++) {
      const a = attemptRows[idx];
      if (a) attemptByItem.set(items[idx]._id, a);
    }

    return items.map((item) => {
      const attempt = attemptByItem.get(item._id) ?? null;
      return {
        itemId: item._id,
        order: item.order,
        type: item.type,
        prompt: item.question,
        options: item.options ?? null,
        expectedAnswer: item.answer,
        skill: item.skills[0] ?? "allgemein",
        rubric: item.rubric ?? [],
        wordCountTarget: item.wordCountTarget ?? null,
        sourcePhrase: item.sourcePhrase ?? null,
        startingExpression: item.startingExpression ?? null,
        attempt: attempt
          ? {
              attemptId: attempt._id,
              userAnswer: attempt.userAnswer,
              verdict: attempt.verdict,
              score: attempt.score,
              feedback: attempt.feedback ?? "",
              betterAnswer: attempt.betterAnswer ?? item.answer,
              attemptedAt: attempt.attemptedAt,
            }
          : null,
      };
    });
  },
});

export const listTopicsForSubject = query({
  args: { subjectId: v.id("subjects") },
  returns: v.array(
    v.object({
      id: v.id("topics"),
      slug: v.string(),
      title: v.string(),
      chapterId: v.id("chapters"),
      chapterTitle: v.string(),
    })
  ),
  handler: async (ctx, { subjectId }) => {
    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_subject_order", (q) => q.eq("subjectId", subjectId))
      .collect();

    const out: Array<{
      id: Id<"topics">;
      slug: string;
      title: string;
      chapterId: Id<"chapters">;
      chapterTitle: string;
    }> = [];

    for (const ch of chapters) {
      const topics = await ctx.db
        .query("topics")
        .withIndex("by_chapter", (q) => q.eq("chapterId", ch._id))
        .collect();
      for (const topic of topics) {
        out.push({
          id: topic._id,
          slug: topic.slug,
          title: topic.title,
          chapterId: ch._id,
          chapterTitle: ch.title,
        });
      }
    }

    return out;
  },
});

export const getLessonContentForTopics = query({
  args: { topicIds: v.array(v.id("topics")) },
  returns: v.array(
    v.object({
      topicId: v.id("topics"),
      topicTitle: v.string(),
      gradeLevel: v.union(v.string(), v.null()),
      content: v.string(),
      subjectSlug: v.union(v.string(), v.null()),
    })
  ),
  handler: async (ctx, { topicIds }) => {
    const out: Array<{
      topicId: Id<"topics">;
      topicTitle: string;
      gradeLevel: string | null;
      content: string;
      subjectSlug: string | null;
    }> = [];

    for (const topicId of topicIds) {
      const topic = await ctx.db.get(topicId);
      if (!topic) continue;

      const content = await topicLessonExcerpt(ctx, topicId, 6000);

      let subjectSlug: string | null = null;
      const chapter = await ctx.db.get(topic.chapterId);
      if (chapter) {
        const subject = await ctx.db.get(chapter.subjectId);
        subjectSlug = subject?.slug ?? null;
      }

      out.push({
        topicId,
        topicTitle: topic.title,
        gradeLevel: topic.gradeLevel ?? null,
        content,
        subjectSlug,
      });
    }

    return out;
  },
});

export const recordArenaAttempt = mutation({
  args: {
    runId: v.id("topicLessonPractice"),
    practiceSetId: v.id("practiceSets"),
    itemId: v.id("practiceItems"),
    userAnswer: v.string(),
    verdict: verdictArg,
    score: v.number(),
    feedback: v.string(),
    betterAnswer: v.string(),
  },
  returns: v.object({
    attemptId: v.id("practiceAttempts"),
    runFinished: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const run = await ctx.db.get(args.runId);
    if (!run) throw new ConvexError("run_not_found");
    if (run.userId !== user._id) throw new ConvexError("forbidden");
    if (run.status !== "in_progress") {
      throw new ConvexError("run_not_in_progress");
    }

    const item = await ctx.db.get(args.itemId);
    if (!item) throw new ConvexError("item_not_found");
    if (item.practiceSetId !== args.practiceSetId) {
      throw new ConvexError("item_does_not_belong_to_run");
    }

    const attemptId = await ctx.db.insert("practiceAttempts", {
      userId: user._id,
      practiceItemId: args.itemId,
      userAnswer: args.userAnswer,
      verdict: args.verdict,
      score: args.score,
      feedback: args.feedback,
      betterAnswer: args.betterAnswer,
      attemptedAt: Date.now(),
    });

    const nextAnswered = Math.min(run.itemCount, run.answeredCount + 1);
    await ctx.db.patch(run._id, { answeredCount: nextAnswered });

    const runFinished = nextAnswered >= run.itemCount;
    if (runFinished) {
      await finishArenaPracticeInner(ctx, run, user._id);
    }

    return { attemptId, runFinished };
  },
});

async function finishArenaPracticeInner(
  ctx: { db: MutationCtx["db"] },
  run: { _id: Id<"topicLessonPractice">; itemCount: number; practiceSetId: Id<"practiceSets">; startedAt: number; topicId: Id<"topics">; topicIds?: Id<"topics">[] },
  userId: Id<"users">
) {
  const items = await ctx.db
    .query("practiceItems")
    .withIndex("by_practice_set", (q) =>
      q.eq("practiceSetId", run.practiceSetId)
    )
    .collect();

  const itemIds: Array<Id<"practiceItems">> = Array.from(new Set(items.map((i) => i._id)));
  const attemptRows = await Promise.all(
    itemIds.map((itemId: Id<"practiceItems">) =>
      ctx.db
        .query("practiceAttempts")
        .withIndex("by_user_practice_item", (q) =>
          q.eq("userId", userId).eq("practiceItemId", itemId)
        )
        .collect()
    )
  );

  type ScoreEntry = { score: number; attemptedAt: number };
  const latestPerItem = new Map<Id<"practiceItems">, ScoreEntry>();
  for (let idx = 0; idx < itemIds.length; idx++) {
    const perItem = attemptRows[idx];
    if (!perItem) continue;
    for (const a of perItem) {
      const existing = latestPerItem.get(itemIds[idx]);
      if (!existing || a.attemptedAt > existing.attemptedAt) {
        latestPerItem.set(itemIds[idx], {
          score: a.score,
          attemptedAt: a.attemptedAt,
        });
      }
    }
  }

  if (latestPerItem.size === 0) {
    return;
  }

  const sum = Array.from(latestPerItem.values()).reduce(
    (acc, e) => acc + e.score,
    0
  );
  const overallScore =
    run.itemCount > 0 ? sum / run.itemCount : sum / latestPerItem.size;

  const grade: GermanLetterGrade = scoreToGermanGrade(overallScore);

  await ctx.db.patch(run._id, {
    status: "graded",
    completedAt: Date.now(),
    overallScore,
    grade,
  });

  const now = Date.now();
  const masteryDelta = Math.max(0, Math.min(1, overallScore * 0.25));
  const confidenceDelta = Math.max(
    -0.15,
    Math.min(0.25, (overallScore - 0.5) * 0.2)
  );
  const timeSpent = Math.max(0, Math.floor((now - run.startedAt) / 1000));

  const topicIds = run.topicIds ?? [run.topicId];
  for (const topicId of topicIds) {
    const existingProgress = await ctx.db
      .query("userTopicProgress")
      .withIndex("by_user_topic", (q) =>
        q.eq("userId", userId).eq("topicId", topicId)
      )
      .first();

    if (existingProgress) {
      const newMastery = Math.max(
        0,
        Math.min(
          1,
          existingProgress.mastery + masteryDelta * (1 - existingProgress.mastery)
        )
      );
      const newConfidence = Math.max(
        0,
        Math.min(1, existingProgress.confidence + confidenceDelta)
      );
      await ctx.db.patch(existingProgress._id, {
        mastery: newMastery,
        confidence: newConfidence,
        timeSpentSec: existingProgress.timeSpentSec + timeSpent,
        lastStudied: now,
      });
    } else {
      await ctx.db.insert("userTopicProgress", {
        userId,
        topicId,
        mastery: Math.max(0, Math.min(1, masteryDelta)),
        confidence: Math.max(0, Math.min(1, 0.4 + confidenceDelta)),
        timeSpentSec: timeSpent,
        lastStudied: now,
      });
    }
  }
}

export const getSubjectSlugForTopic = query({
  args: { topicId: v.id("topics") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { topicId }) => {
    const topic = await ctx.db.get(topicId);
    if (!topic) return null;
    const chapter = await ctx.db.get(topic.chapterId);
    if (!chapter) return null;
    const subject = await ctx.db.get(chapter.subjectId);
    return subject?.slug ?? null;
  },
});

async function topicLessonExcerpt(
  ctx: { db: QueryCtx["db"] },
  topicId: Id<"topics">,
  maxChars: number
): Promise<string> {
  const blocks = await ctx.db
    .query("lessonBlocks")
    .withIndex("by_topic_depth", (q) =>
      q.eq("topicId", topicId).eq("depth", "standard")
    )
    .collect();

  if (blocks.length > 0) {
    blocks.sort((a, b) => a.order - b.order);
    return blocks
      .map((b) => b.content)
      .join("\n\n")
      .slice(0, maxChars);
  }

  const lessons = await ctx.db
    .query("topicLessons")
    .withIndex("by_topic", (q) => q.eq("topicId", topicId))
    .order("desc")
    .take(1);

  if (lessons.length > 0) {
    return lessons[0].content.slice(0, maxChars);
  }

  return "";
}
