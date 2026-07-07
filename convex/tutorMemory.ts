import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

import { resolveUserReadOnly as resolveUser } from "./users";

/**
 * tutorMemory.ts.
 *
 * The single backend surface that powers the tutor
 * page's right-hand Memory Panel. The panel reads
 * mastery / confidence / weaknesses / recently learned /
 * confidence trend / attention signal / next recommended
 * action and renders them as a continuously-updating
 * compact column.
 *
 * Why a new query instead of reusing
 * `api.subjects.getTopicDetailBySlug`:
 *
 *  - The new panel needs FLATTENED, AGGREGATED data
 *    (mastery ring, top-3 weaknesses, etc.) rather than
 *    the canonical curriculum fields that
 *    `getTopicDetailBySlug` carries. Re-shaping the
 *    canonical query to fit would bloat the response and
 *    split its surface area across two consumers.
 *  - `getTopicDetailBySlug` is keyed on (subjectSlug,
 *    chapterSlug, topicSlug). The tutor page only knows
 *    (subjectId, topicId) because the canonical
 *    resolution happens server-side in `page.tsx` and
 *    the ids are what the page forwards. A new
 *    id-keyed query avoids re-resolving slugs.
 *  - AGENTS.md's "exactly one name per concept
 *    everywhere" + "business logic in Convex functions"
 *    rules: a focused new query is the right shape.
 *
 * Returns null when no Clerk identity is forwarded
 * (anonymous render) — the panel renders its empty
 * skeleton in that case.
 */

/**
 * Returns the memory panel snapshot for the (subjectId,
 * topicId?) the user is currently studying. `topicId`
 * is optional because the tutor is also reachable with
 * `?subject=…` only (no topic pinned).
 */
export const getMemorySnapshot = query({
  args: {
    subjectId: v.id("subjects"),
    topicId: v.optional(v.id("topics")),
  },
  returns: v.union(
    v.object({
      subject: v.object({
        id: v.id("subjects"),
        slug: v.string(),
        title: v.string(),
        color: v.optional(v.string()),
      }),
      topic: v.union(
        v.object({
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
          gradeLevel: v.union(v.string(), v.null()),
        }),
        v.null()
      ),
      // Top-3 weaknesses derived from the recent mistakes
      // on this topic. Each entry carries the question +
      // a one-line "cause" so the panel can quote it.
      weaknesses: v.array(
        v.object({
          id: v.id("mistakeEntries"),
          question: v.string(),
          userAnswer: v.string(),
          correctAnswer: v.string(),
          mistakeType: v.string(),
          cause: v.union(v.string(), v.null()),
          attemptedAt: v.number(),
        })
      ),
      // Top-5 most recently mastered objectives (from
      // userTopicProgress, filtered to actually-studied
      // topics in the current subject). Empty when no
      // progress exists yet. Driven client-side to "✓"
      // check chips.
      recentProgress: v.array(
        v.object({
          topicId: v.id("topics"),
          topicTitle: v.string(),
          topicSlug: v.string(),
          mastery: v.number(),
          lastStudiedAt: v.number(),
        })
      ),
      // Estimated minutes remaining to first mastery
      // (mastery >= 0.5). Computed by re-using the
      // topic's `estimatedMinutes` field and scaling by
      // the (1 - mastery) complement. From the user's
      // prompt this maps well to an "~Nm remaining"
      // chip in the session header.
      estimatedMinutesToMastery: v.union(v.number(), v.null()),
      // Goal / focus string. Sourced from the tutor
      // profile if present ("Exam Friday", "Catch up on
      // 11th grade math"), otherwise null and the panel
      // hides the chip. The frontend applies a compact
      // visual treatment when present.
      focusGoal: v.union(v.string(), v.null()),
      // Subject-level mastery (mean across studied
      // topics). The session header reads this for the
      // ring without subscribing to a separate query.
      subjectMastery: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, { subjectId, topicId }) => {
    const user = await resolveUser(ctx);
    if (!user) return null;

    // Subject (canonical, public read).
    const subject = await ctx.db.get(subjectId);
    if (!subject) return null;

    // Topic-level progress (mastery + confidence) when
    // a topic is pinned. Null otherwise.
    let topicSnapshot:
      | {
          id: Id<"topics">;
          slug: string;
          title: string;
          mastery: number;
          confidence: number;
          difficulty: "EASY" | "MEDIUM" | "HARD";
          gradeLevel: string | null;
        }
      | null = null;
    if (topicId) {
      const t = await ctx.db.get(topicId);
      if (!t) return null;
      const p = await ctx.db
        .query("userTopicProgress")
        .withIndex("by_user_topic", (q) =>
          q.eq("userId", user._id).eq("topicId", topicId)
        )
        .first();
      topicSnapshot = {
        id: t._id,
        slug: t.slug,
        title: t.title,
        mastery: p ? p.mastery : 0,
        confidence: p ? p.confidence : 0,
        difficulty: t.difficulty,
        gradeLevel: t.gradeLevel ?? null,
      };
    }

    // Top-3 recent mistakes on the topic for the
    // "Weaknesses" section. Empty when no mistakes or
    // no topic. Indexed scan keeps this O(log n).
    let weaknesses: Array<{
      id: Id<"mistakeEntries">;
      question: string;
      userAnswer: string;
      correctAnswer: string;
      mistakeType: string;
      cause: string | null;
      attemptedAt: number;
    }> = [];
    if (topicId) {
      const ms = await ctx.db
        .query("mistakeEntries")
        .withIndex("by_user_topic", (q) =>
          q.eq("userId", user._id).eq("topicId", topicId)
        )
        .collect();
      // Reverse so the newest mistake is index 0; slice
      // to 3 for the panel.
      ms.sort((a, b) => b._creationTime - a._creationTime);
      weaknesses = ms.slice(0, 3).map((m) => ({
        id: m._id,
        question: m.question,
        userAnswer: m.userAnswer,
        correctAnswer: m.correctAnswer,
        mistakeType: m.mistakeType,
        cause: m.cause ?? null,
        attemptedAt: m._creationTime,
      }));
    }

    // Recent progress across the subject — pull every
    // topic-level progress row whose topic lives in this
    // subject, sorted by lastStudied desc, sliced to 5.
    // Two parallel reads (all chapters in subject, all
    // progress rows for the user) keep this O(1) network
    // round trips.
    const [chapters, allProgress] = await Promise.all([
      ctx.db
        .query("chapters")
        .withIndex("by_subject", (q) => q.eq("subjectId", subject._id))
        .collect(),
      ctx.db
        .query("userTopicProgress")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect(),
    ]);
    const topicsInSubject: Array<{
      readonly _id: Id<"topics">;
      readonly chapterId: Id<"chapters">;
      readonly title: string;
      readonly slug: string;
      readonly difficulty: "EASY" | "MEDIUM" | "HARD";
      readonly gradeLevel?: string;
      readonly objectives: ReadonlyArray<string>;
      readonly examRelevance: number;
      readonly estimatedMinutes?: number;
    }> = [];
    for (const ch of chapters) {
      const chTopics = await ctx.db
        .query("topics")
        .withIndex("by_chapter", (q) => q.eq("chapterId", ch._id))
        .collect();
      topicsInSubject.push(...chTopics);
    }
    const subjectTopicIds = new Set(topicsInSubject.map((t) => t._id));
    const subjectTopicsById = new Map(
      topicsInSubject.map((t) => [t._id, t] as const)
    );

    const recentProgress = allProgress
      .filter(
        (p) =>
          subjectTopicIds.has(p.topicId) &&
          typeof p.lastStudied === "number"
      )
      .sort((a, b) => (b.lastStudied ?? 0) - (a.lastStudied ?? 0))
      .slice(0, 5)
      .map((p) => {
        const t = subjectTopicsById.get(p.topicId);
        return {
          topicId: p.topicId,
          topicTitle: t?.title ?? "Topic",
          topicSlug: t?.slug ?? "",
          mastery: p.mastery,
          lastStudiedAt: p.lastStudied ?? 0,
        };
      });

    // Subject-level mastery (mean across studied topics
    // in this subject). Single linear pass over
    // `allProgress`.
    let subjectMasterySum = 0;
    let subjectMasteryCount = 0;
    for (const p of allProgress) {
      if (!subjectTopicIds.has(p.topicId)) continue;
      subjectMasterySum += p.mastery;
      subjectMasteryCount += 1;
    }
    const subjectMastery =
      subjectMasteryCount > 0 ? subjectMasterySum / subjectMasteryCount : 0;

    // Estimated minutes to first mastery. Pull the
    // topic's `estimatedMinutes`, multiply by (1 - max(0,
    // mastery - 0.5)) so we surface a meaningful ETA only
    // when we're still on the way up. Null when no topic
    // or estimatedMinutes missing.
    let estimatedMinutesToMastery: number | null = null;
    if (topicId) {
      const t = topicsInSubject.find((x) => x._id === topicId);
      if (t && t.estimatedMinutes !== undefined) {
        const mastery = topicSnapshot?.mastery ?? 0;
        if (mastery < 0.5) {
          estimatedMinutesToMastery = Math.round(
            t.estimatedMinutes * (1 - mastery * 2)
          );
        } else {
          // Already past the half-mastery marker, so
          // the panel hides the ETA chip anyway.
          estimatedMinutesToMastery = null;
        }
      }
    }

    // Focus goal. Read directly from the tutor profile
    // (single read). When the user has not onboarded we
    // serve `null` and the panel hides the chip.
    const profile = await ctx.db
      .query("tutorProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    let focusGoal: string | null = null;
    if (profile) {
      // The "primaryGoal" union never includes a long
      // string, so we map it to a friendly one-liner here
      // rather than passing the union straight through.
      focusGoal = GOAL_LABEL[profile.primaryGoal];
    }

    return {
      subject: {
        id: subject._id,
        slug: subject.slug,
        title: subject.title,
        color: subject.color,
      },
      topic: topicSnapshot,
      weaknesses,
      recentProgress,
      estimatedMinutesToMastery,
      focusGoal,
      subjectMastery,
    };
  },
});

/**
 * getMemoryChronicle — Phase 2 §4.1.
 *
 * Builds a time-ordered narrative of the user's learning
 * for the tutor system prompt. Returns:
 *
 *   1. Last 3 completed sessions on this subject (or topic)
 *   2. Active mistake patterns (from `mistakePatterns`)
 *   3. Progress milestones (first 50% mastery, 85% threshold)
 *   4. Recently studied related topics
 *   5. A one-paragraph narrative summary for the system prompt
 *
 * Returns `null` when the user has no progress yet or is
 * not authenticated.
 */
export const getMemoryChronicle = query({
  args: {
    subjectId: v.id("subjects"),
    topicId: v.optional(v.id("topics")),
  },
  returns: v.union(
    v.object({
      recentSessions: v.array(
        v.object({
          date: v.number(),
          durationMin: v.number(),
          topicTitle: v.union(v.string(), v.null()),
          hadReflection: v.boolean(),
        })
      ),
      activePatterns: v.array(
        v.object({
          patternType: v.string(),
          description: v.string(),
          topicCount: v.number(),
        })
      ),
      milestones: v.array(
        v.object({
          label: v.string(),
          achievedAt: v.number(),
        })
      ),
      relatedTopics: v.array(
        v.object({
          title: v.string(),
          slug: v.string(),
          mastery: v.number(),
          lastStudiedAt: v.number(),
        })
      ),
      narrative: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, { subjectId, topicId }) => {
    const user = await resolveUser(ctx);
    if (!user) return null;

    const subject = await ctx.db.get(subjectId);
    if (!subject) return null;

    // ── 1. Recent completed sessions (capped at 50) ────
    const allSessions = await ctx.db
      .query("studySessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(50);

    const completed = allSessions
      .filter((s) => typeof s.completedAt === "number")
      .sort((a, b) => (b.completedAt as number) - (a.completedAt as number));

    // Filter to sessions in the given subject (or topic).
    const subjectChapterIds = new Set(
      (
        await ctx.db
          .query("chapters")
          .withIndex("by_subject", (q) => q.eq("subjectId", subjectId))
          .collect()
      ).map((c) => c._id)
    );
    const allTopics = await ctx.db.query("topics").collect();
    const subjectTopicIds = new Set(
      allTopics
        .filter((t) => subjectChapterIds.has(t.chapterId))
        .map((t) => t._id)
    );
    const topicById = new Map(allTopics.map((t) => [t._id, t] as const));

    const subjectSessions = topicId
      ? completed.filter((s) => s.topicId === topicId)
      : completed.filter(
          (s) =>
            (s.subjectId === subjectId) ||
            (s.topicId && subjectTopicIds.has(s.topicId))
        );

    const recentSessions = subjectSessions.slice(0, 3).map((s) => {
      const topicTitle = s.topicId ? topicById.get(s.topicId)?.title ?? null : null;
      return {
        date: s.completedAt as number,
        durationMin: Math.round(s.durationSec / 60),
        topicTitle,
        hadReflection:
          typeof s.reflection === "string" && s.reflection.trim().length > 0,
      };
    });

    // ── 2. Active mistake patterns ────────────────────
    const patternRows = await ctx.db
      .query("mistakePatterns")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const activePatterns = patternRows
      .filter((p) => p.resolvedAt === undefined)
      .sort((a, b) => b.detectedAt - a.detectedAt)
      .map((p) => ({
        patternType: p.patternType,
        description: p.description,
        topicCount: p.topicCount,
      }));

    // ── 3. Progress milestones ────────────────────────
    const allProgress = await ctx.db
      .query("userTopicProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const milestones: Array<{ label: string; achievedAt: number }> = [];
    const now = Date.now();

    // First topic studied.
    if (allProgress.length > 0) {
      const earliest = allProgress.reduce((a, b) =>
        (a.lastStudied ?? a._creationTime) < (b.lastStudied ?? b._creationTime) ? a : b
      );
      const firstDate = earliest.lastStudied ?? earliest._creationTime;
      milestones.push({
        label: "First topic studied",
        achievedAt: firstDate,
      });
    }

    // First 50% mastery on any topic.
    const first50 = allProgress.find((p) => p.mastery >= 0.5);
    if (first50) {
      milestones.push({
        label: "First topic at 50% mastery",
        achievedAt: first50.lastStudied ?? first50._creationTime,
      });
    }

    // First 85% mastery on any topic.
    const first85 = allProgress.find((p) => p.mastery >= 0.85);
    if (first85) {
      milestones.push({
        label: "First topic at 85% mastery",
        achievedAt: first85.lastStudied ?? first85._creationTime,
      });
    }

    // Streak milestone: 5+ consecutive days.
    const completedTimes = allSessions
      .map((s) => s.completedAt)
      .filter((t): t is number => typeof t === "number");
    const streak = computeStreak(completedTimes, now);
    if (streak >= 5) {
      milestones.push({
        label: `${streak}-day study streak`,
        achievedAt: now,
      });
    }

    // ── 4. Related topics ─────────────────────────────
    const relatedTopics = allProgress
      .filter(
        (p) =>
          subjectTopicIds.has(p.topicId) &&
          p.topicId !== (topicId ?? undefined) &&
          typeof p.lastStudied === "number"
      )
      .sort((a, b) => (b.lastStudied as number) - (a.lastStudied as number))
      .slice(0, 5)
      .map((p) => {
        const t = topicById.get(p.topicId);
        return {
          title: t?.title ?? "Topic",
          slug: t?.slug ?? "",
          mastery: p.mastery,
          lastStudiedAt: p.lastStudied as number,
        };
      });

    // ── 5. Narrative summary ──────────────────────────
    const narrative = buildChronicleNarrative({
      subjectTitle: subject.title,
      topicTitle: topicId ? topicById.get(topicId)?.title : null,
      recentSessions,
      activePatterns,
      milestones,
      relatedTopics,
    });

    return {
      recentSessions,
      activePatterns,
      milestones,
      relatedTopics,
      narrative,
    };
  },
});

/**
 * getProgressNarrative — Phase 2 §4.3.
 *
 * Returns a short one-line narrative for the SessionHeader
 * that changes based on context:
 *
 *   - "Back after 3 days — your mastery held at 72%"
 *   - "Third session this week on Quadratics — 18% gain"
 *   - "First time on this topic — let's build from zero"
 *
 * Returns `null` when no narrative is available (fresh
 * user, no progress yet).
 */
export const getProgressNarrative = query({
  args: {
    subjectId: v.id("subjects"),
    topicId: v.optional(v.id("topics")),
    currentMastery: v.number(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { subjectId, topicId, currentMastery }) => {
    const user = await resolveUser(ctx);
    if (!user) return null;

    // Load sessions for the "returning after X days" check.
    const allSessions = await ctx.db
      .query("studySessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const completed = allSessions
      .filter((s) => typeof s.completedAt === "number")
      .sort((a, b) => (b.completedAt as number) - (a.completedAt as number));

    const now = Date.now();
    const DAY_MS = 86_400_000;

    // Check if this is the first time on this topic.
    if (topicId && currentMastery === 0) {
      // Check if the user has studied any topic in this subject.
      const chapters = await ctx.db
        .query("chapters")
        .withIndex("by_subject", (q) => q.eq("subjectId", subjectId))
        .collect();
      const chapterIds = new Set(chapters.map((c) => c._id));
      const allTopics = await ctx.db.query("topics").collect();
      const subjectTopicIds = new Set(
        allTopics.filter((t) => chapterIds.has(t.chapterId)).map((t) => t._id)
      );
      const allProgress = await ctx.db
        .query("userTopicProgress")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      const hasStudiedInSubject = allProgress.some((p) =>
        subjectTopicIds.has(p.topicId)
      );

      if (!hasStudiedInSubject) {
        return "First time in this subject — let's build from zero.";
      }
      return "New topic in an active subject — your prior work carries over.";
    }

    // Check how long since the last session on this topic.
    const topicSessions = topicId
      ? completed.filter((s) => s.topicId === topicId)
      : completed.filter((s) => s.subjectId === subjectId);

    if (topicSessions.length > 0) {
      const lastSession = topicSessions[0];
      const daysSince = Math.floor(
        (now - (lastSession.completedAt as number)) / DAY_MS
      );

      if (daysSince >= 1) {
        const masteryLabel =
          currentMastery >= 0.7
            ? "your mastery held strong"
            : currentMastery >= 0.4
              ? "your mastery is holding"
              : "let's rebuild the foundations";
        if (daysSince === 1) {
          return `Back after a day — ${masteryLabel} at ${Math.round(currentMastery * 100)}%.`;
        }
        if (daysSince <= 7) {
          return `Back after ${daysSince} days — ${masteryLabel} at ${Math.round(currentMastery * 100)}%.`;
        }
        if (daysSince <= 30) {
          return `${daysSince} days since your last session — ${masteryLabel}.`;
        }
        return `It's been a while (${daysSince} days). Let's pick up where you left off.`;
      }

      // Same-day return — check for multi-session momentum.
      const sessionsToday = topicSessions.filter(
        (s) =>
          (s.completedAt as number) > now - DAY_MS
      );
      if (sessionsToday.length >= 3) {
        return `Third session today on this topic — that's real momentum.`;
      }
      if (sessionsToday.length >= 2) {
        return `Second session today — building deep understanding.`;
      }

      // Check this week's session count.
      const sessionsThisWeek = topicSessions.filter(
        (s) =>
          (s.completedAt as number) > now - 7 * DAY_MS
      );
      if (sessionsThisWeek.length >= 3) {
        // Try to compute mastery delta across sessions.
        const firstSessionThisWeek = sessionsThisWeek[sessionsThisWeek.length - 1];
        const masteryDelta =
          firstSessionThisWeek && topicSessions.length >= 2
            ? Math.round(currentMastery * 100)
            : null;
        if (masteryDelta !== null && masteryDelta > 0) {
          return `${sessionsThisWeek.length}th session this week — making steady progress.`;
        }
      }
    }

    return null;
  },
});

// ── Helpers ──────────────────────────────────────────────

/**
 * Build a one-paragraph narrative summary for the system
 * prompt from the chronicle data.
 */
function buildChronicleNarrative(args: {
  readonly subjectTitle: string;
  readonly topicTitle: string | undefined | null;
  readonly recentSessions: ReadonlyArray<{
    readonly date: number;
    readonly durationMin: number;
    readonly topicTitle: string | null;
    readonly hadReflection: boolean;
  }>;
  readonly activePatterns: ReadonlyArray<{
    readonly patternType: string;
    readonly description: string;
    readonly topicCount: number;
  }>;
  readonly milestones: ReadonlyArray<{
    readonly label: string;
    readonly achievedAt: number;
  }>;
  readonly relatedTopics: ReadonlyArray<{
    readonly title: string;
    readonly mastery: number;
  }>;
}): string {
  const parts: string[] = [];

  const scope = args.topicTitle ?? args.subjectTitle;

  // Recent sessions.
  if (args.recentSessions.length > 0) {
    const totalMin = args.recentSessions.reduce(
      (s, ses) => s + ses.durationMin,
      0
    );
    const withReflection = args.recentSessions.filter(
      (s) => s.hadReflection
    ).length;
    parts.push(
      `${args.recentSessions.length} recent session${args.recentSessions.length > 1 ? "s" : ""} on ${scope} (${totalMin}min total${withReflection > 0 ? `, ${withReflection} with reflection` : ""}).`
    );
  } else {
    parts.push(`No completed sessions yet on ${scope}.`);
  }

  // Active patterns.
  if (args.activePatterns.length > 0) {
    const patternNames = args.activePatterns.map(
      (p) =>
        `${PATTERN_SHORT_LABELS[p.patternType] ?? p.patternType}`
    );
    parts.push(
      `${args.activePatterns.length} active learning pattern${args.activePatterns.length > 1 ? "s" : ""}: ${patternNames.join(", ")}.`
    );
  }

  // Milestones.
  if (args.milestones.length > 0) {
    const recent = args.milestones
      .slice(0, 2)
      .map((m) => m.label.toLowerCase());
    parts.push(`Recent milestones: ${recent.join(", ")}.`);
  }

  // Related topics.
  if (args.relatedTopics.length > 0) {
    const topicNames = args.relatedTopics
      .slice(0, 3)
      .map((t) => `${t.title} (${Math.round(t.mastery * 100)}%)`);
    parts.push(
      `Recently studied: ${topicNames.join(", ")}.`
    );
  }

  return parts.join(" ");
}

/**
 * Compute a simple streak from completed session timestamps.
 * Mirrors the logic in `convex/dashboard.ts`.
 */
function computeStreak(
  completedAtTimes: readonly number[],
  nowMs: number
): number {
  if (completedAtTimes.length === 0) return 0;
  const DAY_MS = 86_400_000;
  const dayKey = (ms: number) => Math.floor(ms / DAY_MS);
  const today = dayKey(nowMs);
  const yesterday = today - 1;
  const days = new Set(completedAtTimes.map(dayKey));
  if (!days.has(today) && !days.has(yesterday)) return 0;
  let cursor = days.has(today) ? today : yesterday;
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    if (days.has(cursor)) {
      streak++;
      cursor -= 1;
    } else break;
  }
  return streak;
}

const PATTERN_SHORT_LABELS: Record<string, string> = {
  sign_error_chain: "sign errors across topics",
  formula_confusion: "formula confusion",
  unit_conversion_gap: "unit conversion gap",
  reading_comprehension: "reading comprehension gap",
  recurring_mistake_type: "recurring mistake type",
  cross_topic_weakness: "cross-topic weakness",
};

/**
 * Map the "primaryGoal" union onto a friendly one-line
 * string. Read from the user profile; absent for users
 * who have not onboarded yet.
 */
const GOAL_LABEL: Record<string, string> = {
  pass_classes: "Pass every class",
  improve_grades: "Bump every grade up a notch",
  top_of_class: "Top of class",
  university_prep: "University prep",
  master_everything: "Master everything",
};
