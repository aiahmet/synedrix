# A3 Tutor Report: Extract `useInlinePractice` hook

## Status

**Complete**

## Files Changed

1. **Created**: `src/lib/hooks/useInlinePractice.ts`
   - Extracted the `useInlinePractice` hook with `request` and `isRequesting` return values
   - Internal state uses `requestingRef` (ref-based guard) and `isRequesting` (react state)

2. **Modified**: `app/(app)/tutor/TutorClient.tsx`
   - Replaced `import { extractText } from "@/lib/ai/uiMessage"` with `import { useInlinePractice } from "@/lib/hooks/useInlinePractice"`
   - Removed the old `inlinePracticeRequestingRef`, `inlinePracticeRequestingLocal` useState, and the `handleInlinePracticeRequested` useCallback
   - Added `useInlinePractice` hook call after `useAutoRetry` (and after `useChat`, which it depends on for `messages`)

## Concerns

- No concerns. The extraction is clean and matches the specification exactly. The hook is placed after `useChat` (as required, since it depends on `messages`).
- Note: The file uses CRLF line endings, which caused the Edit tool to fail matching the old text. The replacement was applied via Node.js with explicit CRLF line endings.
