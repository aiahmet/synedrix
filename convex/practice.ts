import { mutation, query, type QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";

import { requireUser, resolveUserReadOnly as resolveUser } from "./users";
import {
  scoreToGermanGrade,
  type GermanLetterGrade,
} from "./_lib/grading";

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
  v.literal("LANGUAGE_EXPRESSION_ISSUE"),
  v.literal("SIGN_ERROR"),
  v.literal("UNIT_CONVERSION_ERROR"),
  v.literal("GRAMMAR_ERROR"),
  v.literal("VOCABULARY_ERROR"),
  v.literal("REACTION_BALANCE_ERROR"),
  v.literal("ARGUMENT_STRUCTURE_ISSUE")
);

const practiceItemShapeArg = v.object({
  prompt: v.string(),
  expectedAnswer: v.string(),
  skill: v.string(),
  rubric: v.array(v.string()),
});

const gradeShapeArg = v.object({
  verdict: verdictArg,
  score: v.number(),
  feedback: v.string(),
  betterAnswer: v.string(),
  mistakeType: v.union(mistakeTypeArg, v.null()),
  cause: v.union(v.string(), v.null()),
});

export const startLessonPractice = mutation({
  args: {
    lessonId: v.id("topicLessons"),
    itemCount: v.optional(v.number()),
    items: v.array(practiceItemShapeArg),
  },
  returns: v.object({
    runId: v.id("topicLessonPractice"),
    itemIds: v.array(v.id("practiceItems")),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) throw new ConvexError("lesson_not_found");

    const topic = await ctx.db.get(lesson.topicId);
    if (!topic) throw new ConvexError("topic_not_found");
    if (topic.source !== "user" || topic.ownerId !== user._id) {
      throw new ConvexError("forbidden");
    }

    if (args.items.length === 0) {
      throw new ConvexError("practice_items_empty");
    }

    const practiceSetId = await ctx.db.insert("practiceSets", {
      topicId: topic._id,
      title: `Practice — ${topic.title}`,
      difficulty: topic.difficulty,
      generatedById: user._id,
      createdAt: Date.now(),
      source: "user_lesson",
      sourceLessonId: lesson._id,
    });

    const itemIds: Array<Id<"practiceItems">> = [];
    for (let i = 0; i < args.items.length; i++) {
      const it = args.items[i];
      const id = await ctx.db.insert("practiceItems", {
        practiceSetId,
        type: "user_text_answer",
        question: it.prompt,
        answer: it.expectedAnswer,
        explanation: it.expectedAnswer,
        skills: [it.skill],
        order: i,
        source: "user_lesson",
        sourceLessonId: lesson._id,
        rubric: it.rubric,
      });
      itemIds.push(id);
    }

    const existingInProgress = await ctx.db
      .query("topicLessonPractice")
      .withIndex("by_user_topic", (q) =>
        q.eq("userId", user._id).eq("topicId", topic._id)
      )
      .collect();
    const priorInProgress = existingInProgress.find(
      (r) => r.lessonId === lesson._id && r.status === "in_progress"
    );
    if (priorInProgress) {
      await ctx.db.patch(priorInProgress._id, { status: "abandoned" });
    }

    const runId = await ctx.db.insert("topicLessonPractice", {
      userId: user._id,
      topicId: topic._id,
      lessonId: lesson._id,
      practiceSetId,
      startedAt: Date.now(),
      status: "in_progress",
      itemCount: args.items.length,
      answeredCount: 0,
    });

    return { runId, itemIds };
  },
});

export const submitAnswerAndGrade = mutation({
  args: {
    runId: v.id("topicLessonPractice"),
    itemId: v.id("practiceItems"),
    userAnswer: v.string(),
    grade: gradeShapeArg,
  },
  returns: v.object({
    attemptId: v.id("practiceAttempts"),
    verdict: verdictArg,
    score: v.number(),
    feedback: v.string(),
    betterAnswer: v.string(),
    mistakeEntryId: v.union(v.id("mistakeEntries"), v.null()),
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
    if (item.practiceSetId !== run.practiceSetId) {
      throw new ConvexError("item_does_not_belong_to_run");
    }

    const trimmedAnswer = args.userAnswer.trim();
    if (trimmedAnswer.length === 0) {
      throw new ConvexError("empty_answer");
    }

    if (
      args.grade.verdict === "correct" &&
      (args.grade.mistakeType !== null ||
        args.grade.cause !== null)
    ) {
      throw new ConvexError("invariant_verdict_mistakeType");
    }

    const attemptId = await ctx.db.insert("practiceAttempts", {
      userId: user._id,
      practiceItemId: args.itemId,
      userAnswer: trimmedAnswer,
      verdict: args.grade.verdict,
      score: args.grade.score,
      feedback: args.grade.feedback,
      betterAnswer: args.grade.betterAnswer,
      attemptedAt: Date.now(),
    });

    let mistakeEntryId: Id<"mistakeEntries"> | null = null;
    if (
      args.grade.verdict !== "correct" &&
      args.grade.mistakeType !== null
    ) {
      mistakeEntryId = await ctx.db.insert("mistakeEntries", {
        userId: user._id,
        topicId: run.topicId,
        practiceAttemptId: attemptId,
        question: item.question,
        userAnswer: trimmedAnswer,
        correctAnswer: args.grade.betterAnswer,
        mistakeType: args.grade.mistakeType,
        ...(args.grade.cause !== null && args.grade.cause.length > 0
          ? { cause: args.grade.cause }
          : {}),
      });
    }

    const nextAnswered = Math.min(
      run.itemCount,
      run.answeredCount + 1
    );
    await ctx.db.patch(run._id, { answeredCount: nextAnswered });

    return {
      attemptId,
      verdict: args.grade.verdict,
      score: args.grade.score,
      feedback: args.grade.feedback,
      betterAnswer: args.grade.betterAnswer,
      mistakeEntryId,
    };
  },
});

export const finishLessonPractice = mutation({
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

    const items = await ctx.db
      .query("practiceItems")
      .withIndex("by_practice_set", (q) =>
        q.eq("practiceSetId", run.practiceSetId)
      )
      .collect();

    const itemIds = Array.from(new Set(items.map((i) => i._id)));
    const attemptRows = await Promise.all(
      itemIds.map((itemId) =>
        ctx.db
          .query("practiceAttempts")
          .withIndex("by_user_practice_item", (q) =>
            q.eq("userId", user._id).eq("practiceItemId", itemId)
          )
          .collect()
      )
    );

    const latestPerItem = new Map<
      Id<"practiceItems">,
      { score: number; attemptedAt: number }
    >();
    for (let idx = 0; idx < itemIds.length; idx++) {
      const perItem = attemptRows[idx];
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
      throw new ConvexError("no_attempts");
    }

    const sum = Array.from(latestPerItem.values()).reduce(
      (acc, e) => acc + e.score,
      0
    );
    const overallScore =
      run.itemCount > 0 ? sum / run.itemCount : sum / latestPerItem.size;

    const grade: GermanLetterGrade = scoreToGermanGrade(overallScore);

    await ctx.db.patch(runId, {
      status: "graded",
      completedAt: Date.now(),
      overallScore,
      grade,
    });

    const now = Date.now();
    const masteryDelta = Math.max(0, Math.min(1, overallScore * 0.25));
    const confidenceDelta = Math.max(-0.15, Math.min(0.25, (overallScore - 0.5) * 0.2));
    const timeSpent = Math.max(0, Math.floor((now - run.startedAt) / 1000));

    const existingProgress = await ctx.db
      .query("userTopicProgress")
      .withIndex("by_user_topic", (q) =>
        q.eq("userId", user._id).eq("topicId", run.topicId)
      )
      .first();

    if (existingProgress) {
      const newMastery = Math.max(
        0,
        Math.min(1, existingProgress.mastery + masteryDelta * (1 - existingProgress.mastery))
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
        userId: user._id,
        topicId: run.topicId,
        mastery: Math.max(0, Math.min(1, masteryDelta)),
        confidence: Math.max(0, Math.min(1, 0.4 + confidenceDelta)),
        timeSpentSec: timeSpent,
        lastStudied: now,
      });
    }

    return { runId, overallScore, grade };
  },
});

export const abandonLessonPractice = mutation({
  args: { runId: v.id("topicLessonPractice") },
  returns: v.null(),
  handler: async (ctx, { runId }): Promise<null> => {
    const user = await requireUser(ctx);
    const run = await ctx.db.get(runId);
    if (!run) throw new ConvexError("run_not_found");
    if (run.userId !== user._id) throw new ConvexError("forbidden");
    if (run.status !== "in_progress") return null;
    await ctx.db.patch(runId, {
      status: "abandoned",
      completedAt: Date.now(),
    });
    return null;
  },
});

export const getLessonPracticeRun = query({
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
    };
  },
});

export const getLatestPracticeRunForOwnedTopic = query({
  args: { topicId: v.id("topics") },
  returns: v.union(
    v.object({
      id: v.id("topicLessonPractice"),
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
    }),
    v.null()
  ),
  handler: async (ctx, { topicId }) => {
    const user = await resolveUser(ctx);
    if (!user) return null;

    const topic = await ctx.db.get(topicId);
    if (!topic) return null;
    if (topic.source !== "user" || topic.ownerId !== user._id) return null;

    const runs = await ctx.db
      .query("topicLessonPractice")
      .withIndex("by_user_topic", (q) =>
        q.eq("userId", user._id).eq("topicId", topicId)
      )
      .collect();
    if (runs.length === 0) return null;
    runs.sort((a, b) => b.startedAt - a.startedAt);
    const top = runs[0];
    return {
      id: top._id,
      status: top.status,
      itemCount: top.itemCount,
      answeredCount: top.answeredCount,
      overallScore: top.overallScore ?? null,
      grade: top.grade ?? null,
      startedAt: top.startedAt,
      completedAt: top.completedAt ?? null,
    };
  },
});

export const getLessonForStart = query({
  args: { lessonId: v.id("topicLessons") },
  returns: v.union(
    v.object({
      content: v.string(),
      sections: v.array(
        v.object({ heading: v.string(), body: v.string() })
      ),
      topicTitle: v.string(),
      gradeLevel: v.union(v.string(), v.null()),
      subjectSlug: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, { lessonId }) => {
    const user = await resolveUser(ctx);
    if (!user) return null;
    const lesson = await ctx.db.get(lessonId);
    if (!lesson) return null;
    const topic = await ctx.db.get(lesson.topicId);
    if (!topic) return null;
    if (topic.source !== "user" || topic.ownerId !== user._id) {
      return null;
    }
    const chapter = await ctx.db.get(topic.chapterId);
    const subject = chapter ? await ctx.db.get(chapter.subjectId) : null;
    return {
      content: lesson.content,
      sections: lesson.sections,
      topicTitle: topic.title,
      gradeLevel: topic.gradeLevel ?? null,
      subjectSlug: subject?.slug ?? "",
    };
  },
});

export const getItemForGrading = query({
  args: {
    runId: v.id("topicLessonPractice"),
    itemId: v.id("practiceItems"),
  },
  returns: v.union(
    v.object({
      prompt: v.string(),
      expectedAnswer: v.string(),
      skill: v.string(),
      rubric: v.array(v.string()),
      lessonExcerpt: v.string(),
      subjectSlug: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, { runId, itemId }) => {
    const user = await resolveUser(ctx);
    if (!user) return null;
    const run = await ctx.db.get(runId);
    if (!run || run.userId !== user._id) return null;
    const item = await ctx.db.get(itemId);
    if (!item || item.practiceSetId !== run.practiceSetId) return null;

    const topic = await ctx.db.get(run.topicId);
    const chapter = topic ? await ctx.db.get(topic.chapterId) : null;
    const subject = chapter ? await ctx.db.get(chapter.subjectId) : null;

    const LESSON_EXCERPT_CHARS = 2400;
    const excerpt: string = await (async () => {
      if (run.lessonId === undefined) {
        return canonicalBlockExcerpt(ctx, run.topicId, LESSON_EXCERPT_CHARS);
      }
      const lesson = await ctx.db.get(run.lessonId);
      if (lesson) {
        return lesson.content.slice(0, LESSON_EXCERPT_CHARS);
      }
      return canonicalBlockExcerpt(ctx, run.topicId, LESSON_EXCERPT_CHARS);
    })();

    return {
      prompt: item.question,
      expectedAnswer: item.answer,
      skill: item.skills[0] ?? "allgemein",
      rubric: item.rubric ?? [],
      lessonExcerpt: excerpt,
      subjectSlug: subject?.slug ?? "",
    };
  },
});

async function canonicalBlockExcerpt(
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
  if (blocks.length === 0) return "";
  blocks.sort((a, b) => a.order - b.order);
  return blocks
    .map((b) => b.content)
    .join("\n\n")
    .slice(0, maxChars);
}

export const getLessonPracticeRunItems = query({
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
      mistake: v.union(
        v.object({
          id: v.id("mistakeEntries"),
          mistakeType: mistakeTypeArg,
          cause: v.union(v.string(), v.null()),
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
      .withIndex("by_practice_set", (q) =>
        q.eq("practiceSetId", run.practiceSetId)
      )
      .collect();
    items.sort((a, b) => a.order - b.order);

    const itemIdsAttempt = items.map((i) => i._id);
    const attemptRows = await Promise.all(
      itemIdsAttempt.map((itemId) =>
        ctx.db
          .query("practiceAttempts")
          .withIndex("by_user_practice_item", (q) =>
            q.eq("userId", user._id).eq("practiceItemId", itemId)
          )
          .collect()
      )
    );
    const attemptByItem = new Map<
      Id<"practiceItems">,
      (typeof attemptRows)[number][number]
    >();
    for (let idx = 0; idx < itemIdsAttempt.length; idx++) {
      for (const a of attemptRows[idx]) {
        const existing = attemptByItem.get(itemIdsAttempt[idx]);
        if (!existing || a.attemptedAt > existing.attemptedAt) {
          attemptByItem.set(itemIdsAttempt[idx], a);
        }
      }
    }

    const topicMistakes = await ctx.db
      .query("mistakeEntries")
      .withIndex("by_user_topic", (q) =>
        q.eq("userId", user._id).eq("topicId", run.topicId)
      )
      .collect();
    const attemptIdsSet = new Set(Array.from(attemptByItem.values()).map((a) => a._id));
    const mistakeByAttempt = new Map<Id<"practiceAttempts">, (typeof topicMistakes)[number]>();
    for (const m of topicMistakes) {
      if (m.practiceAttemptId && attemptIdsSet.has(m.practiceAttemptId)) {
        mistakeByAttempt.set(m.practiceAttemptId, m);
      }
    }

    return items.map((item) => {
      const attempt = attemptByItem.get(item._id) ?? null;
      const mistake =
        attempt && mistakeByAttempt.has(attempt._id)
          ? mistakeByAttempt.get(attempt._id)!
          : null;
      return {
        itemId: item._id,
        order: item.order,
        type: item.type,
        prompt: item.question,
        options: item.options ?? null,
        expectedAnswer: item.answer,
        skill: item.skills[0] ?? "allgemein",
        rubric: item.rubric ?? [],
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
        mistake: mistake
          ? {
              id: mistake._id,
              mistakeType: mistake.mistakeType,
              cause: mistake.cause ?? null,
            }
          : null,
      };
    });
  },
});

export const getCanonicalPracticeSet = query({
  args: { topicId: v.id("topics") },
  handler: async (ctx, { topicId }) => {
    const sets = await ctx.db
      .query("practiceSets")
      .withIndex("by_topic_source", (q) =>
        q.eq("topicId", topicId).eq("source", "canonical_baseline")
      )
      .collect();
    if (sets.length === 0) return null;

    const set = sets[0];
    const items = await ctx.db
      .query("practiceItems")
      .withIndex("by_practice_set", (q) => q.eq("practiceSetId", set._id))
      .collect();
    items.sort((a, b) => a.order - b.order);

    return {
      id: set._id,
      title: set.title,
      difficulty: set.difficulty,
      itemCount: items.length,
      items: items.map((i) => ({
        id: i._id,
        type: i.type,
        question: i.question,
        options: i.options,
        answer: i.answer,
        explanation: i.explanation,
        skills: i.skills,
        order: i.order,
      })),
    };
  },
});

export const startCanonicalPractice = mutation({
  args: { topicId: v.id("topics") },
  returns: v.object({
    runId: v.id("topicLessonPractice"),
    practiceSetId: v.id("practiceSets"),
  }),
  handler: async (ctx, { topicId }) => {
    const user = await requireUser(ctx);

    const sets = await ctx.db
      .query("practiceSets")
      .withIndex("by_topic_source", (q) =>
        q.eq("topicId", topicId).eq("source", "canonical_baseline")
      )
      .collect();
    if (sets.length === 0) throw new Error("canonical_practice_set_not_found");
    const set = sets[0];

    const items = await ctx.db
      .query("practiceItems")
      .withIndex("by_practice_set", (q) => q.eq("practiceSetId", set._id))
      .collect();

    const existingRuns = await ctx.db
      .query("topicLessonPractice")
      .withIndex("by_user_topic", (q) =>
        q.eq("userId", user._id).eq("topicId", topicId)
      )
      .collect();
    for (const r of existingRuns) {
      if (r.status === "in_progress") {
        await ctx.db.patch(r._id, { status: "abandoned" });
      }
    }

    const runId = await ctx.db.insert("topicLessonPractice", {
      userId: user._id,
      topicId,
      lessonId: undefined,
      practiceSetId: set._id,
      startedAt: Date.now(),
      status: "in_progress",
      itemCount: items.length,
      answeredCount: 0,
    });

    return { runId, practiceSetId: set._id };
  },
});
