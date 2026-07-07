# A3 Report: Refactor `getPlannerOverview` to use A2 helpers

## Status: DONE

## Changes made

**File**: `C:\Users\Ittn\Documents\SaaS\synedrix\synedrix\convex/planner.ts`

### Imports (lines 5-8)
- Added imports for the 4 A2 helpers: `computeWeeklyStats`, `collectOverdueTopics`, `resolveGoalSubjects`, `resolveTemplateSubjects` from `./_lib/plannerHelpers`
- Added type imports (`WeeklyStats`, `EnrichedGoal`, `EnrichedTemplate`, `OverdueTopic`) from `./_lib/plannerTypes`
- Removed `resolveTopicChain` import (no longer used — logic moved into `collectOverdueTopics`)
- Kept `computeStreak` import (still used by `getRecoveryPlan`)
- Cleaned up `recommendNextBest` import to single-line style

### Handler body (lines 81-115)
Replaced the ~130-line inline handler with ~30 lines of orchestration:

1. **Goals query**: changed from `.collect()` to `.take(50)` with cap pattern
2. **Templates query**: changed from `.collect()` to `.take(50)` with cap pattern
3. **Weekly stats**: replaced inline session query + streak computation + week filtering + goal rate calc with `computeWeeklyStats(ctx, user._id, now)`
4. **Overdue topics**: replaced inline progress loop + `resolveTopicChain` per-row calls + subject resolution with `collectOverdueTopics(ctx, user._id, now, 10)`
5. **Goal subject enrichment**: replaced inline `subjects.collect()` + map build + per-goal map lookup with `resolveGoalSubjects(ctx, goals)`
6. **Template subject enrichment**: replaced inline template subject ID collection + batch get + map build + per-template map lookup with `resolveTemplateSubjects(ctx, templates)`
7. **`recommendNextBest`**: moved into the parallel `Promise.all` array alongside the other queries

### What was preserved
- `v.object(...)` return type declaration (lines 13-80) — **unchanged**
- `DAY_MS` constant (still used by `getRecoveryPlan`)
- All other handlers (`listTemplates`, `createTemplate`, `removeTemplate`, `getRecoveryPlan`) — **unchanged**
- Early-return empty state when no user found

## Verification
- Return shape is identical (inline `v.object(...)` was not touched)
- All 4 A2 helpers are imported and called
- `computeStreak` is still imported and used by `getRecoveryPlan`
- `resolveTopicChain` was removed as import (no longer used anywhere in the file)
