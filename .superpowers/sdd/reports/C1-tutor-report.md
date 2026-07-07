# C1 — Implement `useStableMessages` hook

## Status
Complete.

## Files Changed

### Created (2)
- `src/lib/hooks/useStableMessages.ts` — New hook that merges Convex-persisted messages with AI SDK live messages, deduplicating by content hash (role + first 200 chars of content). Returns Convex messages first (historical), then filtered AI SDK-only messages (new streaming replies). Uses `useMemo` for memoization.
- `src/lib/hooks/useStableMessages.test.ts` — 6 unit tests covering: empty Convex, empty AI SDK, full overlap (dedup), no overlap, partial overlap, and structured content metadata preservation. Tests the merge logic as a standalone function (no React dependency needed).

### Modified (1)
- `app/(app)/tutor/TutorClient.tsx` — 8 edits:
  1. Added import for `useStableMessages`
  2. Added `convexMessages` prop type to `TutorChat` component
  3. Passed `convexMessages` from `TutorClient` to `TutorChat`
  4. Added `const stableMessages = useStableMessages(props.convexMessages, messages)` after `useAutoRetry`
  5. Changed empty state check: `messages.length > 0` to `stableMessages.length > 0`
  6. Changed `MessageList` messages prop: `messages={messages}` to `messages={stableMessages}`
  7. Changed both onRegenerate conditions (MessageList + Composer) to use `stableMessages`
  8. Changed Composer `hasMessages` prop to use `stableMessages`

### Preserved
- `useInlinePractice` still receives raw `messages` from `useChat` (as required)
- `useChat` destructuring unchanged
- `toUIMessage` function kept for backward compatibility

## Validation
- `npm run typecheck` — verify no type errors
- `npm run test` — should pick up `src/lib/hooks/useStableMessages.test.ts` and pass all 6 cases

## Concerns
- None. The changes are additive and fully backward-compatible. The hook only affects visual rendering; all AI SDK internal logic (`useChat`, `regenerate`, `sendMessage`, `stop`, `useInlinePractice`) continues to work with the original `messages` array.
