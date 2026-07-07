# C2/C3 Report: `listThreadsForSidebar` optimization

**Status:** Both tasks complete.

## C3 — Cap thread count

Already in place before this task. `.take(100)` on the `by_user` index scan (line 47) with a JSDoc comment on line 43: `// Cap at 100 threads for sidebar rendering.`

## C2 — Switch to denormalized `lastMessagePreview`

Removed the N+1 sub-query pattern:

- **Removed:** `previewRows` array (one `tutorMessages` query per thread via `Promise.all`)
- **Removed:** `previewByThread` Map building loop
- **Replaced `last?.content` with `t.lastMessagePreview ?? null`** (line 80) — reads the denormalized field written by `appendUserMessage` and `recordAssistantMessage` in `convex/tutor.ts`
- **Replaced `last?.createdAt ?? t._creationTime` with `t._creationTime`** (line 79) — since `lastMessageAt` on the thread row already reflects the last message time; the fallback to thread creation time is sufficient.

## File changed

`convex/tutorHistory.ts` — single file, no other files affected.

## Concerns

None. The denormalized field (`lastMessagePreview`) is confirmed present in `convex/schema.ts` (line 614, `v.optional(v.string())`) and written by both write paths in `convex/tutor.ts` (lines 660, 713). The query is now a single indexed scan with zero sub-queries — O(1) instead of O(N+1) for the preview resolution.
