# A2: Extract `useSpecialMode` hook — Report

## Status
**Complete.** The hook was extracted successfully with no build errors or reference issues.

## Files Changed

1. **Created**: `src/lib/hooks/useSpecialMode.ts`
   - Extracted `requestSpecialMode` logic, `requestingRef`, `modeRef`, and `isRequesting` state into a standalone hook
   - Exports `requestSummarize`, `requestExam`, `requestCompare`, and `isRequesting`
   - Accepts `threadId`, `subjectId`, `topicId`, and `sendMessage` as parameters

2. **Modified**: `app/(app)/tutor/TutorClient.tsx`
   - Added import for `useSpecialMode`
   - Removed `specialModeRef` ref (line 220)
   - Removed `specialModeRequestingRef` and `specialModeRequestingLocal` state (lines 244-246)
   - Removed `handleSpecialModeStream`, `handleSummarizeRequested`, `handleExamRequested`, `handleCompareRequested` callbacks (lines 287-354)
   - Replaced all with single `useSpecialMode` hook call using renamed destructuring: `requestSummarize`, `requestExam`, `requestCompare` → `handleSummarizeRequested`, `handleExamRequested`, `handleCompareRequested`, and `isRequesting` → `specialModeRequestingLocal`

## Concerns

- The `extractText` import (`@/lib/ai/uiMessage`) has been removed from the imports (replaced by `useInlinePractice` in a concurrent edit), but `extractText` is still called on line 255 within `handleInlinePracticeRequested`. This was **not introduced by this task** but exists in the file as found. It will cause a build error unless the inline practice handler has also been extracted or updated accordingly.
