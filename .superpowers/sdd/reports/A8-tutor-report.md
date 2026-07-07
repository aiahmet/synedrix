# A8 Tutor Report

## Status
Complete.

## Files Changed
- `convex/schema.ts` — Added `lastMessagePreview` optional `v.string()` field to the `tutorThreads` table, after `unreadCount`. All existing indexes remain unchanged.

## Concerns
None. The field is optional, so existing rows are unaffected. The field follows the same naming and typing patterns as the adjacent denormalized fields (`lastMessageAt`, `unreadCount`). Callers that write to `tutorThreads` (e.g. `appendUserMessage`, `recordAssistantMessage`, `ensureThread`) should be updated separately to populate this field — this schema change is purely additive and backwards-compatible.
