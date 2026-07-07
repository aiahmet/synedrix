import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Id, Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import {
  resolveFlashcardReviewChains,
  resolveMistakeReviewChains,
  collectFormulaPacks,
  collectVocabularyDecks,
} from "./_lib/reviewHelpers";
import { resolveTopicChains } from "./_lib/topicChain";
import type { QueueItem } from "./_lib/reviewTypes";

const DAY_MS = 86_400_000;
const WEAK_MASTERY_THRESHOLD = 0.5;

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

    // Fetch raw data in parallel
    const [
      profile,
      enrollments,
      overdueFlashcards,
      dueTodayFlashcards,
      overdueMistakes,
      dueTodayMistakes,
    ] = await Promise.all([
      ctx.db
        .query("tutorProfiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first(),
      ctx.db
        .query("userSubjects")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("flashcardReviews")
        .withIndex("by_user_due", (q) =>
          q.eq("userId", userId).lt("dueAt", now)
        )
        .take(100),
      ctx.db
        .query("flashcardReviews")
        .withIndex("by_user_due", (q) =>
          q
            .eq("userId", userId)
            .gte("dueAt", now)
            .lt("dueAt", now + DAY_MS)
        )
        .take(100),
      ctx.db
        .query("mistakeEntries")
        .withIndex("by_user_review", (q) =>
          q.eq("userId", userId).lt("reviewAt", now)
        )
        .take(100),
      ctx.db
        .query("mistakeEntries")
        .withIndex("by_user_review", (q) =>
          q
            .eq("userId", userId)
            .gte("reviewAt", now)
            .lt("reviewAt", now + DAY_MS)
        )
        .take(100),
    ]);

    // Resolve flashcard + mistake chain via helpers
    const flashcardResult = await resolveFlashcardReviewChains(
      ctx,
      overdueFlashcards,
      dueTodayFlashcards
    );
    const { overdueByTopic, dueTodayByTopic } =
      await resolveMistakeReviewChains(
        ctx,
        overdueMistakes,
        dueTodayMistakes,
        flashcardResult.topicMap,
      );

    const items: QueueItem[] = [];
    const seen = new Set<string>();
    const dedupeKey = (kind: string, key: string) => `${kind}::${key}`;

    // Build flashcard queue items (using maps from flashcardResult)
    const {
      flashcardMap,
      deckMap,
      topicMap,
      resolveTopicPath,
      overdueByDeck,
      dueTodayByDeck,
    } = flashcardResult;

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
      const overdueInDeck = overdueByDeck.get(deck._id) ?? 0;
      items.push({
        kind: "flashcard",
        priority: 1.0,
        at: review.dueAt,
        title: deck.title,
        subtitle: `${overdueInDeck} card${
          overdueInDeck === 1 ? "" : "s"
        } overdue${subject ? ` · ${subject.title}` : ""}`,
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
      const dueInDeck = dueTodayByDeck.get(deck._id) ?? 0;
      items.push({
        kind: "flashcard",
        priority: 0.8,
        at: review.dueAt,
        title: deck.title,
        subtitle: `${dueInDeck} card${
          dueInDeck === 1 ? "" : "s"
        } due today${subject ? ` · ${subject.title}` : ""}`,
        href: subject
          ? `/subjects/${subject.slug}/${topic.slug}?review=flashcards`
          : `/subjects?review=flashcards`,
        subjectSlug: subject?.slug ?? null,
        subjectColor: subject?.color ?? null,
        count: dueInDeck,
        topicId: topic._id,
      });
    }

    // Build mistake queue items (using topicMap + resolveTopicPath)
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
        subtitle: `${mistake.mistakeType
          .replace(/_/g, " ")
          .toLowerCase()}${subject ? ` · ${subject.title}` : ""}`,
        href: topic
          ? `/subjects/${subject?.slug ?? ""}/${topic.slug}?review=mistakes`
          : "/subjects?review=mistakes",
        subjectSlug: subject?.slug ?? null,
        subjectColor: subject?.color ?? null,
        count: mistake.topicId
          ? (overdueByTopic.get(mistake.topicId) ?? 0)
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
        subtitle: `${mistake.mistakeType
          .replace(/_/g, " ")
          .toLowerCase()}${subject ? ` · ${subject.title}` : ""}`,
        href: topic
          ? `/subjects/${subject?.slug ?? ""}/${topic.slug}?review=mistakes`
          : "/subjects?review=mistakes",
        subjectSlug: subject?.slug ?? null,
        subjectColor: subject?.color ?? null,
        count: mistake.topicId
          ? (dueTodayByTopic.get(mistake.topicId) ?? 0)
          : 0,
        topicId: topic?._id ?? null,
      });
    }

    // Weak topics — use resolveTopicChains (batch) instead of per-row N+1
    const enrolledSubjectIds = enrollments.map((e) => e.subjectId);
    const gradeLevel = profile?.grade ?? null;

    const progress = await ctx.db
      .query("userTopicProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(500); // CAP: was .collect()

    const weakCandidates = progress
      .filter((p) => p.mastery < WEAK_MASTERY_THRESHOLD)
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 6); // CAP: was 8

    const weakIds = weakCandidates.map((p) => p.topicId);
    const weakChains = await resolveTopicChains(ctx, weakIds);

    let weakTopicCount = 0;
    for (const wp of weakCandidates) {
      const chain = weakChains.get(wp.topicId);
      if (!chain) continue;
      const { topic, chapter, subject } = chain;
      if (topic.source === "user" && topic.ownerId !== userId) continue;
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

    // Formula packs + vocabulary decks via helpers
    if (enrolledSubjectIds.length > 0) {
      const [formulaItems, vocabItems] = await Promise.all([
        collectFormulaPacks(ctx, enrolledSubjectIds, seen, 5),
        collectVocabularyDecks(ctx, enrolledSubjectIds, seen, 5),
      ]);
      items.push(...formulaItems, ...vocabItems);
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
