import { mutation, query, type MutationCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";

import { requireUser, resolveUserReadOnly as resolveUser } from "./users";

/**
 * topics.ts.
 *
 * Decision D1 (locked in docs/USER-TOPIC-LESSON-PLAN.md §2):
 * student-created topics live in the canonical `topics`
 * table with the `source: "user"` discriminator + an
 * `ownerId` reference. There is no parallel `userTopics`
 * table. Per AGENTS.md: "exactly one name per concept
 * everywhere." `Topic` is `Topic`.
 *
 * Mutations call AI OUT OF BAND: the streaming route
 * handler at `/api/topics/lesson/stream` produces the
 * structured `LessonShape` (live UX) and then invokes
 * `createUserTopic` server-side with the validated
 * lesson. This matches the existing `/api/tutor/chat`
 * pattern and keeps mutations free of AI plumbing noise
 * (per AGENTS.md "business logic in Convex / lib",
 * strictly enforced).
 */

const depthArg = v.union(
  v.literal("simple"),
  v.literal("standard"),
  v.literal("rigorous")
);

const difficultyArg = v.union(
  v.literal("EASY"),
  v.literal("MEDIUM"),
  v.literal("HARD")
);

const lessonShapeArg = v.object({
  sections: v.array(
    v.object({
      heading: v.string(),
      body: v.string(),
    })
  ),
  glossary: v.array(
    v.object({
      term: v.string(),
      definition: v.string(),
    })
  ),
});

/**
 * Slug uniqueness helper.
 *
 * Generates a kebab-case slug from a title and, on
 * collision, appends `-2`, `-3`, … until it lands on a
 * free slug. Indexed look-up (`by_slug`) keeps this
 * O(collision-count) per call — well under the
 * student-pruned insertion rate.
 */
async function uniqueSlug(
  ctx: MutationCtx,
  base: string
): Promise<string> {
  const slug = base
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "topic";
  let candidate = slug;
  let n = 2;
  for (let i = 0; i < 50; i++) {
    const existing = await ctx.db
      .query("topics")
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .first();
    if (!existing) return candidate;
    candidate = `${slug}-${n}`;
    n += 1;
  }
  return `${slug}-${Date.now().toString(36)}`;
}

export const createUserTopic = mutation({
  args: {
    chapterId: v.id("chapters"),
    title: v.string(),
    brief: v.string(),
    difficulty: difficultyArg,
    depth: depthArg,
    objectives: v.optional(v.array(v.string())),
    gradeLevel: v.optional(v.string()),
    model: v.string(),
    lesson: lessonShapeArg,
  },
  returns: v.object({
    topicId: v.id("topics"),
    lessonId: v.id("topicLessons"),
    slug: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const chapter = await ctx.db.get(args.chapterId);
    if (!chapter) throw new ConvexError("chapter_not_found");

    const slug = await uniqueSlug(ctx, args.title);

    const topicId = await ctx.db.insert("topics", {
      chapterId: args.chapterId,
      title: args.title,
      slug,
      objectives: (args.objectives ?? []).map((o) => o.trim()).filter(Boolean),
      examRelevance: 1,
      difficulty: args.difficulty,
      estimatedMinutes: undefined,
      gradeLevel: args.gradeLevel,
      source: "user",
      ownerId: user._id,
    });

    const joinedContent = args.lesson.sections
      .map((s) => `${s.heading}\n\n${s.body}`)
      .join("\n\n");
    const wordCount = joinedContent.trim().split(/\s+/u).length;

    const lessonId = await ctx.db.insert("topicLessons", {
      topicId,
      depth: args.depth,
      content: joinedContent,
      sections: args.lesson.sections.map((s) => ({
        heading: s.heading,
        body: s.body,
      })),
      wordCount,
      glossary: args.lesson.glossary.map((g) => ({
        term: g.term,
        definition: g.definition,
      })),
      generatedBy: user._id,
      generatedAt: Date.now(),
      version: 1,
      model: args.model,
      schemaValid: true,
    });

    return { topicId, lessonId, slug };
  },
});

export const regenerateTopicLesson = mutation({
  args: {
    topicId: v.id("topics"),
    depth: depthArg,
    model: v.string(),
    lesson: lessonShapeArg,
  },
  returns: v.object({
    lessonId: v.id("topicLessons"),
    version: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const topic = await ctx.db.get(args.topicId);
    if (!topic) throw new ConvexError("topic_not_found");
    if (topic.source !== "user" || topic.ownerId !== user._id) {
      throw new ConvexError("forbidden");
    }

    const priorVersions = await ctx.db
      .query("topicLessons")
      .withIndex("by_topic", (q) => q.eq("topicId", args.topicId))
      .collect();
    const maxVersion = priorVersions.reduce(
      (acc, l) => Math.max(acc, l.version),
      0
    );

    const joinedContent = args.lesson.sections
      .map((s) => `${s.heading}\n\n${s.body}`)
      .join("\n\n");
    const wordCount = joinedContent.trim().split(/\s+/u).length;

    const lessonId = await ctx.db.insert("topicLessons", {
      topicId: args.topicId,
      depth: args.depth,
      content: joinedContent,
      sections: args.lesson.sections.map((s) => ({
        heading: s.heading,
        body: s.body,
      })),
      wordCount,
      glossary: args.lesson.glossary.map((g) => ({
        term: g.term,
        definition: g.definition,
      })),
      generatedBy: user._id,
      generatedAt: Date.now(),
      version: maxVersion + 1,
      model: args.model,
      schemaValid: true,
    });

    return { lessonId, version: maxVersion + 1 };
  },
});

export const getTopicLesson = query({
  args: {
    topicId: v.id("topics"),
    version: v.optional(v.number()),
  },
  returns: v.union(
    v.object({
      id: v.id("topicLessons"),
      topicId: v.id("topics"),
      depth: depthArg,
      content: v.string(),
      sections: v.array(
        v.object({ heading: v.string(), body: v.string() })
      ),
      glossary: v.array(
        v.object({ term: v.string(), definition: v.string() })
      ),
      wordCount: v.number(),
      version: v.number(),
      model: v.string(),
      schemaValid: v.boolean(),
      generatedAt: v.number(),
      generatedBy: v.id("users"),
    }),
    v.null()
  ),
  handler: async (ctx, { topicId, version }) => {
    const rows = await ctx.db
      .query("topicLessons")
      .withIndex("by_topic", (q) => q.eq("topicId", topicId))
      .collect();
    if (rows.length === 0) return null;
    rows.sort((a, b) => b.version - a.version);
    const pick =
      version === undefined
        ? rows[0]
        : rows.find((l) => l.version === version);
    if (!pick) return null;
    return {
      id: pick._id,
      topicId: pick.topicId,
      depth: pick.depth,
      content: pick.content,
      sections: pick.sections,
      glossary: pick.glossary,
      wordCount: pick.wordCount,
      version: pick.version,
      model: pick.model,
      schemaValid: pick.schemaValid,
      generatedAt: pick.generatedAt,
      generatedBy: pick.generatedBy,
    };
  },
});

export const listUserTopicsByOwner = query({
  args: { ownerId: v.id("users") },
  returns: v.array(
    v.object({
      id: v.id("topics"),
      slug: v.string(),
      title: v.string(),
      objectives: v.array(v.string()),
      difficulty: difficultyArg,
      gradeLevel: v.union(v.string(), v.null()),
      createdAt: v.number(),
      latestLesson: v.union(
        v.object({
          id: v.id("topicLessons"),
          version: v.number(),
          wordCount: v.number(),
          depth: depthArg,
          generatedAt: v.number(),
        }),
        v.null()
      ),
      latestRun: v.union(
        v.object({
          id: v.id("topicLessonPractice"),
          status: v.union(
            v.literal("in_progress"),
            v.literal("graded"),
            v.literal("abandoned")
          ),
          overallScore: v.union(v.number(), v.null()),
          grade: v.union(
            v.literal("1"),
            v.literal("2"),
            v.literal("3"),
            v.literal("4"),
            v.literal("5"),
            v.literal("6"),
            v.null()
          ),
          completedAt: v.union(v.number(), v.null()),
        }),
        v.null()
      ),
    })
  ),
  handler: async (ctx, { ownerId }) => {
    const topics = await ctx.db
      .query("topics")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();
    if (topics.length === 0) return [];
    topics.sort((a, b) => b._creationTime - a._creationTime);

    const out = [];
    for (const topic of topics) {
      const lessons = await ctx.db
        .query("topicLessons")
        .withIndex("by_topic", (q) => q.eq("topicId", topic._id))
        .collect();
      let latestLesson = null;
      if (lessons.length > 0) {
        lessons.sort((a, b) => b.version - a.version);
        const top = lessons[0];
        latestLesson = {
          id: top._id,
          version: top.version,
          wordCount: top.wordCount,
          depth: top.depth,
          generatedAt: top.generatedAt,
        };
      }

      const runs = await ctx.db
        .query("topicLessonPractice")
        .withIndex("by_user_topic", (q) =>
          q.eq("userId", ownerId).eq("topicId", topic._id)
        )
        .collect();
      runs.sort((a, b) => b.startedAt - a.startedAt);
      const latestRun = runs.length > 0 ? runs[0] : null;

      out.push({
        id: topic._id,
        slug: topic.slug,
        title: topic.title,
        objectives: topic.objectives,
        difficulty: topic.difficulty,
        gradeLevel: topic.gradeLevel ?? null,
        createdAt: topic._creationTime,
        latestLesson,
        latestRun: latestRun
          ? {
              id: latestRun._id,
              status: latestRun.status,
              overallScore: latestRun.overallScore ?? null,
              grade: latestRun.grade ?? null,
              completedAt: latestRun.completedAt ?? null,
            }
          : null,
      });
    }
    return out;
  },
});

export const getBySlugAndOwner = query({
  args: {
    slug: v.string(),
    ownerId: v.id("users"),
  },
  returns: v.union(
    v.object({
      id: v.id("topics"),
      slug: v.string(),
      title: v.string(),
      objectives: v.array(v.string()),
      examRelevance: v.number(),
      difficulty: difficultyArg,
      estimatedMinutes: v.union(v.number(), v.null()),
      gradeLevel: v.union(v.string(), v.null()),
      source: v.literal("user"),
      ownerId: v.id("users"),
      chapterId: v.id("chapters"),
      chapterSlug: v.string(),
      subjectSlug: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, { slug, ownerId }) => {
    const topic = await ctx.db
      .query("topics")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!topic) return null;
    if (topic.source !== "user" || topic.ownerId !== ownerId) return null;
    const chapter = await ctx.db.get(topic.chapterId);
    if (!chapter) return null;
    const subject = await ctx.db.get(chapter.subjectId);
    if (!subject) return null;
    return {
      id: topic._id,
      slug: topic.slug,
      title: topic.title,
      objectives: topic.objectives,
      examRelevance: topic.examRelevance,
      difficulty: topic.difficulty,
      estimatedMinutes: topic.estimatedMinutes ?? null,
      gradeLevel: topic.gradeLevel ?? null,
      source: "user" as const,
      ownerId: topic.ownerId!,
      chapterId: topic.chapterId,
      chapterSlug: chapter.slug,
      subjectSlug: subject.slug,
    };
  },
});

/**
 * getOwnedTopicBySlug.
 *
 * Server-side ownership-aware lookup. The lesson,
 * practice, and results pages `useQuery` this with the
 * page's `topicSlug` URL param; ownership is enforced
 * here against the Clerk identity so client components
 * never have to ask for `ownerId`.
 *
 * Returns `null` for canonical topics or topics owned
 * by a different user. Canonical resolution goes
 * through `api.subjects.getTopicBySlug` instead.
 */
export const getOwnedTopicBySlug = query({
  args: { slug: v.string() },
  returns: v.union(
    v.object({
      id: v.id("topics"),
      slug: v.string(),
      title: v.string(),
      objectives: v.array(v.string()),
      examRelevance: v.number(),
      difficulty: difficultyArg,
      estimatedMinutes: v.union(v.number(), v.null()),
      gradeLevel: v.union(v.string(), v.null()),
      source: v.literal("user"),
      ownerId: v.id("users"),
      chapterId: v.id("chapters"),
      chapterSlug: v.string(),
      chapterTitle: v.string(),
      subjectId: v.id("subjects"),
      subjectSlug: v.string(),
      subjectTitle: v.string(),
      latestLesson: v.union(
        v.object({
          id: v.id("topicLessons"),
          version: v.number(),
          wordCount: v.number(),
          depth: depthArg,
          generatedAt: v.number(),
        }),
        v.null()
      ),
    }),
    v.null()
  ),
  handler: async (ctx, { slug }) => {
    const user = await resolveUser(ctx);
    if (!user) return null;
    const topic = await ctx.db
      .query("topics")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!topic) return null;
    if (topic.source !== "user" || topic.ownerId !== user._id) return null;
    const chapter = await ctx.db.get(topic.chapterId);
    if (!chapter) return null;
    const subject = await ctx.db.get(chapter.subjectId);
    if (!subject) return null;

    // Look up the latest lesson version for this topic
    // so the practice page can start without an extra
    // round trip. Returns null if the user has not
    // generated a lesson yet.
    const lessons = await ctx.db
      .query("topicLessons")
      .withIndex("by_topic", (q) => q.eq("topicId", topic._id))
      .collect();
    let latestLesson: {
      id: Id<"topicLessons">;
      version: number;
      wordCount: number;
      depth: "simple" | "standard" | "rigorous";
      generatedAt: number;
    } | null = null;
    if (lessons.length > 0) {
      lessons.sort((a, b) => b.version - a.version);
      const top = lessons[0];
      latestLesson = {
        id: top._id,
        version: top.version,
        wordCount: top.wordCount,
        depth: top.depth,
        generatedAt: top.generatedAt,
      };
    }

    return {
      id: topic._id,
      slug: topic.slug,
      title: topic.title,
      objectives: topic.objectives,
      examRelevance: topic.examRelevance,
      difficulty: topic.difficulty,
      estimatedMinutes: topic.estimatedMinutes ?? null,
      gradeLevel: topic.gradeLevel ?? null,
      source: "user" as const,
      ownerId: topic.ownerId,
      chapterId: topic.chapterId,
      chapterSlug: chapter.slug,
      chapterTitle: chapter.title,
      subjectId: subject._id,
      subjectSlug: subject.slug,
      subjectTitle: subject.title,
      latestLesson,
    };
  },
});
