import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id, Doc } from "./_generated/dataModel";
import { requireUser, resolveUserReadOnly as resolveUser } from "./users";
import { recommendNextBest, type NextBestRecommendation } from "./_lib/recommendNextBest";
import { api } from "./_generated/api";

/**
 * Minimum session length, in seconds, for the mastery
 * bump in `endSession` to apply. Below this, the user almost
 * certainly opened the tab and closed it by accident; the
 * mastery curve is reserved for sessions, not opens.
 */
const MIN_SESSION_SEC = 60;

/**
 * endSession.
 *
 * Atomically closes the study session, optionally stores a
 * reflection, and (if the session is topic-scoped and long
 * enough) blends a small mastery increment into the user's
 * topic-level progress. Idempotent.
 */
export const endSession = mutation({
  args: {
    sessionId: v.id("studySessions"),
    durationSec: v.number(),
    reflection: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      masteryDelta: v.number(),
      newMastery: v.number(),
      newConfidence: v.number(),
      durationSec: v.number(),
      reflection: v.union(v.string(), v.null()),
      hadReflectionBonus: v.boolean(),
      nextBest: v.union(
        v.object({
          subject: v.object({
            slug: v.string(),
            title: v.string(),
            color: v.optional(v.string()),
          }),
          chapter: v.object({ slug: v.string(), title: v.string() }),
          topic: v.object({
            id: v.id("topics"),
            slug: v.string(),
            title: v.string(),
            examRelevance: v.number(),
            mastery: v.number(),
            source: v.union(v.literal("canonical"), v.literal("user")),
            ownerId: v.union(v.id("users"), v.null()),
          }),
          reason: v.string(),
        }),
        v.null()
      ),
    }),
    v.null()
  ),
  handler: async (
    ctx,
    { sessionId, durationSec, reflection }
  ): Promise<{
    masteryDelta: number;
    newMastery: number;
    newConfidence: number;
    durationSec: number;
    reflection: string | null;
    hadReflectionBonus: boolean;
    nextBest: NextBestRecommendation | null;
  } | null> => {
    const user = await requireUser(ctx);
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.userId !== user._id) throw new Error("Forbidden");
    if (session.completedAt !== undefined) return null;

    const now = Date.now();
    const actualDuration = Math.max(
      0,
      Math.min(Math.floor(durationSec), 24 * 60 * 60)
    );

    await ctx.db.patch(sessionId, {
      durationSec: actualDuration,
      completedAt: now,
      ...(reflection !== undefined ? { reflection } : {}),
    });

    let masteryDelta = 0;
    let newMastery = 0;
    let newConfidence = 0;
    let hadReflectionBonus = false;
    if (session.topicId && actualDuration >= MIN_SESSION_SEC) {
      const baseIncrement = 0.1;
      const reflectionBonus =
        reflection && reflection.trim().length > 0 ? 0.05 : 0;
      const confidenceDelta = 0.05 + (reflectionBonus > 0 ? 0.05 : 0);
      hadReflectionBonus = reflectionBonus > 0;
      masteryDelta = baseIncrement + reflectionBonus;

      const prior = await ctx.db
        .query("userTopicProgress")
        .withIndex("by_user_topic", (q) =>
          q.eq("userId", user._id).eq("topicId", session.topicId!)
        )
        .first();

      await ctx.runMutation(api.progress.upsertFromSession, {
        userId: user._id,
        topicId: session.topicId!,
        masteryDelta,
        confidenceDelta,
        timeSpentSec: actualDuration,
      });

      const post = await ctx.db
        .query("userTopicProgress")
        .withIndex("by_user_topic", (q) =>
          q.eq("userId", user._id).eq("topicId", session.topicId!)
        )
        .first();
      newMastery = post?.mastery ?? (prior ? prior.mastery + masteryDelta : masteryDelta);
      newConfidence = post?.confidence ?? 0;
    } else if (session.topicId) {
      const post = await ctx.db
        .query("userTopicProgress")
        .withIndex("by_user_topic", (q) =>
          q.eq("userId", user._id).eq("topicId", session.topicId!)
        )
        .first();
      newMastery = post?.mastery ?? 0;
      newConfidence = post?.confidence ?? 0;
    }

    let nextBestSummary: NextBestRecommendation | null = null;
    if (session.subjectId) {
      nextBestSummary = await recommendNextBest(ctx, {
        userId: user._id,
        scope: { kind: "subject", subjectId: session.subjectId },
        excludeTopicId: session.topicId,
      });
    }

    // Phase 2 §4.2: trigger cross-topic mistake pattern
    // detection after the session closes and mastery is
    // updated. Fire-and-forget — the pattern detection
    // runs asynchronously and does not block the session
    // end response.
    ctx.scheduler
      .runAfter(0, api.tutorPatterns.detect, {})
      .catch((err) =>
        console.error("endSession: tutorPatterns.detect failed", err)
      );

    return {
      masteryDelta,
      newMastery,
      newConfidence,
      durationSec: actualDuration,
      reflection: reflection ?? null,
      hadReflectionBonus,
      nextBest: nextBestSummary,
    };
  },
});

/**
 * getSubjectTopicsForEmptyState.
 */
export const getSubjectTopicsForEmptyState = query({
  args: {
    subjectId: v.id("subjects"),
    limit: v.optional(v.number()),
  },
  returns: v.union(
    v.array(
      v.object({
        id: v.id("topics"),
        slug: v.string(),
        title: v.string(),
        chapterSlug: v.string(),
        chapterTitle: v.string(),
        mastery: v.number(),
        isStudied: v.boolean(),
        examRelevance: v.number(),
      })
    ),
    v.null()
  ),
  handler: async (ctx, { subjectId, limit }) => {
    const cap = Math.max(1, Math.min(limit ?? 6, 20));
    const subject = await ctx.db.get(subjectId);
    if (!subject) return null;

    const user = await resolveUser(ctx);
    const userId: Id<"users"> | null = user ? user._id : null;

    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_subject_order", (q) => q.eq("subjectId", subject._id))
      .collect();
    chapters.sort((a, b) => a.order - b.order);

    const allTopics = (
      await Promise.all(
        chapters.map((ch) =>
          ctx.db
            .query("topics")
            .withIndex("by_chapter", (q) => q.eq("chapterId", ch._id))
            .collect()
        )
      )
    ).flat();

    if (allTopics.length === 0) return [];

    const progressRows =
      userId !== null
        ? await ctx.db
            .query("userTopicProgress")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .collect()
        : [];
    const progressByTopic = new Map<Id<"topics">, Doc<"userTopicProgress">>();
    for (const p of progressRows) progressByTopic.set(p.topicId, p);

    const rows = allTopics
      .map((t) => {
        const ch = chapters.find((c) => c._id === t.chapterId);
        if (!ch) return null;
        const p = progressByTopic.get(t._id);
        return {
          id: t._id,
          slug: t.slug,
          title: t.title,
          chapterSlug: ch.slug,
          chapterTitle: ch.title,
          mastery: p ? p.mastery : 0,
          isStudied: p !== null,
          examRelevance: t.examRelevance,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    rows.sort((a, b) => {
      if (a.isStudied !== b.isStudied) return a.isStudied ? 1 : -1;
      if (a.mastery !== b.mastery) return a.mastery - b.mastery;
      return b.examRelevance - a.examRelevance;
    });

    return rows.slice(0, cap);
  },
});
