import { query, mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import {
  resolveIdentityAndUser,
  requireUser,
} from "./users";

/**
 * Subject UX contract.
 *
 * This file is the single source of truth for how Subject
 * rows in Convex are read and mutated. Three invariants
 * are enforced by JSDoc (no Convex unions, on purpose —
 * unions add friction in the seed for no benefit, and the
 * contract is a small one):
 *
 *   1. `subjects.color` and `subjects.icon` are free-form
 *      strings. The slug convention is the canonical
 *      subject slug (`"math"`, `"physics"`, `"chemistry"`,
 *      `"french"`, `"german"`, `"english"`, etc. —
 *      anything in `SUBJECT_ICON_MAP` in
 *      `components/landing/icons.ts`). The seed tree in
 *      `convex/seed.ts` writes the slug form; legacy rows
 *      with Phosphor-component-name values are migrated
 *      in place by `migrateIconSlugs` below.
 *
 *   2. The "subject-level mastery" math lives in exactly
 *      one place: `computeSubjectAggregate`. Both `list`
 *      (which batches the read pass across every subject)
 *      and `getBySlug` (which loads chapters + topics for
 *      its per-chapter math) pass their pre-loaded data
 *      into this pure function. Do not duplicate the
 *      mastery / topicsStudied / lastStudied math
 *      anywhere else in this file.
 *
 *   3. The "next-best topic" recommendation lives in
 *      exactly one place: `recommendNextBest`. The
 *      recommendation is parameterized by scope: the
 *      detail-page header surfaces a per-subject "Up
 *      next" (so it points within the current subject),
 *      while the atomic topic page surfaces a
 *      cross-subject "next thing to study" recommendation.
 *      Both share the same scoring formula and threshold
 *      for "mastered" (mastery >= 0.85).
 *
 * When adding a 7th subject: add the slug to
 * `SUBJECT_ICON_MAP` AND to the canonical seed tree
 * (`convex/seed.ts`). The two must match. AGENTS.md
 * cites this contract in the "Naming Consistency"
 * section.
 */

/**
 * Legacy `icon` value → current slug map.
 *
 * The first revision of the subject seed wrote Phosphor
 * component NAMES (`"MathOperations"`, `"Infinity"`,
 * etc.) into the `subjects.icon` field. The current
 * `SUBJECT_ICON_MAP` keys on slugs, so the legacy values
 * never resolved to a glyph and every subject rendered
 * the `Books` fallback. `migrateIconSlugs` walks the
 * table and patches each row whose `icon` matches a
 * key in this map to the matching slug.
 *
 * New rows never go through this map — the seed already
 * writes the slug form. The map is only here to repair
 * existing data.
 */
const LEGACY_ICON_TO_SLUG: Readonly<Record<string, string>> = {
  MathOperations: "math",
  Infinity: "physics",
  Flask: "chemistry",
  Quotes: "french",
  Notebook: "german",
  Brain: "english",
};

/**
 * The shared per-subject aggregate. Used by `list`
 * (as the in-memory pure function) and by `getBySlug`
 * (via `aggregateSubjectProgress`, which loads the
 * data on the caller's behalf).
 */
type SubjectAggregate = {
  mastery: number;
  topicsStudied: number;
  lastStudiedAt: number | null;
  firstTopic: {
    slug: string;
    chapterSlug: string;
    title: string;
    mastery: number;
  } | null;
};

/**
 * The shape of the next-best recommendation. Mirrored
 * exactly by the `nextBest` field on `getBySlug` and
 * `getTopicDetailBySlug`.
 */
type NextBestRecommendation = {
  subject: { slug: string; title: string; color?: string };
  chapter: { slug: string; title: string };
  topic: {
    id: Id<"topics">;
    slug: string;
    title: string;
    examRelevance: number;
    mastery: number;
  };
  reason: string;
};

/**
 * Pre-loaded curriculum + progress input for
 * `computeSubjectAggregate`. Caller is responsible for
 * filtering the maps to the relevant subjectId. This
 * is the batched-read shape the `list` query uses.
 */
type AggregateInputs = {
  readonly chaptersForSubject: ReadonlyArray<Doc<"chapters">>;
  readonly topicsByChapterId: ReadonlyMap<Id<"chapters">, Doc<"topics">[]>;
  readonly progressByTopicId: ReadonlyMap<
    Id<"topics">,
    Doc<"userTopicProgress">
  >;
};

/**
 * computeSubjectAggregate.
 *
 * Pure function. Takes pre-loaded curriculum + progress
 * data and returns the subject-level aggregate. The
 * batched `list` query uses this in-memory; `getBySlug`
 * uses `aggregateSubjectProgress` (which does its own
 * reads) and then routes through here for the math.
 *
 * First topic: lowest-`order` chapter, then highest
 * `examRelevance` (with title asc as tiebreaker).
 */
function computeSubjectAggregate(
  input: AggregateInputs
): SubjectAggregate {
  const { chaptersForSubject, topicsByChapterId, progressByTopicId } = input;

  const sortedChapters = [...chaptersForSubject].sort(
    (a, b) => a.order - b.order
  );

  let masterySum = 0;
  let masteryCount = 0;
  let topicsStudied = 0;
  let lastStudiedAt: number | null = null;
  let firstTopic: SubjectAggregate["firstTopic"] = null;

  for (const ch of sortedChapters) {
    const topics = topicsByChapterId.get(ch._id) ?? [];

    // Pick the first topic in the first chapter. Sort
    // by examRelevance desc, title asc. The "first"
    // chapter is whichever has the lowest `order`.
    if (firstTopic === null && topics.length > 0) {
      const sorted = [...topics].sort((a, b) => {
        if (b.examRelevance !== a.examRelevance) {
          return b.examRelevance - a.examRelevance;
        }
        return a.title.localeCompare(b.title);
      });
      const top = sorted[0];
      const progress = progressByTopicId.get(top._id);
      firstTopic = {
        slug: top.slug,
        chapterSlug: ch.slug,
        title: top.title,
        mastery: progress ? progress.mastery : 0,
      };
    }

    for (const topic of topics) {
      const progress = progressByTopicId.get(topic._id);
      if (!progress) continue;
      topicsStudied += 1;
      masterySum += progress.mastery;
      masteryCount += 1;
      if (
        progress.lastStudied !== undefined &&
        (lastStudiedAt === null || progress.lastStudied > lastStudiedAt)
      ) {
        lastStudiedAt = progress.lastStudied;
      }
    }
  }

  return {
    mastery: masteryCount > 0 ? masterySum / masteryCount : 0,
    topicsStudied,
    lastStudiedAt,
    firstTopic,
  };
}

/**
 * NOTE: the plan §4.3 calls for an `aggregateSubjectProgress`
 * helper that owns the per-subject read pass. In practice,
 * both `list` (which needs the aggregate for every subject
 * in a single batched read pass) and `getBySlug` (which
 * already loads chapters + topics for its per-chapter
 * math) need the math but not the per-subject read pass.
 * The shared "math" lives in `computeSubjectAggregate`
 * above. A per-subject "load + compute" helper is
 * intentionally not provided: the two callers do their
 * own batching and a third helper would either be dead
 * code or duplicate the load.
 */

/**
 * recommendNextBest.
 *
 * The single scoring + selection function for both
 * `getBySlug` and `getTopicDetailBySlug`. Same formula
 * everywhere:
 *
 *   score = (1 - mastery) * max(1, examRelevance) * recencyBoost
 *   recencyBoost = 1.5 if never started
 *                  1.2 if studied today
 *                  1.0 if studied this week
 *                  0.8 if older
 *
 * Topics with mastery >= 0.85 are skipped (treated as
 * "done"). `excludingTopicId` is an optional filter; the
 * atomic topic page uses it to skip the topic currently
 * being viewed.
 *
 * Scope:
 *   - "subject": walk only the chapter/topics of one
 *     subject. The /subjects/[slug] header pill uses
 *     this so "Up next" stays within the current subject.
 *   - "all_enrolled": walk every enrolled subject. The
 *     atomic topic page uses this so the recommendation
 *     can point anywhere in the user's curriculum.
 *
 * Returns `null` if no eligible candidate is found
 * (no enrolled subjects, or every topic is past the
 * mastery threshold).
 */
async function recommendNextBest(
  ctx: QueryCtx,
  userId: Id<"users">,
  scope:
    | { kind: "subject"; subjectId: Id<"subjects"> }
    | { kind: "all_enrolled" },
  excludingTopicId?: Id<"topics">
): Promise<NextBestRecommendation | null> {
  const now = Date.now();
  const DAY_MS = 86_400_000;
  const WEEK_MS = 7 * DAY_MS;

  type SubjectSubject = { _id: Id<"subjects">; slug: string; title: string; color?: string };
  type Candidate = {
    subject: SubjectSubject;
    chapter: { _id: Id<"chapters">; slug: string; title: string };
    topic: {
      _id: Id<"topics">;
      slug: string;
      title: string;
      examRelevance: number;
      mastery: number;
    };
    score: number;
    reason: string;
  };

  let enrolledSubjects: Array<SubjectSubject>;
  if (scope.kind === "subject") {
    const sub = await ctx.db.get(scope.subjectId);
    if (!sub) return null;
    enrolledSubjects = [
      { _id: sub._id, slug: sub.slug, title: sub.title, color: sub.color },
    ];
  } else {
    const rows = await ctx.db
      .query("userSubjects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const resolved = await Promise.all(
      rows.map((r) => ctx.db.get(r.subjectId))
    );
    enrolledSubjects = resolved
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .map((s) => ({ _id: s._id, slug: s.slug, title: s.title, color: s.color }));
  }

  if (enrolledSubjects.length === 0) return null;

  const candidates: Candidate[] = [];
  for (const sub of enrolledSubjects) {
    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_subject_order", (q) => q.eq("subjectId", sub._id))
      .collect();
    chapters.sort((a, b) => a.order - b.order);

    for (const ch of chapters) {
      const chTopics = await ctx.db
        .query("topics")
        .withIndex("by_chapter", (q) => q.eq("chapterId", ch._id))
        .collect();
      for (const t of chTopics) {
        if (excludingTopicId && t._id === excludingTopicId) continue;
        const progress = await ctx.db
          .query("userTopicProgress")
          .withIndex("by_user_topic", (q) =>
            q.eq("userId", userId).eq("topicId", t._id)
          )
          .first();
        const mastery = progress ? progress.mastery : 0;
        if (mastery >= 0.85) continue;
        const lastStudied = progress?.lastStudied ?? null;
        let recencyBoost = 1;
        if (lastStudied === null) recencyBoost = 1.5;
        else if (now - lastStudied < DAY_MS) recencyBoost = 1.2;
        else if (now - lastStudied < WEEK_MS) recencyBoost = 1;
        else recencyBoost = 0.8;
        const score =
          (1 - mastery) * Math.max(1, t.examRelevance) * recencyBoost;
        const reason =
          lastStudied === null
            ? `Not started yet, ${t.examRelevance >= 4 ? "high-yield before exams" : "core in your curriculum"}.`
            : mastery >= 0.6
              ? `Only ${Math.round(mastery * 100)}% mastered on ${t.title}, worth a second pass.`
              : `Early on ${t.title} at ${Math.round(mastery * 100)}%, keep going.`;
        candidates.push({
          subject: sub,
          chapter: { _id: ch._id, slug: ch.slug, title: ch.title },
          topic: {
            _id: t._id,
            slug: t.slug,
            title: t.title,
            examRelevance: t.examRelevance,
            mastery,
          },
          score,
          reason,
        });
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0];
  return {
    subject: {
      slug: top.subject.slug,
      title: top.subject.title,
      ...(top.subject.color ? { color: top.subject.color } : {}),
    },
    chapter: { slug: top.chapter.slug, title: top.chapter.title },
    topic: {
      id: top.topic._id,
      slug: top.topic.slug,
      title: top.topic.title,
      examRelevance: top.topic.examRelevance,
      mastery: top.topic.mastery,
    },
    reason: top.reason,
  };
}

/**
 * list.
 *
 * Returns every canonical subject in the curriculum, annotated
 * with the current user's enrollment state, mastery, last-studied
 * timestamp, and the canonical first topic. Sorted: enrolled
 * first (most recent enrollment first), then unenrolled
 * (alphabetical).
 *
 * Gating: requires a Clerk identity. The Convex `users` row is
 * NOT required — if it has not been created yet (webhook
 * pending, or first-visit dev user), the catalog still renders
 * with every subject marked `enrolled: false`. The first
 * `api.subjects.enroll` mutation self-heals the row via the
 * lazy-create path in `convex/users.ts`.
 *
 * Cost: the chapter + topic + progress reads are batched so the
 * whole query is O(3) `db.query` reads total, not O(N) per
 * subject. The aggregate math is delegated to
 * `computeSubjectAggregate` so the formula lives in exactly
 * one place.
 */
export const list = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("subjects"),
      slug: v.string(),
      title: v.string(),
      // `description`, `color`, and `icon` are all
      // `v.optional(v.string())` in the schema. The
      // earlier shape mixed `v.union(v.string(), v.null())`
      // for `description` and `v.optional(v.string())` for
      // `color`/`icon`, which is inconsistent at the read
      // surface (clients had to remember which fields are
      // null and which are undefined). The schema is the
      // single source of truth (AGENTS.md "Naming
      // Consistency"), so every field here mirrors the
      // schema's optionality.
      description: v.optional(v.string()),
      color: v.optional(v.string()),
      icon: v.optional(v.string()),
      enrolled: v.boolean(),
      enrolledAt: v.union(v.number(), v.null()),
      chapterCount: v.number(),
      topicCount: v.number(),
      mastery: v.number(),
      topicsStudied: v.number(),
      lastStudiedAt: v.union(v.number(), v.null()),
      firstTopic: v.union(
        v.object({
          slug: v.string(),
          chapterSlug: v.string(),
          title: v.string(),
          mastery: v.number(),
        }),
        v.null()
      ),
    })
  ),
  handler: async (ctx) => {
    const resolved = await resolveIdentityAndUser(ctx);
    if (!resolved) return [];

    // 1. All canonical subjects. Batched read.
    const subjects = await ctx.db.query("subjects").collect();

    // 2. Enrollment state. Batched read.
    const enrollments = resolved.user
      ? await ctx.db
          .query("userSubjects")
          .withIndex("by_user", (q) => q.eq("userId", resolved.user!._id))
          .collect()
      : [];
    const enrolledMap = new Map<Id<"subjects">, number>();
    for (const e of enrollments) {
      enrolledMap.set(e.subjectId, e.enrolledAt);
    }

    // 3. Batched curriculum + progress reads. Three reads
    //    total regardless of how many subjects exist.
    //    The `chaptersForSubject` map is grouped in-memory
    //    by `subjectId`; the `topicsByChapterId` map keys
    //    on chapterId; the `progressByTopicId` map keys on
    //    topicId. `aggregateSubjectProgress` consumes all
    //    three for one subject; `computeSubjectAggregate`
    //    consumes them in-memory across many subjects.
    const [allChapters, allUserProgress] = await Promise.all([
      ctx.db.query("chapters").collect(),
      resolved.user
        ? ctx.db
            .query("userTopicProgress")
            .withIndex("by_user", (q) => q.eq("userId", resolved.user!._id))
            .collect()
        : Promise.resolve([] as Doc<"userTopicProgress">[]),
    ]);

    // Topics keyed by chapterId. ONE batched read of the
    // `topics` table (returns canonical + user-owned rows
    // together because decision D1 keeps user topics in the
    // canonical table) followed by an in-memory bucket on
    // `chapterId`. This replaces the previous `O(chapters)`
    // parallel-indexed reads with a single O(1) request that
    // costs less connection-pool slots and is more readable.
    // The downstream consumers (`computeSubjectAggregate`,
    // the per-subject topicCount loop, the `firstTopic`
    // selection) treat every row uniformly, so the union of
    // canonical + user-owned topics in one Map is the right
    // shape end-to-end. User-owned topics have
    // `examRelevance: 1`, so the `firstTopic` ordering is
    // always canonical-first even with user rows present.
    const allTopics = await ctx.db.query("topics").collect();

    const topicsByChapterId = new Map<Id<"chapters">, Doc<"topics">[]>();
    for (const t of allTopics) {
      const arr = topicsByChapterId.get(t.chapterId) ?? [];
      arr.push(t);
      topicsByChapterId.set(t.chapterId, arr);
    }

    const chaptersBySubject = new Map<Id<"subjects">, Doc<"chapters">[]>();
    for (const ch of allChapters) {
      const arr = chaptersBySubject.get(ch.subjectId) ?? [];
      arr.push(ch);
      chaptersBySubject.set(ch.subjectId, arr);
    }

    const progressByTopicId = new Map<
      Id<"topics">,
      Doc<"userTopicProgress">
    >();
    for (const p of allUserProgress) {
      progressByTopicId.set(p.topicId, p);
    }

    // 4. Build the response. For each subject, call the
    //    pure-function aggregate. The cost per subject is
    //    O(chapters) + O(topics) in-memory, no further
    //    database reads.
    const out = subjects.map((subj) => {
      const chapters = chaptersBySubject.get(subj._id) ?? [];
      let topicCount = 0;
      for (const ch of chapters) {
        topicCount += (topicsByChapterId.get(ch._id) ?? []).length;
      }

      const aggregate = computeSubjectAggregate({
        chaptersForSubject: chapters,
        topicsByChapterId,
        progressByTopicId,
      });

      return {
        id: subj._id,
        slug: subj.slug,
        title: subj.title,
        // Mirror the schema's optionality verbatim: missing
        // stays missing, present stays present. No `?? null`
        // conversion — that would require clients to remember
        // which optional fields are nullable vs undefined.
        description: subj.description,
        color: subj.color,
        icon: subj.icon,
        enrolled: enrolledMap.has(subj._id),
        enrolledAt: enrolledMap.get(subj._id) ?? null,
        chapterCount: chapters.length,
        topicCount,
        mastery: aggregate.mastery,
        topicsStudied: aggregate.topicsStudied,
        lastStudiedAt: aggregate.lastStudiedAt,
        firstTopic: aggregate.firstTopic,
      };
    });

    // Sort: enrolled first (most recent first), then unenrolled (alpha).
    out.sort((a, b) => {
      if (a.enrolled && !b.enrolled) return -1;
      if (!a.enrolled && b.enrolled) return 1;
      if (a.enrolled && b.enrolled) {
        return (b.enrolledAt ?? 0) - (a.enrolledAt ?? 0);
      }
      return a.title.localeCompare(b.title);
    });

    return out;
  },
});

/**
 * enroll.
 *
 * Idempotent: enrolling in a subject the user is already enrolled
 * in is a no-op. Returns the enrollment row's id (or the existing
 * one if the call was a no-op) so the caller can chain without a
 * re-read.
 *
 * Lazy-creates the Convex `users` row on first call from a
 * brand-new sign-up (see `requireUser` in `convex/users.ts`).
 */
export const enroll = mutation({
  args: {
    subjectId: v.id("subjects"),
  },
  returns: v.id("userSubjects"),
  handler: async (ctx, { subjectId }): Promise<Id<"userSubjects">> => {
    const user = await requireUser(ctx);
    const userId: Id<"users"> = user._id;

    // Idempotency: re-enroll is a no-op.
    const existing = await ctx.db
      .query("userSubjects")
      .withIndex("by_user_subject", (q) =>
        q.eq("userId", userId).eq("subjectId", subjectId)
      )
      .first();
    if (existing) return existing._id;

    // Validate the subject actually exists so we never write a
    // dangling foreign key.
    const subject = await ctx.db.get(subjectId);
    if (!subject) throw new ConvexError("subject_not_found");

    return await ctx.db.insert("userSubjects", {
      userId,
      subjectId,
      enrolledAt: Date.now(),
    });
  },
});

/**
 * leave.
 *
 * Idempotent: leaving a subject the user is not enrolled in is a
 * no-op. Intentionally does NOT cascade-delete userTopicProgress
 * for that subject. The project rule is that learning history is
 * soft-preserved for longitudinal analytics; if the user re-enrolls
 * later, their old progress is still there.
 */
export const leave = mutation({
  args: {
    subjectId: v.id("subjects"),
  },
  returns: v.null(),
  handler: async (ctx, { subjectId }): Promise<null> => {
    const user = await requireUser(ctx);
    const userId: Id<"users"> = user._id;

    const existing = await ctx.db
      .query("userSubjects")
      .withIndex("by_user_subject", (q) =>
        q.eq("userId", userId).eq("subjectId", subjectId)
      )
      .first();
    if (!existing) return null;

    await ctx.db.delete(existing._id);
    return null;
  },
});

/**
 * getBySlug.
 *
 * Returns the full subject detail for a single subject: the
 * subject, the user's enrollment state, a list of chapters
 * (ordered by `order`) with per-chapter topic count, topics
 * studied, average mastery, and the most recent `lastStudied`
 * timestamp across the chapter's topics, plus a per-subject
 * `nextBest` recommendation (the next topic to study within
 * this subject).
 *
 * Returns `null` ONLY if the subject does not exist. The
 * canonical subject lookup is auth-optional — the `subjects`
 * table is public curriculum data with no PII, and per-user
 * enrichment below gracefully degrades to no-progress
 * defaults when no Clerk identity is forwarded.
 *
 * Does NOT require the Convex `users` row to exist. If signed
 * in but the row has not been created yet, the response carries
 * `enrolled: false`, mastery / topicsStudied = 0, and null
 * timestamps — the same shape it would have for a brand-new
 * user with no progress at all. This is the dev-time default
 * and is the invariant that lets the catalog render immediately
 * after Clerk sign-up.
 *
 * The per-subject aggregate math is delegated to
 * `aggregateSubjectProgress`. The per-chapter math stays
 * inline because the per-chapter shape is the natural return
 * value and would not benefit from a shared helper.
 */
export const getBySlug = query({
  args: {
    slug: v.string(),
  },
  returns: v.union(
    v.object({
      subject: v.object({
        id: v.id("subjects"),
        slug: v.string(),
        title: v.string(),
        description: v.union(v.string(), v.null()),
        color: v.optional(v.string()),
        icon: v.optional(v.string()),
      }),
      enrolled: v.boolean(),
      enrolledAt: v.union(v.number(), v.null()),
      chapters: v.array(
        v.object({
          id: v.id("chapters"),
          slug: v.string(),
          title: v.string(),
          description: v.union(v.string(), v.null()),
          order: v.number(),
          topicCount: v.number(),
          topicsStudied: v.number(),
          mastery: v.number(),
          lastStudiedAt: v.union(v.number(), v.null()),
        })
      ),
      aggregate: v.object({
        topicCount: v.number(),
        topicsStudied: v.number(),
        mastery: v.number(),
        lastStudiedAt: v.union(v.number(), v.null()),
        // Total `estimatedMinutes` across every topic in
        // the subject. The SubjectHeader divides by
        // `topicCount` to get the average per topic,
        // then multiplies by unmastered topics to render
        // the "~Nh to mastery" chip. Mirrors the field
        // in `getChapterBySlug.aggregate`.
        estimatedMinutesTotal: v.number(),
        // First topic in the first chapter. Drives the
        // SubjectCard "Continue" / "Start first topic"
        // CTA and the SubjectDetail page's "Up next"
        // pill fallback. `null` if the subject has no
        // chapters.
        firstTopic: v.union(
          v.object({
            slug: v.string(),
            chapterSlug: v.string(),
            title: v.string(),
            mastery: v.number(),
          }),
          v.null()
        ),
      }),
      // "Up next" recommendation, scoped to this subject.
      // `null` if no eligible topic exists (the user has
      // mastered everything in the subject, or the subject
      // has no chapters).
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
          }),
          reason: v.string(),
        }),
        v.null()
      ),
    }),
    v.null()
  ),
  handler: async (ctx, { slug }) => {
    // 1. Subject by slug — canonical curriculum data, publicly
    //    readable. Resolved BEFORE the per-user enrichment so a
    //    direct deep link to /tutor?subject=… works even when
    //    the server-side read context does not forward a Clerk
    //    JWT. The subjects table has no PII, and per-user
    //    enrichment below already gracefully degrades.
    const subject = await ctx.db
      .query("subjects")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!subject) return null;

    // 2. Per-user enrichment (best-effort). Returns null when
    //    no Clerk identity is forwarded — the rare path where
    //    fetchQuery on this route lost the request cookie. The
    //    fallback shape matches a brand-new user with no
    //    progress: enrolled=false, mastery=0, lastStudied=null.
    const resolved = await resolveIdentityAndUser(ctx).catch(() => null);
    const userId: Id<"users"> | null = resolved?.user?._id ?? null;

    // 3. Enrollment state. Empty when no users row yet.
    const enrollment =
      userId !== null
        ? await ctx.db
            .query("userSubjects")
            .withIndex("by_user_subject", (q) =>
              q.eq("userId", userId).eq("subjectId", subject._id)
            )
            .first()
        : null;

    // 4. Chapters in order.
    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_subject_order", (q) => q.eq("subjectId", subject._id))
      .collect();
    chapters.sort((a, b) => a.order - b.order);

    // 5. Collect every topic across the subject's chapters in a
    //    single fan-out, then batch-load the user's progress
    //    for those topics in parallel. Replaces the previous
    //    O(chapters * topics) `db.query` chain with two
    //    O(N) passes.
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

    // Per-topic progress, scoped to the calling user when we
    // have a row. An empty `progressRows` (no userId) yields the
    // same shape as a brand-new user with no progress — every
    // mastery value is 0, every lastStudiedAt is null, every
    // `isStudied` is false. That is the desired fallback.
    const progressRows =
      userId !== null
        ? await Promise.all(
            allTopics.map((topic) =>
              ctx.db
                .query("userTopicProgress")
                .withIndex("by_user_topic", (q) =>
                  q.eq("userId", userId).eq("topicId", topic._id)
                )
                .first()
            )
          )
        : new Array(allTopics.length).fill(null);
    const progressByTopic = new Map<
      Id<"topics">,
      NonNullable<typeof progressRows[number]>
    >();
    allTopics.forEach((topic, i) => {
      const p = progressRows[i];
      if (p) progressByTopic.set(topic._id, p);
    });

    const chapterOut = [];
    let totalTopicCount = 0;
    let totalTopicsStudied = 0;
    let estimatedMinutesTotal = 0;

    for (const ch of chapters) {
      const topics = allTopics.filter((t) => t.chapterId === ch._id);

      let topicsStudied = 0;
      let chMasterySum = 0;
      let chMasteryCount = 0;
      let chLastStudied: number | null = null;

      for (const topic of topics) {
        const progress = progressByTopic.get(topic._id);
        if (progress) {
          topicsStudied += 1;
          chMasterySum += progress.mastery;
          chMasteryCount += 1;
          if (
            progress.lastStudied !== undefined &&
            (chLastStudied === null || progress.lastStudied > chLastStudied)
          ) {
            chLastStudied = progress.lastStudied;
          }
        }
      }

      totalTopicCount += topics.length;
      totalTopicsStudied += topicsStudied;
      for (const topic of topics) {
        if (topic.estimatedMinutes !== undefined) {
          estimatedMinutesTotal += topic.estimatedMinutes;
        }
      }

      chapterOut.push({
        id: ch._id,
        slug: ch.slug,
        title: ch.title,
        description: ch.description ?? null,
        order: ch.order,
        topicCount: topics.length,
        topicsStudied,
        // Per-topic mastery mean: each studied topic contributes
        // its own mastery once. This matches the per-subject
        // weighting in `aggregateSubjectProgress` so the cockpit
        // and the subject detail page tell the same story.
        mastery: chMasteryCount > 0 ? chMasterySum / chMasteryCount : 0,
        lastStudiedAt: chLastStudied,
      });
    }

    // 6. Subject-level aggregate via the shared helper. The
    //    helper accepts pre-loaded data; for `getBySlug` we
    //    pass the same data we already loaded for the per-
    //    chapter loop so no extra reads happen here.
    const aggregate = computeSubjectAggregate({
      chaptersForSubject: chapters,
      topicsByChapterId: (() => {
        const m = new Map<Id<"chapters">, Doc<"topics">[]>();
        for (const t of allTopics) {
          const arr = m.get(t.chapterId) ?? [];
          arr.push(t);
          m.set(t.chapterId, arr);
        }
        return m;
      })(),
      progressByTopicId: progressByTopic,
    });

    // 7. Per-subject next-best recommendation. Scoped to this
    //    subject so the SubjectHeader's "Up next" pill always
    //    points within the current subject. The atomic topic
    //    page uses `recommendNextBest` with the
    //    `all_enrolled` scope instead — that divergence is
    //    intentional: the SubjectHeader wants a recommendation
    //    that lives in the same subject the user is viewing,
    //    while the topic page can point anywhere in the
    //    user's curriculum.
    //    `null` when the user is not signed in OR no eligible
    //    candidate exists.
    const nextBest =
      userId !== null
        ? await recommendNextBest(
            ctx,
            userId,
            { kind: "subject", subjectId: subject._id }
          )
        : null;

    return {
      subject: {
        id: subject._id,
        slug: subject.slug,
        title: subject.title,
        description: subject.description ?? null,
        color: subject.color,
        icon: subject.icon,
      },
      enrolled: enrollment !== null,
      enrolledAt: enrollment?.enrolledAt ?? null,
      chapters: chapterOut,
      aggregate: {
        topicCount: totalTopicCount,
        topicsStudied: totalTopicsStudied,
        mastery: aggregate.mastery,
        lastStudiedAt: aggregate.lastStudiedAt,
        estimatedMinutesTotal,
        firstTopic: aggregate.firstTopic,
      },
      nextBest,
    };
  },
});

/**
 * getChapterBySlug.
 *
 * Returns the chapter detail for a single chapter in a single
 * subject. Includes the subject (for breadcrumbs), the chapter,
 * and all topics in the chapter (sorted canonical-first by
 * `examRelevance` desc, then user-owned topics appended last)
 * with per-topic mastery and last-studied timestamp.
 *
 * Decision D1 in docs/USER-TOPIC-LESSON-PLAN.md: user-owned
 * topics live in the same `topics` table; this drilldown
 * returns both canonical and user rows so the student sees a
 * cohesive list. The two flavors are discriminated via
 * `source` + `ownerId` (both optional, defaulted to canonical).
 *
 * Returns `null` if the subject or chapter does not exist or
 * if the chapter does not belong to the given subject. The
 * canonical reads are auth-optional; per-user enrichment
 * (mastery, lastStudiedAt) gracefully degrades to no-
 * progress defaults when no Clerk identity is forwarded.
 * Does NOT require the Convex `users` row to exist — falls
 * back to per-topic defaults (mastery = 0, lastStudiedAt =
 * null, isStudied = false).
 */
export const getChapterBySlug = query({
  args: {
    subjectSlug: v.string(),
    chapterSlug: v.string(),
  },
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
        description: v.union(v.string(), v.null()),
        order: v.number(),
      }),
      topics: v.array(
        v.object({
          id: v.id("topics"),
          slug: v.string(),
          title: v.string(),
          objectives: v.array(v.string()),
          examRelevance: v.number(),
          difficulty: v.union(
            v.literal("EASY"),
            v.literal("MEDIUM"),
            v.literal("HARD")
          ),
          estimatedMinutes: v.optional(v.number()),
          mastery: v.number(),
          lastStudiedAt: v.union(v.number(), v.null()),
          isStudied: v.boolean(),
          // NEW: discriminator + ownership. Canonical topics
          // read as `source: "canonical"` (default) and
          // `ownerId: null`. Student-created topics read as
          // `source: "user"` + the calling user's id.
          source: v.union(v.literal("canonical"), v.literal("user")),
          ownerId: v.union(v.id("users"), v.null()),
        })
      ),
      aggregate: v.object({
        topicCount: v.number(),
        topicsStudied: v.number(),
        mastery: v.number(),
        lastStudiedAt: v.union(v.number(), v.null()),
        estimatedMinutesTotal: v.number(),
      }),
    }),
    v.null()
  ),
  handler: async (ctx, { subjectSlug, chapterSlug }) => {
    // 1. Subject + chapter by slug pair. Canonical, publicly
    //    readable. Auth-optional on the canonical read so
    //    direct deep links to /subjects/[slug]/[chapterSlug]
    //    work even if the read context lost the Clerk JWT.
    const subject = await ctx.db
      .query("subjects")
      .withIndex("by_slug", (q) => q.eq("slug", subjectSlug))
      .first();
    if (!subject) return null;

    // 2. Per-user enrichment (best-effort). Falls back to per-
    //    topic defaults (mastery 0, lastStudied null) when no
    //    Clerk identity is forwarded.
    const resolved = await resolveIdentityAndUser(ctx).catch(() => null);
    const userId: Id<"users"> | null = resolved?.user?._id ?? null;

    // 2. Chapter by (subject, slug) using the compound index.
    //    The previous implementation queried all chapters in
    //    the subject and ran an in-memory find; the index turns
    //    this into an O(log n) lookup.
    const chapter = await ctx.db
      .query("chapters")
      .withIndex("by_subject_slug", (q) =>
        q.eq("subjectId", subject._id).eq("slug", chapterSlug)
      )
      .first();
    if (!chapter) return null;

    // 3. Topics in this chapter, with per-topic progress.
    // The `by_chapter` index returns BOTH canonical and user-
    // owned topics because they all live in the same table
    // (decision D1). The per-topic `source` discriminator
    // surfaces the flavor at the response layer.
    const topics = await ctx.db
      .query("topics")
      .withIndex("by_chapter", (q) => q.eq("chapterId", chapter._id))
      .collect();

    const topicsOut = [];
    let topicsStudied = 0;
    let masterySum = 0;
    let masteryCount = 0;
    let lastStudiedGlobal: number | null = null;
    let estimatedMinutesTotal = 0;

    for (const topic of topics) {
      // Skip the per-topic progress lookup when no users row
      // exists yet — equivalent to "user exists but has no
      // progress on this topic".
      const progress =
        userId !== null
          ? await ctx.db
              .query("userTopicProgress")
              .withIndex("by_user_topic", (q) =>
                q.eq("userId", userId).eq("topicId", topic._id)
              )
              .first()
          : null;

      const isStudied = progress !== null;
      if (isStudied) {
        topicsStudied += 1;
        masterySum += progress.mastery;
        masteryCount += 1;
        if (
          progress.lastStudied !== undefined &&
          (lastStudiedGlobal === null ||
            progress.lastStudied > lastStudiedGlobal)
        ) {
          lastStudiedGlobal = progress.lastStudied;
        }
      }

      estimatedMinutesTotal += topic.estimatedMinutes ?? 0;

      topicsOut.push({
        id: topic._id,
        slug: topic.slug,
        title: topic.title,
        objectives: topic.objectives,
        examRelevance: topic.examRelevance,
        difficulty: topic.difficulty,
        estimatedMinutes: topic.estimatedMinutes,
        mastery: isStudied ? progress.mastery : 0,
        lastStudiedAt: isStudied ? (progress.lastStudied ?? null) : null,
        isStudied,
        // NEW: defaults match the canonical shape so old
        // canonical rows that were inserted before
        // `source`/`ownerId` landed read back as canonical.
        source: (topic.source ?? "canonical") as "canonical" | "user",
        ownerId: topic.ownerId ?? null,
      });
    }

    // Sort topics: canonical first by exam relevance desc
    // (with title asc as tiebreaker), then user-owned
    // topics appended at the end in creation-date order.
    // This keeps the canonical curriculum ordering intact
    // for students who have not created any of their own.
    topicsOut.sort((a, b) => {
      if (a.source !== b.source) {
        return a.source === "canonical" ? -1 : 1;
      }
      if (a.source === "canonical") {
        if (b.examRelevance !== a.examRelevance) {
          return b.examRelevance - a.examRelevance;
        }
        return a.title.localeCompare(b.title);
      }
      // User topics appended in stable insertion order
      // (filtering on canonical-first already partitioned
      // them; the in-memory order respects the chapter's
      // index insertion order which is creation order).
      return 0;
    });

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
        description: chapter.description ?? null,
        order: chapter.order,
      },
      topics: topicsOut,
      aggregate: {
        topicCount: topics.length,
        topicsStudied,
        mastery: masteryCount > 0 ? masterySum / masteryCount : 0,
        lastStudiedAt: lastStudiedGlobal,
        estimatedMinutesTotal,
      },
    };
  },
});

/**
 * getTopicBySlug.
 *
 * Resolves a single topic by its slug within a subject.
 * Returns the topic (with mastery, lastStudied, isStudied)
 * or `null` if the subject or topic does not exist. The
 * canonical lookup is auth-optional — per-user enrichment
 * degrades to no-progress defaults when no Clerk identity
 * is forwarded; the response shape is identical either way.
 * Used by the /tutor page
 * to resolve a `?subject=...&topic=...` query pair in a
 * single read instead of scanning chapters. Does NOT require
 * the Convex `users` row to exist.
 */
export const getTopicBySlug = query({
  args: {
    subjectSlug: v.string(),
    topicSlug: v.string(),
  },
  returns: v.union(
    v.object({
      id: v.id("topics"),
      slug: v.string(),
      title: v.string(),
      objectives: v.array(v.string()),
      examRelevance: v.number(),
      difficulty: v.union(
        v.literal("EASY"),
        v.literal("MEDIUM"),
        v.literal("HARD")
      ),
      estimatedMinutes: v.optional(v.number()),
      mastery: v.number(),
      lastStudiedAt: v.union(v.number(), v.null()),
      isStudied: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx, { subjectSlug, topicSlug }) => {
    // 1. Subject + topic by slug pair. Canonical, public.
    const subject = await ctx.db
      .query("subjects")
      .withIndex("by_slug", (q) => q.eq("slug", subjectSlug))
      .first();
    if (!subject) return null;

    // 2. Per-user enrichment (best-effort). Null userId yields
    //    the same shape as a brand-new user with no progress.
    const resolved = await resolveIdentityAndUser(ctx).catch(() => null);
    const userId: Id<"users"> | null = resolved?.user?._id ?? null;

    // Use the existing `by_slug` index on `topics` to do an
    // O(log n) lookup, then verify the topic belongs to the
    // requested subject. The previous implementation walked
    // every chapter in the subject and every topic in each
    // chapter (O(chapters * topics)); this turns it into one
    // indexed read plus one `db.get` to verify ownership.
    const topic = await ctx.db
      .query("topics")
      .withIndex("by_slug", (q) => q.eq("slug", topicSlug))
      .first();
    if (!topic) return null;

    const chapter = await ctx.db.get(topic.chapterId);
    if (!chapter) return null;
    if (chapter.subjectId !== subject._id) return null;

    const progress =
      userId !== null
        ? await ctx.db
            .query("userTopicProgress")
            .withIndex("by_user_topic", (q) =>
              q.eq("userId", userId).eq("topicId", topic._id)
            )
            .first()
        : null;
    const isStudied = progress !== null;
    return {
      id: topic._id,
      slug: topic.slug,
      title: topic.title,
      objectives: topic.objectives,
      examRelevance: topic.examRelevance,
      difficulty: topic.difficulty,
      estimatedMinutes: topic.estimatedMinutes,
      mastery: isStudied ? progress.mastery : 0,
      lastStudiedAt: isStudied ? (progress.lastStudied ?? null) : null,
      isStudied,
    };
  },
});

/**
 * getTopicDetailBySlug.
 *
 * The atomic topic page query. Co-locates everything the
 * /subjects/[slug]/[chapterSlug]/[topicSlug] route needs in
 * one round trip:
 *
 *   - subject + chapter + topic (extended metadata: mastery,
 *     confidence, lastStudied, objectives, examRelevance,
 *     difficulty, estimatedMinutes)
 *   - lessonBlocks keyed by depth (`simple` / `standard` /
 *     `rigorous`), each in `order` ascending. Pulled from the
 *     `by_topic_depth` index, one read per depth. Missing
 *     depths return as empty arrays so the UI shows a friendly
 *     "Not yet authored" panel rather than crashing.
 *   - prerequisites — every `topicPrerequisites` row where
 *     this topic is the dependent side, joined to its topic
 *     row + the user's mastery for that prereq. Empty when no
 *     prerequisites exist (the seed tree doesn't yet encode
 *     them; this is forward-compatible).
 *   - commonMistakes — the most recent 5 `mistakeEntries`
 *     rows for this topic, scoped to the user. Empty for a
 *     brand-new user.
 *   - nextBest — `{ topic, reason }` recommendation: the
 *     highest-scoring unmastered topic across the user's
 *     enrolled subjects, scored as
 *       `(1 - mastery) * examRelevance * recencyBoost`
 *     where recencyBoost is 1.5 if never started, 1.2 if
 *     studied today, 1.0 if this week, 0.8 if older. Topics
 *     with mastery >= 0.85 are considered done and skipped.
 *     Excludes the topic currently being viewed so the
 *     recommendation always points somewhere new.
 *     Returns `null` if the user has no enrolled subjects or
 *     every enrolled topic is past the mastery threshold.
 *     The recommendation math + selection lives in
 *     `recommendNextBest` so the per-subject and
 *     cross-subject scopes share the same formula.
 *
 * Returns `null` only if any of subject / chapter / topic
 * does not resolve. The canonical resolution is auth-optional;
 * per-user fields (mastery, prerequisites, commonMistakes,
 * nextBest) gracefully degrade to no-progress defaults when
 * no Clerk identity is forwarded. Does NOT require the
 * Convex `users` row — falls back to per-topic
 * defaults, empty prerequisites, empty mistakes, and a
 * recommendation built purely from curriculum data.
 */
export const getTopicDetailBySlug = query({
  args: {
    subjectSlug: v.string(),
    chapterSlug: v.string(),
    topicSlug: v.string(),
  },
  returns: v.union(
    v.object({
      subject: v.object({
        id: v.id("subjects"),
        slug: v.string(),
        title: v.string(),
        color: v.optional(v.string()),
      }),
      chapter: v.object({
        slug: v.string(),
        title: v.string(),
        order: v.number(),
        id: v.id("chapters"),
      }),
      topic: v.object({
        id: v.id("topics"),
        slug: v.string(),
        title: v.string(),
        objectives: v.array(v.string()),
        examRelevance: v.number(),
        difficulty: v.union(
          v.literal("EASY"),
          v.literal("MEDIUM"),
          v.literal("HARD")
        ),
        estimatedMinutes: v.optional(v.number()),
        gradeLevel: v.optional(v.string()),
        mastery: v.number(),
        confidence: v.number(),
        lastStudiedAt: v.union(v.number(), v.null()),
        isStudied: v.boolean(),
        timeSpentSec: v.number(),
      }),
      lessonBlocks: v.object({
        simple: v.array(
          v.object({
            id: v.id("lessonBlocks"),
            title: v.string(),
            content: v.string(),
            order: v.number(),
            workedExamples: v.optional(
              v.array(
                v.object({
                  setup: v.string(),
                  solution: v.string(),
                  skill: v.string(),
                })
              )
            ),
            commonMistakes: v.optional(
              v.array(
                v.object({
                  mistake: v.string(),
                  correction: v.string(),
                  cause: v.string(),
                })
              )
            ),
            formulas: v.optional(
              v.array(
                v.object({
                  name: v.string(),
                  expression: v.string(),
                  when: v.string(),
                })
              )
            ),
            vocabulary: v.optional(
              v.array(
                v.object({
                  term: v.string(),
                  definition: v.string(),
                  gender: v.optional(v.union(
                    v.literal("m"), v.literal("f"), v.literal("n")
                  )),
                })
              )
            ),
          })
        ),
        standard: v.array(
          v.object({
            id: v.id("lessonBlocks"),
            title: v.string(),
            content: v.string(),
            order: v.number(),
            workedExamples: v.optional(
              v.array(
                v.object({
                  setup: v.string(),
                  solution: v.string(),
                  skill: v.string(),
                })
              )
            ),
            commonMistakes: v.optional(
              v.array(
                v.object({
                  mistake: v.string(),
                  correction: v.string(),
                  cause: v.string(),
                })
              )
            ),
            formulas: v.optional(
              v.array(
                v.object({
                  name: v.string(),
                  expression: v.string(),
                  when: v.string(),
                })
              )
            ),
            vocabulary: v.optional(
              v.array(
                v.object({
                  term: v.string(),
                  definition: v.string(),
                  gender: v.optional(v.union(
                    v.literal("m"), v.literal("f"), v.literal("n")
                  )),
                })
              )
            ),
          })
        ),
        rigorous: v.array(
          v.object({
            id: v.id("lessonBlocks"),
            title: v.string(),
            content: v.string(),
            order: v.number(),
            workedExamples: v.optional(
              v.array(
                v.object({
                  setup: v.string(),
                  solution: v.string(),
                  skill: v.string(),
                })
              )
            ),
            commonMistakes: v.optional(
              v.array(
                v.object({
                  mistake: v.string(),
                  correction: v.string(),
                  cause: v.string(),
                })
              )
            ),
            formulas: v.optional(
              v.array(
                v.object({
                  name: v.string(),
                  expression: v.string(),
                  when: v.string(),
                })
              )
            ),
            vocabulary: v.optional(
              v.array(
                v.object({
                  term: v.string(),
                  definition: v.string(),
                  gender: v.optional(v.union(
                    v.literal("m"), v.literal("f"), v.literal("n")
                  )),
                })
              )
            ),
          })
        ),
      }),
      prerequisites: v.array(
        v.object({
          id: v.id("topics"),
          slug: v.string(),
          title: v.string(),
          chapterSlug: v.string(),
          subjectSlug: v.string(),
          mastery: v.number(),
          isStudied: v.boolean(),
          unlocked: v.boolean(), // mastery >= 0.5 treated as unlocked
        })
      ),
      commonMistakes: v.array(
        v.object({
          id: v.id("mistakeEntries"),
          question: v.string(),
          userAnswer: v.string(),
          correctAnswer: v.string(),
          mistakeType: v.string(),
          attemptedAt: v.number(),
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
          }),
          reason: v.string(),
        }),
        v.null()
      ),
    }),
    v.null()
  ),
  handler: async (ctx, { subjectSlug, chapterSlug, topicSlug }) => {
    // 1. Subject / chapter / topic. Canonical, public reads so
    //    direct deep links to
    //    /subjects/[slug]/[chapterSlug]/[topicSlug] work even
    //    when the read context lost the Clerk JWT. Same
    //    lookup pattern as getChapterBySlug; an extra `db.get`
    //    to verify the topic belongs to the (subject, chapter)
    //    pair.
    const subject = await ctx.db
      .query("subjects")
      .withIndex("by_slug", (q) => q.eq("slug", subjectSlug))
      .first();
    if (!subject) return null;

    // 2. Per-user enrichment (best-effort). Returns null when
    //    no Clerk identity is forwarded. Fallback shape is the
    //    same as a brand-new user: zero mastery, no prereqs,
    //    no mistakes, no nextBest.
    const resolved = await resolveIdentityAndUser(ctx).catch(() => null);
    const userId: Id<"users"> | null = resolved?.user?._id ?? null;

    const chapter = await ctx.db
      .query("chapters")
      .withIndex("by_subject_slug", (q) =>
        q.eq("subjectId", subject._id).eq("slug", chapterSlug)
      )
      .first();
    if (!chapter) return null;

    const topic = await ctx.db
      .query("topics")
      .withIndex("by_slug", (q) => q.eq("slug", topicSlug))
      .first();
    if (!topic || topic.chapterId !== chapter._id) return null;

    // 2. Per-topic progress for the current topic.
    const topicProgress =
      userId !== null
        ? await ctx.db
            .query("userTopicProgress")
            .withIndex("by_user_topic", (q) =>
              q.eq("userId", userId).eq("topicId", topic._id)
            )
            .first()
        : null;

    // 3. Lesson blocks keyed by depth. Three parallel reads
    //    against `by_topic_depth`; each in-memory sort by
    //    `order` asc.
    const depthRows = await Promise.all(
      (["simple", "standard", "rigorous"] as const).map((depth) =>
        ctx.db
          .query("lessonBlocks")
          .withIndex("by_topic_depth", (q) =>
            q.eq("topicId", topic._id).eq("depth", depth)
          )
          .collect()
      )
    );
    const [simpleRows, standardRows, rigorousRows] = depthRows;
    simpleRows.sort((a, b) => a.order - b.order);
    standardRows.sort((a, b) => a.order - b.order);
    rigorousRows.sort((a, b) => a.order - b.order);

    // 4. Prerequisites. Find every prereq edge that points AT
    //    this topic, then fetch the prereq topic + chapter in
    //    parallel, and the per-prereq mastery (user-scoped or
    //    empty array when no users row).
    const prereqEdges = await ctx.db
      .query("topicPrerequisites")
      .withIndex("by_topic", (q) => q.eq("topicId", topic._id))
      .collect();
    const prereqTopicIds = prereqEdges.map((e) => e.prerequisiteTopicId);
    const prereqTopicsResolved = prereqTopicIds.length
      ? await Promise.all(prereqTopicIds.map((id) => ctx.db.get(id)))
      : [];
    const prereqChaptersResolved = prereqTopicsResolved.length
      ? await Promise.all(
          prereqTopicsResolved.map((t) =>
            t ? ctx.db.get(t.chapterId) : Promise.resolve(null)
          )
        )
      : [];
    const prereqSubjectsResolved = prereqChaptersResolved.length
      ? await Promise.all(
          prereqChaptersResolved.map((c) =>
            c ? ctx.db.get(c.subjectId) : Promise.resolve(null)
          )
        )
      : [];
    const prereqProgressResolved =
      userId !== null && prereqTopicIds.length > 0
        ? await Promise.all(
            prereqTopicIds.map((id) =>
              ctx.db
                .query("userTopicProgress")
                .withIndex("by_user_topic", (q) =>
                  q.eq("userId", userId).eq("topicId", id)
                )
                .first()
            )
          )
        : new Array(prereqTopicIds.length).fill(null);

    const prerequisites = prereqTopicsResolved.map((pt, idx) => {
      const chapterRow = prereqChaptersResolved[idx];
      const subjectRow = prereqSubjectsResolved[idx];
      const progressRow = prereqProgressResolved[idx];
      const mastery = progressRow ? progressRow.mastery : 0;
      return {
        id: pt!._id,
        slug: pt!.slug,
        title: pt!.title,
        chapterSlug: chapterRow?.slug ?? "",
        subjectSlug: subjectRow?.slug ?? "",
        mastery,
        isStudied: progressRow !== null,
        unlocked: mastery >= 0.5,
      };
    });

    // 5. Common mistakes — last 5 attempts on this topic. The
    //    `by_user_topic` index covers (userId, topicId) so this
    //    is one read. We collect (no `.take()` on
    //    `by_user_topic`) because that index is not range-
    //    bounded on `_creationTime`; collect + slice is fine
    //    for the app's expected mistake scale.
    //
    //    The schema has no explicit `attemptedAt` field — we
    //    surface the canonical `_creationTime` as the response
    //    timestamp because that's the closest equivalent and
    //    the topic page only needs a relative sort signal.
    const commonMistakes =
      userId !== null
        ? (
            await ctx.db
              .query("mistakeEntries")
              .withIndex("by_user_topic", (q) =>
                q.eq("userId", userId).eq("topicId", topic._id)
              )
              .collect()
          )
            .sort((a, b) => b._creationTime - a._creationTime)
            .slice(0, 5)
            .map((m) => ({
              id: m._id,
              question: m.question,
              userAnswer: m.userAnswer,
              correctAnswer: m.correctAnswer,
              mistakeType: m.mistakeType,
              attemptedAt: m._creationTime,
            }))
        : [];

    // 6. nextBest. Cross-subject scope. The current topic is
    //    excluded so the recommendation always points
    //    somewhere new. The math + selection is in
    //    `recommendNextBest` so this query and `getBySlug`
    //    never diverge.
    const nextBest =
      userId !== null
        ? await recommendNextBest(
            ctx,
            userId,
            { kind: "all_enrolled" },
            topic._id
          )
        : null;

    // 7. Canonical resources: formula sheet, vocabulary deck,
    //    canonical practice set, flashcard deck. All optional —
    //    will be null for topics seeded before these fields
    //    landed.
    const [formulaSheetRow, vocabularyDeckRow, canonicalPracticeRow, canonicalFlashcardRow] =
      await Promise.all([
        ctx.db
          .query("topicResources")
          .withIndex("by_topic_kind", (q) =>
            q.eq("topicId", topic._id).eq("kind", "formula_sheet")
          )
          .first(),
        ctx.db
          .query("topicResources")
          .withIndex("by_topic_kind", (q) =>
            q.eq("topicId", topic._id).eq("kind", "vocabulary_deck")
          )
          .first(),
        ctx.db
          .query("practiceSets")
          .withIndex("by_topic_source", (q) =>
            q.eq("topicId", topic._id).eq("source", "canonical_baseline")
          )
          .first(),
        ctx.db
          .query("flashcardDecks")
          .withIndex("by_topic_source", (q) =>
            q.eq("topicId", topic._id).eq("source", "canonical_baseline")
          )
          .first(),
      ]);

    // Count flashcard cards for the deck summary
    let flashcardCardCount = 0;
    if (canonicalFlashcardRow) {
      const cards = await ctx.db
        .query("flashcards")
        .withIndex("by_deck", (q) => q.eq("deckId", canonicalFlashcardRow._id))
        .collect();
      flashcardCardCount = cards.length;
    }

    // Count practice items for the set summary
    let practiceItemCount = 0;
    if (canonicalPracticeRow) {
      const items = await ctx.db
        .query("practiceItems")
        .withIndex("by_practice_set", (q) =>
          q.eq("practiceSetId", canonicalPracticeRow._id)
        )
        .collect();
      practiceItemCount = items.length;
    }

    return {
      subject: {
        id: subject._id,
        slug: subject.slug,
        title: subject.title,
        color: subject.color,
      },
      chapter: {
        slug: chapter.slug,
        title: chapter.title,
        order: chapter.order,
        id: chapter._id,
      },
      topic: {
        id: topic._id,
        slug: topic.slug,
        title: topic.title,
        objectives: topic.objectives,
        examRelevance: topic.examRelevance,
        difficulty: topic.difficulty,
        estimatedMinutes: topic.estimatedMinutes,
        gradeLevel: topic.gradeLevel,
        mastery: topicProgress ? topicProgress.mastery : 0,
        confidence: topicProgress ? topicProgress.confidence : 0,
        lastStudiedAt: topicProgress
          ? (topicProgress.lastStudied ?? null)
          : null,
        isStudied: topicProgress !== null,
        timeSpentSec: topicProgress ? topicProgress.timeSpentSec : 0,
      },
      lessonBlocks: {
        simple: simpleRows.map((b) => ({
          id: b._id,
          title: b.title,
          content: b.content,
          order: b.order,
          ...(b.workedExamples ? { workedExamples: b.workedExamples } : {}),
          ...(b.commonMistakes ? { commonMistakes: b.commonMistakes } : {}),
          ...(b.formulas ? { formulas: b.formulas } : {}),
          ...(b.vocabulary ? { vocabulary: b.vocabulary } : {}),
        })),
        standard: standardRows.map((b) => ({
          id: b._id,
          title: b.title,
          content: b.content,
          order: b.order,
          ...(b.workedExamples ? { workedExamples: b.workedExamples } : {}),
          ...(b.commonMistakes ? { commonMistakes: b.commonMistakes } : {}),
          ...(b.formulas ? { formulas: b.formulas } : {}),
          ...(b.vocabulary ? { vocabulary: b.vocabulary } : {}),
        })),
        rigorous: rigorousRows.map((b) => ({
          id: b._id,
          title: b.title,
          content: b.content,
          order: b.order,
          ...(b.workedExamples ? { workedExamples: b.workedExamples } : {}),
          ...(b.commonMistakes ? { commonMistakes: b.commonMistakes } : {}),
          ...(b.formulas ? { formulas: b.formulas } : {}),
          ...(b.vocabulary ? { vocabulary: b.vocabulary } : {}),
        })),
      },
      prerequisites,
      commonMistakes,
      nextBest,
      formulaSheet: formulaSheetRow
        ? {
            contents: formulaSheetRow.contents
              .filter((c): c is { name: string; expression: string; when: string } =>
                "expression" in c && "when" in c
              )
              .map((c) => ({ name: c.name, expression: c.expression, when: c.when })),
          }
        : null,
      vocabularyDeck: vocabularyDeckRow
        ? {
            contents: vocabularyDeckRow.contents
              .filter((c): c is { term: string; definition: string; gender?: "m" | "f" | "n"; example?: string } =>
                "term" in c && "definition" in c
              )
              .map((c) => ({
                term: c.term,
                definition: c.definition,
                ...(c.gender ? { gender: c.gender } : {}),
                ...(c.example ? { example: c.example } : {}),
              })),
          }
        : null,
      canonicalPractice: canonicalPracticeRow
        ? {
            id: canonicalPracticeRow._id,
            title: canonicalPracticeRow.title,
            itemCount: practiceItemCount,
          }
        : null,
      canonicalFlashcardDeck: canonicalFlashcardRow
        ? {
            id: canonicalFlashcardRow._id,
            title: canonicalFlashcardRow.title,
            cardCount: flashcardCardCount,
          }
        : null,
    };
  },
});

/**
 * migrateIconSlugs.
 *
 * One-shot repair for deployments that have subject rows
 * whose `icon` field still holds a legacy Phosphor
 * component name (`"MathOperations"`, `"Infinity"`, etc.).
 * Each row that matches a key in `LEGACY_ICON_TO_SLUG` is
 * patched to the matching slug. Idempotent: a second run
 * with no legacy rows returns `migrated: 0, alreadyValid: N`.
 *
 * Run once per deployment with:
 *   npx convex run api.subjects.migrateIconSlugs
 *
 * Returns a summary so the caller can confirm the migration
 * landed. Designed to be safe to run in a Convex admin
 * context (no Clerk auth, no per-user writes — the canonical
 * `subjects` table is public curriculum data).
 */
export const migrateIconSlugs = mutation({
  args: {},
  returns: v.object({
    migrated: v.number(),
    alreadyValid: v.number(),
    /**
     * Rows with no `icon` field at all. These will
     * render the `Books` fallback in `resolveSubjectIcon`
     * and need a separate fix-up (set a slug) — the
     * migration deliberately does NOT auto-assign
     * because we cannot know which subject glyph the
     * operator intended.
     */
    noIcon: v.number(),
  }),
  handler: async (ctx) => {
    const rows = await ctx.db.query("subjects").collect();
    let migrated = 0;
    let alreadyValid = 0;
    let noIcon = 0;
    for (const row of rows) {
      if (!row.icon) {
        noIcon += 1;
        continue;
      }
      const legacy = LEGACY_ICON_TO_SLUG[row.icon];
      if (legacy) {
        await ctx.db.patch(row._id, { icon: legacy });
        migrated += 1;
      } else {
        alreadyValid += 1;
      }
    }
    return { migrated, alreadyValid, noIcon };
  },
});

// Subject-scoped queries / mutations import `requireUser`
// (lazy-create) and `resolveIdentityAndUser` (read-only, no row
// required) from `convex/users.ts`. See users.ts for the auth
// design and the lazy-create behavior.
