import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Id, Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

const DAY_MS = 86_400_000;
const WEAK_MASTERY_THRESHOLD = 0.5;
const TOPIC_BATCH = 300;
const CH_BATCH = 100;

export const getReviewQueue = query({
  args: {},
  returns: v.object({
    overdueCount: v.number(),
    dueTodayCount: v.number(),
    weakTopicCount: v.number(),
    formulaPackCount: v.number(),
    vocabularyDeckCount: v.number(),
    items: v.array(
      v.object({
        kind: v.union(
          v.literal("flashcard"),
          v.literal("mistake"),
          v.literal("weak_topic"),
          v.literal("formula_pack"),
          v.literal("vocabulary_deck")
        ),
        priority: v.number(),
        at: v.number(),
        title: v.string(),
        subtitle: v.string(),
        href: v.string(),
        subjectSlug: v.union(v.string(), v.null()),
        subjectColor: v.union(v.string(), v.null()),
        count: v.union(v.number(), v.null()),
        topicId: v.union(v.id("topics"), v.null()),
      })
    ),
    hasRescuePlanEligible: v.boolean(),
  }),
  handler: async (ctx) => {
    const user = await resolveUser(ctx);
    if (!user) return emptyQueue();

    const now = Date.now();
    const userId: Id<"users"> = user._id;

    const [profile, enrollments] = await Promise.all([
      ctx.db
        .query("tutorProfiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first(),
      ctx.db
        .query("userSubjects")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);

    const [
      overdueFlashcards,
      dueTodayFlashcards,
      overdueMistakes,
      dueTodayMistakes,
    ] = await Promise.all([
      ctx.db
        .query("flashcardReviews")
        .withIndex("by_user_due", (q) =>
          q.eq("userId", userId).lt("dueAt", now)
        )
        .take(200),
      ctx.db
        .query("flashcardReviews")
        .withIndex("by_user_due", (q) =>
          q
            .eq("userId", userId)
            .gte("dueAt", now)
            .lt("dueAt", now + DAY_MS)
        )
        .take(200),
      ctx.db
        .query("mistakeEntries")
        .withIndex("by_user_review", (q) =>
          q.eq("userId", userId).lt("reviewAt", now)
        )
        .take(200),
      ctx.db
        .query("mistakeEntries")
        .withIndex("by_user_review", (q) =>
          q
            .eq("userId", userId)
            .gte("reviewAt", now)
            .lt("reviewAt", now + DAY_MS)
        )
        .take(200),
    ]);

    const flashcardIds = new Set([
      ...overdueFlashcards.map((r) => r.flashcardId),
      ...dueTodayFlashcards.map((r) => r.flashcardId),
    ]);
    const flashcardRows = flashcardIds.size > 0
      ? await Promise.all(Array.from(flashcardIds).map((id) => ctx.db.get(id)))
      : [];
    const flashcardMap = new Map<
      Id<"flashcards">,
      NonNullable<(typeof flashcardRows)[number]>
    >();
    for (const fc of flashcardRows) {
      if (fc) flashcardMap.set(fc._id, fc);
    }

    const deckIds = new Set(
      Array.from(flashcardMap.values()).map((fc) => fc.deckId)
    );
    const deckRows = deckIds.size > 0
      ? await Promise.all(Array.from(deckIds).map((id) => ctx.db.get(id)))
      : [];
    const deckMap = new Map<
      Id<"flashcardDecks">,
      NonNullable<(typeof deckRows)[number]>
    >();
    for (const d of deckRows) {
      if (d) deckMap.set(d._id, d);
    }

    const topicIdsFromDecks = new Set(
      Array.from(deckMap.values()).map((d) => d.topicId)
    );
    const mistakeTopicIds = new Set(
      [...overdueMistakes, ...dueTodayMistakes]
        .map((m) => m.topicId)
        .filter((id): id is Id<"topics"> => id !== undefined)
    );
    const allReviewTopicIds = new Set([
      ...topicIdsFromDecks,
      ...mistakeTopicIds,
    ]);

    const topicRows = allReviewTopicIds.size > 0
      ? await Promise.all(
          Array.from(allReviewTopicIds).map((id) => ctx.db.get(id))
        )
      : [];
    const topicMap = new Map<
      Id<"topics">,
      NonNullable<(typeof topicRows)[number]>
    >();
    for (const t of topicRows) {
      if (t) topicMap.set(t._id, t);
    }

    const chapterIds = new Set(
      Array.from(topicMap.values()).map((t) => t.chapterId)
    );
    const chapterRows = chapterIds.size > 0
      ? await Promise.all(Array.from(chapterIds).map((id) => ctx.db.get(id)))
      : [];
    const chapterMap = new Map<
      Id<"chapters">,
      NonNullable<(typeof chapterRows)[number]>
    >();
    for (const ch of chapterRows) {
      if (ch) chapterMap.set(ch._id, ch);
    }

    const subjectIds = new Set(
      Array.from(chapterMap.values()).map((ch) => ch.subjectId)
    );
    const subjectRows = subjectIds.size > 0
      ? await Promise.all(Array.from(subjectIds).map((id) => ctx.db.get(id)))
      : [];
    const subjectMap = new Map<
      Id<"subjects">,
      NonNullable<(typeof subjectRows)[number]>
    >();
    for (const s of subjectRows) {
      if (s) subjectMap.set(s._id, s);
    }

    const resolveTopicPath = (
      topic: NonNullable<(typeof topicRows)[number]>
    ) => {
      const chapter = chapterMap.get(topic.chapterId);
      const subject = chapter
        ? subjectMap.get(chapter.subjectId)
        : null;
      return { chapter, subject };
    };

    type QueueItem = {
      kind: "flashcard" | "mistake" | "weak_topic" | "formula_pack" | "vocabulary_deck";
      priority: number;
      at: number;
      title: string;
      subtitle: string;
      href: string;
      subjectSlug: string | null;
      subjectColor: string | null;
      count: number | null;
      topicId: Id<"topics"> | null;
    };

    const items: QueueItem[] = [];

    const dedupeKey = (kind: string, key: string) => `${kind}::${key}`;
    const seen = new Set<string>();

    const overdueFlashcardsByDeck = new Map<Id<"flashcardDecks">, number>();
    for (const r of overdueFlashcards) {
      const fc = flashcardMap.get(r.flashcardId);
      if (!fc) continue;
      overdueFlashcardsByDeck.set(
        fc.deckId,
        (overdueFlashcardsByDeck.get(fc.deckId) ?? 0) + 1
      );
    }
    const dueTodayFlashcardsByDeck = new Map<Id<"flashcardDecks">, number>();
    for (const r of dueTodayFlashcards) {
      const fc = flashcardMap.get(r.flashcardId);
      if (!fc) continue;
      dueTodayFlashcardsByDeck.set(
        fc.deckId,
        (dueTodayFlashcardsByDeck.get(fc.deckId) ?? 0) + 1
      );
    }
    const overdueMistakesByTopic = new Map<Id<"topics">, number>();
    for (const m of overdueMistakes) {
      if (!m.topicId) continue;
      overdueMistakesByTopic.set(
        m.topicId,
        (overdueMistakesByTopic.get(m.topicId) ?? 0) + 1
      );
    }
    const dueTodayMistakesByTopic = new Map<Id<"topics">, number>();
    for (const m of dueTodayMistakes) {
      if (!m.topicId) continue;
      dueTodayMistakesByTopic.set(
        m.topicId,
        (dueTodayMistakesByTopic.get(m.topicId) ?? 0) + 1
      );
    }

    for (const review of overdueFlashcards) {
      const fc = flashcardMap.get(review.flashcardId);
      if (!fc) continue;
      const deck = deckMap.get(fc.deckId);
      if (!deck) continue;
      const topic = topicMap.get(deck.topicId);
      if (!topic) continue;
      const { subject } = resolveTopicPath(topic);
      const key = dedupeKey("flashcard", deck._id);
      if (seen.has(key)) continue;
      seen.add(key);
      const overdueInDeck = overdueFlashcardsByDeck.get(deck._id) ?? 0;
      items.push({
        kind: "flashcard",
        priority: 1.0,
        at: review.dueAt,
        title: deck.title,
        subtitle: `${overdueInDeck} card${overdueInDeck === 1 ? "" : "s"} overdue${subject ? ` · ${subject.title}` : ""}`,
        href: subject
          ? `/subjects/${subject.slug}/${topic.slug}?review=flashcards`
          : `/subjects?review=flashcards`,
        subjectSlug: subject?.slug ?? null,
        subjectColor: subject?.color ?? null,
        count: overdueInDeck,
        topicId: topic._id,
      });
    }

    for (const review of dueTodayFlashcards) {
      const fc = flashcardMap.get(review.flashcardId);
      if (!fc) continue;
      const deck = deckMap.get(fc.deckId);
      if (!deck) continue;
      const topic = topicMap.get(deck.topicId);
      if (!topic) continue;
      const { subject } = resolveTopicPath(topic);
      const key = dedupeKey("flashcard", deck._id);
      if (seen.has(key)) continue;
      seen.add(key);
      const dueInDeck = dueTodayFlashcardsByDeck.get(deck._id) ?? 0;
      items.push({
        kind: "flashcard",
        priority: 0.8,
        at: review.dueAt,
        title: deck.title,
        subtitle: `${dueInDeck} card${dueInDeck === 1 ? "" : "s"} due today${subject ? ` · ${subject.title}` : ""}`,
        href: subject
          ? `/subjects/${subject.slug}/${topic.slug}?review=flashcards`
          : `/subjects?review=flashcards`,
        subjectSlug: subject?.slug ?? null,
        subjectColor: subject?.color ?? null,
        count: dueInDeck,
        topicId: topic._id,
      });
    }

    for (const mistake of overdueMistakes) {
      const topic = mistake.topicId
        ? topicMap.get(mistake.topicId)
        : null;
      const { subject } = topic ? resolveTopicPath(topic) : { subject: null };
      const key = dedupeKey(
        "mistake",
        topic ? topic._id : mistake._id
      );
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        kind: "mistake",
        priority: 1.0,
        at: mistake.reviewAt ?? mistake._creationTime,
        title: topic?.title ?? "Mistake review",
        subtitle: `${mistake.mistakeType.replace(/_/g, " ").toLowerCase()}${subject ? ` · ${subject.title}` : ""}`,
        href: topic
          ? `/subjects/${subject?.slug ?? ""}/${topic.slug}?review=mistakes`
          : "/subjects?review=mistakes",
        subjectSlug: subject?.slug ?? null,
        subjectColor: subject?.color ?? null,
        count: mistake.topicId
          ? (overdueMistakesByTopic.get(mistake.topicId) ?? 0)
          : 0,
        topicId: topic?._id ?? null,
      });
    }

    for (const mistake of dueTodayMistakes) {
      const topic = mistake.topicId
        ? topicMap.get(mistake.topicId)
        : null;
      const { subject } = topic ? resolveTopicPath(topic) : { subject: null };
      const key = dedupeKey(
        "mistake",
        topic ? topic._id : mistake._id
      );
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        kind: "mistake",
        priority: 0.8,
        at: mistake.reviewAt ?? mistake._creationTime,
        title: topic?.title ?? "Mistake review",
        subtitle: `${mistake.mistakeType.replace(/_/g, " ").toLowerCase()}${subject ? ` · ${subject.title}` : ""}`,
        href: topic
          ? `/subjects/${subject?.slug ?? ""}/${topic.slug}?review=mistakes`
          : "/subjects?review=mistakes",
        subjectSlug: subject?.slug ?? null,
        subjectColor: subject?.color ?? null,
        count: mistake.topicId
          ? (dueTodayMistakesByTopic.get(mistake.topicId) ?? 0)
          : 0,
        topicId: topic?._id ?? null,
      });
    }

    const enrolledSubjectIds = enrollments.map((e) => e.subjectId);
    const gradeLevel = profile?.grade ?? null;

    const progress = await ctx.db
      .query("userTopicProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const weakCandidates = progress.filter(
      (p) => p.mastery < WEAK_MASTERY_THRESHOLD
    );
    weakCandidates.sort((a, b) => a.mastery - b.mastery);

    let weakTopicCount = 0;
    for (const wp of weakCandidates.slice(0, 8)) {
      const topic = await ctx.db.get(wp.topicId);
      if (!topic) continue;
      if (topic.source === "user" && topic.ownerId !== userId) continue;
      const chapter = await ctx.db.get(topic.chapterId);
      if (!chapter) continue;
      const subject = await ctx.db.get(chapter.subjectId);
      if (!subject) continue;
      if (
        enrolledSubjectIds.length > 0 &&
        !enrolledSubjectIds.includes(subject._id)
      )
        continue;

      if (
        topic.gradeLevel &&
        gradeLevel !== null &&
        topic.gradeLevel !== String(gradeLevel) &&
        topic.gradeLevel !== "11"
      )
        continue;

      weakTopicCount++;
      items.push({
        kind: "weak_topic",
        priority: 0.7 * (1 - wp.mastery),
        at: wp.lastStudied ?? 0,
        title: topic.title,
        subtitle: `${Math.round(wp.mastery * 100)}% mastery · ${subject.title}`,
        href: `/subjects/${subject.slug}/${chapter.slug}/${topic.slug}`,
        subjectSlug: subject.slug,
        subjectColor: subject.color ?? null,
        count: null,
        topicId: topic._id,
      });
    }

    if (enrolledSubjectIds.length > 0) {
      const formulaSheets = await Promise.all(
        enrolledSubjectIds.slice(0, 5).map(async (subjId) => {
          const chapters = await ctx.db
            .query("chapters")
            .withIndex("by_subject", (q) => q.eq("subjectId", subjId))
            .take(CH_BATCH);
          const topicLists = await Promise.all(
            chapters.map((ch) =>
              ctx.db
                .query("topics")
                .withIndex("by_chapter", (q) => q.eq("chapterId", ch._id))
                .take(TOPIC_BATCH)
            )
          );
          const allTopics = topicLists.flat();
          const resourceRows = await Promise.all(
            allTopics.slice(0, 50).map((t) =>
              ctx.db
                .query("topicResources")
                .withIndex("by_topic_kind", (q) =>
                  q.eq("topicId", t._id).eq("kind", "formula_sheet")
                )
                .first()
            )
          );
          return { subjId, resources: resourceRows.filter(Boolean) };
        })
      );

      for (const { subjId, resources } of formulaSheets) {
        for (const resource of resources) {
          if (!resource) continue;
          const topic = await ctx.db.get(resource.topicId);
          if (!topic) continue;
          const chapter =
            chapterMap.get(topic.chapterId) ??
            (await ctx.db.get(topic.chapterId));
          const key = dedupeKey("formula_pack", resource._id);
          if (seen.has(key)) continue;
          seen.add(key);
          const subject = subjectMap.get(subjId);
          items.push({
            kind: "formula_pack",
            priority: 0.5,
            at: resource.updatedAt,
            title: `Formulas: ${topic.title}`,
            subtitle: `${resource.contents.length} formula${resource.contents.length === 1 ? "" : "s"}${subject ? ` · ${subject.title}` : ""}`,
            href: subject && chapter
              ? `/subjects/${subject.slug}/${chapter.slug}/${topic.slug}?tab=formulas`
              : "/subjects",
            subjectSlug: subject?.slug ?? null,
            subjectColor: subject?.color ?? null,
            count: resource.contents.length,
            topicId: topic._id,
          });
        }
      }

      const vocabDecks = await Promise.all(
        enrolledSubjectIds.slice(0, 5).map(async (subjId) => {
          const chapters = await ctx.db
            .query("chapters")
            .withIndex("by_subject", (q) => q.eq("subjectId", subjId))
            .take(CH_BATCH);
          const topicLists = await Promise.all(
            chapters.map((ch) =>
              ctx.db
                .query("topics")
                .withIndex("by_chapter", (q) => q.eq("chapterId", ch._id))
                .take(TOPIC_BATCH)
            )
          );
          const allTopics = topicLists.flat();
          const resourceRows = await Promise.all(
            allTopics.slice(0, 50).map((t) =>
              ctx.db
                .query("topicResources")
                .withIndex("by_topic_kind", (q) =>
                  q.eq("topicId", t._id).eq("kind", "vocabulary_deck")
                )
                .first()
            )
          );
          return { subjId, resources: resourceRows.filter(Boolean) };
        })
      );

      for (const { subjId, resources } of vocabDecks) {
        for (const resource of resources) {
          if (!resource) continue;
          const topic = await ctx.db.get(resource.topicId);
          if (!topic) continue;
          const chapter =
            chapterMap.get(topic.chapterId) ??
            (await ctx.db.get(topic.chapterId));
          const key = dedupeKey("vocabulary_deck", resource._id);
          if (seen.has(key)) continue;
          seen.add(key);
          const subject = subjectMap.get(subjId);
          items.push({
            kind: "vocabulary_deck",
            priority: 0.5,
            at: resource.updatedAt,
            title: `Vocabulary: ${topic.title}`,
            subtitle: `${resource.contents.length} term${resource.contents.length === 1 ? "" : "s"}${subject ? ` · ${subject.title}` : ""}`,
            href: subject && chapter
              ? `/subjects/${subject.slug}/${chapter.slug}/${topic.slug}?tab=vocabulary`
              : "/subjects",
            subjectSlug: subject?.slug ?? null,
            subjectColor: subject?.color ?? null,
            count: resource.contents.length,
            topicId: topic._id,
          });
        }
      }
    }

    items.sort((a, b) => b.priority - a.priority || a.at - b.at);

    const overdueCount =
      overdueFlashcards.length + overdueMistakes.length;
    const dueTodayCount =
      dueTodayFlashcards.length + dueTodayMistakes.length;
    const hasRescuePlanEligible = overdueCount >= 5;

    return {
      overdueCount,
      dueTodayCount,
      weakTopicCount,
      formulaPackCount: items.filter(
        (i) => i.kind === "formula_pack"
      ).length,
      vocabularyDeckCount: items.filter(
        (i) => i.kind === "vocabulary_deck"
      ).length,
      items: items.slice(0, 20),
      hasRescuePlanEligible,
    };
  },
});

async function resolveUser(
  ctx: QueryCtx
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
  return user;
}

function emptyQueue() {
  return {
    overdueCount: 0,
    dueTodayCount: 0,
    weakTopicCount: 0,
    formulaPackCount: 0,
    vocabularyDeckCount: 0,
    items: [],
    hasRescuePlanEligible: false,
  };
}
