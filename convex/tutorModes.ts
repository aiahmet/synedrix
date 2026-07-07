import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { resolveUserReadOnly as resolveUser } from "./users";

/**
 * getSummarizeContext.
 *
 * Loads the last 200 messages and up to 5 recent mistakes for the
 * given thread to build a compact summarisation context.
 */
export const getSummarizeContext = query({
  args: {
    threadId: v.id("tutorThreads"),
  },
  returns: v.union(
    v.object({
      topicTitle: v.union(v.string(), v.null()),
      subjectTitle: v.string(),
      messageCount: v.number(),
      history: v.array(
        v.object({
          role: v.union(v.literal("user"), v.literal("assistant")),
          content: v.string(),
        })
      ),
      keyObjectives: v.array(v.string()),
      recentMistakes: v.array(
        v.object({
          question: v.string(),
          userAnswer: v.string(),
          correctAnswer: v.string(),
          mistakeType: v.string(),
        })
      ),
    }),
    v.null()
  ),
  handler: async (ctx, { threadId }) => {
    const start = Date.now();
    const user = await resolveUser(ctx);
    if (!user) {
      const ms = Date.now() - start;
      if (ms > 500) console.warn(`[tutor-telemetry] getSummarizeContext took ${ms}ms`);
      return null;
    }

    const thread = await ctx.db.get(threadId);
    if (!thread || thread.userId !== user._id) {
      const ms = Date.now() - start;
      if (ms > 500) console.warn(`[tutor-telemetry] getSummarizeContext took ${ms}ms`);
      return null;
    }

    const subject = thread.subjectId
      ? await ctx.db.get(thread.subjectId)
      : null;
    if (!subject) {
      const ms = Date.now() - start;
      if (ms > 500) console.warn(`[tutor-telemetry] getSummarizeContext took ${ms}ms`);
      return null;
    }

    const topic = thread.topicId ? await ctx.db.get(thread.topicId) : null;

    // Cap at 200 messages for summarisation context.
    const messages = await ctx.db
      .query("tutorMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .take(200);

    const history = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let keyObjectives: string[] = [];
    let recentMistakes: Array<{
      question: string;
      userAnswer: string;
      correctAnswer: string;
      mistakeType: string;
    }> = [];

    if (topic) {
      keyObjectives = topic.objectives;
      const mistakes = await ctx.db
        .query("mistakeEntries")
        .withIndex("by_user_topic", (q) =>
          q.eq("userId", user._id).eq("topicId", topic._id)
        )
        .take(200);
      recentMistakes = mistakes
        .slice()
        .reverse()
        .slice(0, 5)
        .map((m) => ({
          question: m.question,
          userAnswer: m.userAnswer,
          correctAnswer: m.correctAnswer,
          mistakeType: m.mistakeType,
        }));
    }

    const result = {
      topicTitle: topic?.title ?? null,
      subjectTitle: subject.title,
      messageCount: messages.length,
      history,
      keyObjectives,
      recentMistakes,
    };
    const ms = Date.now() - start;
    if (ms > 500) console.warn(`[tutor-telemetry] getSummarizeContext took ${ms}ms`);
    return result;
  },
});

/**
 * getExamContext.
 *
 * Loads the last 200 messages, up to 50 recent mistakes, and
 * up to 20 sibling topics to build an exam-generation context.
 */
export const getExamContext = query({
  args: {
    threadId: v.id("tutorThreads"),
  },
  returns: v.union(
    v.object({
      subjectTitle: v.string(),
      subjectSlug: v.string(),
      topicTitle: v.union(v.string(), v.null()),
      topicObjectives: v.array(v.string()),
      topicDifficulty: v.union(
        v.literal("EASY"),
        v.literal("MEDIUM"),
        v.literal("HARD"),
        v.null()
      ),
      mastery: v.number(),
      confidence: v.number(),
      recentMistakes: v.array(
        v.object({
          question: v.string(),
          userAnswer: v.string(),
          correctAnswer: v.string(),
          mistakeType: v.string(),
        })
      ),
      history: v.array(
        v.object({
          role: v.union(v.literal("user"), v.literal("assistant")),
          content: v.string(),
        })
      ),
      relatedTopics: v.array(
        v.object({
          title: v.string(),
          slug: v.string(),
          mastery: v.number(),
        })
      ),
    }),
    v.null()
  ),
  handler: async (ctx, { threadId }) => {
    const start = Date.now();
    const user = await resolveUser(ctx);
    if (!user) {
      const ms = Date.now() - start;
      if (ms > 500) console.warn(`[tutor-telemetry] getExamContext took ${ms}ms`);
      return null;
    }

    const thread = await ctx.db.get(threadId);
    if (!thread || thread.userId !== user._id) {
      const ms = Date.now() - start;
      if (ms > 500) console.warn(`[tutor-telemetry] getExamContext took ${ms}ms`);
      return null;
    }

    const subject = thread.subjectId
      ? await ctx.db.get(thread.subjectId)
      : null;
    if (!subject) {
      const ms = Date.now() - start;
      if (ms > 500) console.warn(`[tutor-telemetry] getExamContext took ${ms}ms`);
      return null;
    }

    const topic = thread.topicId ? await ctx.db.get(thread.topicId) : null;

    // Cap at 200 messages for exam context.
    const messages = await ctx.db
      .query("tutorMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .take(200);

    const history = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let mastery = 0;
    let confidence = 0;
    let objectives: string[] = [];
    let recentMistakes: Array<{
      question: string;
      userAnswer: string;
      correctAnswer: string;
      mistakeType: string;
    }> = [];
    let relatedTopics: Array<{
      title: string;
      slug: string;
      mastery: number;
    }> = [];

    if (topic) {
      objectives = topic.objectives;

      const progress = await ctx.db
        .query("userTopicProgress")
        .withIndex("by_user_topic", (q) =>
          q.eq("userId", user._id).eq("topicId", topic._id)
        )
        .first();
      if (progress) {
        mastery = progress.mastery;
        confidence = progress.confidence;
      }

      // Cap at 50 recent mistakes for exam generation.
      const mistakes = await ctx.db
        .query("mistakeEntries")
        .withIndex("by_user_topic", (q) =>
          q.eq("userId", user._id).eq("topicId", topic._id)
        )
        .take(50);
      recentMistakes = mistakes
        .slice()
        .reverse()
        .slice(0, 5)
        .map((m) => ({
          question: m.question,
          userAnswer: m.userAnswer,
          correctAnswer: m.correctAnswer,
          mistakeType: m.mistakeType,
        }));

      const chapter = await ctx.db.get(topic.chapterId);
      if (chapter) {
        // Cap at 20 sibling topics for exam context.
        const siblingTopics = await ctx.db
          .query("topics")
          .withIndex("by_chapter", (q) => q.eq("chapterId", chapter._id))
          .take(20);
        const siblingProgress = await ctx.db
          .query("userTopicProgress")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect();
        const progressMap = new Map<Id<"topics">, number>();
        for (const p of siblingProgress) progressMap.set(p.topicId, p.mastery);

        relatedTopics = siblingTopics
          .filter((t) => t._id !== topic._id)
          .slice(0, 5)
          .map((t) => ({
            title: t.title,
            slug: t.slug,
            mastery: progressMap.get(t._id) ?? 0,
          }));
      }
    }

    const result = {
      subjectTitle: subject.title,
      subjectSlug: subject.slug,
      topicTitle: topic?.title ?? null,
      topicObjectives: objectives,
      topicDifficulty: topic?.difficulty ?? null,
      mastery,
      confidence,
      recentMistakes,
      history,
      relatedTopics,
    };
    const ms = Date.now() - start;
    if (ms > 500) console.warn(`[tutor-telemetry] getExamContext took ${ms}ms`);
    return result;
  },
});

/**
 * getCompareContext.
 *
 * Loads the last 200 messages and up to 20 sibling topics to
 * build a comparison / differentiation tutoring context.
 */
export const getCompareContext = query({
  args: {
    threadId: v.id("tutorThreads"),
  },
  returns: v.union(
    v.object({
      subjectTitle: v.string(),
      subjectSlug: v.string(),
      currentTopic: v.union(
        v.object({
          title: v.string(),
          slug: v.string(),
          objectives: v.array(v.string()),
          difficulty: v.union(
            v.literal("EASY"),
            v.literal("MEDIUM"),
            v.literal("HARD")
          ),
          mastery: v.number(),
        }),
        v.null()
      ),
      siblingTopics: v.array(
        v.object({
          title: v.string(),
          slug: v.string(),
          difficulties: v.union(
            v.literal("EASY"),
            v.literal("MEDIUM"),
            v.literal("HARD")
          ),
          mastery: v.number(),
        })
      ),
      history: v.array(
        v.object({
          role: v.union(v.literal("user"), v.literal("assistant")),
          content: v.string(),
        })
      ),
    }),
    v.null()
  ),
  handler: async (ctx, { threadId }) => {
    const start = Date.now();
    const user = await resolveUser(ctx);
    if (!user) {
      const ms = Date.now() - start;
      if (ms > 500) console.warn(`[tutor-telemetry] getCompareContext took ${ms}ms`);
      return null;
    }

    const thread = await ctx.db.get(threadId);
    if (!thread || thread.userId !== user._id) {
      const ms = Date.now() - start;
      if (ms > 500) console.warn(`[tutor-telemetry] getCompareContext took ${ms}ms`);
      return null;
    }

    const subject = thread.subjectId
      ? await ctx.db.get(thread.subjectId)
      : null;
    if (!subject) {
      const ms = Date.now() - start;
      if (ms > 500) console.warn(`[tutor-telemetry] getCompareContext took ${ms}ms`);
      return null;
    }

    const topic = thread.topicId ? await ctx.db.get(thread.topicId) : null;
    if (!topic || !thread.topicId) {
      const ms = Date.now() - start;
      if (ms > 500) console.warn(`[tutor-telemetry] getCompareContext took ${ms}ms`);
      return null;
    }

    // Cap at 200 messages for compare context.
    const messages = await ctx.db
      .query("tutorMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .take(200);

    const history = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const progress = await ctx.db
      .query("userTopicProgress")
      .withIndex("by_user_topic", (q) =>
        q.eq("userId", user._id).eq("topicId", topic._id)
      )
      .first();

    const currentTopic = {
      title: topic.title,
      slug: topic.slug,
      objectives: topic.objectives,
      difficulty: topic.difficulty,
      mastery: progress?.mastery ?? 0,
    };

    const chapter = await ctx.db.get(topic.chapterId);
    if (!chapter) {
      const ms = Date.now() - start;
      if (ms > 500) console.warn(`[tutor-telemetry] getCompareContext took ${ms}ms`);
      return null;
    }

    // Cap at 20 sibling topics for comparison.
    const siblingTopics = await ctx.db
      .query("topics")
      .withIndex("by_chapter", (q) => q.eq("chapterId", chapter._id))
      .take(20);

    const allProgress = await ctx.db
      .query("userTopicProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const progressMap = new Map<Id<"topics">, number>();
    for (const p of allProgress) progressMap.set(p.topicId, p.mastery);

    const siblings = siblingTopics
      .filter((t) => t._id !== topic._id)
      .map((t) => ({
        title: t.title,
        slug: t.slug,
        difficulties: t.difficulty,
        mastery: progressMap.get(t._id) ?? 0,
      }));

    const result = {
      subjectTitle: subject.title,
      subjectSlug: subject.slug,
      currentTopic,
      siblingTopics: siblings,
      history,
    };
    const ms = Date.now() - start;
    if (ms > 500) console.warn(`[tutor-telemetry] getCompareContext took ${ms}ms`);
    return result;
  },
});
