import { query } from "./_generated/server";
import { v } from "convex/values";
import { resolveUserReadOnly as resolveUser } from "./users";

export const getPersonalizationSignals = query({
  args: {
    subjectId: v.optional(v.id("subjects")),
    topicId: v.optional(v.id("topics")),
  },
  returns: v.object({
    recommendedSessionType: v.union(
      v.literal("practice"),
      v.literal("review"),
      v.literal("learn_new"),
      v.literal("exam_prep"),
      v.literal("quick_refresh"),
      v.null()
    ),
    suggestedRevisionTiming: v.union(
      v.literal("now"),
      v.literal("tomorrow"),
      v.literal("in_2_days"),
      v.literal("in_a_week"),
      v.null()
    ),
    difficultyAdjustment: v.union(
      v.literal("easier"),
      v.literal("current"),
      v.literal("harder"),
      v.null()
    ),
    responseStyle: v.union(
      v.literal("concise"),
      v.literal("standard"),
      v.literal("detailed"),
      v.null()
    ),
    sessionTypeReason: v.union(v.string(), v.null()),
    revisionTimingReason: v.union(v.string(), v.null()),
  }),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handler: async (ctx, { subjectId, topicId }) => {
    const user = await resolveUser(ctx);
    if (!user) {
      return {
        recommendedSessionType: null,
        suggestedRevisionTiming: null,
        difficultyAdjustment: null,
        responseStyle: null,
        sessionTypeReason: null,
        revisionTimingReason: null,
      };
    }

    const profile = await ctx.db
      .query("tutorProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    let recommendedSessionType: "practice" | "review" | "learn_new" | "exam_prep" | "quick_refresh" | null = null;
    let sessionTypeReason: string | null = null;
    let suggestedRevisionTiming: "now" | "tomorrow" | "in_2_days" | "in_a_week" | null = null;
    let revisionTimingReason: string | null = null;
    let difficultyAdjustment: "easier" | "current" | "harder" | null = "current";
    let responseStyle: "concise" | "standard" | "detailed" | null = "standard";

    if (profile) {
      responseStyle =
        profile.preferredExplanationStyle === "simple" ? "concise" : profile.preferredExplanationStyle === "rigorous" ? "detailed" : "standard";

      if (profile.learningPreference === "practice") {
        recommendedSessionType = "practice";
        sessionTypeReason = "You learn best through practice.";
      } else if (profile.learningPreference === "reading") {
        recommendedSessionType = "learn_new";
        sessionTypeReason = "You learn best by reading through new material.";
      } else if (profile.learningPreference === "mixed") {
        recommendedSessionType = "quick_refresh";
        sessionTypeReason = "A mixed session keeps things fresh.";
      }
    }

    if (!topicId) {
      return {
        recommendedSessionType,
        suggestedRevisionTiming,
        difficultyAdjustment,
        responseStyle,
        sessionTypeReason,
        revisionTimingReason,
      };
    }

    const progress = await ctx.db
      .query("userTopicProgress")
      .withIndex("by_user_topic", (q) =>
        q.eq("userId", user._id).eq("topicId", topicId)
      )
      .first();

    const mastery = progress?.mastery ?? 0;
    const lastStudied = progress?.lastStudied ?? null;

    const mistakes = await ctx.db
      .query("mistakeEntries")
      .withIndex("by_user_topic", (q) =>
        q.eq("userId", user._id).eq("topicId", topicId)
      )
      .collect();
    const mistakeCount = mistakes.length;

    if (mastery < 0.3) {
      recommendedSessionType = "learn_new";
      sessionTypeReason = "You are just getting started on this topic.";
      difficultyAdjustment = "easier";
    } else if (mastery >= 0.3 && mastery < 0.6) {
      recommendedSessionType = "practice";
      sessionTypeReason = "Time to practice and lock in the fundamentals.";
      difficultyAdjustment = "current";
    } else if (mastery >= 0.6 && mastery < 0.85) {
      if (mistakeCount > 3) {
        recommendedSessionType = "review";
        sessionTypeReason = "You have a few recurring mistakes to address.";
      } else {
        recommendedSessionType = "practice";
        sessionTypeReason = "Almost there — targeted practice will seal it.";
      }
      difficultyAdjustment = "current";
    } else {
      recommendedSessionType = "exam_prep";
      sessionTypeReason = "High mastery — time to simulate exam conditions.";
      difficultyAdjustment = "harder";
    }

    if (lastStudied) {
      const now = Date.now();
      const hoursSince = (now - lastStudied) / (1000 * 60 * 60);

      if (hoursSince < 2 && mastery >= 0.5) {
        suggestedRevisionTiming = "tomorrow";
        revisionTimingReason = "You just studied — let it settle overnight.";
      } else if (hoursSince >= 24 && hoursSince < 72 && mastery >= 0.4) {
        suggestedRevisionTiming = "now";
        revisionTimingReason = "Good timing for a quick review to reinforce.";
      } else if (hoursSince >= 72 && hoursSince < 168 && mastery >= 0.6) {
        suggestedRevisionTiming = "in_2_days";
        revisionTimingReason = "The material has settled — 2 more days and it will be ready.";
      } else if (hoursSince >= 168) {
        suggestedRevisionTiming = "now";
        revisionTimingReason = "It has been a week — review now before it fades.";
      } else {
        suggestedRevisionTiming = "now";
      }
    }

    return {
      recommendedSessionType,
      suggestedRevisionTiming,
      difficultyAdjustment,
      responseStyle,
      sessionTypeReason,
      revisionTimingReason,
    };
  },
});
