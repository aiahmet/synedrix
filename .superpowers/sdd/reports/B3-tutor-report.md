# B3 — Wire mode instructions into the prompt builder

**Status:** Complete

## Files changed

1. **`app/api/tutor/chat/_lib/promptBuilder.ts`**
   - Added import of `buildExamInstructions`, `buildCompareInstructions`, `buildSummarizeInstructions` from `./modeInstructions` (B2).
   - Extended `buildFullSystemPrompt` params with `mode?: "default" | "summarize" | "exam" | "compare"` and `modeOptions?: { taskCount?: number }`.
   - After building the standard system prompt + strategy block, appends the mode-specific instruction block when `params.mode` is set and not `"default"`. Each case constructs the appropriate context object from `ChatContext` (subject, topic, mastery, confidence, objectives, recent mistakes, tutor profile) with sensible defaults for fields not available in `ChatContext` (empty arrays for `history`/`relatedTopics`/`siblingTopics`, `0` for `messageCount`).
   - Returns the combined `fullSystemPrompt` string (unchanged return type).

2. **`app/api/tutor/chat/route.ts`**
   - Passes `mode` and `modeOptions` (already destructured from the Zod-validated request body) to `buildFullSystemPrompt`.
   - Conditionally sets `maxOutputTokens` in the `streamText` call: 2500 for exam, 2000 for compare/summarize, 1500 default.

## Concerns

- `relatedTopics`, `siblingTopics`, and `history` are supplied as empty arrays because `ChatContext` does not carry this data. If richer context is needed (e.g., exam mode listing related topics, compare mode listing sibling topics), those fields would need to be loaded in `contextLoader.ts` and passed through.
- `messageCount` for summarize mode is hardcoded to `0` — the actual count isn't available at prompt-build time. The mode builder falls back to `"(no conversation history)"` in its history block, so the output is degraded but not broken.
- No TypeScript errors introduced by these changes. The single pre-existing error in `route.ts:192` (onFinish callback type mismatch against the AI SDK) is unrelated.
