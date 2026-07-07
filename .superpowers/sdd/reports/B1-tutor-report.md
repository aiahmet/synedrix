# B1: Add `mode` and `modeOptions` to chat request schema

## Status

Complete.

## Files changed

- `app/api/tutor/chat/route.ts` — two edits:
  1. Added `mode` (`z.enum(["default", "summarize", "exam", "compare"]).optional()`) and `modeOptions` (`z.object({ taskCount: z.number().min(1).max(8).optional() }).optional()`) to the `chatRequestSchema` Zod object.
  2. Added `mode` and `modeOptions` to the destructuring of `parseResult.data`.

## Concerns

None. Both fields are optional and backward-compatible — existing callers that omit them will continue to work unchanged. The `mode` enum covers the current set of special modes (`default`, `summarize`, `exam`, `compare`) and can be extended later. `modeOptions.taskCount` is constrained to 1-8 to match expected exam-generation limits.
