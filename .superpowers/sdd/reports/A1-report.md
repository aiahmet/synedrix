# A1 Report: Create `convex/_lib/plannerTypes.ts`

## What was created

Created `convex/_lib/plannerTypes.ts` with shared type definitions extracted from `convex/planner.ts`, `convex/goals.ts`, and `convex/_lib/recommendNextBest.ts`.

## Files changed

- **Created**: `convex/_lib/plannerTypes.ts` (new file, 79 lines)

## Types defined

| Type | Source | Fields |
|------|--------|--------|
| `WeeklyStats` | `planner.ts` `getPlannerOverview` return (lines 75-80) | totalMinutes, totalSessions, streakDays, goalCompletionRate |
| `EnrichedGoal` | `planner.ts` `getPlannerOverview` goals array (lines 16-27) | id, title, type, targetCount, completedCount, deadline, subjectTitle, subjectColor |
| `GoalSnapshotDaily` | `goals.ts` `getSnapshot` daily array (lines 152-160) | id, title, targetCount, completedCount, subjectTitle, subjectColor |
| `GoalSnapshotWeekly` | `goals.ts` `getSnapshot` weekly array (lines 162-171) | extends GoalSnapshotDaily with deadline |
| `EnrichedTemplate` | `planner.ts` `getPlannerOverview` templates & `listTemplates` (lines 28-38, 219-232) | id, title, description, subjectId, subjectTitle, subjectColor, intentionHint, targetMinutes |
| `OverdueTopic` | `planner.ts` `getPlannerOverview` overdueTopics (lines 61-73) | id, slug, title, subjectTitle, subjectSlug, subjectColor, chapterSlug, mastery, lastStudied, daysSinceStudy |
| `PriorityTopic` | `planner.ts` `getRecoveryPlan` priorityTopics (lines 308-319) | title, slug, subjectTitle, subjectSlug, subjectColor, chapterSlug, mastery, daysSinceStudy, reason |
| `RecoveryPlan` | `planner.ts` `getRecoveryPlan` plan (lines 303-323) | overdueCount, totalTopics, suggestedSessionMinutes, priorityTopics, narrative |

## Re-exported

- `NextBestRecommendation` from `./recommendNextBest` (to avoid duplication, matches shape in `getPlannerOverview` nextBest field)

## Self-review findings

- All interfaces use `readonly` modifiers on all fields.
- All nullable fields use `| null` consistently with the Convex schema definitions.
- `GoalSnapshotWeekly` extends `GoalSnapshotDaily` to avoid field duplication, matching the pattern where `getSnapshot` weekly items are a superset of daily items (adding `deadline`).
- `EnrichedGoal` vs `GoalSnapshotDaily` are intentionally separate types -- `EnrichedGoal` includes `type` and `deadline` directly, while `GoalSnapshotDaily` is a subset without `type`/`deadline`, matching the different Convex query return shapes.
- `NextBestRecommendation` is re-exported rather than redefined, per task instructions.
- `PriorityTopic.daysSinceStudy` is `number` (not `number | null`), matching the `getRecoveryPlan` schema where it is non-nullable -- this is a legitimate difference from `OverdueTopic.daysSinceStudy` which is `number | null`.
- File content verified by reading it back -- matches the specification exactly.

## Status

**DONE**
