# A4 Report: Use `resolveTopicChains` (batch) instead of per-row lookups in `getRecoveryPlan`

## Status: DONE

## Files Changed

- `C:\Users\Ittn\Documents\SaaS\synedrix\synedrix\convex\planner.ts`

## Summary

The `getRecoveryPlan` handler was refactored to eliminate the N+1 pattern with manual map-building:

### Import added (line 4)
```ts
import { resolveTopicChains } from "./_lib/topicChain";
```

### Inline replacement (lines 253-297)
- **Removed**: 3 unbounded `.collect()` queries (`allTopics`, `chapters`, `subjects`) and their `Promise.all` wrapper
- **Removed**: Manual map-building (`chapterMap`, `subjectMap`, `topicChapterMap`)
- **Removed**: Per-row `.find()` lookups in the `.map()` callback
- **Capped**: `allProgress` query to `.take(200)` instead of `.collect()`
- **Added**: `candidateProgress` intermediate variable for filter/sort/slice before resolution
- **Added**: `resolveTopicChains(ctx, candidateIds)` for a single batch-resolve call
- **Added**: `.filter()` on the final map to discard null results from broken chains
- **Preserved**: `Doc` import (still used in `listTemplates`), filter/sort/slice logic, narrative/computation

## Concerns

None. The refactor is a direct swap: same filter/sort/slice logic, same return shape, same narrative generation — just batch-resolved via `resolveTopicChains` instead of unbounded collects + manual maps.
