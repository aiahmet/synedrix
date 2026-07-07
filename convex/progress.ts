import { mutation } from "./_generated/server";
import { v } from "convex/values";

import { requireUser } from "./users";

/**
 * upsertFromSession.
 *
 * Records a session's contribution to the user's topic-level
 * mastery. Idempotent: if a `userTopicProgress` row already
 * exists for the (userId, topicId) tuple, the new mastery is
 * blended in. Otherwise a fresh row is created.
 *
 * Called by `tutor.endSession` whenever a session is scoped to
 * a topic. The blend is a small additive increment bounded at
 * 1.0 so repeated sessions continue to feel meaningful as
 * mastery grows.
 *
 * The session is referenced indirectly (we accept mastery and
 * confidence deltas) so the same helper can be reused for
 * future non-session sources of progress (e.g. a review card
 * answered correctly).
 */
export const upsertFromSession = mutation({
  args: {
    userId: v.id("users"),
    topicId: v.id("topics"),
    masteryDelta: v.number(), // 0..1, typically a small positive increment
    confidenceDelta: v.number(), // 0..1
    timeSpentSec: v.number(),
  },
  returns: v.null(),
  handler: async (
    ctx,
    {
      userId,
      topicId,
      masteryDelta,
      confidenceDelta,
      timeSpentSec,
    }
  ): Promise<null> => {
    const existing = await ctx.db
      .query("userTopicProgress")
      .withIndex("by_user_topic", (q) =>
        q.eq("userId", userId).eq("topicId", topicId)
      )
      .first();

    const now = Date.now();
    const clampedMasteryDelta = Math.max(0, Math.min(1, masteryDelta));
    const clampedConfidenceDelta = Math.max(-1, Math.min(1, confidenceDelta));
    const clampedTime = Math.max(0, Math.floor(timeSpentSec));

    if (existing) {
      // Additive blend with saturation at 1.0. A delta of 0.1 on a
      // 0% topic yields 10%; on a 50% topic yields 60%; on a 100%
      // topic yields 100% (clamped). The (1 - existing) factor
      // makes the curve asymptotic, so repeated sessions continue
      // to feel meaningful as mastery grows but never blow past 1.0.
      const newMastery = Math.max(
        0,
        Math.min(1, existing.mastery + clampedMasteryDelta * (1 - existing.mastery))
      );
      const newConfidence = Math.max(
        0,
        Math.min(1, existing.confidence + clampedConfidenceDelta)
      );

      await ctx.db.patch(existing._id, {
        mastery: newMastery,
        confidence: newConfidence,
        timeSpentSec: existing.timeSpentSec + clampedTime,
        lastStudied: now,
      });
    } else {
      await ctx.db.insert("userTopicProgress", {
        userId,
        topicId,
        mastery: Math.max(0, Math.min(1, clampedMasteryDelta)),
        // 0.4 is the first-session confidence baseline: the user
        // chose to study the topic, so they are at least mildly
        // confident in it. Subsequent sessions nudge this up or
        // down. We intentionally separate confidence (how sure
        // the student is) from mastery (how much of the topic
        // they have actually worked through) so a confused-but-
        // committed student can show high confidence on low
        // mastery, which surfaces as a teachable signal.
        confidence: Math.max(0, Math.min(1, 0.4 + clampedConfidenceDelta)),
        timeSpentSec: clampedTime,
        lastStudied: now,
      });
    }
    return null;
  },
});

export const updateConfidence = mutation({
  args: {
    topicId: v.id("topics"),
    confidence: v.number(),
  },
  returns: v.object({
    mastery: v.number(),
    confidence: v.number(),
    timeSpentSec: v.number(),
  }),
  handler: async (ctx, { topicId, confidence }) => {
    const user = await requireUser(ctx);
    const clamped = Math.max(0, Math.min(1, confidence));
    const now = Date.now();

    const existing = await ctx.db
      .query("userTopicProgress")
      .withIndex("by_user_topic", (q) =>
        q.eq("userId", user._id).eq("topicId", topicId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        confidence: clamped,
        lastStudied: now,
      });
      return {
        mastery: existing.mastery,
        confidence: clamped,
        timeSpentSec: existing.timeSpentSec,
      };
    }

    await ctx.db.insert("userTopicProgress", {
      userId: user._id,
      topicId,
      mastery: 0,
      confidence: clamped,
      timeSpentSec: 0,
      lastStudied: now,
    });
    return { mastery: 0, confidence: clamped, timeSpentSec: 0 };
  },
});
