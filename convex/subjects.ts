import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id, Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/**
 * list.
 *
 * Returns every canonical subject in the curriculum, annotated
 * with the current user's enrollment state and a small curriculum
 * summary. Sorted: enrolled first (most recent enrollment first),
 * then unenrolled (alphabetical).
 *
 * Read-only. Safe to call from a server-rendered page; powers
 * the /subjects picker and the enrollment toggle.
 */
export const list = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("subjects"),
      slug: v.string(),
      title: v.string(),
      description: v.union(v.string(), v.null()),
      color: v.optional(v.string()),
      icon: v.optional(v.string()),
      enrolled: v.boolean(),
      enrolledAt: v.union(v.number(), v.null()),
      chapterCount: v.number(),
      topicCount: v.number(),
    })
  ),
  handler: async (ctx) => {
    const user = await resolveUser(ctx);
    if (!user) return [];

    const userId: Id<"users"> = user._id;

    // 1. All canonical subjects.
    const subjects = await ctx.db.query("subjects").collect();

    // 2. The user's enrollments as a Map for O(1) lookup.
    const enrollments = await ctx.db
      .query("userSubjects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const enrolledMap = new Map<Id<"subjects">, number>();
    for (const e of enrollments) {
      enrolledMap.set(e.subjectId, e.enrolledAt);
    }

    // 3. For each subject, count chapters and topics. We do this
    // sequentially with two indexed queries per subject because
    // Convex's `db.collect` is fine for a small canonical set
    // (a single-user app with ~6 subjects). The query is rare
    // enough that denormalization is not worth it.
    const out = [];
    for (const subj of subjects) {
      const chapters = await ctx.db
        .query("chapters")
        .withIndex("by_subject", (q) => q.eq("subjectId", subj._id))
        .collect();

      let topicCount = 0;
      for (const ch of chapters) {
        const tops = await ctx.db
          .query("topics")
          .withIndex("by_chapter", (q) => q.eq("chapterId", ch._id))
          .collect();
        topicCount += tops.length;
      }

      out.push({
        id: subj._id,
        slug: subj.slug,
        title: subj.title,
        description: subj.description ?? null,
        color: subj.color,
        icon: subj.icon,
        enrolled: enrolledMap.has(subj._id),
        enrolledAt: enrolledMap.get(subj._id) ?? null,
        chapterCount: chapters.length,
        topicCount,
      });
    }

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
    if (!subject) throw new Error("Subject not found");

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
 * subject, the user's enrollment state, and a list of chapters
 * (ordered by `order`) with per-chapter topic count, topics
 * studied, average mastery, and the most recent `lastStudied`
 * timestamp across the chapter's topics.
 *
 * Returns `null` if the subject does not exist or the user is
 * not authenticated. The page is responsible for rendering a
 * 404 in that case.
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
      }),
    }),
    v.null()
  ),
  handler: async (ctx, { slug }) => {
    const user = await resolveUser(ctx);
    if (!user) return null;
    const userId: Id<"users"> = user._id;

    // 1. Subject by slug.
    const subject = await ctx.db
      .query("subjects")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!subject) return null;

    // 2. Enrollment state.
    const enrollment = await ctx.db
      .query("userSubjects")
      .withIndex("by_user_subject", (q) =>
        q.eq("userId", userId).eq("subjectId", subject._id)
      )
      .first();

    // 3. Chapters in order.
    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_subject_order", (q) => q.eq("subjectId", subject._id))
      .collect();
    chapters.sort((a, b) => a.order - b.order);

    // 4. Collect every topic across the subject's chapters in a
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

    const progressRows = await Promise.all(
      allTopics.map((topic) =>
        ctx.db
          .query("userTopicProgress")
          .withIndex("by_user_topic", (q) =>
            q.eq("userId", userId).eq("topicId", topic._id)
          )
          .first()
      )
    );
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
    let masterySum = 0;
    let masteryCount = 0;
    let lastStudiedGlobal: number | null = null;

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
      masterySum += chMasterySum;
      masteryCount += chMasteryCount;
      if (chLastStudied !== null) {
        if (lastStudiedGlobal === null || chLastStudied > lastStudiedGlobal) {
          lastStudiedGlobal = chLastStudied;
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
        // weighting in `getOverview` so the cockpit and the
        // subject detail page tell the same story.
        mastery: chMasteryCount > 0 ? chMasterySum / chMasteryCount : 0,
        lastStudiedAt: chLastStudied,
      });
    }

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
        mastery: masteryCount > 0 ? masterySum / masteryCount : 0,
        lastStudiedAt: lastStudiedGlobal,
      },
    };
  },
});

/**
 * getChapterBySlug.
 *
 * Returns the chapter detail for a single chapter in a single
 * subject. Includes the subject (for breadcrumbs), the chapter,
 * and all topics in the chapter (sorted by `examRelevance`
 * desc, then title asc as tiebreaker) with per-topic mastery
 * and last-studied timestamp.
 *
 * Returns `null` if the subject or chapter does not exist, or
 * if the chapter does not belong to the given subject. The
 * page is responsible for rendering a not-found state in that
 * case.
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
    const user = await resolveUser(ctx);
    if (!user) return null;
    const userId: Id<"users"> = user._id;

    // 1. Subject by slug.
    const subject = await ctx.db
      .query("subjects")
      .withIndex("by_slug", (q) => q.eq("slug", subjectSlug))
      .first();
    if (!subject) return null;

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
      const progress = await ctx.db
        .query("userTopicProgress")
        .withIndex("by_user_topic", (q) =>
          q.eq("userId", userId).eq("topicId", topic._id)
        )
        .first();

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
      });
    }

    // Sort topics by exam relevance (most relevant first), with
    // title as a stable tiebreaker.
    topicsOut.sort((a, b) => {
      if (b.examRelevance !== a.examRelevance) {
        return b.examRelevance - a.examRelevance;
      }
      return a.title.localeCompare(b.title);
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
 * or `null` if the subject or topic does not exist. Used by
 * the /tutor page to resolve a `?subject=...&topic=...`
 * query pair in a single read instead of scanning chapters.
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
    const user = await resolveUser(ctx);
    if (!user) return null;
    const userId: Id<"users"> = user._id;

    const subject = await ctx.db
      .query("subjects")
      .withIndex("by_slug", (q) => q.eq("slug", subjectSlug))
      .first();
    if (!subject) return null;

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

    const progress = await ctx.db
      .query("userTopicProgress")
      .withIndex("by_user_topic", (q) =>
        q.eq("userId", userId).eq("topicId", topic._id)
      )
      .first();
    const isStudied = progress !== null;
    return {
      id: topic._id,
      slug: topic.slug,
      title: topic.title,
      objectives: topic.objectives,
      examRelevance: topic.examRelevance,
      difficulty: topic.difficulty,
      estimatedMinutes: topic.estimatedMinutes,
      mastery: isStudied ? progress!.mastery : 0,
      lastStudiedAt: isStudied ? (progress!.lastStudied ?? null) : null,
      isStudied,
    };
  },
});

/**
 * resolveUser.
 *
 * Resolves the current Clerk identity to a Convex user row, or
 * null if no Clerk session exists. Used by `list`, which can be
 * safely called without auth (it just returns an empty array).
 */
async function resolveUser(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
}

/**
 * requireUser.
 *
 * Resolves the current Clerk identity to a Convex user row, or
 * throws. Used by every authenticated mutation to keep the auth
 * pattern in one place.
 */
async function requireUser(ctx: MutationCtx): Promise<Doc<"users">> {
  const user = await resolveUser(ctx);
  if (!user) throw new Error("Unauthenticated");
  return user;
}
