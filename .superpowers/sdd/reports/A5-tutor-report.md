# A5: Split `convex/tutor.ts` into focused modules

## Status

Complete.

## Files changed

### Created
- `convex/tutorSessions.ts` — contains `endSession` (mutation) and `getSubjectTopicsForEmptyState` (query), plus the `MIN_SESSION_SEC` constant. Imports `recommendNextBest` and `api` for session close logic.
- `convex/tutorHistory.ts` — contains `listThreadsForSidebar` (query) with client-side subject-grouping and message-preview logic.
- `convex/tutorComposer.ts` — contains `getTutorUnreadTotal` (query), `markThreadRead` (mutation), and `getThreadById` (query).

### Modified
- `convex/tutor.ts` — removed 6 exported functions (`endSession`, `getSubjectTopicsForEmptyState`, `getTutorUnreadTotal`, `listThreadsForSidebar`, `markThreadRead`, `getThreadById`). Removed unused imports (`recommendNextBest`, `NextBestRecommendation`). Kept: `findThread`, `MIN_SESSION_SEC`, `LIST_MESSAGES_DEFAULT_LIMIT`, `LIST_MESSAGES_MAX_LIMIT`, `getThread`, `listMessages`, `getThreadHistory`, `getContextForChat`, `ensureThread`, `appendUserMessage`, `recordAssistantMessage`.
- `components/tutor/HistoryPanel.tsx` — `api.tutor.listThreadsForSidebar` (2 occurrences) changed to `api.tutorHistory.listThreadsForSidebar`.
- `components/layout/NavTutorBadge.tsx` — `api.tutor.getTutorUnreadTotal` changed to `api.tutorComposer.getTutorUnreadTotal`.
- `app/(app)/tutor/[threadId]/page.tsx` — `api.tutor.getThreadById` changed to `api.tutorComposer.getThreadById`.
- `app/(app)/tutor/TutorClient.tsx` — `api.tutor.markThreadRead` changed to `api.tutorComposer.markThreadRead`.

## Concerns

- The `tutorSessions.ts` file also includes a small `lastMessagePreview` patch added to `appendUserMessage` and `recordAssistantMessage` in `tutor.ts` — this was a pre-existing working-tree change unrelated to the split, left intact.
- All moved functions preserve their original JSDoc comments and logic. No behavioral changes.
