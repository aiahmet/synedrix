# A2 Review Report: `convex/_lib/reviewHelpers.ts`

**Status:** DONE

## Files Changed

- **Created:** `convex/_lib/reviewHelpers.ts` (419 lines)

## Summary

Created `convex/_lib/reviewHelpers.ts` with four exported async helper functions extracted from the patterns in `convex/reviewCenter.ts`:

### Function 1: `resolveFlashcardReviewChains(ctx, overdueReviews, dueTodayReviews)`

Batch-resolves the full flashcard -> deck -> topic -> chapter -> subject chain. Uses `Promise.all` with `ctx.db.get()` at each level (no `.collect()`), deduplicating IDs via Sets. Returns all five maps, a `resolveTopicPath` closure, and per-deck counts (`overdueByDeck`, `dueTodayByDeck`).

- Extracted from `reviewCenter.ts` lines 97-178 (resolution chain) + lines 208-225 (per-deck counts)
- Flashcard caps: caller-limited at 100 per input array; internal fetch bounded by unique flashcard IDs

### Function 2: `resolveMistakeReviewChains(ctx, overdueMistakes, dueTodayMistakes, topicMap, resolveTopicPath)`

Accepts the `topicMap` from `resolveFlashcardReviewChains` and extends it with any topic IDs not already present. Returns per-topic counts (`overdueByTopic`, `dueTodayByTopic`).

- Extracted from `reviewCenter.ts` lines 226-241
- Only fetches topics not already in the supplied map (avoids redundant reads)

### Function 3: `collectFormulaPacks(ctx, enrolledSubjectIds, seen, limit)`

Self-contained nested scan discovering formula sheet resources. Pre-fetches subjects into a map, then iterates subjects -> chapters -> topics -> topicResources (kind: `formula_sheet`). Deduplicates via the `seen` Set. Returns `QueueItem[]` capped at `limit`.

- Extracted from `reviewCenter.ts` lines 407-464
- Internal caps: 5 subjects, 30 chapters/subject, 50 topics/chapter, 20 topics evaluated

### Function 4: `collectVocabularyDecks(ctx, enrolledSubjectIds, seen, limit)`

Same pattern as `collectFormulaPacks` but for `kind: "vocabulary_deck"`. Self-contained nested scan with pre-fetched subject map.

- Extracted from `reviewCenter.ts` lines 466-522
- Internal caps: same as collectFormulaPacks

### Constants

- `DAY_MS` exported (86_400_000)

## Key Design Decisions

1. **No `.collect()` calls** -- all queries use `.take(N)` with explicit caps documented in JSDoc.
2. **Self-contained nested scans** -- `collectFormulaPacks` and `collectVocabularyDecks` do their own queries rather than accepting pre-resolved maps, allowing them to discover resources for subjects without flashcard/mistake activity.
3. **Pre-fetched subject maps** -- both nested scan functions pre-fetch subjects into a `Map<Id<"subjects">, Doc<"subjects">>` to avoid repeated `ctx.db.get(subjId)` calls in inner loops.
4. **`resolveTopicPath` closure** -- captures `chapterMap` and `subjectMap` from the resolution chain, matching the existing reviewCenter.ts pattern (lines 180-188).
5. **Extensible topic map** -- `resolveMistakeReviewChains` accepts and extends the existing `topicMap`, avoiding redundant fetches for topics already resolved by the flashcard chain.

## Concerns

- The `resolveTopicPath` parameter type in `resolveMistakeReviewChains` has a function type that must match the closure returned by `resolveFlashcardReviewChains`. Callers must pass the same function instance to stay in sync with the maps -- passing a stale one would produce incorrect lookups.
- `collectFormulaPacks` and `collectVocabularyDecks` pattern-match closely; if the topicResources schema changes, both functions need updating in parallel.
