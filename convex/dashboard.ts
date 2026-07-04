import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Id, Doc } from "./_generated/dataModel";

/**
 * getOverview.
 *
 * One query that powers the whole dashboard. Returns either a
 * populated cockpit or `isEmpty: true` for new users who have not
 * enrolled in any subjects yet.
 *
 * Streak is computed from completed study sessions. Due counts come
 * from flashcard reviews whose `dueAt` has passed. Overall mastery
 * is the mean of per-topic mastery across all topics the user has
 * ever touched (so an empty state is also a 0-mastery state).
 *
 * Subject enrollment source of truth is the `userSubjects` table.
 * For users who have any explicit enrollment rows, those are used
 * directly. For legacy users who studied before `userSubjects`
 * existed, we fall back to deriving enrollment from any existing
 * `userTopicProgress` so they do not see an empty cockpit just
 * because the table is new. Mastery is always computed from
 * `userTopicProgress` regardless of how enrollment was determined.
 */
export const getOverview = query({
  args: {},
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
  handler: async (ctx) => {
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

    // Fan out the four independent reads in parallel: progress,
    // enrollments, all subjects, all sessions. The `chapters`
    // and `topics` per-subject counts happen below.
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

    // Build the set of enrolled subject ids. If the user has any
    // explicit enrollments, use those exclusively. If they have
    // none but have legacy progress, fall back to subjects-with-
    // progress so the cockpit does not go empty for users who
    // studied before this table existed.
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

    // Resolve every distinct topic the user has any progress on
    // in a single parallel pass. The (topicId) -> subjectId
    // map is used both by the legacy-fallback enrollment build
    // and the mastery loop below.
    const allTopicIds = Array.from(
      new Set(allProgress.map((p) => p.topicId))
    );
    const topicRows = await Promise.all(
      allTopicIds.map((id) => ctx.db.get(id))
    );
    const topicToSubject = new Map<Id<"topics">, Id<"subjects">>();
    // Cache chapters so two topics in the same chapter do not
    // each pay a `db.get` roundtrip. The cache is built
    // synchronously after the parallel pass.
    const chapterCache = new Map<Id<"chapters">, Doc<"chapters">>();
    const chapterIdsToFetch = new Set<Id<"chapters">>();
    for (const topic of topicRows) {
      if (topic) chapterIdsToFetch.add(topic.chapterId);
    }
    const chapterRows = await Promise.all(
      Array.from(chapterIdsToFetch).map((id) => ctx.db.get(id))
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

    // Single pass over `allProgress` to compute both the
    // overall mastery mean and the per-subject mastery means.
    // Replaces the previous O(n^2) `allProgress.filter(...)`
    // loop with an O(n) reduce.
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
      if (!acc) continue; // not enrolled
      acc.masterySum += agg.sum / agg.n;
      acc.topicsStudied += 1;
    }

    // Per-subject total topic counts. Parallelize per subject
    // (each subject triggers a chapters query, each chapter a
    // topics query; we fire them all at once and aggregate).
    const totalTopicsBySubject = new Map<Id<"subjects">, number>();
    await Promise.all(
      subjectsRaw.map(async (subj) => {
        const chapters = await ctx.db
          .query("chapters")
          .withIndex("by_subject", (q) => q.eq("subjectId", subj._id))
          .collect();
        const topicCounts = await Promise.all(
          chapters.map((ch) =>
            ctx.db
              .query("topics")
              .withIndex("by_chapter", (q) => q.eq("chapterId", ch._id))
              .collect()
              .then((rows) => rows.length)
          )
        );
        totalTopicsBySubject.set(
          subj._id,
          topicCounts.reduce((s, n) => s + n, 0)
        );
      })
    );

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

    // Due counts from flashcard reviews. Run in parallel.
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

    // Streak from completed study sessions.
    const completedTimes = sessions
      .map((s) => s.completedAt)
      .filter((t): t is number => typeof t === "number");
    const streak = computeStreak(completedTimes, now);

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
        // Count distinct topics the user has any progress on,
        // not the total number of progress rows. Without this
        // a user who studies the same topic 5 times would see
        // 5 topics studied, which inflates the stat and makes
        // it diverge from the per-subject `topicsStudied` count
        // (which is per-topic).
        topicsStudied: perTopicMastery.size,
        topicsTotal,
      },
      isEmpty: false,
    };
  },
});

/**
 * Compute the user's current streak (consecutive days ending today
 * with at least one completed study session).
 *
 * Returns 0 if the user has never studied or if the most recent
 * session is older than yesterday. We use the UTC day boundary so
 * the result is deterministic across timezones and matches what
 * Convex stores (UTC). A user studying at 11pm local time on the
 * last day of a month will have that session attributed to the
 * following UTC day — an acceptable trade-off for a personal
 * tool, and the alternative (per-user timezone) requires a
 * timezone field on the user record that the rest of the app
 * does not need.
 */
function computeStreak(
  completedAtTimes: readonly number[],
  nowMs: number
): number {
  if (completedAtTimes.length === 0) return 0;

  // Use an integer day count (UTC) as the Set key. It is
  // sortable, hashable, and immune to off-by-one string bugs
  // (the old `${y}-${m}-${d}` key was fragile around month and
  // day boundaries with no leading zero).
  const DAY_MS = 86_400_000;
  const dayKey = (ms: number) => Math.floor(ms / DAY_MS);
  const today = dayKey(nowMs);
  const yesterday = today - 1;

  const days = new Set(completedAtTimes.map(dayKey));
  if (!days.has(today) && !days.has(yesterday)) return 0;

  let cursor = days.has(today) ? today : yesterday;
  let streak = 0;
  // Hard cap to avoid infinite loop on a corrupt set.
  for (let i = 0; i < 365; i++) {
    if (days.has(cursor)) {
      streak++;
      cursor -= 1;
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
