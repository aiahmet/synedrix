import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Id, Doc } from "./_generated/dataModel";

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
        .collect(),
      ctx.db
        .query("userSubjects")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db.query("subjects").collect(),
      ctx.db
        .query("studySessions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
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

function computeStreak(
  completedAtTimes: readonly number[],
  nowMs: number,
  options: { readonly timeZone: string }
): number {
  if (completedAtTimes.length === 0) return 0;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: options.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dayKey = (ms: number): string => {
    try {
      return formatter.format(new Date(ms));
    } catch {
      const d = new Date(ms);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    }
  };
  const dayBefore = (d: string): string => {
    const parts = d.split("-");
    if (parts.length !== 3) return d;
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const day = Number(parts[2]);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(day)) {
      return d;
    }
    const probe = Date.UTC(y, m - 1, day - 1, 12, 0, 0);
    return dayKey(probe);
  };

  const today = dayKey(nowMs);
  const days = new Set(completedAtTimes.map(dayKey));

  let cursor = today;
  if (!days.has(cursor)) {
    cursor = dayBefore(cursor);
    if (!days.has(cursor)) return 0;
  }
  let streak = 0;
  for (let i = 0; i < 366; i++) {
    if (days.has(cursor)) {
      streak++;
      cursor = dayBefore(cursor);
    } else {
      break;
    }
  }
  return streak;
}

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
    const topic = await ctx.db.get(top.topicId);
    if (!topic) return null;
    const chapter = await ctx.db.get(topic.chapterId);
    if (!chapter) return null;
    const subject = await ctx.db.get(chapter.subjectId);
    if (!subject) return null;
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
