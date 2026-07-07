# A5 Review Report — Split ReviewCenterClient.tsx

**Status**: Complete

## Files Created

| File | Lines | Notes |
|------|-------|-------|
| `components/review/types.ts` | 37 | Shared types, `resolveTone`, `kindMeta` with English labels |
| `components/review/RescuePlanButton.tsx` | 59 | Client component with useState/useCallback for rescue plan fetch |
| `components/review/ReviewHeader.tsx` | 37 | Server component (no "use client"), renders RescuePlanButton |
| `components/review/ReviewSection.tsx` | 26 | Server component, maps items to ReviewQueueCard |
| `components/review/ReviewQueueCard.tsx` | 61 | Client component (Link), renders individual queue item card |
| `components/review/EmptyState.tsx` | 47 | Client component (Link), English empty state with CTA |

## Files Modified

| File | Lines (was → now) | Notes |
|------|-------------------|-------|
| `app/(app)/review/ReviewCenterClient.tsx` | 283 → 63 | Stripped inline components, now imports from `@/components/review/*` |

## Key Changes

1. **Pure extraction** — no logic was changed, only relocated.
2. **English labels** applied per A7: German labels (`"Karteikarten-Wiederholung"`, `"Überfällig"`, `"Rettungsplan erstellen"`, etc.) replaced with English equivalents (`"Flashcard review"`, `"Overdue"`, `"Generate rescue plan"`, etc.).
3. **Label mapping alignment**: kindMeta labels changed to match the section labels for consistency.

## Concerns

- The `"use client"` directives are set per the task spec: `ReviewSection.tsx` and `ReviewHeader.tsx` are server components (no hooks/events), while `ReviewQueueCard.tsx`, `RescuePlanButton.tsx`, and `EmptyState.tsx` are client components due to `Link` usage or `useState`/`useCallback`.
- Build should be verified via `npm run typecheck` to ensure import paths resolve correctly.
