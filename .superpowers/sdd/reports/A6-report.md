# A6 Report: Extract mutation hooks into `components/planner/hooks.ts`

## Summary

Created `components/planner/hooks.ts` with two custom hooks that encapsulate the mutation + form state patterns extracted from `PlannerClient.tsx`.

## What was created

- **`components/planner/hooks.ts`** — contains:
  - `EnrichedGoal` type (mirrors the goal shape from `api.planner.getPlannerOverview` query return)
  - `EnrichedTemplate` type (mirrors the template shape from the same query)
  - `useGoalsManager(initialGoals)` — manages:
    - Local `goals` state initialized from `initialGoals`
    - `createGoal({ title, type, targetCount? })` — calls `api.goals.create`, optimistic add, rollback on error
    - `incrementGoal(goalId)` — calls `api.goals.increment`, optimistic increment, rollback on error
    - `removeGoal(goalId)` — calls `api.goals.remove`, optimistic remove, rollback on error
    - `isCreating` flag set true during create mutation
  - `useTemplatesManager(initialTemplates)` — manages:
    - Local `templates` state initialized from `initialTemplates`
    - `createTemplate({ title, targetMinutes? })` — calls `api.planner.createTemplate`, optimistic add, rollback on error
    - `removeTemplate(templateId)` — calls `api.planner.removeTemplate`, optimistic remove, rollback on error
    - `isCreating` flag set true during create mutation

## Key design decisions

1. **Optimistic updates with error rollback**: Both hooks optimistically update local state before the mutation completes, and roll back on failure by either filtering out optimistic entries or restoring a pre-mutation snapshot.

2. **Sync with Convex reactivity**: A `useEffect` syncs local state back to the incoming `initialGoals`/`initialTemplates` when no mutation is in flight (tracked via `isMutatingRef`). This ensures that after a mutation succeeds, the reactive Convex query data takes over correctly.

3. **`isMutatingRef`**: A ref (not state) tracks whether any mutation is in progress, avoiding unnecessary re-renders and preventing the sync effect from overwriting optimistic state.

4. **`crypto.randomUUID()`**: Used to generate unique optimistic IDs (`__opt_<uuid>`) that are easily identifiable for rollback filtering.

5. **Snapshot-based rollback for remove**: Captures a closure snapshot of state before removal, then restores it on error. This is safe because mutations are serialized via the ref guard.

## Mutation argument alignment

- `createGoal` accepts `{ title, type, targetCount? }` matching the subset used by the GoalsPanel form. The Convex mutation also accepts `subjectId` and `deadline` — these can be added later.
- `createTemplate` accepts `{ title, targetMinutes? }` matching the SessionTemplatesPanel form. The Convex mutation also accepts `description`, `subjectId`, `intentionHint` — these can be added later.

## Files changed

- Created: `C:\Users\Ittn\Documents\SaaS\synedrix\synedrix\components\planner\hooks.ts`

## Test strategy

1. **TypeScript**: Run `npm run typecheck` to verify types resolve correctly against the Convex generated types and the mutation signatures.
2. **Manual test**: In `PlannerClient.tsx`, import `useGoalsManager` and `useTemplatesManager` from the new hooks file, then wire them into the GoalsPanel and SessionTemplatesPanel respectively. Verify:
   - Creating a goal/template adds it to the UI immediately and persists to the backend.
   - Incrementing a goal shows the check mark immediately.
   - Removing a goal/template removes it from the UI immediately.
   - `isCreating` disables the submit button while the mutation is in flight.
3. **Error simulation**: Temporarily break the Convex mutation (e.g., unauthenticate) to verify rollbacks work correctly for all three operations (create, increment, remove).
4. **Edge case**: Rapid consecutive creates — verify each gets a unique optimistic ID and the list stays consistent.

## Self-review findings

1. **Snapshot staleness risk**: The `removeGoal` and `removeTemplate` rollback captures `snapshot = goals` at call time. If state were updated between the snapshot and the rollback (e.g., by a concurrent mutation), the snapshot could be stale. This is mitigated by the `isMutatingRef` guard which serializes mutations — no two mutations can run concurrently.

2. **No `useCallback` wrapping**: The returned functions (`createGoal`, `incrementGoal`, etc.) are recreated on every render. If these are passed as props to child components, they should be wrapped with `useCallback`. Not an issue for the current usage pattern where callbacks are used inline, but worth noting for future refactoring.

3. **Argument subset**: The hooks expose a subset of the full Convex mutation arguments. If a future consumer needs `subjectId` or `deadline` on createGoal, or `description`/`subjectId`/`intentionHint` on createTemplate, the hooks would need to be extended.

4. **No loading state for increment/remove**: Only `isCreating` is exposed. `incrementGoal` and `removeGoal` have no dedicated loading state — the consumer trusts the optimistic update is sufficient. This matches the existing UI pattern where these operations are instantaneous from the user's perspective.

## Status

**DONE**
