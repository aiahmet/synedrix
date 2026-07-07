import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id, Doc } from "./_generated/dataModel";
import { resolveTopicChains } from "./_lib/topicChain";
import { requireUser, resolveUserReadOnly as resolveUser } from "./users";
import { recommendNextBest } from "./_lib/recommendNextBest";
import { computeStreak } from "./_lib/streak";
import { computeWeeklyStats, collectOverdueTopics, resolveGoalSubjects, resolveTemplateSubjects } from "./_lib/plannerHelpers";

const DAY_MS = 86_400_000;

export const getPlannerOverview = query({
  args: {},
  returns: v.object({
    goals: v.array(
      v.object({
        id: v.id("goals"),
        title: v.string(),
        type: v.union(v.literal("daily"), v.literal("weekly")),
        targetCount: v.union(v.number(), v.null()),
        completedCount: v.number(),
        deadline: v.union(v.number(), v.null()),
        subjectTitle: v.union(v.string(), v.null()),
        subjectColor: v.union(v.string(), v.null()),
      })
    ),
    templates: v.array(
      v.object({
        id: v.id("sessionTemplates"),
        title: v.string(),
        description: v.union(v.string(), v.null()),
        subjectId: v.union(v.id("subjects"), v.null()),
        subjectTitle: v.union(v.string(), v.null()),
        subjectColor: v.union(v.string(), v.null()),
        intentionHint: v.union(v.string(), v.null()),
        targetMinutes: v.union(v.number(), v.null()),
      })
    ),
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
    overdueTopics: v.array(
      v.object({
        id: v.id("topics"),
        slug: v.string(),
        title: v.string(),
        subjectTitle: v.string(),
        subjectSlug: v.string(),
        subjectColor: v.union(v.string(), v.null()),
        chapterSlug: v.string(),
        mastery: v.number(),
        lastStudied: v.union(v.number(), v.null()),
        daysSinceStudy: v.union(v.number(), v.null()),
      })
    ),
    weeklyStats: v.object({
      totalMinutes: v.number(),
      totalSessions: v.number(),
      streakDays: v.number(),
      goalCompletionRate: v.number(),
    }),
  }),
  handler: async (ctx) => {
    const user = await resolveUser(ctx);
    if (!user) {
      return {
        goals: [],
        templates: [],
        nextBest: null,
        overdueTopics: [],
        weeklyStats: { totalMinutes: 0, totalSessions: 0, streakDays: 0, goalCompletionRate: 0 },
      };
    }

    const now = Date.now();

    const [goals, templates, weeklyStats, overdueTopics, nextBest] =
      await Promise.all([
        ctx.db.query("goals").withIndex("by_user_type", (q) => q.eq("userId", user._id)).take(50),
        ctx.db.query("sessionTemplates").withIndex("by_user", (q) => q.eq("userId", user._id)).take(50),
        computeWeeklyStats(ctx, user._id, now),
        collectOverdueTopics(ctx, user._id, now, 10),
        recommendNextBest(ctx, {
          userId: user._id,
          scope: { kind: "all_enrolled" },
        }),
      ]);

    return {
      goals: await resolveGoalSubjects(ctx, goals),
      templates: await resolveTemplateSubjects(ctx, templates),
      nextBest,
      overdueTopics,
      weeklyStats,
    };
  },
});

export const listTemplates = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("sessionTemplates"),
      title: v.string(),
      description: v.union(v.string(), v.null()),
      subjectId: v.union(v.id("subjects"), v.null()),
      subjectTitle: v.union(v.string(), v.null()),
      subjectColor: v.union(v.string(), v.null()),
      intentionHint: v.union(v.string(), v.null()),
      targetMinutes: v.union(v.number(), v.null()),
    })
  ),
  handler: async (ctx) => {
    const user = await resolveUser(ctx);
    if (!user) return [];
    const templates = await ctx.db
      .query("sessionTemplates")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const subjectIds = Array.from(new Set(
      templates.map((t) => t.subjectId).filter((id): id is Id<"subjects"> => id !== undefined && id !== null)
    ));
    const subjectRows = subjectIds.length > 0
      ? await Promise.all(subjectIds.map((id) => ctx.db.get(id)))
      : [];
    const subjectMap = new Map<Id<"subjects">, Doc<"subjects">>();
    for (const s of subjectRows) if (s) subjectMap.set(s._id, s);

    return templates.map((t) => {
      const subject = t.subjectId ? subjectMap.get(t.subjectId) : undefined;
      return {
        id: t._id,
        title: t.title,
        description: t.description ?? null,
        subjectId: t.subjectId ?? null,
        subjectTitle: subject?.title ?? null,
        subjectColor: subject?.color ?? null,
        intentionHint: t.intentionHint ?? null,
        targetMinutes: t.targetMinutes ?? null,
      };
    });
  },
});

export const createTemplate = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    subjectId: v.optional(v.id("subjects")),
    intentionHint: v.optional(v.string()),
    targetMinutes: v.optional(v.number()),
  },
  returns: v.id("sessionTemplates"),
  handler: async (ctx, args): Promise<Id<"sessionTemplates">> => {
    const user = await requireUser(ctx);
    return await ctx.db.insert("sessionTemplates", {
      userId: user._id,
      title: args.title,
      description: args.description,
      subjectId: args.subjectId,
      intentionHint: args.intentionHint,
      targetMinutes: args.targetMinutes,
    });
  },
});

export const removeTemplate = mutation({
  args: { templateId: v.id("sessionTemplates") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const user = await requireUser(ctx);
    const tpl = await ctx.db.get(args.templateId);
    if (!tpl || tpl.userId !== user._id) return null;
    await ctx.db.delete(args.templateId);
    return null;
  },
});

export const getRecoveryPlan = query({
  args: {},
  returns: v.object({
    plan: v.union(
      v.object({
        overdueCount: v.number(),
        totalTopics: v.number(),
        suggestedSessionMinutes: v.number(),
        priorityTopics: v.array(
          v.object({
            title: v.string(),
            slug: v.string(),
            subjectTitle: v.string(),
            subjectSlug: v.string(),
            subjectColor: v.union(v.string(), v.null()),
            chapterSlug: v.string(),
            mastery: v.number(),
            daysSinceStudy: v.number(),
            reason: v.string(),
          })
        ),
        narrative: v.string(),
      }),
      v.null()
    ),
    missedDaysCount: v.number(),
    isRecoveryNeeded: v.boolean(),
  }),
  handler: async (ctx) => {
    const user = await resolveUser(ctx);
    if (!user) return { plan: null, missedDaysCount: 0, isRecoveryNeeded: false };

    const now = Date.now();
    const sessions = await ctx.db
      .query("studySessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(500);

    const completedTimes = sessions
      .map((s) => s.completedAt)
      .filter((t): t is number => typeof t === "number");
    const streak = computeStreak(completedTimes, now, { timeZone: "UTC" });
    const dayKey = (ms: number) => Math.floor(ms / DAY_MS);
    const todayKey = dayKey(now);
    const studyDays = new Set(completedTimes.map(dayKey));

    let missedDaysCount = 0;
    for (let d = todayKey - 1; d >= todayKey - 14; d--) {
      if (!studyDays.has(d)) missedDaysCount++;
    }

    const isRecoveryNeeded = missedDaysCount >= 3 || streak === 0;
    if (!isRecoveryNeeded) return { plan: null, missedDaysCount, isRecoveryNeeded: false };

    const allProgress = await ctx.db
      .query("userTopicProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(200);

    const candidateProgress = allProgress
      .filter((p) => {
        if (!p.lastStudied) return false;
        if (p.mastery >= 0.85) return false;
        const daysSince = Math.floor((now - p.lastStudied) / DAY_MS);
        return daysSince >= 3 && p.mastery < 0.6;
      })
      .sort((a, b) => {
        const aDays = a.lastStudied ? Math.floor((now - a.lastStudied) / DAY_MS) : 0;
        const bDays = b.lastStudied ? Math.floor((now - b.lastStudied) / DAY_MS) : 0;
        return bDays - aDays;
      })
      .slice(0, 6);

    const candidateIds = candidateProgress.map((p) => p.topicId);
    const chains = await resolveTopicChains(ctx, candidateIds);

    const priorityTopics = candidateProgress
      .map((p) => {
        const chain = chains.get(p.topicId);
        if (!chain) return null;
        const { topic, chapter, subject } = chain;
        const daysSince = p.lastStudied ? Math.floor((now - p.lastStudied) / DAY_MS) : 0;
        return {
          title: topic.title,
          slug: topic.slug,
          subjectTitle: subject.title,
          subjectSlug: subject.slug,
          subjectColor: subject.color ?? null,
          chapterSlug: chapter.slug,
          mastery: p.mastery,
          daysSinceStudy: daysSince,
          reason: daysSince >= 14
            ? `Last touched ${daysSince} days ago — needs a full refresh.`
            : daysSince >= 7
              ? `${daysSince} days since last study — refresh before it fades.`
              : `${daysSince} days — a quick review keeps this active.`,
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);

    const overdueCount = priorityTopics.length;
    const suggestedSessionMinutes = Math.min(90, Math.max(30, overdueCount * 15));
    const narrative = missedDaysCount >= 7
      ? `You have missed ${missedDaysCount} days — no pressure. Start with 15 minutes on one topic today.`
      : `${missedDaysCount} missed days. A single focused session today resets the streak.`;

    return {
      plan: { overdueCount, totalTopics: allProgress.length, suggestedSessionMinutes, priorityTopics, narrative },
      missedDaysCount,
      isRecoveryNeeded: true,
    };
  },
});
