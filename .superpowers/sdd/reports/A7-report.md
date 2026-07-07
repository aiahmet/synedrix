# A7 Report: Simplify PlannerHeader Stat Strip

**Status:** DONE

## Files Changed

- `C:\Users\Ittn\Documents\SaaS\synedrix\synedrix\components\planner\PlannerHeader.tsx`

## Summary

Replaced the "carded-box" layout in `PlannerHeader` with a plain typography row per the style guide.

**Removed:**
- `statItems` array
- Bordered `bg-surface-elevated` carded boxes with uppercase labels
- German locale strings (`"Diese Woche"`, `"Min."`, `"Sitzungen"`, `"Tage"`, `"in Folge"`, `"Zielquote"`, `"erreicht"`)

**Replaced with:**
- Inline typography row using `<span>` elements separated by `·` middot dividers
- Stats formatted as: `{totalMinutes}m` with "this week · {totalSessions} sessions" subtitle, `{streakDays}d` with "streak" subtitle, `{goalCompletionRate}%` with "goals done" subtitle
- English locale for consistency with the rest of the codebase
- No borders, no elevated surfaces — pure typography hierarchy (`tabular-nums` for values, `text-muted-foreground` for labels)

## Concerns

None.
