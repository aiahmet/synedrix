# A6 Review Report — Replace `color-mix` icon containers with native-sized icons

**Status:** Done

## Files changed

1. **`components/review/ReviewQueueCard.tsx`**
   - Removed the `color-mix` background `span` wrapper around the `<Icon>` component.
   - Replaced with `<Icon>` directly, using `style={{ color: accentTone ?? "var(--accent)" }}`.
   - Removed `aria-hidden` (no longer needed without the wrapper span).
   - Kept `shrink-0` on the icon to preserve layout.

2. **`components/review/EmptyState.tsx`**
   - Removed the `color-mix` background `span` wrapper around `<ClockCounterClockwise>`.
   - Replaced with `<ClockCounterClockwise className="mx-auto h-5 w-5 text-accent">` directly.
   - Replaced the double-bezel card `div` with `<CockpitCard>` wrapping a flex-centered content div.
   - Restructured spacing: replaced `mt-4`/`mt-1` margins with flex `gap-3` on the parent.
   - Added import: `import { CockpitCard } from "@/components/dashboard/CockpitCard"`.

## Concerns

- `resolveTone` import in `ReviewQueueCard.tsx` is still used (line 5) — it's referenced by `item.subjectColor` resolution above the changed block, so it stays.
- No logic, labels, or props were changed in either file.
