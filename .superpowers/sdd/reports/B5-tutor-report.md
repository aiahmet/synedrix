# B5 Report: Remove useSpecialMode (dead code)

**Status**: Completed

## Files Changed

1. **Deleted** `src/lib/hooks/useSpecialMode.ts` — entire file removed (dead code after unified pipeline).

2. **Modified** `app/(app)/tutor/TutorClient.tsx`:
   - Removed `import { useSpecialMode } from "@/lib/hooks/useSpecialMode";` (line 18)
   - Removed the `useSpecialMode(...)` hook call and destructuring (lines 252-262)
   - Removed `onSummarizeRequested`, `onExamRequested`, `onCompareRequested` props from the `<Composer>` JSX
   - Replaced `isRequestingSpecialMode={specialModeRequestingLocal}` with `isRequestingSpecialMode={false}`

## Concerns

None. The deleted hook's exported functions (`requestSummarize`, `requestExam`, `requestCompare`, `isRequesting`) were only consumed in `TutorClient.tsx`. The Composer component already declares the removed props as optional (`?:`), so no type errors arise from their removal.
