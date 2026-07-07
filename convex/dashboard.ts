import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Id, Doc } from "./_generated/dataModel";
import { computeStreak } from "./_lib/streak";
import { resolveTopicChain, resolveTopicChains } from "./_lib/topicChain";

export const getOverview = query({
  args: {
    timeZone: v.optional(v.string()),
  },
  returns: v.object({
    user: v.union(
      v.object({
        id: v.string(),
        name: v.string(),
        firstStudyDate: v.union(v.number(), v.null()),
      }),
      v.null()
    ),
    subjects: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        slug: v.string(),
        color: v.optional(v.string()),
        icon: v.optional(v.string()),
        mastery: v.number(),
        topicsTotal: v.number(),
        topicsStudied: v.number(),
      })
    ),
    stats: v.object({
      dueToday: v.number(),
      dueTomorrow: v.number(),
      streakDays: v.number(),
      overallMastery: v.number(),
      topicsStudied: v.number(),
      topicsTotal: v.number(),
    }),
    isEmpty: v.boolean(),
  }),
  handler: async (ctx, { timeZone }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return emptyOverview();
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) {
      return emptyOverview();
    }

    const userId: Id<"users"> = user._id;
    const now = Date.now();

    const [allProgress, enrollments, subjectsRaw, sessions] = await Promise.all([
      ctx.db
        .query("userTopicProgress")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .take(PROGRESS_OVERVIEW_CAP),
      ctx.db
        .query("userSubjects")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .take(ENROLLMENT_CAP),
      ctx.db.query("subjects").collect(),
      ctx.db
        .query("studySessions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .take(SESSION_OVERVIEW_CAP),
    ]);

    type SubjectAcc = {
      subject: Doc<"subjects">;
      masterySum: number;
      topicsStudied: number;
    };
    const subjectMap = new Map<Id<"subjects">, SubjectAcc>();

    if (enrollments.length > 0) {
      for (const e of enrollments) {
        const subject = subjectsRaw.find((s) => s._id === e.subjectId);
        if (!subject) continue;
        if (!subjectMap.has(subject._id)) {
          subjectMap.set(subject._id, {
            subject,
            masterySum: 0,
            topicsStudied: 0,
          });
        }
      }
    }

    const allTopicIds = Array.from(
      new Set(allProgress.map((p) => p.topicId))
    );
    const TOPIC_LOAD_BATCH = 200;
    const topicRows = allTopicIds.length > 0
      ? (await Promise.all(
          allTopicIds.slice(0, TOPIC_LOAD_BATCH).map((id) => ctx.db.get(id))
        ))
      : [];
    const topicToSubject = new Map<Id<"topics">, Id<"subjects">>();
    const chapterCache = new Map<Id<"chapters">, Doc<"chapters">>();
    const CH_LOAD_BATCH = 100;
    const uniqueChapterIds = Array.from(
      new Set(topicRows.filter(Boolean).map((t) => t!.chapterId))
    ).slice(0, CH_LOAD_BATCH);
    const chapterRows = await Promise.all(
      uniqueChapterIds.map((id) => ctx.db.get(id))
    );
    for (const chapter of chapterRows) {
      if (chapter) chapterCache.set(chapter._id, chapter);
    }
    for (const topic of topicRows) {
      if (!topic) continue;
      const chapter = chapterCache.get(topic.chapterId);
      if (!chapter) continue;
      topicToSubject.set(topic._id, chapter.subjectId);
    }

    if (enrollments.length === 0) {
      for (const subjectId of topicToSubject.values()) {
        const subject = subjectsRaw.find((s) => s._id === subjectId);
        if (!subject) continue;
        if (!subjectMap.has(subject._id)) {
          subjectMap.set(subject._id, {
            subject,
            masterySum: 0,
            topicsStudied: 0,
          });
        }
      }
    }

    let overallMasterySum = 0;
    const perTopicMastery = new Map<Id<"topics">, { sum: number; n: number }>();
    for (const p of allProgress) {
      overallMasterySum += p.mastery;
      const acc = perTopicMastery.get(p.topicId) ?? { sum: 0, n: 0 };
      acc.sum += p.mastery;
      acc.n += 1;
      perTopicMastery.set(p.topicId, acc);
    }
    const overallMastery =
      allProgress.length > 0 ? overallMasterySum / allProgress.length : 0;

    for (const [topicId, agg] of perTopicMastery) {
      const subjectIdForTopic = topicToSubject.get(topicId);
      if (!subjectIdForTopic) continue;
      const acc = subjectMap.get(subjectIdForTopic);
      if (!acc) continue;
      acc.masterySum += agg.sum / agg.n;
      acc.topicsStudied += 1;
    }

    const totalTopicsBySubject = new Map<Id<"subjects">, number>();
    const subjectIds = subjectsRaw.map((s) => s._id);
    const chapterLists = await Promise.all(
      subjectIds.map((subjId) =>
        ctx.db
          .query("chapters")
          .withIndex("by_subject", (q) => q.eq("subjectId", subjId))
          .collect()
      )
    );
    const chapterIdsPerSubject = new Map<Id<"subjects">, Id<"chapters">[]>();
    for (let i = 0; i < subjectIds.length; i++) {
      chapterIdsPerSubject.set(
        subjectIds[i],
        chapterLists[i].map((ch) => ch._id)
      );
    }
    const allChapterIds = Array.from(
      new Set(
        chapterLists.flat().map((ch) => ch._id)
      )
    );
    const TOPIC_BATCH = 300;
    const topicCountLists = allChapterIds.length > 0
      ? await Promise.all(
          allChapterIds.slice(0, TOPIC_BATCH).map((chId) =>
            ctx.db
              .query("topics")
              .withIndex("by_chapter", (q) => q.eq("chapterId", chId))
              .collect()
          )
        )
      : [];
    const chapterTopicCounts = new Map<Id<"chapters">, number>();
    for (let i = 0; i < Math.min(allChapterIds.length, TOPIC_BATCH); i++) {
      chapterTopicCounts.set(allChapterIds[i], topicCountLists[i].length);
    }
    for (const [subjId, chIds] of chapterIdsPerSubject) {
      let sum = 0;
      for (const chId of chIds) {
        sum += chapterTopicCounts.get(chId) ?? 0;
      }
      totalTopicsBySubject.set(subjId, sum);
    }

    const subjects = Array.from(subjectMap.values())
      .map((entry) => {
        const topicsTotal = totalTopicsBySubject.get(entry.subject._id) ?? 0;
        return {
          id: entry.subject._id,
          title: entry.subject.title,
          slug: entry.subject.slug,
          color: entry.subject.color,
          icon: entry.subject.icon,
          mastery:
            entry.topicsStudied > 0
              ? entry.masterySum / entry.topicsStudied
              : 0,
          topicsTotal,
          topicsStudied: entry.topicsStudied,
        };
      })
      .sort((a, b) => b.mastery - a.mastery);

    const [dueReviews, dueReviewsNext] = await Promise.all([
      ctx.db
        .query("flashcardReviews")
        .withIndex("by_user_due", (q) =>
          q.eq("userId", userId).lt("dueAt", now)
        )
        .collect(),
      ctx.db
        .query("flashcardReviews")
        .withIndex("by_user_due", (q) =>
          q
            .eq("userId", userId)
            .gte("dueAt", now)
            .lt("dueAt", now + 24 * 60 * 60 * 1000)
        )
        .collect(),
    ]);

    const completedTimes = sessions
      .map((s) => s.completedAt)
      .filter((t): t is number => typeof t === "number");
    const streak = computeStreak(completedTimes, now, {
      timeZone: timeZone ?? "UTC",
    });

    const topicsTotal = Array.from(totalTopicsBySubject.values()).reduce(
      (s, n) => s + n,
      0
    );

    const isEmpty = subjects.length === 0;

    if (isEmpty) {
      return {
        user: {
          id: user._id,
          name: user.name ?? "Student",
          firstStudyDate: null,
        },
        subjects: [],
        stats: {
          dueToday: 0,
          dueTomorrow: 0,
          streakDays: 0,
          overallMastery: 0,
          topicsStudied: 0,
          topicsTotal,
        },
        isEmpty: true,
      };
    }

    return {
      user: {
        id: user._id,
        name: user.name ?? "Student",
        firstStudyDate:
          completedTimes.length > 0 ? Math.min(...completedTimes) : null,
      },
      subjects,
      stats: {
        dueToday: dueReviews.length,
        dueTomorrow: dueReviewsNext.length,
        streakDays: streak,
        overallMastery,
        topicsStudied: perTopicMastery.size,
        topicsTotal,
      },
      isEmpty: false,
    };
  },
});

function emptyOverview() {
  return {
    user: null,
    subjects: [],
    stats: {
      dueToday: 0,
      dueTomorrow: 0,
      streakDays: 0,
      overallMastery: 0,
      topicsStudied: 0,
      topicsTotal: 0,
    },
    isEmpty: true,
  };
}

// ── Overview & dashboard caps ──
const PROGRESS_OVERVIEW_CAP = 2000;
const ENROLLMENT_CAP = 200;
const SESSION_OVERVIEW_CAP = 500;

// ── Recovery caps ──
const RECOVERY_PROGRESS_CAP = 500;

// ── Activity caps ──
const ACTIVITY_HARD_CAP = 100;

export const getContinueStudying = query({
  args: {},
  returns: v.union(
    v.object({
      subject: v.object({
        id: v.id("subjects"),
        slug: v.string(),
        title: v.string(),
        color: v.optional(v.string()),
        icon: v.optional(v.string()),
      }),
      chapter: v.object({
        id: v.id("chapters"),
        slug: v.string(),
        title: v.string(),
      }),
      topic: v.object({
        id: v.id("topics"),
        slug: v.string(),
        title: v.string(),
        mastery: v.number(),
        confidence: v.number(),
        difficulty: v.union(
          v.literal("EASY"),
          v.literal("MEDIUM"),
          v.literal("HARD")
        ),
        source: v.union(v.literal("canonical"), v.literal("user")),
        ownerId: v.union(v.id("users"), v.null()),
      }),
      lastStudiedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return null;

    const MASTERY_DONE_THRESHOLD = 0.85;
    const CONT_TAKE = 2000;
    const allProgress = await ctx.db
      .query("userTopicProgress")
      .withIndex("by_user_lastStudied", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(CONT_TAKE);
    const candidates = allProgress
      .filter(
        (p): p is typeof p & { lastStudied: number } =>
          typeof p.lastStudied === "number" &&
          p.mastery < MASTERY_DONE_THRESHOLD
      );
    if (candidates.length === 0) return null;

    const top = candidates[0];
    const chain = await resolveTopicChain(ctx, top.topicId);
    if (!chain) return null;
    const { topic, chapter, subject } = chain;
    const topicSource = (topic.source ?? "canonical") as
      | "canonical"
      | "user";

    return {
      subject: {
        id: subject._id,
        slug: subject.slug,
        title: subject.title,
        color: subject.color,
        icon: subject.icon,
      },
      chapter: {
        id: chapter._id,
        slug: chapter.slug,
        title: chapter.title,
      },
      topic: {
        id: topic._id,
        slug: topic.slug,
        title: topic.title,
        mastery: top.mastery,
        confidence: top.confidence,
        difficulty: topic.difficulty,
        source: topicSource,
        ownerId: topic.ownerId ?? null,
      },
      lastStudiedAt: top.lastStudied,
    };
  },
});

export const getRecentActivity = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      kind: v.union(
        v.literal("session"),
        v.literal("practice"),
        v.literal("tutor")
      ),
      at: v.number(),
      title: v.string(),
      subtitle: v.string(),
      href: v.string(),
      tone: v.optional(v.string()),
    })
  ),
  handler: async (ctx, { limit }) => {
    const cap = Math.max(1, Math.min(limit ?? 5, 12));
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return [];

    const [sessions, runs, threads] = await Promise.all([
      ctx.db
        .query("studySessions")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .take(ACTIVITY_HARD_CAP),
      ctx.db
        .query("topicLessonPractice")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .take(ACTIVITY_HARD_CAP),
      ctx.db
        .query("tutorThreads")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .take(ACTIVITY_HARD_CAP),
    ]);

    type Entry = {
      kind: "session" | "practice" | "tutor";
      at: number;
      title: string;
      subtitle: string;
      href: string;
      tone?: string;
    };
    const out: Entry[] = [];

    for (const s of sessions) {
      if (typeof s.completedAt !== "number") continue;
      const subject = s.subjectId ? await ctx.db.get(s.subjectId) : null;
      const topic = s.topicId ? await ctx.db.get(s.topicId) : null;
      out.push({
        kind: "session",
        at: s.completedAt,
        title: subject?.title ?? "Study session",
        subtitle: topic?.title ?? "Subject overview",
        href: subject ? `/subjects/${subject.slug}` : "/dashboard",
        tone: subject?.color,
      });
    }

  const gradedRuns = runs.filter((r) => r.status === "graded" && r.grade !== undefined);
  const ungradedRuns = runs.filter((r) => r.status !== "graded" || r.grade === undefined);
  const mergedRuns = [...gradedRuns, ...ungradedRuns.slice(0, cap - gradedRuns.length)];
  for (const r of mergedRuns.slice(0, cap)) {
    const topic = await ctx.db.get(r.topicId);
    if (!topic) continue;
    const isUserOwned =
      topic.source === "user" && topic.ownerId === user._id;
    const isGraded = r.status === "graded" && r.grade !== undefined;
    const prefix = isGraded ? `Practice graded ${r.grade}` : "Practice started";

    if (isUserOwned) {
      out.push({
        kind: "practice",
        at: r.completedAt ?? r.startedAt,
        title: prefix,
        subtitle: topic.title,
        href: `/my-topics/${topic.slug}/practice/results`,
      });
      continue;
    }

    const chapter = await ctx.db.get(topic.chapterId);
    if (!chapter) continue;
    const subject = await ctx.db.get(chapter.subjectId);
    if (!subject) continue;
    out.push({
      kind: "practice",
      at: r.completedAt ?? r.startedAt,
      title: prefix,
      subtitle: `${subject.title} · ${topic.title}`,
      href: `/subjects/${subject.slug}/${chapter.slug}/${topic.slug}`,
      tone: subject.color,
    });
  }

  const sortedThreads = [...threads].sort((a, b) => {
    const atA = a.lastMessageAt ?? a._creationTime;
    const atB = b.lastMessageAt ?? b._creationTime;
    return atB - atA;
  });
  for (const thread of sortedThreads.slice(0, 3)) {
    const subject = thread.subjectId
      ? await ctx.db.get(thread.subjectId)
      : null;
    const topic = thread.topicId
      ? await ctx.db.get(thread.topicId)
      : null;
    const at = thread.lastMessageAt ?? thread._creationTime;
    const slug = subject?.slug ?? "";
    const params = new URLSearchParams();
    if (slug) params.set("subject", slug);
    const topicIsUserOwned =
      topic !== null &&
      topic.source === "user" &&
      topic.ownerId === user._id;
    if (!topicIsUserOwned && topic?.slug) params.set("topic", topic.slug);
    out.push({
      kind: "tutor",
      at,
      title: topic?.title ?? subject?.title ?? "Tutor",
      subtitle: "Discussed with tutor",
      href: `/tutor?${params.toString()}`,
      tone: subject?.color,
    });
  }

    out.sort((a, b) => b.at - a.at);
    return out.slice(0, cap);
  },
});

export const listOwnedTopicsForCurrentUser = query({
  args: {},
  returns: v.object({ count: v.number() }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { count: 0 };
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return { count: 0 };
    const owned = await ctx.db
      .query("topics")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    return { count: owned.length };
  },
});

const DAY_MS = 86_400_000;

export const getDailyMission = query({
  args: {},
  returns: v.union(
    v.object({
      nextBestTopic: v.union(
        v.object({
          subjectSlug: v.string(),
          subjectTitle: v.string(),
          subjectColor: v.optional(v.string()),
          chapterSlug: v.string(),
          topicSlug: v.string(),
          topicTitle: v.string(),
          mastery: v.number(),
          reason: v.string(),
        }),
        v.null()
      ),
      dueTodayCount: v.number(),
      overdueCount: v.number(),
      streakDays: v.number(),
      sessionsToday: v.number(),
      dailyGoal: v.union(
        v.object({
          id: v.id("goals"),
          title: v.string(),
          targetCount: v.union(v.number(), v.null()),
          completedCount: v.number(),
        }),
        v.null()
      ),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return null;

    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartMs = todayStart.getTime();

    const [nextBest, sessions, dueReviews, overdueReviews, dailyGoal] =
      await Promise.all([
        ctx.db
          .query("userTopicProgress")
          .withIndex("by_user_lastStudied", (q) =>
            q.eq("userId", user._id)
          )
          .order("desc")
          .first(),
        ctx.db
          .query("studySessions")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .take(500),
        ctx.db
          .query("flashcardReviews")
          .withIndex("by_user_due", (q) =>
            q
              .eq("userId", user._id)
              .gte("dueAt", now)
              .lt("dueAt", now + DAY_MS)
          )
          .take(100),
        ctx.db
          .query("flashcardReviews")
          .withIndex("by_user_due", (q) =>
            q.eq("userId", user._id).lt("dueAt", now)
          )
          .take(100),
        ctx.db
          .query("goals")
          .withIndex("by_user_type", (q) =>
            q.eq("userId", user._id).eq("type", "daily")
          )
          .first(),
      ]);

    const sessionsToday = sessions.filter(
      (s) =>
        typeof s.completedAt === "number" && s.completedAt >= todayStartMs
    ).length;

    let nextBestTopic: {
      subjectSlug: string;
      subjectTitle: string;
      subjectColor?: string;
      chapterSlug: string;
      topicSlug: string;
      topicTitle: string;
      mastery: number;
      reason: string;
    } | null = null;

    if (nextBest && nextBest.mastery < 0.85) {
      const chain = await resolveTopicChain(ctx, nextBest.topicId);
      if (chain) {
        const { topic, chapter, subject } = chain;
        nextBestTopic = {
              subjectSlug: subject.slug,
              subjectTitle: subject.title,
              subjectColor: subject.color,
              chapterSlug: chapter.slug,
              topicSlug: topic.slug,
              topicTitle: topic.title,
              mastery: nextBest.mastery,
              reason:
                nextBest.mastery < 0.3
                  ? "Just started — keep the momentum"
                  : nextBest.mastery < 0.6
                    ? "Halfway there — lock this in"
                    : "Almost at mastery — one more push",
            };
        }
      }

    const completedTimes = sessions
      .map((s) => s.completedAt)
      .filter((t): t is number => typeof t === "number");
    const streak = computeStreak(completedTimes, now, {
      timeZone: "UTC",
    });

    return {
      nextBestTopic,
      dueTodayCount: dueReviews.length,
      overdueCount: overdueReviews.length,
      streakDays: streak,
      sessionsToday,
      dailyGoal: dailyGoal
        ? {
            id: dailyGoal._id,
            title: dailyGoal.title,
            targetCount: dailyGoal.targetCount ?? null,
            completedCount: dailyGoal.completedCount ?? 0,
          }
        : null,
    };
  },
});

export const getMistakesToRevisit = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("mistakeEntries"),
      topicId: v.union(v.id("topics"), v.null()),
      question: v.string(),
      mistakeType: v.string(),
      reviewAt: v.union(v.number(), v.null()),
      topicSlug: v.union(v.string(), v.null()),
      topicTitle: v.union(v.string(), v.null()),
      chapterSlug: v.union(v.string(), v.null()),
      subjectSlug: v.union(v.string(), v.null()),
      subjectTitle: v.union(v.string(), v.null()),
      subjectColor: v.union(v.string(), v.null()),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return [];

    const now = Date.now();
    const mistakes = await ctx.db
      .query("mistakeEntries")
      .withIndex("by_user_review", (q) =>
        q.eq("userId", user._id).lt("reviewAt", now + 3 * DAY_MS)
      )
      .take(20);

    const sorted = mistakes
      .filter((m) => m.reviewAt !== undefined)
      .sort((a, b) => (a.reviewAt ?? 0) - (b.reviewAt ?? 0))
      .slice(0, 8);

    const topicIds = Array.from(
      new Set(sorted.map((m) => m.topicId).filter((id): id is Id<"topics"> => id !== undefined))
    );
    const topicChains = await resolveTopicChains(ctx, topicIds);

    return sorted.map((m) => {
      const chain = m.topicId ? topicChains.get(m.topicId) : undefined;
      const topic = chain?.topic;
      const chapter = chain?.chapter;
      const subject = chain?.subject;
      return {
        id: m._id,
        topicId: m.topicId ?? null,
        question: m.question,
        mistakeType: m.mistakeType,
        reviewAt: m.reviewAt ?? null,
        topicSlug: topic?.slug ?? null,
        topicTitle: topic?.title ?? null,
        chapterSlug: chapter?.slug ?? null,
        subjectSlug: subject?.slug ?? null,
        subjectTitle: subject?.title ?? null,
        subjectColor: subject?.color ?? null,
      };
    });
  },
});

export const getRecoveredTopics = query({
  args: {},
  returns: v.array(
    v.object({
      topicId: v.id("topics"),
      topicSlug: v.string(),
      topicTitle: v.string(),
      chapterSlug: v.string(),
      subjectSlug: v.string(),
      subjectTitle: v.string(),
      subjectColor: v.optional(v.string()),
      previousMastery: v.number(),
      currentMastery: v.number(),
      recoveryDelta: v.number(),
      recoveredAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return [];

    const RECOVERY_THRESHOLD = 0.65;
    const LOOKBACK_DAYS = 30;
    const lookbackMs = Date.now() - LOOKBACK_DAYS * DAY_MS;

    const recentSessions = await ctx.db
      .query("studySessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(300);

    const recentCompleted = recentSessions.filter(
      (s) => typeof s.completedAt === "number" && s.completedAt >= lookbackMs
    );

    const topicSessionMap = new Map<string, { count: number; latestAt: number }>();
    for (const s of recentCompleted) {
      if (!s.topicId) continue;
      const key = s.topicId;
      const entry = topicSessionMap.get(key) ?? { count: 0, latestAt: 0 };
      entry.count += 1;
      entry.latestAt = Math.max(entry.latestAt, s.completedAt as number);
      topicSessionMap.set(key, entry);
    }

    const progress = await ctx.db
      .query("userTopicProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(RECOVERY_PROGRESS_CAP);

    const progressByTopic = new Map<string, (typeof progress)[number]>();
    for (const p of progress) {
      progressByTopic.set(p.topicId, p);
    }

    const recovered: Array<{
      topicId: Id<"topics">;
      topicSlug: string;
      topicTitle: string;
      chapterSlug: string;
      subjectSlug: string;
      subjectTitle: string;
      subjectColor?: string;
      previousMastery: number;
      currentMastery: number;
      recoveryDelta: number;
      recoveredAt: number;
    }> = [];

    for (const [topicIdStr, sessionInfo] of topicSessionMap) {
      const topicId = topicIdStr as Id<"topics">;
      const prog = progressByTopic.get(topicIdStr);
      if (!prog || prog.mastery < RECOVERY_THRESHOLD) continue;
      if (sessionInfo.count < 3) continue;

      const earliestSession = recentCompleted
        .filter((s) => s.topicId === topicIdStr && typeof s.completedAt === "number")
        .sort((a, b) => (a.completedAt as number) - (b.completedAt as number))[0];
      if (!earliestSession) continue;

      const previousMastery = Math.max(0, prog.mastery - 0.25);
      const recoveryDelta = prog.mastery - previousMastery;
      if (recoveryDelta < 0.15) continue;

      const chain = await resolveTopicChain(ctx, topicId);
      if (!chain) continue;
      const { topic, chapter, subject } = chain;

      recovered.push({
        topicId,
        topicSlug: topic.slug,
        topicTitle: topic.title,
        chapterSlug: chapter.slug,
        subjectSlug: subject.slug,
        subjectTitle: subject.title,
        subjectColor: subject.color,
        previousMastery,
        currentMastery: prog.mastery,
        recoveryDelta,
        recoveredAt: sessionInfo.latestAt,
      });
    }

    recovered.sort((a, b) => b.recoveredAt - a.recoveredAt);
    return recovered.slice(0, 5);
  },
});

export const getTimeBySubject = query({
  args: {},
  returns: v.array(
    v.object({
      subjectId: v.id("subjects"),
      subjectSlug: v.string(),
      subjectTitle: v.string(),
      subjectColor: v.optional(v.string()),
      totalMinutes: v.number(),
      sessionCount: v.number(),
      percentageOfTotal: v.number(),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return [];

    const sessions = await ctx.db
      .query("studySessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(500);

    const completed = sessions.filter(
      (s) => typeof s.completedAt === "number"
    );

    const bySubject = new Map<
      string,
      { totalSec: number; sessionCount: number }
    >();

    for (const s of completed) {
      if (!s.subjectId) continue;
      const key = s.subjectId;
      const entry = bySubject.get(key) ?? { totalSec: 0, sessionCount: 0 };
      entry.totalSec += s.durationSec;
      entry.sessionCount += 1;
      bySubject.set(key, entry);
    }

    if (bySubject.size === 0) return [];

    const subjectIds = Array.from(bySubject.keys()) as Id<"subjects">[];
    const subjectRows = await Promise.all(
      subjectIds.map((id) => ctx.db.get(id))
    );
    const subjectMap = new Map<
      string,
      NonNullable<(typeof subjectRows)[number]>
    >();
    for (const s of subjectRows) {
      if (s) subjectMap.set(s._id, s);
    }

    let grandTotal = 0;
    const entries: Array<{
      subjectId: Id<"subjects">;
      subjectSlug: string;
      subjectTitle: string;
      subjectColor?: string;
      totalMinutes: number;
      sessionCount: number;
      percentageOfTotal: number;
    }> = [];

    for (const [subjectIdStr, data] of bySubject) {
      const s = subjectMap.get(subjectIdStr);
      const minutes = Math.round(data.totalSec / 60);
      entries.push({
        subjectId: subjectIdStr as Id<"subjects">,
        subjectSlug: s?.slug ?? "",
        subjectTitle: s?.title ?? "Unknown",
        subjectColor: s?.color,
        totalMinutes: minutes,
        sessionCount: data.sessionCount,
        percentageOfTotal: 0,
      });
      grandTotal += minutes;
    }

    for (const entry of entries) {
      entry.percentageOfTotal =
        grandTotal > 0
          ? Math.round((entry.totalMinutes / grandTotal) * 1000) / 10
          : 0;
    }

    entries.sort((a, b) => b.totalMinutes - a.totalMinutes);
    return entries;
  },
});

export const getWeeklyConsistency = query({
  args: {},
  returns: v.object({
    days: v.array(
      v.object({
        date: v.string(),
        sessions: v.number(),
        minutes: v.number(),
      })
    ),
    maxSessions: v.number(),
    totalMinutes: v.number(),
    totalSessions: v.number(),
    averageMinutes: v.number(),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        days: [],
        maxSessions: 0,
        totalMinutes: 0,
        totalSessions: 0,
        averageMinutes: 0,
      };
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) {
      return {
        days: [],
        maxSessions: 0,
        totalMinutes: 0,
        totalSessions: 0,
        averageMinutes: 0,
      };
    }

    const now = Date.now();
    const sevenDaysAgo = now - 7 * DAY_MS;

    const sessions = await ctx.db
      .query("studySessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(500);

    const recentSessions = sessions.filter(
      (s) =>
        typeof s.completedAt === "number" && s.completedAt >= sevenDaysAgo
    );

    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const dayKey = (ms: number): string => {
      try {
        return formatter.format(new Date(ms));
      } catch {
        return "";
      }
    };

    const dayMap = new Map<string, { sessions: number; minutes: number }>();
    for (let i = 6; i >= 0; i--) {
      const day = dayKey(now - i * DAY_MS);
      dayMap.set(day, { sessions: 0, minutes: 0 });
    }

    for (const s of recentSessions) {
      const key = dayKey(s.completedAt as number);
      const existing = dayMap.get(key);
      if (existing) {
        existing.sessions += 1;
        existing.minutes += Math.round(s.durationSec / 60);
      }
    }

    const days = Array.from(dayMap.entries()).map(([date, stats]) => ({
      date,
      sessions: stats.sessions,
      minutes: stats.minutes,
    }));

    const totalSessions = days.reduce((s, d) => s + d.sessions, 0);
    const totalMinutes = days.reduce((s, d) => s + d.minutes, 0);
    const maxSessions = Math.max(1, ...days.map((d) => d.sessions));
    const averageMinutes =
      totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;

    return { days, maxSessions, totalMinutes, totalSessions, averageMinutes };
  },
});
