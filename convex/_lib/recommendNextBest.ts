import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export type NextBestRecommendation = {
  readonly subject: {
    readonly slug: string;
    readonly title: string;
    readonly color?: string;
  };
  readonly chapter: { readonly slug: string; readonly title: string };
  readonly topic: {
    readonly id: Id<"topics">;
    readonly slug: string;
    readonly title: string;
    readonly examRelevance: number;
    readonly mastery: number;
    readonly source: "canonical" | "user";
    readonly ownerId: Id<"users"> | null;
  };
  readonly reason: string;
};

export type RecommendationScope =
  | { readonly kind: "subject"; readonly subjectId: Id<"subjects"> }
  | { readonly kind: "all_enrolled" };

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const MASTERY_DONE_THRESHOLD = 0.85;

type SubjectRow = {
  readonly _id: Id<"subjects">;
  readonly slug: string;
  readonly title: string;
  readonly color?: string;
};

type Candidate = {
  readonly subject: SubjectRow;
  readonly chapter: { readonly _id: Id<"chapters">; readonly slug: string; readonly title: string };
  readonly topic: {
    readonly _id: Id<"topics">;
    readonly slug: string;
    readonly title: string;
    readonly examRelevance: number;
    readonly mastery: number;
    readonly source: "canonical" | "user";
    readonly ownerId: Id<"users"> | null;
  };
  readonly score: number;
  readonly reason: string;
};

export async function recommendNextBest(
  ctx: QueryCtx,
  args: {
    readonly userId: Id<"users">;
    readonly scope: RecommendationScope;
    readonly excludeTopicId?: Id<"topics">;
  }
): Promise<NextBestRecommendation | null> {
  const now = Date.now();

  let enrolledSubjects: ReadonlyArray<SubjectRow>;
  if (args.scope.kind === "subject") {
    const sub = await ctx.db.get(args.scope.subjectId);
    if (!sub) return null;
    enrolledSubjects = [
      { _id: sub._id, slug: sub.slug, title: sub.title, color: sub.color },
    ];
  } else {
    const rows = await ctx.db
      .query("userSubjects")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const resolved = await Promise.all(
      rows.map((r) => ctx.db.get(r.subjectId))
    );
    enrolledSubjects = resolved
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .map((s) => ({
        _id: s._id,
        slug: s.slug,
        title: s.title,
        color: s.color,
      }));
  }

  if (enrolledSubjects.length === 0) return null;

  type TopicContext = {
    readonly subject: SubjectRow;
    readonly chapter: { readonly _id: Id<"chapters">; readonly slug: string; readonly title: string };
    readonly topic: NonNullable<Awaited<ReturnType<typeof ctx.db.get<"topics">>>>;
  };
  const topicContexts: TopicContext[] = [];

  const chapterRows = (
    await Promise.all(
      enrolledSubjects.map(async (sub) => {
        const chapters = await ctx.db
          .query("chapters")
          .withIndex("by_subject_order", (q) => q.eq("subjectId", sub._id))
          .collect();
        return chapters.map((ch) => ({ sub, ch }));
      })
    )
  ).flat();
  chapterRows.sort((a, b) => a.ch.order - b.ch.order);

  for (const { sub, ch } of chapterRows) {
    const chTopics = await ctx.db
      .query("topics")
      .withIndex("by_chapter", (q) => q.eq("chapterId", ch._id))
      .collect();
    for (const t of chTopics) {
      if (args.excludeTopicId && t._id === args.excludeTopicId) continue;
      topicContexts.push({
        subject: sub,
        chapter: { _id: ch._id, slug: ch.slug, title: ch.title },
        topic: t,
      });
    }
  }

  const allProgress = await ctx.db
    .query("userTopicProgress")
    .withIndex("by_user", (q) => q.eq("userId", args.userId))
    .collect();
  const progressByTopic = new Map<
    Id<"topics">,
    NonNullable<typeof allProgress[number]>
  >();
  for (const p of allProgress) progressByTopic.set(p.topicId, p);

  const candidates: Candidate[] = [];
  for (const ctx0 of topicContexts) {
    const t = ctx0.topic;
    const ch = ctx0.chapter;
    const sub = ctx0.subject;
    const progress = progressByTopic.get(t._id);
    const mastery = progress ? progress.mastery : 0;
    if (mastery >= MASTERY_DONE_THRESHOLD) continue;
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
      chapter: ch,
      topic: {
        _id: t._id,
        slug: t.slug,
        title: t.title,
        examRelevance: t.examRelevance,
        mastery,
        source: (t.source ?? "canonical") as "canonical" | "user",
        ownerId: t.ownerId ?? null,
      },
      score,
      reason,
    });
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
      source: top.topic.source,
      ownerId: top.topic.ownerId,
    },
    reason: top.reason,
  };
}
