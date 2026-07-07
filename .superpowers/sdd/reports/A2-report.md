# A2 Report: `convex/_lib/plannerHelpers.ts`

**Status:** DONE

## Files Changed

- **Created:** `convex/_lib/plannerHelpers.ts` (209 lines)

## Summary

Created `convex/_lib/plannerHelpers.ts` with four exported async helper functions, extracted and deduplicated from `convex/planner.ts` and `convex/goals.ts`:

### `computeWeeklyStats(ctx, userId, now) -> WeeklyStats`
- Fetches study sessions (`.take(100)`) and goals (`.take(50)`)
- Computes streak via `computeStreak(completedTimes, now, { timeZone: "UTC" })`
- Filters sessions from the last 7 days, computes `totalMinutes`, `totalSessions`, `goalCompletionRate`
- Caps documented: sessions ≤ 100, goals ≤ 50

### `collectOverdueTopics(ctx, userId, now, limit) -> OverdueTopic[]`
- Fetches userTopicProgress via `.take(200)`
- Filters for `lastStudied >= 3 days ago AND mastery < 0.85`
- Uses `resolveTopicChains` (batch, single call) instead of per-row `resolveTopicChain`
- Sorts by `daysSinceStudy` descending, returns `.slice(0, limit)`
- Cap documented: userTopicProgress ≤ 200

### `resolveGoalSubjects(ctx, goals) -> EnrichedGoal[]`
- Collects unique subjectIds from goals array, batch-fetches subjects via `Promise.all`
- Maps each goal to `EnrichedGoal` with `subjectTitle` and `subjectColor`
- Cap documented: subjects fetched ≤ unique subjectIds in goals

### `resolveTemplateSubjects(ctx, templates) -> EnrichedTemplate[]`
- Collects unique subjectIds from templates array (filters null/undefined), batch-fetches subjects
- Maps each template to `EnrichedTemplate` with `subjectTitle`, `subjectColor`, `intentionHint`, `targetMinutes`
- Cap documented: subjects fetched ≤ unique subjectIds in templates

## Key Design Decisions

1. **No `.collect()` calls** -- all queries use `.take(N)` with explicit caps in JSDoc, as required.
2. **Batch resolution** -- `collectOverdueTopics` uses the batch `resolveTopicChains` (single call) rather than per-row `resolveTopicChain`, fixing the N+1 pattern in the original `getPlannerOverview`.
3. **Goal subject resolution** follows the `goals.ts` pattern (unique IDs from goals) rather than the original planner.ts pattern (fetching all subjects), which is more efficient.
4. **DAY_MS constant** defined locally as `86_400_000`.
5. All four functions are self-contained and accept `ctx: QueryCtx`, making them callable from both queries and mutations.
