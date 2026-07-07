# A8 Report: Remove `color-mix` icon wrappers per style guide

## Status: DONE

## Files Changed

1. **`components/planner/RecoveryPlanCard.tsx`**
   - Removed the `flex h-7 w-7 ... bg-[var(--color-subject-french)]/15` wrapper around `<Warning />`
   - Changed icon from `className="h-3.5 w-3.5 text-[var(--color-subject-french)]" weight="fill"` to `className="h-4 w-4 text-accent" weight="duotone"`

2. **`components/planner/OverdueTopicsPanel.tsx`**
   - Section header `ClockCounterClockwise`: `text-[var(--color-subject-french)]` -> `text-accent`
   - Count badge: `bg-[var(--color-subject-french)]/15` -> `bg-accent/10` and `text-[var(--color-subject-french)]` -> `text-accent`

3. **`components/planner/GoalRow.tsx`**
   - Delete button hover: `hover:text-[var(--color-subject-french)]` -> `hover:text-destructive`

4. **`components/planner/SessionTemplatesPanel.tsx`**
   - Delete button hover: `hover:text-[var(--color-subject-french)]` -> `hover:text-destructive`

## Files Verified (no changes needed)

5. **`components/planner/GoalsPanel.tsx`** -- Already clean. `<Target className="h-4 w-4 text-accent" weight="duotone" />` with no wrapper div.

## Verification

- Grep of `components/planner/` for `color-subject-french` returns zero matches.
- All hardcoded subject color references in these five files have been replaced with `text-accent`, `bg-accent/10`, or `hover:text-destructive` as specified.
