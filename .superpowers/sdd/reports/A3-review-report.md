# A3 Report: Refactor `getReviewQueue` to use helpers from A2

**Status:** Complete

**File changed:** `C:\Users\Ittn\Documents\SaaS\synedrix\synedrix\convex\reviewCenter.ts`

## Changes Made

1. **Added imports** for the four A2 helpers (`resolveFlashcardReviewChains`, `resolveMistakeReviewChains`, `collectFormulaPacks`, `collectVocabularyDecks` from `./_lib/reviewHelpers`), `resolveTopicChains` from `./_lib/topicChain`, and `QueueItem`/`QueueHeader` types from `./_lib/reviewTypes`.

2. **Removed constants** `TOPIC_BATCH` (300) and `CH_BATCH` (100) -- no longer used since the inline formula/vocab scan was replaced with helper calls.

3. **Removed inline resolution chain** (~80 lines of per-level batch-fetch: `flashcardIds` -> `flashcardMap`, `deckIds` -> `deckMap`, `topicIds` -> `topicMap`, `chapterIds` -> `chapterMap`, `subjectIds` -> `subjectMap`, plus the `resolveTopicPath` closure). This is now handled by `resolveFlashcardReviewChains`.

4. **Removed inline deduped counting** (~35 lines: `overdueFlashcardsByDeck`, `dueTodayFlashcardsByDeck`, `overdueMistakesByTopic`, `dueTodayMistakesByTopic`). Counts are now returned by `resolveFlashcardReviewChains` (overdueByDeck, dueTodayByDeck) and `resolveMistakeReviewChains` (overdueByTopic, dueTodayByTopic).

5. **Removed inline `type QueueItem`** (lines 190-201) -- now imported from `reviewTypes`.

6. **Replaced inline formula/vocab nested scan** (~120 lines) with two-liner `collectFormulaPacks` + `collectVocabularyDecks` calls.

7. **Replaced weak topic N+1 loop** (per-row `ctx.db.get()` for topic, chapter, subject) with batch `resolveTopicChains(ctx, weakIds)` call.

8. **Reduced query caps**: `.take(200)` -> `.take(100)` for flashcard/mistake queries; `.collect()` -> `.take(500)` for progress query; `.slice(0, 8)` -> `.slice(0, 6)` for weak candidates.

9. **Kept unchanged**: `resolveUser`, `emptyQueue`, return type `v.object(...)` declaration, inline flashcard/mistake item building loops.

## Concerns

- `QueueHeader` is imported but never used in this file. The task instructions explicitly requested the import; it was kept as specified despite being unused.
