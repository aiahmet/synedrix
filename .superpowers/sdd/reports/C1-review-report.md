# C1 Review Report: Add `rescuePlans` Table to Schema

**Status:** Complete

**File Changed:**
- `C:\Users\Ittn\Documents\SaaS\synedrix\synedrix\convex\schema.ts`

**Change:**
- Added `rescuePlans` table definition after the `sessionTemplates` table (line 943) and before the closing `});` of `defineSchema`.
- Table fields: `userId` (ref `users`), `plan` (string), `priorityTopics` (array of ref `topics`), `generatedAt` (number), `expiresAt` (number).
- Indexed by `userId` via `.index("by_user", ["userId"])`.
- Trailing comma preserved to match the existing schema convention.

**Concerns:** None. The change is a straightforward schema addition following the existing patterns.
