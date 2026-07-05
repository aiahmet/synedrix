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
    const chapterIds = new Set(chapters.map((c) => c._id));
    const topicsInSubject = await ctx.db.query("topics").collect();
    const subjectTopicIds = new Set(
      topicsInSubject.filter((t) => chapterIds.has(t.chapterId)).map((t) => t._id)
    );
    const subjectTopicsById = new Map(
      topicsInSubject
        .filter((t) => chapterIds.has(t.chapterId))
        .map((t) => [t._id, t] as const)
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
