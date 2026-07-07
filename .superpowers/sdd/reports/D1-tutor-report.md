# D1 Report: Tutor `collect()` Cap

## Status

**Complete.** All 13 specified `.collect()` calls were replaced with `.take(N)`.

## Files Modified

| File | Change |
|---|---|
| `convex/tutorModes.ts` | `getSummarizeContext` messages `.take(200)`; `getExamContext` messages `.take(200)`, mistakes `.take(50)`, sibling topics `.take(20)`; `getCompareContext` messages `.take(200)`, sibling topics `.take(20)`. Added JSDoc on each query. |
| `convex/tutorPatterns.ts` | `detect` allMistakes `.take(500)` |
| `convex/tutorMemory.ts` | `getMemoryChronicle` allSessions `.take(50)` |
| `convex/tutorHistory.ts` | `listThreadsForSidebar` threads `.take(100)` |
| `convex/tutor.ts` | `findThread` `.take(500)`; `getThreadHistory` `.take(500)`; `getContextForChat` topicMistakes `.take(500)`; `ensureThread` allTopicMistakes `.take(500)` |

## Verification

A final grep across `convex/tutor*.ts` confirms 0 remaining `.collect()` calls in the cap-table target functions and 0 in `convex/tutor.ts`.

## Notes / Concerns

1. **`getSummarizeContext` messages**. The original code showed `messageCount: messages.length` in the return value, which would now report at most 200. This is a minor behavioral change but well within expectations (you don't need to summarize more than 200 messages).

2. **`findThread` in `convex/tutor.ts`** was given `.take(500)` as a safety cap. The `by_user_subject` compound index typically returns 1-2 candidates, so the 500 limit is purely a guard. However, if a user somehow accumulated more than 500 threads for the same (userId, subjectId) pair (very unlikely given typical usage), the correct match could be missed. This is acceptable as a safety boundary.

3. **Out-of-scope remaining `.collect()` calls**. Several other tutor modules still use unbounded `.collect()`:
   - `convex/tutorContext.ts` (3 calls)
   - `convex/tutorComposer.ts` (1 call)
   - `convex/tutorPractice.ts` (3 calls)
   - `convex/tutorSessions.ts` (3 calls)
   - `convex/tutorSignals.ts` (1 call)
   These were not listed in the D1 cap table and were left unchanged.

4. **`getExamContext` and `getCompareContext` sibling queries**. The `allProgress` / `siblingProgress` collect on `userTopicProgress` (by user) remains uncapped in both functions. These were not in the cap table. They could return a large number of rows for users with extensive progress history.
