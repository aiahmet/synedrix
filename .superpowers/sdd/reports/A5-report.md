# A5 Report: Split PlannerClient.tsx into separate panel files

## Status: DONE

## What was created

7 new component files under `components/planner/`:

1. **`PlannerHeader.tsx`** (37 lines) — Extracted lines 54-88. Named export `PlannerHeader`. Props: `{ stats }` with 4 numeric fields. Imports: `Calendar` from phosphor.

2. **`RecoveryPlanCard.tsx`** (65 lines) — Extracted lines 90-144. Named export `RecoveryPlanCard`. Props: `{ plan, missedDays }` preserving the complex `NonNullable<ReturnType<typeof usePreloadedQuery<...>>>` type. Imports: `Link`, `CockpitCard`, `CaretRight`/`Warning`, `resolveColorVar`, plus type-only `api` and `usePreloadedQuery`.

3. **`GoalRow.tsx`** (58 lines) — Extracted lines 277-329. Named export `GoalRow`. Props: `{ goal, onIncrement, onRemove }`. Imports: `Id` type, `Lightning`/`Trash`, `cn`.

4. **`GoalsPanel.tsx`** (143 lines) — Extracted lines 146-275. Named export `GoalsPanel`. Props: `{ goals }` with full inline type. Imports: `useState`, `useMutation`, `api`, `Id`, `CockpitCard`, `Target`/`Plus`, `cn`, `GoalRow` (sibling). Has `"use client"` (uses hooks).

5. **`NextBestPanel.tsx`** (73 lines) — Extracted lines 331-395. Named export `NextBestPanel`. Props: `{ nextBest }` with nullable inline type. Imports: `Link`, `Id`, `CockpitCard`, `Lightning`/`ChartBar`/`ArrowRight`, `resolveColorVar`.

6. **`OverdueTopicsPanel.tsx`** (75 lines) — Extracted lines 397-463. Named export `OverdueTopicsPanel`. Props: `{ topics }` with full inline Array type. Imports: `Link`, `Id`, `CockpitCard`, `ClockCounterClockwise`/`ArrowRight`, `resolveColorVar`.

7. **`SessionTemplatesPanel.tsx`** (117 lines) — Extracted lines 465-569. Named export `SessionTemplatesPanel`. Props: `{ templates }` with full inline Array type. Imports: `useState`, `useMutation`, `api`, `Id`, `CockpitCard`, `Timer`/`Plus`/`Trash`. Has `"use client"` (uses hooks).

## What was modified

- **`app/(app)/planner/PlannerClient.tsx`** — Reduced from 570 lines to 39 lines. All 7 inline function components replaced with imports from `@/components/planner/*`. Only the main `PlannerClient` export function remains.

## Self-review findings

- Every import in every file was verified as actually used (no dead imports).
- Every runtime symbol has a corresponding import (no missing imports).
- Phosphor icon import paths use `@phosphor-icons/react/dist/ssr` (no `/dist/ssr/index`).
- `"use client"` was added to `GoalsPanel.tsx` and `SessionTemplatesPanel.tsx` because they use `useState` and `useMutation` hooks. The other 5 files do not use hooks and don't need the directive (they are rendered inside PlannerClient which has it).
- The complex `RecoveryPlanCard` prop type (`NonNullable<ReturnType<typeof usePreloadedQuery<...>>>`) is preserved exactly via type-only imports of `api` and `usePreloadedQuery`.
- Line counts, prop shapes, function bodies, and rendering behavior are identical to the original inline components.
