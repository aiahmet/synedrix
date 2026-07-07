# A9 -- `lastMessagePreview` in message mutations

**Status**: Complete

**Files changed**:
- `C:\Users\Ittn\Documents\SaaS\synedrix\synedrix\convex\tutor.ts`

## Changes

### 1. `appendUserMessage` (line 589-592)

Added `lastMessagePreview: trimmed.slice(0, 200)` to the thread patch, updating the single-field patch `{ lastMessageAt: now }` to a multi-field patch.

### 2. `recordAssistantMessage` (line 634-638)

Added `lastMessagePreview: trimmed.slice(0, 200)` to the existing thread patch that already contained `lastMessageAt` and `unreadCount`.

## Concerns

None. Both mutations use the already-available `trimmed` variable (the `.trim()` of the message content), slicing to 200 characters. This avoids an extra query — the preview is written at message-insertion time, so `listThreadsForSidebar` can read it from the thread row directly without an N+1.
