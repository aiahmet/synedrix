import { query, mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  resolveIdentityAndUser,
  requireUser,
} from "./users";
import {
  recommendNextBest,
} from "./_lib/recommendNextBest";

const lessonBlockContentShape = {
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
        gender: v.optional(
          v.union(v.literal("m"), v.literal("f"), v.literal("n"))
        ),
      })
    )
  ),
};

const lessonBlockReturn = v.object({
  id: v.id("lessonBlocks"),
  title: v.string(),
  content: v.string(),
  order: v.number(),
  workedExamples: lessonBlockContentShape.workedExamples,
  commonMistakes: lessonBlockContentShape.commonMistakes,
  formulas: lessonBlockContentShape.formulas,
  vocabulary: lessonBlockContentShape.vocabulary,
});

const LEGACY_ICON_TO_SLUG: Readonly<Record<string, string>> = {
  MathOperations: "math",
  Infinity: "physics",
  Flask: "chemistry",
  Quotes: "french",
  Notebook: "german",
  Brain: "english",
};

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

type AggregateInputs = {
  readonly chaptersForSubject: ReadonlyArray<Doc<"chapters">>;
  readonly topicsByChapterId: ReadonlyMap<Id<"chapters">, Doc<"topics">[]>;
  readonly progressByTopicId: ReadonlyMap<
    Id<"topics">,
    Doc<"userTopicProgress">
  >;
};

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

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("subjects"),
      slug: v.string(),
      title: v.string(),
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

    const subjects = await ctx.db.query("subjects").collect();

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

    const [allChapters, allUserProgress] = await Promise.all([
      ctx.db.query("chapters").collect(),
      resolved.user
        ? ctx.db
            .query("userTopicProgress")
            .withIndex("by_user", (q) => q.eq("userId", resolved.user!._id))
            .collect()
        : Promise.resolve([] as Doc<"userTopicProgress">[]),
    ]);

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

export const enroll = mutation({
  args: {
    subjectId: v.id("subjects"),
  },
  returns: v.id("userSubjects"),
  handler: async (ctx, { subjectId }): Promise<Id<"userSubjects">> => {
    const user = await requireUser(ctx);
    const userId: Id<"users"> = user._id;

    const existing = await ctx.db
      .query("userSubjects")
      .withIndex("by_user_subject", (q) =>
        q.eq("userId", userId).eq("subjectId", subjectId)
      )
      .first();
    if (existing) return existing._id;

    const subject = await ctx.db.get(subjectId);
    if (!subject) throw new ConvexError("subject_not_found");

    return await ctx.db.insert("userSubjects", {
      userId,
      subjectId,
      enrolledAt: Date.now(),
    });
  },
});

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
        estimatedMinutesTotal: v.number(),
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
    }),
    v.null()
  ),
  handler: async (ctx, { slug }) => {
    const subject = await ctx.db
      .query("subjects")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!subject) return null;

    const resolved = await resolveIdentityAndUser(ctx).catch(() => null);
    const userId: Id<"users"> | null = resolved?.user?._id ?? null;

    const enrollment =
      userId !== null
        ? await ctx.db
            .query("userSubjects")
            .withIndex("by_user_subject", (q) =>
              q.eq("userId", userId).eq("subjectId", subject._id)
            )
            .first()
        : null;

    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_subject_order", (q) => q.eq("subjectId", subject._id))
      .collect();
    chapters.sort((a, b) => a.order - b.order);

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

    const topicsByChapter = new Map<Id<"chapters">, Doc<"topics">[]>();
    for (const t of allTopics) {
      const arr = topicsByChapter.get(t.chapterId) ?? [];
      arr.push(t);
      topicsByChapter.set(t.chapterId, arr);
    }

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
      const topics = topicsByChapter.get(ch._id) ?? [];

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
        mastery: chMasteryCount > 0 ? chMasterySum / chMasteryCount : 0,
        lastStudiedAt: chLastStudied,
      });
    }

    const aggregate = computeSubjectAggregate({
      chaptersForSubject: chapters,
      topicsByChapterId: topicsByChapter,
      progressByTopicId: progressByTopic,
    });

    const nextBest =
      userId !== null
        ? await recommendNextBest(ctx, {
            userId,
            scope: { kind: "subject", subjectId: subject._id },
          })
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
    }),
    v.null()
  ),
  handler: async (ctx, { subjectSlug, chapterSlug }) => {
    const subject = await ctx.db
      .query("subjects")
      .withIndex("by_slug", (q) => q.eq("slug", subjectSlug))
      .first();
    if (!subject) return null;

    const resolved = await resolveIdentityAndUser(ctx).catch(() => null);
    const userId: Id<"users"> | null = resolved?.user?._id ?? null;

    const chapter = await ctx.db
      .query("chapters")
      .withIndex("by_subject_slug", (q) =>
        q.eq("subjectId", subject._id).eq("slug", chapterSlug)
      )
      .first();
    if (!chapter) return null;

    const topics = await ctx.db
      .query("topics")
      .withIndex("by_chapter", (q) => q.eq("chapterId", chapter._id))
      .collect();

    const progressRows =
      userId !== null
        ? await Promise.all(
            topics.map((topic) =>
              ctx.db
                .query("userTopicProgress")
                .withIndex("by_user_topic", (q) =>
                  q.eq("userId", userId).eq("topicId", topic._id)
                )
                .first()
            )
          )
        : new Array(topics.length).fill(null);

    const progressByTopic = new Map<Id<"topics">, NonNullable<typeof progressRows[number]>>();
    topics.forEach((topic, i) => {
      const p = progressRows[i];
      if (p) progressByTopic.set(topic._id, p);
    });

    const topicsOut = [];
    let topicsStudied = 0;
    let masterySum = 0;
    let masteryCount = 0;
    let lastStudiedGlobal: number | null = null;
    let estimatedMinutesTotal = 0;

    for (const topic of topics) {
      const progress = progressByTopic.get(topic._id) ?? null;

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
        source: (topic.source ?? "canonical") as "canonical" | "user",
        ownerId: topic.ownerId ?? null,
      });
    }

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
      return 0;
    });

    const nextBest =
      userId !== null
        ? await recommendNextBest(ctx, {
            userId,
            scope: { kind: "subject", subjectId: subject._id },
          })
        : null;

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
      nextBest,
    };
  },
});

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
    const subject = await ctx.db
      .query("subjects")
      .withIndex("by_slug", (q) => q.eq("slug", subjectSlug))
      .first();
    if (!subject) return null;

    const resolved = await resolveIdentityAndUser(ctx).catch(() => null);
    const userId: Id<"users"> | null = resolved?.user?._id ?? null;

    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_subject_order", (q) => q.eq("subjectId", subject._id))
      .collect();
    const chapterIds = new Set(chapters.map((c) => c._id));

    const topic = await ctx.db
      .query("topics")
      .withIndex("by_slug", (q) => q.eq("slug", topicSlug))
      .first();
    if (!topic) return null;
    if (!chapterIds.has(topic.chapterId)) return null;

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
        simple: v.array(lessonBlockReturn),
        standard: v.array(lessonBlockReturn),
        rigorous: v.array(lessonBlockReturn),
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
          unlocked: v.boolean(),
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
            source: v.union(v.literal("canonical"), v.literal("user")),
            ownerId: v.union(v.id("users"), v.null()),
          }),
          reason: v.string(),
        }),
        v.null()
      ),
      formulaSheet: v.union(
        v.object({
          contents: v.array(
            v.object({
              name: v.string(),
              expression: v.string(),
              when: v.string(),
            })
          ),
        }),
        v.null()
      ),
      vocabularyDeck: v.union(
        v.object({
          contents: v.array(
            v.object({
              term: v.string(),
              definition: v.string(),
              gender: v.optional(
                v.union(v.literal("m"), v.literal("f"), v.literal("n"))
              ),
              example: v.optional(v.string()),
            })
          ),
        }),
        v.null()
      ),
      canonicalPractice: v.union(
        v.object({
          id: v.id("practiceSets"),
          title: v.string(),
          itemCount: v.number(),
        }),
        v.null()
      ),
      canonicalFlashcardDeck: v.union(
        v.object({
          id: v.id("flashcardDecks"),
          title: v.string(),
          cardCount: v.number(),
        }),
        v.null()
      ),
    }),
    v.null()
  ),
  handler: async (ctx, { subjectSlug, chapterSlug, topicSlug }) => {
    const subject = await ctx.db
      .query("subjects")
      .withIndex("by_slug", (q) => q.eq("slug", subjectSlug))
      .first();
    if (!subject) return null;

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

    const topicProgress =
      userId !== null
        ? await ctx.db
            .query("userTopicProgress")
            .withIndex("by_user_topic", (q) =>
              q.eq("userId", userId).eq("topicId", topic._id)
            )
            .first()
        : null;

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

    const prereqEdges = await ctx.db
      .query("topicPrerequisites")
      .withIndex("by_topic", (q) => q.eq("topicId", topic._id))
      .collect();

    type DocTopic = NonNullable<Awaited<ReturnType<typeof ctx.db.get<"topics">>>>;
    type DocChapter = NonNullable<Awaited<ReturnType<typeof ctx.db.get<"chapters">>>>;
    type DocSubject = NonNullable<Awaited<ReturnType<typeof ctx.db.get<"subjects">>>>;

    const prereqTopicsResolved: Array<DocTopic | null> = prereqEdges.length > 0
      ? await Promise.all(
          prereqEdges.map((e) => ctx.db.get(e.prerequisiteTopicId) as Promise<DocTopic | null>)
        )
      : [];

    const prereqChaptersResolved: Array<DocChapter | null> = prereqEdges.length > 0
      ? await Promise.all(
          prereqTopicsResolved.map((t) =>
            t === null ? Promise.resolve(null) : (ctx.db.get(t.chapterId) as Promise<DocChapter | null>)
          )
        )
      : [];

    const prereqSubjectsResolved: Array<DocSubject | null> = prereqEdges.length > 0
      ? await Promise.all(
          prereqChaptersResolved.map((c) =>
            c === null ? Promise.resolve(null) : (ctx.db.get(c.subjectId) as Promise<DocSubject | null>)
          )
        )
      : [];

    const prereqProgressResolved: Array<Awaited<ReturnType<typeof ctx.db.get<"userTopicProgress">>> | null> =
      userId !== null && prereqEdges.length > 0
        ? await Promise.all(
            prereqEdges.map((e) =>
              ctx.db
                .query("userTopicProgress")
                .withIndex("by_user_topic", (q) =>
                  q.eq("userId", userId).eq("topicId", e.prerequisiteTopicId)
                )
                .first()
            )
          )
        : new Array(prereqEdges.length).fill(null);

    const prerequisites = prereqEdges
      .map((edge, idx) => {
        const pt = prereqTopicsResolved[idx];
        if (pt === null) return null;
        const chapterRow = prereqChaptersResolved[idx];
        const subjectRow = prereqSubjectsResolved[idx];
        const progressRow = prereqProgressResolved[idx];
        const mastery = progressRow ? progressRow.mastery : 0;
        return {
          id: pt._id,
          slug: pt.slug,
          title: pt.title,
          chapterSlug: chapterRow?.slug ?? "",
          subjectSlug: subjectRow?.slug ?? "",
          mastery,
          isStudied: progressRow !== null,
          unlocked: mastery >= 0.5,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

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

    const nextBest =
      userId !== null
        ? await recommendNextBest(ctx, {
            userId,
            scope: { kind: "all_enrolled" },
            excludeTopicId: topic._id,
          })
        : null;

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

    let flashcardCardCount = 0;
    if (canonicalFlashcardRow) {
      const cards = await ctx.db
        .query("flashcards")
        .withIndex("by_deck", (q) => q.eq("deckId", canonicalFlashcardRow._id))
        .collect();
      flashcardCardCount = cards.length;
    }

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

export const migrateIconSlugs = mutation({
  args: {},
  returns: v.object({
    migrated: v.number(),
    alreadyValid: v.number(),
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

export const getHub = query({
  args: { slug: v.string() },
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
          isCurrent: v.boolean(),
          isCompleted: v.boolean(),
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
              gradeLevel: v.optional(v.string()),
              mastery: v.number(),
              confidence: v.number(),
              lastStudiedAt: v.union(v.number(), v.null()),
              isStudied: v.boolean(),
              source: v.union(v.literal("canonical"), v.literal("user")),
              ownerId: v.union(v.id("users"), v.null()),
              prerequisites: v.array(
                v.object({
                  id: v.id("topics"),
                  slug: v.string(),
                  title: v.string(),
                  chapterSlug: v.string(),
                  subjectSlug: v.string(),
                  mastery: v.number(),
                  isStudied: v.boolean(),
                  unlocked: v.boolean(),
                })
              ),
              isUnlocked: v.boolean(),
            })
          ),
        })
      ),
      aggregate: v.object({
        topicCount: v.number(),
        topicsStudied: v.number(),
        mastery: v.number(),
        lastStudiedAt: v.union(v.number(), v.null()),
        estimatedMinutesTotal: v.number(),
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
      foundationsToFix: v.array(
        v.object({
          topic: v.object({
            id: v.id("topics"),
            slug: v.string(),
            title: v.string(),
            chapterSlug: v.string(),
            chapterTitle: v.string(),
            mastery: v.number(),
          }),
          weakPrerequisites: v.array(
            v.object({
              id: v.id("topics"),
              slug: v.string(),
              title: v.string(),
              chapterSlug: v.string(),
              subjectSlug: v.string(),
              mastery: v.number(),
              isStudied: v.boolean(),
            })
          ),
        })
      ),
      recentMistakes: v.array(
        v.object({
          id: v.id("mistakeEntries"),
          question: v.string(),
          userAnswer: v.string(),
          correctAnswer: v.string(),
          mistakeType: v.string(),
          attemptedAt: v.number(),
          topicSlug: v.string(),
          topicTitle: v.string(),
          chapterSlug: v.string(),
        })
      ),
      savedNotes: v.array(
        v.object({
          id: v.id("notes"),
          title: v.string(),
          content: v.string(),
          pinned: v.optional(v.boolean()),
          topicId: v.union(v.id("topics"), v.null()),
          topicSlug: v.union(v.string(), v.null()),
          topicTitle: v.union(v.string(), v.null()),
          chapterSlug: v.union(v.string(), v.null()),
        })
      ),
      practiceRuns: v.array(
        v.object({
          id: v.id("topicLessonPractice"),
          topicId: v.id("topics"),
          topicSlug: v.string(),
          topicTitle: v.string(),
          chapterSlug: v.string(),
          status: v.union(
            v.literal("in_progress"),
            v.literal("graded"),
            v.literal("abandoned")
          ),
          itemCount: v.number(),
          answeredCount: v.number(),
          overallScore: v.union(v.number(), v.null()),
          topicConfidence: v.union(v.number(), v.null()),
          grade: v.union(
            v.literal("1"),
            v.literal("2"),
            v.literal("3"),
            v.literal("4"),
            v.literal("5"),
            v.literal("6"),
            v.null()
          ),
          startedAt: v.number(),
          completedAt: v.union(v.number(), v.null()),
          mode: v.union(
            v.literal("sequential"),
            v.literal("timed"),
            v.literal("retry_wrong"),
            v.literal("exam_simulation"),
            v.null()
          ),
          skills: v.array(v.string()),
        })
      ),
    }),
    v.null()
  ),
  handler: async (ctx, { slug }) => {
    const subject = await ctx.db
      .query("subjects")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!subject) return null;

    const resolved = await resolveIdentityAndUser(ctx).catch(() => null);
    const userId: Id<"users"> | null = resolved?.user?._id ?? null;

    const enrollment =
      userId !== null
        ? await ctx.db
            .query("userSubjects")
            .withIndex("by_user_subject", (q) =>
              q.eq("userId", userId).eq("subjectId", subject._id)
            )
            .first()
        : null;

    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_subject_order", (q) => q.eq("subjectId", subject._id))
      .collect();
    chapters.sort((a, b) => a.order - b.order);

    const allTopicsByChapter = await Promise.all(
      chapters.map((ch) =>
        ctx.db
          .query("topics")
          .withIndex("by_chapter", (q) => q.eq("chapterId", ch._id))
          .collect()
      )
    );

    const allTopics = allTopicsByChapter.flat();
    const topicIds = allTopics.map((t) => t._id);

    const [
      progressRows,
      allPrerequisiteEdges,
      allUserMistakes,
      allUserNotes,
      allPracticeRuns,
    ] = await Promise.all([
      userId !== null
        ? Promise.all(
            allTopics.map((topic) =>
              ctx.db
                .query("userTopicProgress")
                .withIndex("by_user_topic", (q) =>
                  q.eq("userId", userId).eq("topicId", topic._id)
                )
                .first()
            )
          )
        : Promise.resolve(new Array(allTopics.length).fill(null)),
      Promise.all(
        topicIds.map((id) =>
          ctx.db
            .query("topicPrerequisites")
            .withIndex("by_topic", (q) => q.eq("topicId", id))
            .collect()
        )
      ),
      userId !== null
        ? ctx.db
            .query("mistakeEntries")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .take(200)
        : Promise.resolve([]),
      userId !== null
        ? ctx.db
            .query("notes")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .take(100)
        : Promise.resolve([]),
      userId !== null
        ? ctx.db
            .query("topicLessonPractice")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .take(100)
        : Promise.resolve([]),
    ]);

    const progressByTopic = new Map<
      Id<"topics">,
      NonNullable<typeof progressRows[number]>
    >();
    allTopics.forEach((topic, i) => {
      const p = progressRows[i];
      if (p) progressByTopic.set(topic._id, p);
    });

    const prereqEdgeMap = new Map<Id<"topics">, Doc<"topicPrerequisites">[]>();
    topicIds.forEach((id, i) => {
      prereqEdgeMap.set(id, allPrerequisiteEdges[i]);
    });

    const allPrereqIds = Array.from(
      new Set(allPrerequisiteEdges.flat().map((e) => e.prerequisiteTopicId))
    );
    const prereqTopics = new Map<
      Id<"topics">,
      NonNullable<Awaited<ReturnType<typeof ctx.db.get<"topics">>>>
    >();
    if (allPrereqIds.length > 0) {
      const resolved = await Promise.all(allPrereqIds.map((id) => ctx.db.get(id)));
      for (const t of resolved) {
        if (t) prereqTopics.set(t._id, t);
      }
    }

    const prereqChapterCache = new Map<
      Id<"chapters">,
      NonNullable<Awaited<ReturnType<typeof ctx.db.get<"chapters">>>>
    >();
    const allPrereqChapterIds = Array.from(
      new Set(Array.from(prereqTopics.values()).map((t) => t.chapterId))
    );
    if (allPrereqChapterIds.length > 0) {
      const resolved = await Promise.all(
        allPrereqChapterIds.map((id) => ctx.db.get(id))
      );
      for (const c of resolved) {
        if (c) prereqChapterCache.set(c._id, c);
      }
    }

    const prereqSubjectCache = new Map<
      Id<"subjects">,
      NonNullable<Awaited<ReturnType<typeof ctx.db.get<"subjects">>>>
    >();
    const allPrereqSubjectIds = Array.from(
      new Set(
        Array.from(prereqChapterCache.values()).map((c) => c.subjectId)
      )
    );
    if (allPrereqSubjectIds.length > 0) {
      const resolved = await Promise.all(
        allPrereqSubjectIds.map((id) => ctx.db.get(id))
      );
      for (const s of resolved) {
        if (s) prereqSubjectCache.set(s._id, s);
      }
    }

    const prereqProgressCache = new Map<
      Id<"topics">,
      { mastery: number; isStudied: boolean }
    >();
    if (userId !== null && allPrereqIds.length > 0) {
      const rows = await Promise.all(
        allPrereqIds.map((id) =>
          ctx.db
            .query("userTopicProgress")
            .withIndex("by_user_topic", (q) =>
              q.eq("userId", userId).eq("topicId", id)
            )
            .first()
        )
      );
      allPrereqIds.forEach((id, i) => {
        const row = rows[i];
        prereqProgressCache.set(id, {
          mastery: row ? row.mastery : 0,
          isStudied: row !== null,
        });
      });
    }

    const topicIdSet = new Set(topicIds);

    // Compute "you are here" — the chapter with the most
    // recent progress, falling back to the first chapter
    // with any progress, then the first chapter.
    let currentChapterId: Id<"chapters"> | null = null;
    let bestLastStudied: number | null = null;
    let firstChapterWithProgressId: Id<"chapters"> | null = null;
    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i];
      const chTopics = allTopicsByChapter[i];
      for (const t of chTopics) {
        const p = progressByTopic.get(t._id);
        if (p && typeof p.lastStudied === "number") {
          if (bestLastStudied === null || p.lastStudied > bestLastStudied) {
            bestLastStudied = p.lastStudied;
            currentChapterId = ch._id;
          }
        }
        if (firstChapterWithProgressId === null && p) {
          firstChapterWithProgressId = ch._id;
        }
      }
    }
    if (currentChapterId === null) {
      currentChapterId =
        firstChapterWithProgressId ?? chapters[0]?._id ?? null;
    }

    // Build chapter output with enriched topics.
    let totalTopicCount = 0;
    let totalTopicsStudied = 0;
    let estimatedMinutesTotal = 0;

    const chapterOut = chapters.map((ch, chIdx) => {
      const chTopics = allTopicsByChapter[chIdx];

      let topicsStudied = 0;
      let chMasterySum = 0;
      let chMasteryCount = 0;
      let chLastStudied: number | null = null;

      const topicOut = chTopics.map((topic) => {
        const progress = progressByTopic.get(topic._id) ?? null;
        const isStudied = progress !== null;

        if (isStudied) {
          topicsStudied += 1;
          chMasterySum += progress.mastery;
          chMasteryCount += 1;
          if (
            typeof progress.lastStudied === "number" &&
            (chLastStudied === null || progress.lastStudied > chLastStudied)
          ) {
            chLastStudied = progress.lastStudied;
          }
        }

        const edges = prereqEdgeMap.get(topic._id) ?? [];
        const prereqOut = edges
          .map((edge) => {
            const pt = prereqTopics.get(edge.prerequisiteTopicId);
            if (!pt) return null;
            const pch = prereqChapterCache.get(pt.chapterId);
            if (!pch) return null;
            const ps = prereqSubjectCache.get(pch.subjectId);
            const pprog = prereqProgressCache.get(pt._id) ?? {
              mastery: 0,
              isStudied: false,
            };
            return {
              id: pt._id,
              slug: pt.slug,
              title: pt.title,
              chapterSlug: pch.slug,
              subjectSlug: ps?.slug ?? "",
              mastery: pprog.mastery,
              isStudied: pprog.isStudied,
              unlocked: pprog.mastery >= 0.5,
            };
          })
          .filter((p): p is NonNullable<typeof p> => p !== null);

        const isUnlocked =
          prereqOut.length === 0 || prereqOut.every((p) => p.unlocked);

        return {
          id: topic._id,
          slug: topic.slug,
          title: topic.title,
          objectives: topic.objectives,
          examRelevance: topic.examRelevance,
          difficulty: topic.difficulty,
          estimatedMinutes: topic.estimatedMinutes,
          gradeLevel: topic.gradeLevel,
          mastery: isStudied ? progress.mastery : 0,
          confidence: isStudied ? progress.confidence : 0,
          lastStudiedAt: isStudied
            ? (progress.lastStudied ?? null)
            : null,
          isStudied,
          source: (topic.source ?? "canonical") as "canonical" | "user",
          ownerId: topic.ownerId ?? null,
          prerequisites: prereqOut,
          isUnlocked,
        };
      });

      totalTopicCount += chTopics.length;
      totalTopicsStudied += topicsStudied;
      for (const t of chTopics) {
        if (t.estimatedMinutes !== undefined) {
          estimatedMinutesTotal += t.estimatedMinutes;
        }
      }

      const isCompleted =
        chTopics.length > 0 &&
        topicsStudied === chTopics.length &&
        (chMasteryCount > 0 ? chMasterySum / chMasteryCount : 0) >= 0.85;

      return {
        id: ch._id,
        slug: ch.slug,
        title: ch.title,
        description: ch.description ?? null,
        order: ch.order,
        topicCount: chTopics.length,
        topicsStudied,
        mastery:
          chMasteryCount > 0 ? chMasterySum / chMasteryCount : 0,
        lastStudiedAt: chLastStudied,
        isCurrent: ch._id === currentChapterId,
        isCompleted,
        topics: topicOut,
      };
    });

    // Aggregate.
    const aggregate = computeSubjectAggregate({
      chaptersForSubject: chapters,
      topicsByChapterId: new Map(
        allTopicsByChapter.map((topics, i) => [chapters[i]._id, topics])
      ),
      progressByTopicId: progressByTopic,
    });

    // Next best.
    const nextBest =
      userId !== null
        ? await recommendNextBest(ctx, {
            userId,
            scope: { kind: "subject", subjectId: subject._id },
          })
        : null;

    // Foundations to fix: for each studied topic, find
    // prerequisites with mastery < 0.5. Return up to 5
    // topics that have the most weak prerequisites.
    const FOUNDATIONS_CAP = 5;
    const WEAK_THRESHOLD = 0.5;
    const foundationsAcc = new Map<
      Id<"topics">,
      {
        topic: Doc<"topics">;
        chapter: Doc<"chapters">;
        mastery: number;
        weakPrereqs: Array<{
          id: Id<"topics">;
          slug: string;
          title: string;
          chapterSlug: string;
          subjectSlug: string;
          mastery: number;
          isStudied: boolean;
        }>;
      }
    >();

    for (let ci = 0; ci < chapters.length; ci++) {
      const ch = chapters[ci];
      const chTopics = allTopicsByChapter[ci];
      for (const topic of chTopics) {
        const progress = progressByTopic.get(topic._id);
        if (!progress || progress.mastery >= 0.85) continue;

        const edges = prereqEdgeMap.get(topic._id) ?? [];
        const weakPrereqs = edges
          .map((edge) => {
            const pp = prereqProgressCache.get(edge.prerequisiteTopicId) ?? {
              mastery: 0,
              isStudied: false,
            };
            if (pp.mastery >= WEAK_THRESHOLD) return null;
            const pt = prereqTopics.get(edge.prerequisiteTopicId);
            if (!pt) return null;
            const pch = prereqChapterCache.get(pt.chapterId);
            if (!pch) return null;
            const ps = prereqSubjectCache.get(pch.subjectId);
            return {
              id: pt._id,
              slug: pt.slug,
              title: pt.title,
              chapterSlug: pch.slug,
              subjectSlug: ps?.slug ?? "",
              mastery: pp.mastery,
              isStudied: pp.isStudied,
            };
          })
          .filter((p): p is NonNullable<typeof p> => p !== null);

        if (weakPrereqs.length > 0) {
          foundationsAcc.set(topic._id, {
            topic,
            chapter: ch,
            mastery: progress.mastery,
            weakPrereqs,
          });
        }
      }
    }

    const foundationsToFix = Array.from(foundationsAcc.values())
      .sort((a, b) => b.weakPrereqs.length - a.weakPrereqs.length)
      .slice(0, FOUNDATIONS_CAP)
      .map((entry) => ({
        topic: {
          id: entry.topic._id,
          slug: entry.topic.slug,
          title: entry.topic.title,
          chapterSlug: entry.chapter.slug,
          chapterTitle: entry.chapter.title,
          mastery: entry.mastery,
        },
        weakPrerequisites: entry.weakPrereqs,
      }));

    // Recent mistakes: filter to this subject's topics,
    // sorted by most recent first, capped at 15.
    const MISTAKES_CAP = 15;
    const scopedMistakes = allUserMistakes
      .filter(
        (m) =>
          m.topicId !== undefined && topicIdSet.has(m.topicId)
      )
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, MISTAKES_CAP);

    const topicCache = new Map<Id<"topics">, Doc<"topics">>();
    for (const t of allTopics) topicCache.set(t._id, t);
    const chapterCache = new Map<Id<"chapters">, Doc<"chapters">>();
    for (const ch of chapters) chapterCache.set(ch._id, ch);

    const recentMistakes = scopedMistakes.map((m) => {
      const mtopic =
        m.topicId !== undefined ? topicCache.get(m.topicId) : undefined;
      const mchapter =
        mtopic ? chapterCache.get(mtopic.chapterId) : undefined;
      return {
        id: m._id,
        question: m.question,
        userAnswer: m.userAnswer,
        correctAnswer: m.correctAnswer,
        mistakeType: m.mistakeType,
        attemptedAt: m._creationTime,
        topicSlug: mtopic?.slug ?? "",
        topicTitle: mtopic?.title ?? "",
        chapterSlug: mchapter?.slug ?? "",
      };
    });

    // Saved notes: filter to this subject's topics.
    const NOTES_CAP = 20;
    const scopedNotes = allUserNotes
      .filter((n) => n.topicId !== undefined && topicIdSet.has(n.topicId))
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, NOTES_CAP);

    const savedNotes = scopedNotes.map((n) => {
      const ntopic =
        n.topicId !== undefined ? topicCache.get(n.topicId) : undefined;
      const nchapter =
        ntopic ? chapterCache.get(ntopic.chapterId) : undefined;
      return {
        id: n._id,
        title: n.title,
        content: n.content,
        pinned: n.pinned,
        topicId: n.topicId ?? null,
        topicSlug: ntopic?.slug ?? null,
        topicTitle: ntopic?.title ?? null,
        chapterSlug: nchapter?.slug ?? null,
      };
    });

    // Practice runs: filter to this subject's topics.
    const RUNS_CAP = 10;
    const scopedRuns = allPracticeRuns
      .filter((r) => topicIdSet.has(r.topicId))
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, RUNS_CAP);

    const runSkillCache = new Map<Id<"topicLessonPractice">, string[]>();
    if (scopedRuns.length > 0) {
      const practiceSetIds = Array.from(
        new Set(scopedRuns.map((r) => r.practiceSetId))
      );
      const allItems = (
        await Promise.all(
          practiceSetIds.map((psId) =>
            ctx.db
              .query("practiceItems")
              .withIndex("by_practice_set", (q) =>
                q.eq("practiceSetId", psId)
              )
              .take(100)
          )
        )
      ).flat();
      const itemsBySet = new Map<
        Id<"practiceSets">,
        { skills: string[] }[]
      >();
      for (const item of allItems) {
        const arr = itemsBySet.get(item.practiceSetId) ?? [];
        arr.push({ skills: item.skills });
        itemsBySet.set(item.practiceSetId, arr);
      }
      for (const r of scopedRuns) {
        const items = itemsBySet.get(r.practiceSetId) ?? [];
        const skills = Array.from(
          new Set(items.flatMap((i) => i.skills))
        ).slice(0, 8);
        runSkillCache.set(r._id, skills);
      }
    }

    const practiceRuns = scopedRuns.map((r) => {
      const rtopic = topicCache.get(r.topicId);
      const rchapter = rtopic
        ? chapterCache.get(rtopic.chapterId)
        : undefined;
      return {
        id: r._id,
        topicId: r.topicId,
        topicSlug: rtopic?.slug ?? "",
        topicTitle: rtopic?.title ?? "",
        chapterSlug: rchapter?.slug ?? "",
        status: r.status,
        itemCount: r.itemCount,
        answeredCount: r.answeredCount,
        overallScore: r.overallScore ?? null,
        topicConfidence:
          rtopic !== undefined
            ? (progressByTopic.get(rtopic._id)?.confidence ?? null)
            : null,
        grade: r.grade ?? null,
        startedAt: r.startedAt,
        completedAt: r.completedAt ?? null,
        mode: r.mode ?? null,
        skills: runSkillCache.get(r._id) ?? [],
      };
    });

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
      foundationsToFix,
      recentMistakes,
      savedNotes,
      practiceRuns,
    };
  },
});

export const getRecentlyStudiedTopicsInSubject = query({
  args: {
    slug: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.union(
    v.array(
      v.object({
        id: v.id("topics"),
        slug: v.string(),
        title: v.string(),
        mastery: v.number(),
        lastStudiedAt: v.number(),
        chapter: v.object({
          slug: v.string(),
          title: v.string(),
        }),
      })
    ),
    v.null()
  ),
  handler: async (ctx, { slug, limit }) => {
    const cap = Math.max(1, Math.min(limit ?? 3, 10));
    const subject = await ctx.db
      .query("subjects")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!subject) return null;

    const resolved = await resolveIdentityAndUser(ctx).catch(() => null);
    const userId: Id<"users"> | null = resolved?.user?._id ?? null;
    if (!userId) return [];

    const [chapters, allUserProgress] = await Promise.all([
      ctx.db
        .query("chapters")
        .withIndex("by_subject_order", (q) => q.eq("subjectId", subject._id))
        .collect(),
      ctx.db
        .query("userTopicProgress")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);

    if (allUserProgress.length === 0) return [];

    const chapterIds = new Set(chapters.map((c) => c._id));
    const RECENT_PROGRESS_CAP = 500;
    if (allUserProgress.length > RECENT_PROGRESS_CAP) {
      allUserProgress.sort((a, b) => (b.lastStudied ?? 0) - (a.lastStudied ?? 0));
      allUserProgress.length = RECENT_PROGRESS_CAP;
    }
    const scopedTopicIds = Array.from(
      new Set(allUserProgress.map((p) => p.topicId))
    );
    const fetchedTopics = await Promise.all(
      scopedTopicIds.map((id) => ctx.db.get(id))
    );
    const topicsById = new Map<Id<"topics">, NonNullable<typeof fetchedTopics[number]>>();
    for (const t of fetchedTopics) {
      if (t && chapterIds.has(t.chapterId)) topicsById.set(t._id, t);
    }

    const chaptersById = new Map<Id<"chapters">, Doc<"chapters">>();
    for (const ch of chapters) chaptersById.set(ch._id, ch);

    const out: Array<{
      id: Id<"topics">;
      slug: string;
      title: string;
      mastery: number;
      lastStudiedAt: number;
      chapter: { slug: string; title: string };
    }> = [];

    for (const progress of allUserProgress) {
      if (typeof progress.lastStudied !== "number") continue;
      const topic = topicsById.get(progress.topicId);
      if (!topic) continue;
      const chapter = chaptersById.get(topic.chapterId);
      if (!chapter) continue;
      out.push({
        id: topic._id,
        slug: topic.slug,
        title: topic.title,
        mastery: progress.mastery,
        lastStudiedAt: progress.lastStudied,
        chapter: { slug: chapter.slug, title: chapter.title },
      });
    }

    out.sort((a, b) => b.lastStudiedAt - a.lastStudiedAt);
    return out.slice(0, cap);
  },
});

export const getDependedOnBy = query({
  args: { topicId: v.id("topics") },
  returns: v.array(
    v.object({
      id: v.id("topics"),
      slug: v.string(),
      title: v.string(),
      chapterSlug: v.string(),
      chapterTitle: v.string(),
      subjectSlug: v.string(),
      subjectTitle: v.string(),
      color: v.optional(v.string()),
      mastery: v.number(),
      isStudied: v.boolean(),
      examRelevance: v.number(),
      difficulty: v.union(
        v.literal("EASY"),
        v.literal("MEDIUM"),
        v.literal("HARD")
      ),
    })
  ),
  handler: async (ctx, { topicId }) => {
    const edges = await ctx.db
      .query("topicPrerequisites")
      .withIndex("by_prerequisite", (q) =>
        q.eq("prerequisiteTopicId", topicId)
      )
      .collect();

    if (edges.length === 0) return [];

    const resolved = await resolveIdentityAndUser(ctx).catch(() => null);
    const userId: Id<"users"> | null = resolved?.user?._id ?? null;

    const topicIds = Array.from(new Set(edges.map((e) => e.topicId)));
    const topics = (await Promise.all(topicIds.map((id) => ctx.db.get(id))))
      .filter((t): t is NonNullable<typeof t> => t !== null);

    const chapters = new Map<Id<"chapters">, NonNullable<Awaited<ReturnType<typeof ctx.db.get<"chapters">>>>>();
    const chapterIds = Array.from(new Set(topics.map((t) => t.chapterId)));
    const chapterRows = await Promise.all(chapterIds.map((id) => ctx.db.get(id)));
    for (const ch of chapterRows) {
      if (ch) chapters.set(ch._id, ch);
    }

    const subjects = new Map<Id<"subjects">, NonNullable<Awaited<ReturnType<typeof ctx.db.get<"subjects">>>>>();
    const subjectIds = Array.from(new Set(Array.from(chapters.values()).map((ch) => ch.subjectId)));
    const subjectRows = await Promise.all(subjectIds.map((id) => ctx.db.get(id)));
    for (const s of subjectRows) {
      if (s) subjects.set(s._id, s);
    }

    const progressMap = new Map<Id<"topics">, number>();
    if (userId !== null) {
      const progressRows = await Promise.all(
        topicIds.map((id) =>
          ctx.db
            .query("userTopicProgress")
            .withIndex("by_user_topic", (q) =>
              q.eq("userId", userId).eq("topicId", id)
            )
            .first()
        )
      );
      topicIds.forEach((id, i) => {
        const p = progressRows[i];
        progressMap.set(id, p ? p.mastery : 0);
      });
    }

    return topics.map((t) => {
      const ch = chapters.get(t.chapterId);
      const subj = ch ? subjects.get(ch.subjectId) : undefined;
      return {
        id: t._id,
        slug: t.slug,
        title: t.title,
        chapterSlug: ch?.slug ?? "",
        chapterTitle: ch?.title ?? "",
        subjectSlug: subj?.slug ?? "",
        subjectTitle: subj?.title ?? "",
        color: subj?.color,
        mastery: progressMap.get(t._id) ?? 0,
        isStudied: progressMap.has(t._id),
        examRelevance: t.examRelevance,
        difficulty: t.difficulty,
      };
    });
  },
});
