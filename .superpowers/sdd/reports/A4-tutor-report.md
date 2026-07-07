# A4: Extract `useAutoRetry` hook from TutorClient

**Status**: Complete

## Files Changed

1. **Created**: `src/lib/hooks/useAutoRetry.ts`
   - New extracted hook that auto-retries once when the AI stream errors.
   - Watches `status`, calls `regenerate()` once on first `"error"` state, resets the guard on `"ready"`.

2. **Modified**: `app/(app)/tutor/TutorClient.tsx`
   - Added import `import { useAutoRetry } from "@/lib/hooks/useAutoRetry";`
   - Replaced the inline auto-retry effect (11 lines with `useRef` + `useEffect`) with single call: `useAutoRetry(status, wrappedRegenerate);`
   - Both `useEffect` and `useRef` imports retained (still used by `useEnsureThread`, `useMarkThreadReadOnFocus`, keyboard shortcut handler, composer ref, practice/special-mode request guards).

## Concerns

- None. The extracted hook is a pure mechanical extraction with identical behavior. No logic changes were made.
