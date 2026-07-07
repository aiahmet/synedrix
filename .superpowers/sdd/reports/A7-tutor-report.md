# A7 — Extract pipeline modules from `app/api/tutor/chat/route.ts`

**Status:** Complete

## Summary

The monolithic 605-line `route.ts` has been decomposed into 5 focused modules under `app/api/tutor/chat/_lib/`. The route handler is now a thin orchestrator (~190 lines including schema/JSDoc) that delegates each concern to a dedicated helper.

## Files created

| File | Lines | Purpose |
|------|-------|---------|
| `app/api/tutor/chat/_lib/authMiddleware.ts` | 23 | Clerk auth verification + Convex HTTP client setup |
| `app/api/tutor/chat/_lib/contextLoader.ts` | 169 | Parallel fan-out: context, profile, message persistence, strategy state, memory chronicle |
| `app/api/tutor/chat/_lib/promptBuilder.ts` | 216 | System prompt assembly (grounded prompt + strategy block) |
| `app/api/tutor/chat/_lib/onFinishPipeline.ts` | 212 | Stream completion handler: persist message, log telemetry, record strategy turn |
| `app/api/tutor/chat/_lib/modeInstructions.ts` | 30 | Stub functions for exam/compare/summarize modes (for Phase B2) |

## Files modified

| File | Before | After | Notes |
|------|--------|-------|-------|
| `app/api/tutor/chat/route.ts` | 605 lines | 190 lines | Thin orchestrator; all logic delegates to `_lib/` imports |

## Key changes

1. **`authMiddleware.ts`** — pure extraction of the Clerk auth + ConvexHttpClient pattern (original lines 113-127). Returns a discriminated union `{ userId, convex } | Response`.

2. **`contextLoader.ts`** — pure extraction of the parallel fan-out (original lines 148-286). Defines `ChatContext` and `ContextResult` types explicitly (could not use `typeof convex.query<...>` outside the handler closure). Returns `{ kind: "ok", context, strat, memoryChronicle } | { kind: "error", response }`.

3. **`promptBuilder.ts`** — extraction of active-learning-nudge computation, `buildChatSystemPrompt` call, and `buildStrategyPromptBlock` call (original lines 307-415). `deriveWorkingLanguage` moved here from route.ts. The nudge is computed from `strat` internally and forwarded to the strategy block.

4. **`onFinishPipeline.ts`** — extraction of the `onFinish` callback (original lines 430-489). `parseStructuredFromText` moved here from route.ts. The nudge for `clearLatestChoiceClick` is recomputed from `strat` rather than received externally — this duplicates the computation in `promptBuilder.ts` but keeps the concerns independent and avoids passing intermediate state through the route handler.

5. **`modeInstructions.ts`** — three stub functions (`buildExamInstructions`, `buildCompareInstructions`, `buildSummarizeInstructions`) returning empty strings, ready for Phase B2.

## Concerns

- **Duplicate nudge computation**: The `activeLearningNudge` logic (check `latestChoiceMessageId`, `latestChoiceResponseTimeMs`, `latestChoicePickedCorrect` thresholds) is computed independently in both `promptBuilder.ts` (for the strategy block's `latestChoice` option) and `onFinishPipeline.ts` (for `clearLatestChoiceClick`). This is intentional per the spec to keep the route handler stateless, but introduces a maintenance hazard if the nudge thresholds change. Could be refactored into a shared utility if the logic grows more complex.
- **`ChatContext` type duplication**: The shape of the `getContextForChat` return value is now hardcoded as `ChatContext` in `contextLoader.ts` instead of being derived from the Convex query via `typeof convex.query<typeof api.tutor.getContextForChat>`. This type must be manually kept in sync with the Convex schema.
- **External behavior unchanged**: All variable names, control flow, error messages, and side effects have been preserved exactly. No logic was modified.
- **Branch status**: Changes are on `main` — no branch was created for this work.
