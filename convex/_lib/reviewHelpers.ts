// convex/_lib/reviewHelpers.ts
// Shared computation helpers for review queue building.
// Extracted from reviewCenter.ts to allow reuse across review-related queries.

import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueueItem } from "./reviewTypes";

/** 86_400_000 milliseconds = 1 day */
const DAY_MS = 86_400_000;

// ─── Function 1: resolveFlashcardReviewChains ─────────────────────────────

/**
 * Batch-resolve the full flashcard -> deck -> topic -> chapter -> subject
 * chain for overdue and due-today flashcard reviews.
 *
 * Caps each input array at 100 reviews (caller should already limit).
 *
 * Returns:
 * - `flashcardMap`, `deckMap`, `topicMap`, `chapterMap`, `subjectMap` for
 *   every level of the resolution chain.
 * - `resolveTopicPath(topic)` closure that looks up a topic's chapter and
 *   subject from the built maps.
 * - `overdueByDeck` / `dueTodayByDeck` counts for building queue items.
 *
 * Internal batch-fetch caps: determined by unique IDs collected from
 * reviews (at most 100 reviews * 2 arrays = 200 unique flashcard IDs).
 *
 * All `.collect()` calls are avoided in favor of `.take(N)` or direct
 * `ctx.db.get()`.
 */
export async function resolveFlashcardReviewChains(
  ctx: QueryCtx,
  overdueReviews: Doc<"flashcardReviews">[],
  dueTodayReviews: Doc<"flashcardReviews">[],
): Promise<{
  flashcardMap: Map<Id<"flashcards">, Doc<"flashcards">>;
  deckMap: Map<Id<"flashcardDecks">, Doc<"flashcardDecks">>;
  topicMap: Map<Id<"topics">, Doc<"topics">>;
  chapterMap: Map<Id<"chapters">, Doc<"chapters">>;
  subjectMap: Map<Id<"subjects">, Doc<"subjects">>;
  resolveTopicPath: (
    topic: Doc<"topics">,
  ) => { chapter: Doc<"chapters"> | null; subject: Doc<"subjects"> | null };
  overdueByDeck: Map<Id<"flashcardDecks">, number>;
  dueTodayByDeck: Map<Id<"flashcardDecks">, number>;
}> {
  // 1. Collect all unique flashcard IDs from both arrays.
  const allReviews = [...overdueReviews, ...dueTodayReviews];
  const flashcardIds = new Set(allReviews.map((r) => r.flashcardId));

  // 2. Batch-fetch all flashcard rows.
  const flashcardRows =
    flashcardIds.size > 0
      ? await Promise.all(
          Array.from(flashcardIds).map((id) => ctx.db.get(id)),
        )
      : [];
  const flashcardMap = new Map<Id<"flashcards">, Doc<"flashcards">>();
  for (const fc of flashcardRows) {
    if (fc) flashcardMap.set(fc._id, fc);
  }

  // 3-4. Collect unique deck IDs and batch-fetch.
  const deckIds = new Set(
    Array.from(flashcardMap.values()).map((fc) => fc.deckId),
  );
  const deckRows =
    deckIds.size > 0
      ? await Promise.all(Array.from(deckIds).map((id) => ctx.db.get(id)))
      : [];
  const deckMap = new Map<Id<"flashcardDecks">, Doc<"flashcardDecks">>();
  for (const d of deckRows) {
    if (d) deckMap.set(d._id, d);
  }

  // 5-6. Collect unique topic IDs and batch-fetch.
  const topicIds = new Set(
    Array.from(deckMap.values()).map((d) => d.topicId),
  );
  const topicRows =
    topicIds.size > 0
      ? await Promise.all(Array.from(topicIds).map((id) => ctx.db.get(id)))
      : [];
  const topicMap = new Map<Id<"topics">, Doc<"topics">>();
  for (const t of topicRows) {
    if (t) topicMap.set(t._id, t);
  }

  // 7-8. Collect unique chapter IDs and batch-fetch.
  const chapterIds = new Set(
    Array.from(topicMap.values()).map((t) => t.chapterId),
  );
  const chapterRows =
    chapterIds.size > 0
      ? await Promise.all(
          Array.from(chapterIds).map((id) => ctx.db.get(id)),
        )
      : [];
  const chapterMap = new Map<Id<"chapters">, Doc<"chapters">>();
  for (const ch of chapterRows) {
    if (ch) chapterMap.set(ch._id, ch);
  }

  // 9-10. Collect unique subject IDs and batch-fetch.
  const subjectIds = new Set(
    Array.from(chapterMap.values()).map((ch) => ch.subjectId),
  );
  const subjectRows =
    subjectIds.size > 0
      ? await Promise.all(
          Array.from(subjectIds).map((id) => ctx.db.get(id)),
        )
      : [];
  const subjectMap = new Map<Id<"subjects">, Doc<"subjects">>();
  for (const s of subjectRows) {
    if (s) subjectMap.set(s._id, s);
  }

  // 11. Build the resolveTopicPath helper (closure over chapterMap/subjectMap).
  const resolveTopicPath = (
    topic: Doc<"topics">,
  ): { chapter: Doc<"chapters"> | null; subject: Doc<"subjects"> | null } => {
    const chapter = chapterMap.get(topic.chapterId) ?? null;
    const subject = chapter ? (subjectMap.get(chapter.subjectId) ?? null) : null;
    return { chapter, subject };
  };

  // 12. Count overdue per deck.
  const overdueByDeck = new Map<Id<"flashcardDecks">, number>();
  for (const r of overdueReviews) {
    const fc = flashcardMap.get(r.flashcardId);
    if (!fc) continue;
    overdueByDeck.set(fc.deckId, (overdueByDeck.get(fc.deckId) ?? 0) + 1);
  }

  // 13. Count due-today per deck.
  const dueTodayByDeck = new Map<Id<"flashcardDecks">, number>();
  for (const r of dueTodayReviews) {
    const fc = flashcardMap.get(r.flashcardId);
    if (!fc) continue;
    dueTodayByDeck.set(
      fc.deckId,
      (dueTodayByDeck.get(fc.deckId) ?? 0) + 1,
    );
  }

  return {
    flashcardMap,
    deckMap,
    topicMap,
    chapterMap,
    subjectMap,
    resolveTopicPath,
    overdueByDeck,
    dueTodayByDeck,
  };
}

// ─── Function 2: resolveMistakeReviewChains ───────────────────────────────

/**
 * Batch-resolve the topic chain for overdue and due-today mistake entries.
 *
 * Accepts an existing `topicMap` and `resolveTopicPath` (typically from
 * `resolveFlashcardReviewChains`) and extends `topicMap` with any topics
 * that haven't been fetched yet.
 *
 * Caps each input array at 100 mistakes (caller should already limit).
 *
 * Returns per-topic counts for overdue and due-today mistakes.
 *
 * Internal batch-fetch caps: determined by unique topic IDs not already in
 * `topicMap` (at most 200 mistakes * 2 arrays = 400 unique topic IDs, but
 * most will already be in the map from the flashcard chain).
 */
export async function resolveMistakeReviewChains(
  ctx: QueryCtx,
  overdueMistakes: Doc<"mistakeEntries">[],
  dueTodayMistakes: Doc<"mistakeEntries">[],
  topicMap: Map<Id<"topics">, Doc<"topics">>,
): Promise<{
  overdueByTopic: Map<Id<"topics">, number>;
  dueTodayByTopic: Map<Id<"topics">, number>;
}> {
  // Collect unique topicIds from all mistakes, excluding null/undefined.
  const allMistakes = [...overdueMistakes, ...dueTodayMistakes];
  const missingTopicIds = new Set<Id<"topics">>();
  for (const m of allMistakes) {
    if (m.topicId && !topicMap.has(m.topicId)) {
      missingTopicIds.add(m.topicId);
    }
  }

  // Batch-fetch any topic rows NOT already in topicMap.
  if (missingTopicIds.size > 0) {
    const fetchedTopics = await Promise.all(
      Array.from(missingTopicIds).map((id) => ctx.db.get(id)),
    );
    for (const t of fetchedTopics) {
      if (t) topicMap.set(t._id, t);
    }
  }

  // Count overdue mistakes per topic.
  const overdueByTopic = new Map<Id<"topics">, number>();
  for (const m of overdueMistakes) {
    if (!m.topicId) continue;
    overdueByTopic.set(
      m.topicId,
      (overdueByTopic.get(m.topicId) ?? 0) + 1,
    );
  }

  // Count due-today mistakes per topic.
  const dueTodayByTopic = new Map<Id<"topics">, number>();
  for (const m of dueTodayMistakes) {
    if (!m.topicId) continue;
    dueTodayByTopic.set(
      m.topicId,
      (dueTodayByTopic.get(m.topicId) ?? 0) + 1,
    );
  }

  return { overdueByTopic, dueTodayByTopic };
}

// ─── Function 3: collectFormulaPacks ─────────────────────────────────────

/**
 * Collect formula sheet resources from enrolled subjects and build
 * QueueItems for them.
 *
 * Performs its own self-contained nested scan (subjects -> chapters ->
 * topics -> topicResources) without relying on pre-resolved maps from
 * the flashcard chain. This allows it to discover formula packs for
 * subjects that have no flashcard or mistake activity.
 *
 * Uses a `seen` Set for deduplication with key format
 * `"formula_pack::<resourceId>"`.
 *
 * Internal query caps:
 *  - enrolledSubjectIds: first 5 only
 *  - chapters per subject: `.take(30)`
 *  - topics per chapter: `.take(50)`
 *  - topics evaluated for resources: first 20 of each chapter
 *  - topicResources: `first()` per topic (at most one formula_sheet per topic)
 */
export async function collectFormulaPacks(
  ctx: QueryCtx,
  enrolledSubjectIds: Id<"subjects">[],
  seen: Set<string>,
  limit: number,
): Promise<QueueItem[]> {
  if (enrolledSubjectIds.length === 0 || limit <= 0) return [];

  // Pre-fetch subjects for resolution chain.
  const subjectIdSlice = enrolledSubjectIds.slice(0, 5);
  const subjectRows = await Promise.all(
    subjectIdSlice.map((id) => ctx.db.get(id)),
  );
  const subjectMap = new Map<Id<"subjects">, Doc<"subjects">>();
  for (const s of subjectRows) {
    if (s) subjectMap.set(s._id, s);
  }

  const items: QueueItem[] = [];
  const dedupeKey = (kind: string, key: string) => `${kind}::${key}`;

  for (const subjId of subjectIdSlice) {
    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_subject", (q) => q.eq("subjectId", subjId))
      .take(30);

    for (const chapter of chapters) {
      const topics = await ctx.db
        .query("topics")
        .withIndex("by_chapter", (q) => q.eq("chapterId", chapter._id))
        .take(50);

      for (const topic of topics.slice(0, 20)) {
        const resource = await ctx.db
          .query("topicResources")
          .withIndex("by_topic_kind", (q) =>
            q.eq("topicId", topic._id).eq("kind", "formula_sheet"),
          )
          .first();

        if (!resource) continue;

        const key = dedupeKey("formula_pack", resource._id);
        if (seen.has(key)) continue;
        seen.add(key);

        const subject = subjectMap.get(subjId);
        if (!subject) continue;

        items.push({
          kind: "formula_pack",
          priority: 0.5,
          at: resource.updatedAt,
          title: `Formulas: ${topic.title}`,
          subtitle: `${resource.contents.length} formula${resource.contents.length === 1 ? "" : "s"} · ${subject.title}`,
          href: `/subjects/${subject.slug}/${chapter.slug}/${topic.slug}?tab=formulas`,
          subjectSlug: subject.slug,
          subjectColor: subject.color ?? null,
          count: resource.contents.length,
          topicId: topic._id,
        });

        if (items.length >= limit) return items;
      }
    }
  }

  return items;
}

// ─── Function 4: collectVocabularyDecks ──────────────────────────────────

/**
 * Collect vocabulary deck resources from enrolled subjects and build
 * QueueItems for them.
 *
 * Performs its own self-contained nested scan (subjects -> chapters ->
 * topics -> topicResources) without relying on pre-resolved maps from
 * the flashcard chain. This allows it to discover vocabulary decks for
 * subjects that have no flashcard or mistake activity.
 *
 * Uses a `seen` Set for deduplication with key format
 * `"vocabulary_deck::<resourceId>"`.
 *
 * Internal query caps:
 *  - enrolledSubjectIds: first 5 only
 *  - chapters per subject: `.take(30)`
 *  - topics per chapter: `.take(50)`
 *  - topics evaluated for resources: first 20 of each chapter
 *  - topicResources: `first()` per topic (at most one vocabulary_deck per topic)
 */
export async function collectVocabularyDecks(
  ctx: QueryCtx,
  enrolledSubjectIds: Id<"subjects">[],
  seen: Set<string>,
  limit: number,
): Promise<QueueItem[]> {
  if (enrolledSubjectIds.length === 0 || limit <= 0) return [];

  // Pre-fetch subjects for resolution chain.
  const subjectIdSlice = enrolledSubjectIds.slice(0, 5);
  const subjectRows = await Promise.all(
    subjectIdSlice.map((id) => ctx.db.get(id)),
  );
  const subjectMap = new Map<Id<"subjects">, Doc<"subjects">>();
  for (const s of subjectRows) {
    if (s) subjectMap.set(s._id, s);
  }

  const items: QueueItem[] = [];
  const dedupeKey = (kind: string, key: string) => `${kind}::${key}`;

  for (const subjId of subjectIdSlice) {
    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_subject", (q) => q.eq("subjectId", subjId))
      .take(30);

    for (const chapter of chapters) {
      const topics = await ctx.db
        .query("topics")
        .withIndex("by_chapter", (q) => q.eq("chapterId", chapter._id))
        .take(50);

      for (const topic of topics.slice(0, 20)) {
        const resource = await ctx.db
          .query("topicResources")
          .withIndex("by_topic_kind", (q) =>
            q.eq("topicId", topic._id).eq("kind", "vocabulary_deck"),
          )
          .first();

        if (!resource) continue;

        const key = dedupeKey("vocabulary_deck", resource._id);
        if (seen.has(key)) continue;
        seen.add(key);

        const subject = subjectMap.get(subjId);
        if (!subject) continue;

        items.push({
          kind: "vocabulary_deck",
          priority: 0.5,
          at: resource.updatedAt,
          title: `Vocabulary: ${topic.title}`,
          subtitle: `${resource.contents.length} term${resource.contents.length === 1 ? "" : "s"} · ${subject.title}`,
          href: `/subjects/${subject.slug}/${chapter.slug}/${topic.slug}?tab=vocabulary`,
          subjectSlug: subject.slug,
          subjectColor: subject.color ?? null,
          count: resource.contents.length,
          topicId: topic._id,
        });

        if (items.length >= limit) return items;
      }
    }
  }

  return items;
}

// ─── Constants ─────────────────────────────────────────────────────────────

export { DAY_MS };
