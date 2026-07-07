# B4 Report: Tag mode messages with `structuredContent.mode`

**Status**: Complete

## Files Changed

1.  **`app/api/tutor/chat/_lib/onFinishPipeline.ts`**
    - Added `mode?: "default" | "summarize" | "exam" | "compare"` to the `params` type in `createOnFinishHandler` signature.
    - Destructured `mode` from `params`.
    - After `parseStructuredFromText(trimmed)` succeeds, injects `mode` into the parsed object (if non-`"default"`) before `JSON.stringify`.

2.  **`app/api/tutor/chat/route.ts`**
    - Passes the already-destructured `mode` variable to `createOnFinishHandler` in the `onFinish` construction call.

## Concerns

- **None.** The change is minimal and mechanical. It does not alter any other logic in the `onFinish` pipeline (telemetry, strategy turn recording, choice-click clearing all remain untouched). The `mode` field is already destructured from `parseResult.data` in the route handler (added by B1).
