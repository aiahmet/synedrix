# Tutor Improvement Design Doc

> Status: proposal
> Target: Synedrix Tutor surface (`/tutor`, `convex/tutor*.ts`, `app/api/tutor/*`, `components/tutor/*`)
> Author: generated

---

## Table of Contents

1. [Architecture](#1-architecture)
2. [Code Style Guidelines](#2-code-style-guidelines)
3. [Quality Constraints](#3-quality-constraints)
4. [Testing Strategy](#4-testing-strategy)
5. [Deployment Plan](#5-deployment-plan)

---

## 1. Architecture

### 1.1 Current Architecture Assessment

The Tutor is the most architecturally complex surface in the app. It spans **four layers**:

| Layer | Files | Lines | Responsibility |
|---|---|---|---|
| **Server page** | `app/(app)/tutor/page.tsx` | ~200 | Auth, thread routing, lesson context decoupling |
| **Client island** | `app/(app)/tutor/TutorClient.tsx` | ~460 | Chat orchestration, inline practice, special modes, keyboard shortcuts |
| **API routes** | `app/api/tutor/chat/route.ts` | ~500 | Auth, context loading (6 parallel queries), prompt building, streaming, onFinish persistence + telemetry |
| | `app/api/tutor/exam/route.ts` | ~120 | Exam generation mode |
| | `app/api/tutor/compare/route.ts` | ~110 | Concept comparison mode |
| | `app/api/tutor/summarize/route.ts` | ~95 | Thread summarization mode |
| | `app/api/tutor/practice/route.ts` | ~130 | Inline practice generation |
| **Convex backend** | `convex/tutor.ts` | ~550 | Thread CRUD, context loading, session lifecycle, history sidebar |
| | `convex/tutorStrategy.ts` | ~300 | Teaching strategy state machine (explain/practice/socratic/review) |
| | `convex/tutorPractice.ts` | ~370 | Inline practice persistence (create session, record attempt, end session) |
| | `convex/tutorAutoReview.ts` | ~165 | Auto-review scheduling from `[[mistake:...]]` markers |
| | `convex/tutorPatterns.ts` | ~240 | Cross-topic mistake pattern detection |
| | `convex/tutorModes.ts` | ~370 | Summarize/exam/compare context queries + personalization signals |
| | `convex/tutorProfile.ts` | ~310 | Onboarding profile save/get |
| | `convex/tutorMemory.ts` | ~120 | Session memory chronicle |
| | `convex/tutorOpening.ts` | ~180 | AI-quality opening message builder |
| | `convex/tutorContext.ts` | ~90 | Context loading helpers |
| **Components** | `components/tutor/*` (10 files) | ~1,500 | Presentational + interactive UI |

### 1.2 Key Architectural Problems

#### Problem 1: Monolithic Chat Route Handler (~500 lines)

The `/api/tutor/chat` route handler does **everything** in one function: auth, request validation, 6 parallel Convex queries, prompt assembly, streaming, onFinish persistence, telemetry, strategy recording, nudge clearing, and auto-review scheduling. This makes it untestable as a unit and fragile to change — every modification to any subsystem touches this file.

**Solution: Extract pipeline stages into composable middleware.**

```
POST /api/tutor/chat
  ├─ authMiddleware        → Clerk session verification
  ├─ validateMiddleware    → Zod schema parsing
  ├─ contextLoader         → Parallel Convex queries (getContextForChat, getMine, getMemoryChronicle, getStrategyState)
  ├─ persistenceWriter     → appendUserMessage (fire-and-forget)
  ├─ promptBuilder         → buildChatSystemPrompt + buildStrategyPromptBlock
  ├─ streamExecutor        → streamText with abort signal
  └─ onFinishPipeline      → recordAssistantMessage, logAiGeneration, recordTurn, clearLatestChoiceClick
```

Each stage is an independent pure-ish function or class, testable in isolation. The route handler becomes a thin orchestrator that composes them.

#### Problem 2: Special Modes Hack Client-Side Stream Accumulation

The summarize/exam/compare flows stream to the client, accumulate in memory, then inject the result as a `sendMessage({ text: accumulated })` — effectively impersonating a user message. This means:
- The special mode output has no server-side persistence (no `recordAssistantMessage`)
- The output appears in the UI with `role: "user"` styling
- There's no telemetry for the special mode generation
- The stream-to-sendMessage pattern is fragile (network blip loses the content)

**Solution: Unify special modes into the chat pipeline.**

Special modes should be a first-class message type, not a client-side hack. The route handler should accept a `mode` parameter and render the mode-specific instructions server-side:

```typescript
// New POST /api/tutor/chat body shape
{
  threadId, subjectId, topicId?,
  messages,           // existing chat messages
  mode?: "default" | "summarize" | "exam" | "compare",
  modeOptions?: { taskCount?: number }
}
```

The prompt builder appends mode-specific instructions. The `onFinish` handler persists the result as an assistant message with `structuredContent` containing the mode type. The client never touches the stream bytes — it's a normal chat turn.

#### Problem 3: Message ID Inconsistency Between Convex and AI SDK

The AI SDK generates ephemeral message IDs (`msg-XXXXX`) but `appendUserMessage` uses a `clientId` dedup to prevent double-writes. On the **next** page load, Convex's real IDs are used. This means:
- `useChat` re-initializes with Convex IDs but the AI SDK sometimes re-assigns them
- Messages can briefly duplicate when Convex reactivity fires mid-stream
- The `toUIMessage` mapping is lossy (structured content goes into metadata, not a well-typed shape)

**Solution: Use a stable message ID scheme.**

Generate a deterministic message ID on the client (e.g., `threadId:user:${Date.now()}:${counter}`) and pass it through to Convex. The AI SDK's `useChat` is configured with `id` already, but the message identity model doesn't survive the Convex → AI SDK round-trip cleanly. A `useStableMessages` hook should:
1. Use Convex IDs when available (historical messages)
2. Use client-generated IDs for optimistically rendered messages
3. Deduplicate by content hash on re-render

#### Problem 4: N+1 Preview Lookups in History Sidebar

`listThreadsForSidebar` fetches every thread, then does an individual `tutorMessages.by_thread.order("desc").first()` for each thread to get the preview. For 20 threads, that's 20 extra queries. The grouped-by-subject logic then does another `Promise.all` on subject lookups.

**Solution: Batch the preview lookups.**

Store `lastMessagePreview` as a denormalized field on `tutorThreads` and update it in `appendUserMessage` and `recordAssistantMessage`. The history query becomes a single indexed scan with no N+1 penalty.

#### Problem 5: Tight Coupling Between TutorClient and Special Mode State

`TutorClient` manages `specialModeRequestingRef`, `specialModeRef`, `specialModeRequestingLocal`, and three callbacks (`handleSummarizeRequested`, `handleExamRequested`, `handleCompareRequested`) all for the same underlying pattern. Each mode has bespoke fetch + accumulate + sendMessage logic.

**Solution: Extract a `useSpecialMode` hook.**

```typescript
function useSpecialMode(
  threadId: string,
  subjectId: string,
  topicId: string | null,
  sendMessage: (msg: { text: string }) => void
) {
  return useCallback((mode: "summarize" | "exam" | "compare") => {
    // Unified stream → sendMessage logic
  }, [threadId, subjectId, topicId, sendMessage]);
}
```

But better yet — with the unified pipeline (Problem 2), this hook disappears entirely and the Composer just calls `sendMessage` with a mode flag.

### 1.3 Proposed Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Tutor Page                        │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ HistoryPanel │  │  Chat Column  │  │ (overflow) │ │
│  │ (drawer)    │  │              │  │            │ │
│  │             │  │ MessageList  │  │            │ │
│  │ - threads   │  │ - reasoning  │  │            │ │
│  │ - unread    │  │ - structured │  │            │ │
│  │ - grouped   │  │ - inline     │  │            │ │
│  │             │  │   practice   │  │            │ │
│  │             │  │              │  │            │ │
│  │             │  │ Composer     │  │            │ │
│  │             │  │ - input      │  │            │ │
│  │             │  │ - mode chips │  │            │ │
│  │             │  │ - inline btn │  │            │ │
│  └─────────────┘  └──────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────┘

Data flow:
  Server Page
    ├─ preloadQuery(api.tutor.getThread)
    ├─ preloadQuery(api.tutor.listMessages)  [if thread exists]
    └─ preloadQuery(api.tutor.listThreadsForSidebar)

  TutorClient (client island)
    ├─ useQuery(api.tutor.getThread)          → thread subscription
    ├─ useQuery(api.tutor.listMessages)       → message subscription
    ├─ useQuery(api.tutorPractice.getInlineSessionsForThread) → inline sessions
    ├─ useChat({ transport: DefaultChatTransport({ api: "/api/tutor/chat" }) })
    │   ├─ messages (AI SDK state)
    │   ├─ sendMessage → POST /api/tutor/chat
    │   │   └─ Route Handler Pipeline
    │   │       ├─ authMiddleware
    │   │       ├─ validateMiddleware
    │   │       ├─ contextLoader (6 parallel queries)
    │   │       ├─ promptBuilder (system + strategy blocks)
    │   │       ├─ streamExecutor (streamText)
    │   │       └─ onFinishPipeline
    │   │           ├─ recordAssistantMessage
    │   │           ├─ logAiGeneration
    │   │           ├─ recordTurn (strategy)
    │   │           └─ clearLatestChoiceClick
    │   └─ status, stop, error, regenerate
    └─ useSpecialMode (unified summarize/exam/compare)
        └─ sends mode flag through sendMessage → route handler

  Composer → onSubmit → sendMessage({ text, mode? })
  MessageActions → onInlinePracticeRequested → POST /api/tutor/practice
  InlinePractice → POST /api/tutor/practice/grade
```

### 1.4 Tiered Loading Strategy

The tutor doesn't benefit from the standard tiered `Suspense` approach because the chat is a single synchronized surface — you can't show messages before the thread exists. Instead, the tiering is:

| Tier | What loads | Suspense boundary |
|---|---|---|
| **T0** (shell) | Top bar, composer skeleton, empty chat area | Immediate — always render |
| **T1** (thread) | Thread row, message history, inline practice sessions | `thread !== undefined && messages !== undefined` |
| **T2** (sidebar) | History panel threads (lazy, only on drawer open) | Deferred until drawer opens |

### 1.5 File Split Plan

| Current | Proposed | Purpose |
|---|---|---|
| `TutorClient.tsx` (~460 lines) | `TutorClient.tsx` (~180 lines) | Orchestrator: thread check, layout, props threading |
| | `TutorChat.tsx` (~120 lines) | `useChat` setup, transport config, keyboard shortcuts |
| | `useSpecialMode.ts` (~60 lines) | Unified summarize/exam/compare → sendMessage hook |
| | `useInlinePractice.ts` (~80 lines) | Inline practice request + state management hook |
| | `useAutoRetry.ts` (~30 lines) | Auto-retry on stream error hook |
| `app/api/tutor/chat/route.ts` (~500 lines) | `route.ts` (~120 lines) | Thin orchestrator: auth → validate → compose → stream |
| | `_lib/authMiddleware.ts` (~30 lines) | Clerk verification + Convex client setup |
| | `_lib/contextLoader.ts` (~80 lines) | Parallel fan-out: context, profile, memory, strategy |
| | `_lib/promptBuilder.ts` (~60 lines) | Assemble system + strategy blocks |
| | `_lib/onFinishPipeline.ts` (~80 lines) | Persistence, telemetry, strategy recording |
| | `_lib/modeInstructions.ts` (~50 lines) | Summarize/exam/compare instruction templates |
| `convex/tutor.ts` (~550 lines) | `convex/tutor.ts` (~250 lines) | Core CRUD: getThread, listMessages, ensureThread, appendUserMessage, recordAssistantMessage |
| | `convex/tutorSessions.ts` (~80 lines) | endSession, getSubjectTopicsForEmptyState |
| | `convex/tutorHistory.ts` (~120 lines) | listThreadsForSidebar (with denormalized previews) |
| | `convex/tutorComposer.ts` (~60 lines) | getThreadById, markThreadRead, getTutorUnreadTotal |
| `convex/tutorModes.ts` (~370 lines) | `convex/tutorModes.ts` (~180 lines) | Context queries only |
| | `convex/tutorSignals.ts` (~120 lines) | getPersonalizationSignals (extracted) |

---

## 2. Code Style Guidelines

### 2.1 Extract Shared Types

Create `src/lib/ai/types/tutor.ts` for shared type shapes used across the route handler, prompt builders, and strategy modules:

```typescript
// Shared tutor types — single source of truth for:
// - ChatRequest, ChatContext, StrategyState, TutorProfileLike
// - ModeType, ModeOptions, OnFinishPayload
// - InlinePracticeRequest, InlinePracticeGradeRequest
```

Currently, `TutorProfileLike` is defined inline in the route handler, `StrategyState` is an inline type, and the mode request shapes are scattered across four route files.

### 2.2 Remove Client-Side Stream Accumulation

The `handleSpecialModeStream` in `TutorClient.tsx` reads the entire response into a string before calling `sendMessage`. This pattern should be replaced with the unified pipeline (see §1.2 Problem 2). The client never touches raw stream bytes.

### 2.3 Use `useStableMessages` to Fix Duplication

Create `src/lib/hooks/useStableMessages.ts`:

```typescript
function useStableMessages(
  convexMessages: UIMessage[],
  aiSdkMessages: UIMessage[]
): UIMessage[] {
  // Merge strategy:
  // 1. Build a Set of content hashes from Convex messages
  // 2. Filter AI SDK messages that duplicate Convex content
  // 3. Sort by creation time
  // 4. Return deduplicated, sorted array
}
```

This eliminates the brief flash of duplicated messages that occurs when `useChat` re-initializes after Convex delivers new data.

### 2.4 Normalize Empty States

The tutor has three distinct empty states that currently share rendering logic:

| State | Current behavior | Proposed |
|---|---|---|
| **New thread** (no messages) | Blank chat area + composer | Topic picker chips in empty area |
| **Thread loading** | `ShellSkeleton` | Keep skeleton |
| **Subject-only thread** (no topic) | Generic welcome | Show topic suggestions from `getSubjectTopicsForEmptyState` |

Use a single `EmptyChatArea` component that renders the appropriate variant:

```typescript
function EmptyChatArea({
  state, // "loading" | "new_thread" | "subject_only" | "topic_ready"
  topicSuggestions,
  subjectColor,
}: EmptyChatAreaProps) { ... }
```

### 2.5 Remove `color-mix` Icon Containers

Per the frontend style rulebook (anti-pattern #2), remove all icon containers that use `color-mix` backgrounds throughout the tutor components. Replace with plain icons + text labels.

### 2.6 Standardize Button Heights

The tutor Composer has mixed button sizes (h-7, h-8, h-9, w-6, w-7). Normalize to two sizes:
- Action buttons: `h-7 w-7` (consistent with `MessageActions`)
- Primary buttons: `h-9` (submit, mode triggers)

### 2.7 Composer Props Consolidation

The `Composer` currently receives 18 props. Group related props:

```typescript
type ComposerProps = {
  // Core
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  onSubmit: (text: string) => void;

  // Chat state
  chat: {
    status: string;
    error: Error | undefined;
    onStop: () => void;
    onRegenerate: (() => void) | undefined;
  };

  // Special modes
  modes: {
    onSummarize: () => void;
    onExam: () => void;
    onCompare: () => void;
    isRequesting: boolean;
  };

  // Inline practice
  inlinePractice: {
    onRequested: (() => void) | undefined;
    isRequesting: boolean;
  };

  // Context
  context: {
    subject: SubjectSummary;
    topic: TopicSummary | null;
    fallbackLessonHref: string;
    hasMessages: boolean;
  };
};
```

---

## 3. Quality Constraints

### 3.1 Performance Budgets

| Metric | Target | Measurement |
|---|---|---|
| **First paint** (shell visible) | < 200ms | `ShellSkeleton` renders immediately |
| **Thread ready** (messages visible) | < 1.0s p95 | `getThread` + `listMessages` Convex latency |
| **First token** (streaming starts) | < 2.0s p95 | From `sendMessage` to first stream chunk |
| **TTFB for `/api/tutor/chat`** | < 500ms p95 | Context loading + prompt building |
| **History drawer open** | < 500ms p95 | `listThreadsForSidebar` (cached after first load) |
| **Inline practice generation** | < 3.0s p95 | POST `/api/tutor/practice` → session appears |
| **Inline practice grading** | < 2.0s p95 | POST `/api/tutor/practice/grade` → attempt appears |

### 3.2 Query Latency Budgets (p95)

| Query | Budget | Notes |
|---|---|---|
| `tutor.getThread` | < 50ms | Single indexed lookup |
| `tutor.listMessages` | < 100ms | Indexed scan, capped at 200 |
| `tutor.getContextForChat` | < 150ms | 3 sub-queries (thread, subject, topic + progress + mistakes) |
| `tutor.listThreadsForSidebar` | < 200ms | After denormalized preview optimization |
| `tutorPractice.getInlineSessionsForThread` | < 80ms | Indexed by thread, sorted in-memory |
| `tutorPractice.getInlineSessionForRunner` | < 150ms | Session + items + per-item attempt join |
| `tutorModes.getSummarizeContext` | < 150ms | Thread + messages + topic data |
| `tutorModes.getExamContext` | < 200ms | Thread + messages + progress + mistakes + siblings |
| `tutorModes.getCompareContext` | < 200ms | Thread + messages + progress + siblings |
| `tutorStrategy.getStrategyState` | < 50ms | Single indexed lookup |
| `tutorMemory.getMemoryChronicle` | < 100ms | Compiled from session history |

### 3.3 Caps on Unbounded Collects

| Location | Current | Cap |
|---|---|---|
| `tutor.listMessages` | `.take(limit)` with max 500 | Already capped |
| `tutor.listThreadsForSidebar` | `.collect()` — no cap | Cap at 100 threads |
| `tutorModes.getSummarizeContext` | `.collect()` on messages | Cap at 200 messages |
| `tutorModes.getExamContext` | `.collect()` on messages + mistakes + siblings | Cap at 200 messages, 50 mistakes, 20 siblings |
| `tutorModes.getCompareContext` | `.collect()` on messages + siblings | Cap at 200 messages, 20 siblings |
| `tutorMemory.getMemoryChronicle` | Compiles from all sessions | Cap at 50 sessions, 7-day window |
| `tutorPatterns.detect` | `.collect()` on all mistakes | Cap at 500 mistakes |

### 3.4 Empty State Differentiation

| State | Visual | Action |
|---|---|---|
| **New user** (no threads) | Welcome message with topic picker | "Pick a topic to start" |
| **Thread exists, no messages** | Proactive opening message | Already handled by `ensureThread` |
| **Subject-only thread** | Topic suggestions grid | "What would you like to study?" |
| **Stream error** | Error card with retry button | Auto-retry once, then manual |
| **Thread not found** | 404 message | "This thread is no longer available" |
| **Convex offline** | `OfflineFallback` | Already implemented |

### 3.5 Accessibility

- All message actions have `aria-label` (already present)
- Reasoning toggle has `aria-expanded` and `aria-controls` (already present)
- Composer has `role="form"` with `aria-label="Tutor message composer"`
- Keyboard shortcuts documented in a visible tooltip:
  - `/` — focus composer (already present)
  - `Escape` — stop streaming (already present)
  - `Cmd/Ctrl+Enter` — submit message (already in Composer)
- Focus trap in History drawer when open

### 3.6 Dark Mode

- All tutor components use CSS custom properties (no hardcoded colors)
- Streaming shimmer line already supports dark mode via `rgba(255,255,255,0.08)`
- Verify the sticky composer backdrop blur renders correctly in dark mode
- StructuredResponse accent borders work in both themes

---

## 4. Testing Strategy

### 4.1 Unit Tests (Vitest)

| Test file | What it covers |
|---|---|
| `convex/tutorStrategy.test.ts` | Strategy transition logic, engagement scoring, socratic mode rules |
| `convex/tutor.test.ts` | Thread CRUD, message persistence, denormalized field updates |
| `convex/tutorOpening.test.ts` | Opening message variants: lesson-scoped, topic-scoped, subject-only, tone-aware |
| `src/lib/ai/prompts/chat.test.ts` | System prompt assembly with all context variants |
| `src/lib/hooks/useStableMessages.test.ts` | Message deduplication, sort stability, edge cases |
| `src/lib/ai/pipeline/modeInstructions.test.ts` | Summarize/exam/compare instruction templates |
| `convex/tutorAutoReview.test.ts` | Mistake marker parsing, type normalization, idempotency |
| `convex/tutorPatterns.test.ts` | Pattern detection heuristics, duplicate prevention |

### 4.2 Convex Integration Tests

| Test | What it verifies |
|---|---|
| `ensureThread` creates thread + welcome message atomically | No orphaned thread, welcome message present |
| `ensureThread` is idempotent | Second call returns same threadId |
| `appendUserMessage` deduplicates by clientId | Same clientId twice = no duplicate row |
| `recordAssistantMessage` fires auto-review scheduler | `scheduleAutoReview` called with correct args |
| `endSession` updates mastery + triggers pattern detection | Mastery increment, pattern detection scheduled |
| `listThreadsForSidebar` groups correctly | Threads grouped by subject, sorted by lastMessageAt |
| `getContextForChat` returns null for missing topic | Handle topic_not_found without crashing |
| Strategy transitions are valid | Can't transition from "socratic" to practice without engagement gate |
| Personalization signals are coherent | Mastery < 0.3 → "learn_new" recommendation |

### 4.3 Component Tests (React Testing Library)

| Test | What it verifies |
|---|---|
| `Composer` submit disabled when empty | Button disabled state |
| `Composer` Escape stops streaming | `onStop` called |
| `MessageList` renders messages with correct roles | User messages right-aligned, assistant left-aligned |
| `MessageList` renders inline practice tiles in correct position | Tiles anchored to `anchorMessageId` |
| `ReasoningPart` toggle opens/closes content | `open` state, `aria-expanded` |
| `StructuredResponse` renders all sections | Explanation, insight, next, affirmation |
| `InlinePractice` renders item view → summary view transition | Item at currentIdx, summary when all answered |
| `MessageActions` copy button copies text | `navigator.clipboard.writeText` called |
| `HistoryPanel` renders grouped threads | Subjects as headers, threads as list items |
| `TutorTopBar` shows back link when `backHref` provided | Link present with correct href |
| `TutorDrawer` open/close with Escape | `onOpenChange(false)` called |

### 4.4 API Route Tests

| Test | What it verifies |
|---|---|
| `POST /api/tutor/chat` 401 without auth | Unauthorized response |
| `POST /api/tutor/chat` 400 with invalid body | Zod validation error |
| `POST /api/tutor/chat` 404 for non-existent thread | Thread not found |
| `POST /api/tutor/chat` streams valid SSE | Content-Type: text/event-stream |
| `POST /api/tutor/exam` generates exam tasks | Valid markdown with ## Task N structure |
| `POST /api/tutor/compare` generates comparison table | Valid markdown table |
| `POST /api/tutor/summarize` generates summary | Valid markdown with ## headings |
| `POST /api/tutor/practice` creates inline session | Returns sessionId + practiceSetId |

### 4.5 Manual QA Checklist

- [ ] Open tutor from dashboard → proactive opening message renders
- [ ] Open tutor from lesson → lesson-scoped opening references specific mistakes
- [ ] Open tutor from subject page → topic picker suggests unstudied topics
- [ ] Type a message → assistant replies stream in
- [ ] Click "Re-roll" → same prompt, new response
- [ ] Click "Copy" → text copies, "Copied" confirmation shows
- [ ] Click "3 quick questions" → inline practice tile appears in chat
- [ ] Answer inline practice question → verdict + feedback render
- [ ] Complete all inline practice questions → summary with grade renders
- [ ] Click "Summarize" in composer → summary appears as assistant message
- [ ] Click "Exam prep" in composer → exam tasks appear as assistant message
- [ ] Click "Compare" in composer → comparison table appears as assistant message
- [ ] Open history drawer → threads grouped by subject, unread counts visible
- [ ] Click a thread in history → navigates to that thread
- [ ] Close browser, reopen → thread is still there, messages preserved
- [ ] `/` key focuses composer
- [ ] `Escape` key stops streaming
- [ ] Dark mode renders correctly (no washed-out text, shimmer visible)
- [ ] Mobile: composer doesn't overlap with keyboard
- [ ] Mobile: history drawer slides over chat

---

## 5. Deployment Plan

### 5.1 Phase A: Refactor Extraction (zero visual change)

**Goal:** Extract the monolith into focused modules without changing any behavior.

| Step | What | Risk |
|---|---|---|
| **A1** | Extract `src/lib/ai/types/tutor.ts` with shared type shapes | Low — type-only change |
| **A2** | Extract `useSpecialMode` hook from `TutorClient.tsx` | Medium — test that summarize/exam/compare still work |
| **A3** | Extract `useInlinePractice` hook from `TutorClient.tsx` | Medium — test that inline practice still generates |
| **A4** | Extract `useAutoRetry` hook from `TutorClient.tsx` | Low — simple extraction |
| **A5** | Split `convex/tutor.ts` into `tutor.ts` + `tutorSessions.ts` + `tutorHistory.ts` + `tutorComposer.ts` | Low — file moves, no logic changes |
| **A6** | Extract `convex/tutorSignals.ts` from `convex/tutorModes.ts` | Low — `getPersonalizationSignals` moves to its own file |
| **A7** | Split `app/api/tutor/chat/route.ts` into pipeline modules (`_lib/*`) | High — must ensure streaming still works end-to-end |
| **A8** | Add denormalized `lastMessagePreview` to `tutorThreads` schema + backfill migration | Medium — schema change |
| **A9** | Update `appendUserMessage` and `recordAssistantMessage` to write `lastMessagePreview` | Low — additive mutation change |

**Validation:** Full QA checklist pass + `npm run typecheck` + `npm run test` after each step.

### 5.2 Phase B: Unified Special Modes

**Goal:** Replace client-side stream accumulation with server-side mode handling.

| Step | What | Risk |
|---|---|---|
| **B1** | Add `mode` + `modeOptions` to chat request schema | Low — optional fields |
| **B2** | Build `modeInstructions.ts` with summarize/exam/compare templates | Medium — must match current output quality |
| **B3** | Update `promptBuilder.ts` to inject mode instructions when `mode` is set | Medium |
| **B4** | Update `onFinishPipeline.ts` to tag mode messages with `structuredContent.mode` | Low |
| **B5** | Remove `handleSpecialModeStream` from `TutorClient.tsx` | Low — dead code removal |
| **B6** | Update `Composer` mode buttons to call `sendMessage({ text: userText, mode })` | Medium — ensures mode flag reaches route handler |
| **B7** | Remove `/api/tutor/exam`, `/api/tutor/compare`, `/api/tutor/summarize` routes | Low — after confirming unified pipeline works |
| **B8** | Add mode-specific `StructuredResponse` rendering (exam tasks, comparison tables, summaries) | Medium — new UI for structured mode output |

**Validation:** Test all three modes produce assistant messages (not user messages). Verify telemetry includes the mode. Confirm mode output appears in history.

### 5.3 Phase C: Message Stability & History Optimization

**Goal:** Eliminate message duplication and speed up history sidebar.

| Step | What | Risk |
|---|---|---|
| **C1** | Implement `useStableMessages` hook | Medium — must not drop legitimate messages |
| **C2** | Update `listThreadsForSidebar` to read denormalized `lastMessagePreview` | Low — after Phase A8 denorm is in place |
| **C3** | Remove N+1 preview lookups from `listThreadsForSidebar` | Low — performance improvement only |
| **C4** | Add `EmptyChatArea` component with three variants | Low — pure UI change |
| **C5** | Add topic picker chips to subject-only empty state | Low — uses existing `getSubjectTopicsForEmptyState` |

**Validation:** Verify no duplicate messages during streaming. History drawer opens instantly. Empty states render correctly for each variant.

### 5.4 Phase D: Performance & Polish

**Goal:** Hard caps, accessibility, dark mode verification.

| Step | What | Risk |
|---|---|---|
| **D1** | Add caps on all unbounded `collect()` calls per §3.3 | Low |
| **D2** | Add query latency telemetry to all tutor Convex queries | Low — additive |
| **D3** | Normalize button heights across Composer + MessageActions | Low — visual only |
| **D4** | Add keyboard shortcut tooltip to Composer | Low |
| **D5** | Dark mode audit of all tutor components | Low — visual verification |
| **D6** | Mobile responsive audit (composer overlap, drawer width) | Low — visual verification |

**Validation:** Full QA checklist. Latency budgets within targets.

### 5.5 Feature Flag

Gate behind `NEXT_PUBLIC_TUTOR_V2` environment variable:

```typescript
// app/(app)/tutor/page.tsx
const useV2 = process.env.NEXT_PUBLIC_TUTOR_V2 === "true";
if (useV2) {
  return <TutorPageV2 {...props} />;
}
return <TutorPageV1 {...props} />;
```

Rollback: set `NEXT_PUBLIC_TUTOR_V2=false` and redeploy. The V1 code path remains untouched.

### 5.6 Migration Strategy

| Migration | Approach | Rollback |
|---|---|---|
| Schema: `tutorThreads.lastMessagePreview` | Add nullable field, backfill via Convex migration, remove nullable after backfill | Remove field from schema |
| Route: unified pipeline | Add `mode` to schema, keep old routes, remove after verification | Revert schema change |
| Client: `useStableMessages` | Feature-flagged, A/B test against current behavior | Remove hook, revert to direct `useChat` messages |
| Client: `EmptyChatArea` | Direct swap — no data dependency change | Revert component |
