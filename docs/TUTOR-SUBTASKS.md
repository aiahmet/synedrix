# Tutor Improvement Subtasks

> 28 subtasks across 4 phases. Each is self-contained with concrete inputs, outputs, and a validation command.

---

## Dependency Graph

```
Phase A (Refactor):
A1 ─┬─ A2
    ├─ A3
    ├─ A4
    ├─ A5
    └─ A6 ── A7
A8 ── A9

Phase B (Unified modes) — depends on A1, A2, A5, A7:
B1 ── B2 ── B3 ── B4 ── B5 ── B6 ── B7 ── B8

Phase C (Stability + history) — depends on B5, B6:
C1 ── C2 ── C3 ── C4 ── C5

Phase D (Performance + polish) — independent of B, C:
D1 ── D2
D3, D4, D5, D6 (all independent of each other)
```

**Parallel starting points:** A1, A8, and D3 have zero dependencies and can be started simultaneously.

---

## Phase A: Refactor Extraction (zero visual change)

### A1 — Create shared tutor types module

| Field | Value |
|---|---|
| **Input** | Read: `app/api/tutor/chat/route.ts` (lines 1–500), `app/(app)/tutor/TutorClient.tsx` (lines 1–460) |
| **Create** | `src/lib/ai/types/tutor.ts` |
| **What** | Extract `TutorProfileLike` (lines 389–449 in route.ts), `StrategyState` (lines 89–107), `ModeType`, `ModeOptions`, `OnFinishPayload`, `ChatRequestShape` into a single types module. Export all types. Update imports in route.ts and any other consumer. |
| **Validate** | `npm run typecheck` |
| **Effort** | 20 min |

### A2 — Extract `useSpecialMode` hook

| Field | Value |
|---|---|
| **Input** | Read: `app/(app)/tutor/TutorClient.tsx` lines 303–361 (`handleSpecialModeStream` + 3 callbacks) |
| **Create** | `src/lib/hooks/useSpecialMode.ts` |
| **Modify** | `app/(app)/tutor/TutorClient.tsx` — replace lines 303–361 with single hook call |
| **What** | Extract the summarize/exam/compare stream → accumulate → sendMessage logic into a `useSpecialMode` hook. Accepts `(threadId, subjectId, topicId, sendMessage)` and returns `{ requestSummarize, requestExam, requestCompare, isRequesting }`. The hook uses a ref guard against double-fire and manages the `isRequesting` state internally. |
| **Validate** | `npm run typecheck` + manual: click Summarize/Exam/Compare in tutor — output still appears |
| **Effort** | 30 min |

### A3 — Extract `useInlinePractice` hook

| Field | Value |
|---|---|
| **Input** | Read: `app/(app)/tutor/TutorClient.tsx` lines 253–301 (`handleInlinePracticeRequested`) |
| **Create** | `src/lib/hooks/useInlinePractice.ts` |
| **Modify** | `app/(app)/tutor/TutorClient.tsx` — replace lines 253–301 with single hook call |
| **What** | Extract the inline practice request logic (find last assistant message, POST to `/api/tutor/practice`, manage `inlinePracticeRequestingLocal` state) into a `useInlinePractice` hook. Returns `{ request, isRequesting }`. |
| **Validate** | `npm run typecheck` + manual: click "3 quick questions" — inline practice tile appears in chat |
| **Effort** | 25 min |

### A4 — Extract `useAutoRetry` hook

| Field | Value |
|---|---|
| **Input** | Read: `app/(app)/tutor/TutorClient.tsx` lines 238–251 (auto-retry effect) |
| **Create** | `src/lib/hooks/useAutoRetry.ts` |
| **Modify** | `app/(app)/tutor/TutorClient.tsx` — replace lines 238–251 with single hook call |
| **What** | Extract the single auto-retry on stream error into a hook. Watches `status`, calls `regenerate()` once on first "error" state, resets on "ready". |
| **Validate** | `npm run typecheck` |
| **Effort** | 15 min |

### A5 — Split `convex/tutor.ts` into focused modules

| Field | Value |
|---|---|
| **Input** | Read: `convex/tutor.ts` (all 550 lines) |
| **Create** | `convex/tutorSessions.ts`, `convex/tutorHistory.ts`, `convex/tutorComposer.ts` |
| **Modify** | `convex/tutor.ts` — keep only `getThread`, `listMessages`, `getThreadHistory`, `getContextForChat`, `ensureThread`, `appendUserMessage`, `recordAssistantMessage` (~250 lines) |
| **What** | Move `endSession` + `getSubjectTopicsForEmptyState` → `convex/tutorSessions.ts`. Move `listThreadsForSidebar` → `convex/tutorHistory.ts`. Move `getThreadById` + `markThreadRead` + `getTutorUnreadTotal` → `convex/tutorComposer.ts`. Update all imports in route handlers and client components. |
| **Validate** | `npm run typecheck` + `npm run test` (if tests reference these) |
| **Effort** | 40 min |

### A6 — Extract `getPersonalizationSignals` from `convex/tutorModes.ts`

| Field | Value |
|---|---|
| **Input** | Read: `convex/tutorModes.ts` lines 293–369 (`getPersonalizationSignals`) |
| **Create** | `convex/tutorSignals.ts` |
| **Modify** | `convex/tutorModes.ts` — remove `getPersonalizationSignals` (lines 293–369), update imports |
| **What** | Move `getPersonalizationSignals` to its own module. Update any import of `api.tutorModes.getPersonalizationSignals` → `api.tutorSignals.getPersonalizationSignals`. |
| **Validate** | `npm run typecheck` |
| **Effort** | 15 min |

### A7 — Extract pipeline modules from chat route handler

| Field | Value |
|---|---|
| **Input** | Read: `app/api/tutor/chat/route.ts` (all 500 lines) |
| **Create** | `app/api/tutor/chat/_lib/authMiddleware.ts`, `app/api/tutor/chat/_lib/contextLoader.ts`, `app/api/tutor/chat/_lib/promptBuilder.ts`, `app/api/tutor/chat/_lib/onFinishPipeline.ts`, `app/api/tutor/chat/_lib/modeInstructions.ts` |
| **Modify** | `app/api/tutor/chat/route.ts` — become thin orchestrator (~120 lines) |
| **What** | Extract: `authMiddleware` (Clerk verification + Convex client setup, lines 107–124), `contextLoader` (parallel fan-out for context/profile/memory/strategy/persistence, lines 126–260), `promptBuilder` (system + strategy block assembly, lines 262–305), `onFinishPipeline` (persistence + telemetry + strategy recording + nudge clearing, lines 320–380). Create `modeInstructions.ts` with mode-specific instruction templates (extracted from exam/compare/summarize routes for later use in Phase B). |
| **Validate** | `npm run typecheck` + manual: send a message to the tutor — it streams and persists correctly |
| **Effort** | 60 min |

### A8 — Add `lastMessagePreview` denormalized field to schema

| Field | Value |
|---|---|
| **Input** | Read: `convex/schema.ts` — find `tutorThreads` table definition (around line 350) |
| **Modify** | `convex/schema.ts` — add `lastMessagePreview: v.optional(v.string())` to `tutorThreads` |
| **What** | Add the denormalized field. No backfill migration yet — it's optional, so existing threads simply have `undefined`. |
| **Validate** | `npm run typecheck` |
| **Effort** | 10 min |

### A9 — Write `lastMessagePreview` in message mutations

| Field | Value |
|---|---|
| **Input** | Read: `convex/tutor.ts` — `appendUserMessage` (lines 307–339) and `recordAssistantMessage` (lines 341–395) |
| **Modify** | `convex/tutor.ts` — add `lastMessagePreview: content.slice(0, 200)` to the `ctx.db.patch(threadId, ...)` in both `appendUserMessage` and `recordAssistantMessage` |
| **What** | Update denormalized field on every message write. Preview truncated to 200 chars to match the sidebar display. |
| **Validate** | `npm run typecheck` + manual: send a message in the tutor, check that `lastMessagePreview` appears in the Convex dashboard |
| **Effort** | 15 min |

---

## Phase B: Unified Special Modes

### B1 — Add `mode` and `modeOptions` to chat request schema

| Field | Value |
|---|---|
| **Input** | Read: `app/api/tutor/chat/route.ts` — `chatRequestSchema` (lines 42–63 in current file) |
| **Modify** | `app/api/tutor/chat/route.ts` (or `_lib/validateMiddleware.ts` from A7) — add `mode: z.enum(["default", "summarize", "exam", "compare"]).optional()` and `modeOptions: z.object({ taskCount: z.number().min(1).max(8).optional() }).optional()` |
| **What** | Extend the request schema to accept mode flags. Backward compatible — absent fields default to "default" behavior. |
| **Validate** | `npm run typecheck` |
| **Effort** | 10 min |

### B2 — Build `modeInstructions.ts` with templates

| Field | Value |
|---|---|
| **Input** | Read: `app/api/tutor/exam/route.ts` (system prompt, lines 67–102), `app/api/tutor/compare/route.ts` (system prompt, lines 55–95), `app/api/tutor/summarize/route.ts` (system prompt, lines 72–91) |
| **Modify** | `app/api/tutor/chat/_lib/modeInstructions.ts` — implement three instruction builder functions |
| **What** | Extract the specialized system prompts from the three standalone routes into composable instruction functions: `buildExamInstructions(context, taskCount)`, `buildCompareInstructions(context)`, `buildSummarizeInstructions(context, mode)`. Each returns a string block to append to the system prompt. |
| **Validate** | `npm run typecheck` + unit test: compare output of each builder against the current route handler's system prompt |
| **Effort** | 35 min |

### B3 — Wire mode instructions into the prompt builder

| Field | Value |
|---|---|
| **Input** | Read: `app/api/tutor/chat/_lib/promptBuilder.ts` (from A7) |
| **Modify** | `app/api/tutor/chat/_lib/promptBuilder.ts` — accept `mode` and `modeOptions` params, call `buildExamInstructions` / `buildCompareInstructions` / `buildSummarizeInstructions` when mode is set, append to system prompt |
| **What** | The prompt builder now produces mode-specific instructions when `mode !== "default"`. Mode messages use `maxOutputTokens: 2500` (exam) or `2000` (compare/summarize) instead of the default `1500`. |
| **Validate** | `npm run typecheck` + unit test: verify system prompt includes mode instructions when mode is set |
| **Effort** | 25 min |

### B4 — Tag mode messages with `structuredContent.mode`

| Field | Value |
|---|---|
| **Input** | Read: `app/api/tutor/chat/_lib/onFinishPipeline.ts` (from A7) |
| **Modify** | `app/api/tutor/chat/_lib/onFinishPipeline.ts` — when `mode` is set, include `structuredContent: JSON.stringify({ mode, ...parsed })` |
| **What** | Mode messages get a `mode` tag in structured content so the UI can render specialized layouts (exam task cards, comparison tables, summary sections) and history can differentiate mode turns. |
| **Validate** | `npm run typecheck` |
| **Effort** | 15 min |

### B5 — Remove client-side stream accumulation (`handleSpecialModeStream`)

| Field | Value |
|---|---|
| **Input** | Read: `app/(app)/tutor/TutorClient.tsx` — `handleSpecialModeStream` (lines 303–361), `specialModeRequestingRef`, `specialModeRef`, `specialModeRequestingLocal`, `handleSummarizeRequested`, `handleExamRequested`, `handleCompareRequested` |
| **Modify** | `app/(app)/tutor/TutorClient.tsx` — remove all special mode state and handlers. Delete `useSpecialMode` hook file. |
| **What** | This is dead code removal after the unified pipeline lands. The client no longer touches stream bytes — it just passes `mode` through `sendMessage`. |
| **Validate** | `npm run typecheck` |
| **Effort** | 15 min |

### B6 — Update Composer mode buttons to use `sendMessage` with mode flag

| Field | Value |
|---|---|
| **Input** | Read: `components/tutor/Composer.tsx` — mode button handlers (lines 275–330), `ComposerProps` (lines 43–112) |
| **Modify** | `components/tutor/Composer.tsx` — remove `onSummarizeRequested`, `onExamRequested`, `onCompareRequested`, `isRequestingSpecialMode` props. Add `onSubmitMode: (text: string, mode: "summarize" | "exam" | "compare") => void`. Update mode button click handlers to call `onSubmitMode(input, mode)` instead of the old callbacks. |
| **What** | Summarize/Exam/Compare buttons now send the user's input text plus a mode flag through the normal chat pipeline. No more separate fetch calls. |
| **Validate** | `npm run typecheck` + manual: click Summarize — text + mode flag reaches route handler, streams as assistant message |
| **Effort** | 25 min |

### B7 — Remove legacy special mode route handlers

| Field | Value |
|---|---|
| **Input** | None — just delete |
| **Delete** | `app/api/tutor/exam/route.ts`, `app/api/tutor/compare/route.ts`, `app/api/tutor/summarize/route.ts` |
| **What** | After confirming the unified pipeline handles all three modes, remove the standalone routes. |
| **Validate** | `npm run typecheck` + `npm run test` |
| **Effort** | 5 min |

### B8 — Add mode-specific rendering in `StructuredResponse`

| Field | Value |
|---|---|
| **Input** | Read: `components/tutor/StructuredResponse.tsx` (all ~75 lines) |
| **Modify** | `components/tutor/StructuredResponse.tsx` — add mode-specific rendering paths: `exam` mode renders task cards with type/time/points metadata; `compare` mode renders the comparison table; `summarize` mode renders with revision-note styling |
| **What** | When `structuredContent.mode` is set, render a specialized layout instead of the default explanation/insight/suggestion layout. |
| **Validate** | `npm run typecheck` + manual: generate an exam/compare/summarize — specialized rendering appears |
| **Effort** | 40 min |

---

## Phase C: Message Stability & History Optimization

### C1 — Implement `useStableMessages` hook

| Field | Value |
|---|---|
| **Input** | Read: `app/(app)/tutor/TutorClient.tsx` — `toUIMessage` function (lines 442–454), message flow in `TutorChat` (lines 148–430) |
| **Create** | `src/lib/hooks/useStableMessages.ts` |
| **Modify** | `app/(app)/tutor/TutorClient.tsx` — use `useStableMessages` to merge Convex messages with AI SDK messages |
| **What** | The hook: 1) Builds a `Set<string>` of content hashes from Convex messages (role + content truncated to 200 chars). 2) Filters AI SDK messages whose content hash matches a Convex message (these are duplicates from the initial load). 3) Returns the union, sorted by inferred creation order (Convex messages first, then AI SDK-only messages). 4) Uses `useMemo` with both message arrays as dependencies. |
| **Validate** | `npm run typecheck` + unit test: write `useStableMessages.test.ts` with cases: no overlap, full overlap, partial overlap, empty arrays |
| **Effort** | 35 min |

### C2 — Switch `listThreadsForSidebar` to read denormalized `lastMessagePreview`

| Field | Value |
|---|---|
| **Input** | Read: `convex/tutorHistory.ts` (from A5) — `listThreadsForSidebar`, specifically the N+1 preview lookups (lines where `previewByThread` is built) |
| **Modify** | `convex/tutorHistory.ts` — remove the per-thread `tutorMessages.by_thread.order("desc").first()` calls. Read `lastMessagePreview` directly from the thread row. |
| **What** | After A9, every thread has `lastMessagePreview`. The history query is now a single indexed scan with zero sub-queries. |
| **Validate** | `npm run typecheck` + manual: open history drawer — previews appear without N+1 delay |
| **Effort** | 15 min |

### C3 — Cap thread count in `listThreadsForSidebar`

| Field | Value |
|---|---|
| **Input** | Read: `convex/tutorHistory.ts` — `listThreadsForSidebar` |
| **Modify** | `convex/tutorHistory.ts` — add `.take(100)` after the `by_user` index scan. Add a comment documenting the cap. |
| **What** | Prevent unbounded growth. 100 threads is enough for any real user. |
| **Validate** | `npm run typecheck` |
| **Effort** | 5 min |

### C4 — Create `EmptyChatArea` component with three variants

| Field | Value |
|---|---|
| **Input** | Read: `app/(app)/tutor/TutorClient.tsx` — the empty chat area (lines 414–420: the `<div className="flex-1" />`) and the `ShellSkeleton` (lines 433–454) |
| **Create** | `components/tutor/EmptyChatArea.tsx` |
| **Modify** | `app/(app)/tutor/TutorClient.tsx` — render `<EmptyChatArea>` in the chat column when `messages.length === 0` |
| **What** | Three variants: `"loading"` (ShellSkeleton), `"new_thread"` (welcome + topic picker chips using `getSubjectTopicsForEmptyState`), `"subject_only"` (topic suggestions grid). Component accepts `{ state, topicSuggestions?, subjectColor? }`. |
| **Validate** | `npm run typecheck` + manual: open tutor on a new thread — topic chips appear; open on subject-only thread — suggestions grid appears |
| **Effort** | 35 min |

### C5 — Add topic picker chips to empty state

| Field | Value |
|---|---|
| **Input** | Read: `convex/tutor.ts` — `getSubjectTopicsForEmptyState` (already exists), `components/tutor/EmptyChatArea.tsx` (from C4) |
| **Modify** | `components/tutor/EmptyChatArea.tsx` — render clickable topic chips for `"new_thread"` and `"subject_only"` variants |
| **What** | Chips show topic title + mastery ring + exam relevance badge. Clicking a chip navigates to `/tutor?topicId=...` or fills the composer with the topic name. Uses `topicSuggestions` from the Convex query. |
| **Validate** | `npm run typecheck` + manual: click a topic chip — navigates to topic-scoped thread |
| **Effort** | 30 min |

---

## Phase D: Performance & Polish

### D1 — Add caps on all unbounded `collect()` calls in tutor Convex modules

| Field | Value |
|---|---|
| **Input** | Read the following files, noting every `.collect()` call: `convex/tutorModes.ts`, `convex/tutorPatterns.ts`, `convex/tutorMemory.ts`, `convex/tutorHistory.ts` |
| **Modify** | Each file — replace unbounded `.collect()` with `.take(N)` where N matches the caps in the design doc (§3.3) |
| **What** | `getSummarizeContext`: `.take(200)` on messages. `getExamContext`: `.take(200)` on messages, `.take(50)` on mistakes, `.take(20)` on siblings. `getCompareContext`: `.take(200)` on messages, `.take(20)` on siblings. `detect`: `.take(500)` on mistakes. `getMemoryChronicle`: cap sessions to 50, 7-day window. |
| **Validate** | `npm run typecheck` |
| **Effort** | 25 min |

### D2 — Add query latency telemetry to tutor queries

| Field | Value |
|---|---|
| **Input** | Read: `src/lib/ai/telemetry.ts` — `logAiGeneration` pattern |
| **Modify** | `convex/tutor.ts`, `convex/tutorModes.ts`, `convex/tutorPractice.ts`, `convex/tutorHistory.ts` — add `performance.now()` timing around handler bodies, log p95 to `aiGenerations` table with `task: "tutor.query.xxx"` |
| **What** | Each query records its own latency to the telemetry table. This is additive — it doesn't change query behavior. Use `ctx.scheduler.runAfter(0, ...)` for fire-and-forget writes so telemetry never blocks the query. |
| **Validate** | `npm run typecheck` + check Convex dashboard for `aiGenerations` rows with `task: "tutor.query.*"` |
| **Effort** | 30 min |

### D3 — Normalize button heights across Composer + MessageActions

| Field | Value |
|---|---|
| **Input** | Read: `components/tutor/Composer.tsx` — all button elements, `components/tutor/MessageActions.tsx` — `ActionButton` component |
| **Modify** | Both files — ensure all action buttons use `h-7 w-7`, all primary buttons use `h-9` |
| **What** | Audit every `className` on buttons in both files. Replace any non-standard heights (`h-6`, `h-8`, `w-6`) with the normalized values. |
| **Validate** | `npm run typecheck` + visual: inspect composer buttons — all same height, no misalignment |
| **Effort** | 15 min |

### D4 — Add keyboard shortcut tooltip to Composer

| Field | Value |
|---|---|
| **Input** | Read: `components/tutor/Composer.tsx` — the bottom strip where mode buttons live |
| **Modify** | `components/tutor/Composer.tsx` — add a small `(/)` badge or tooltip next to the input placeholder showing: "Type / to focus · Esc to stop · ⌘↵ to send" |
| **What** | A non-intrusive hint below the textarea (or as a tooltip on the send button). Hidden on touch devices. |
| **Validate** | `npm run typecheck` + visual: tooltip appears on desktop, hidden on mobile |
| **Effort** | 20 min |

### D5 — Dark mode audit of all tutor components

| Field | Value |
|---|---|
| **Input** | Read: `components/tutor/*` (all 10 files), `app/(app)/tutor/TutorClient.tsx` |
| **Modify** | Any hardcoded light-mode colors → CSS custom properties |
| **What** | 1) Set `prefers-color-scheme: dark` in dev tools. 2) Scroll through every tutor component. 3) Fix any washed-out text, invisible borders, missing accents. 4) Verify the sticky composer backdrop blur renders correctly. 5) Verify the streaming shimmer line is visible. 6) Verify ReasoningPart accent border is visible. |
| **Validate** | Visual: dark mode toggle — all components render legibly |
| **Effort** | 25 min |

### D6 — Mobile responsive audit of all tutor components

| Field | Value |
|---|---|
| **Input** | Read: `components/tutor/*` (all 10 files), `app/(app)/tutor/TutorClient.tsx` |
| **Modify** | Adjust responsive classes where needed |
| **What** | 1) Set viewport to 375px wide. 2) Verify composer doesn't overlap with keyboard (use `dvh` units, `env(safe-area-inset-bottom)`). 3) Verify history drawer slides over chat (not pushes it). 4) Verify MessageActions wrap correctly (the `hidden sm:inline-flex` pattern already handles this). 5) Verify inline practice tile is scrollable within viewport. |
| **Validate** | Visual: mobile viewport — all components usable, no overlap |
| **Effort** | 20 min |

---

## Summary

| Phase | Subtasks | Est. time | What changes |
|---|---|---|---|
| **A** (Refactor) | 9 tasks | ~3.5 hrs | Shared types module, 4 extracted hooks, 4 split Convex modules, pipeline extraction, denormalized field — zero visual change |
| **B** (Unified modes) | 8 tasks | ~2.5 hrs | Mode flag in chat schema, instruction templates, unified pipeline, remove 3 legacy routes + client stream hack, mode-specific rendering |
| **C** (Stability + history) | 5 tasks | ~2 hrs | `useStableMessages` hook, denormalized preview reads, capped thread list, `EmptyChatArea` with topic chips |
| **D** (Performance + polish) | 6 tasks | ~2.5 hrs | Caps on collects, latency telemetry, normalized buttons, keyboard shortcut tooltip, dark mode audit, mobile audit |

**Total: 28 subtasks, ~10.5 hours estimated.**

**Parallel starting points:** A1, A8, and D3 have zero dependencies and can be started simultaneously.
