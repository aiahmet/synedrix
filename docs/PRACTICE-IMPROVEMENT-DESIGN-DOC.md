# Practice Arena Improvement Design Doc

> Status: proposal
> Target: Synedrix Practice Arena (`/practice`, `convex/practiceArena.ts`, `app/api/practice/arena/*`, `components/practice/*`)
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

The Practice Arena spans **four layers** with a three-phase flow:

| Layer | Files | Lines | Responsibility |
|---|---|---|---|
| **Server page** | `app/(app)/practice/page.tsx` | ~80 | Auth gate, subjects preloading |
| **Client orchestration** | `app/(app)/practice/PracticeArenaClient.tsx` | ~240 | 6-state phase machine, auto-start from `?topicId=`, retry flow |
| **Config** | `components/practice/ConfigPanel.tsx` | ~380 | Subject/mode/difficulty/topic selection, question type toggles |
| **Runner** | `components/practice/PracticeRunner.tsx` | ~900 | 7-state phase machine, item rendering, grading, timer, exam bulk grading |
| **Summary** | `components/practice/SummaryView.tsx` | ~370 | Grade hero, per-item review, retry wrong items |
| **Math input** | `components/practice/MathInput.tsx` | ~130 | LaTeX toolbar + preview |
| **Convex backend** | `convex/practiceArena.ts` | ~440 | Start/retry/finish/items/attempts/lesson-content queries |
| **API routes** | `app/api/practice/arena/start/route.ts` | ~130 | AI item generation + Convex commit |
| | `app/api/practice/arena/grade/route.ts` | ~130 | AI grading + Convex commit |
| | `app/api/practice/arena/retry/route.ts` | ~50 | Retry wrong items |

### 1.2 Key Architectural Problems

#### Problem 1: Monolithic `PracticeRunner` (~900 lines)

The runner handles: 7-phase state machine, MCQ inputs, essay analysis inputs, translation drill inputs, formula derivation MathInput, oral recall with self-check, fill-in-the-blank, step problems, timer countdown, exam bulk grading (sequential grading loop), error handling, progress bar, grade card rendering, and "Finish" abandonment. All in one file.

**Solution: Extract input types into separate components.**

```
PracticeRunner.tsx (~200 lines): orchestrator only
  ├─ ItemInputRouter.tsx (~60 lines): dispatches to the right input
  ├─ McqInput.tsx (~50 lines): multiple choice buttons
  ├─ EssayInput.tsx (~60 lines): word count + textarea
  ├─ TranslationInput.tsx (~50 lines): source phrase + textarea
  ├─ FormulaInput.tsx (~20 lines): wraps MathInput
  ├─ OralRecallInput.tsx (~60 lines): textarea + self-check toggles
  ├─ StepProblemInput.tsx (~30 lines): conditional MathInput vs textarea
  ├─ GradeCard.tsx (~80 lines): verdict + feedback + better answer + rubric
  └─ usePracticeRunner.ts (~250 lines): 7-state machine hook
```

The `<ItemInput>` function in the current runner is already a partial dispatcher — extract it fully.

#### Problem 2: German/English Label Inconsistency

The practice page uses a mix of German and English:
- "Übungsarena" (German for "Practice Arena")
- "Generiere Übungsaufgaben..." (German)
- "Netzwerkfehler" (German)
- "KI-Generierung fehlgeschlagen" (German)
- But the ConfigPanel, PracticeRunner, and SummaryView are mostly English

**Solution: Standardize to English.** Per the AGENTS.md and the rest of the app's convention, all labels should be English.

#### Problem 3: N+1 Queries in `listTopicsForSubject`

For each chapter in a subject, `listTopicsForSubject` does a separate topic query. For a subject with 6 chapters, that's 6 extra queries.

Also, `getArenaRunItems` does `Promise.all` over per-item attempt lookups — each item gets its own indexed query, which is correct (uses the compound index) but the `Promise.all` creates N concurrent queries. This is already batched via the index but could be made explicit.

**Solution: Batch chapter topic queries in `listTopicsForSubject`.**

Pre-fetch all chapters, then do one batch topic query filtered in-memory. Alternatively, if the subject is small enough, fetch all topics for the subject's chapters in one pass.

#### Problem 4: Exam Bulk Grading is Sequential

In `PracticeRunner`, the exam simulation collects all answers, then grades them one-by-one in a `for...of` loop. For 5 items at ~2s each, that's 10 seconds of waiting.

**Solution: Grade in parallel with `Promise.allSettled`.**

```typescript
const gradeExamAnswers = async () => {
  const answers = examAnswersRef.current;
  const ungradedItems = orderedItems.filter((it) => answers.has(it.itemId));
  
  const results = await Promise.allSettled(
    ungradedItems.map(async (item) => {
      const answer = answers.get(item.itemId);
      if (!answer) return null;
      const res = await fetch(gradeEndpoint, { ... });
      if (res.ok) return await res.json();
      return null;
    })
  );
  
  // Update grades ref from results
  // ...
  void onFinishRun(grades);
};
```

This cuts exam grading from ~10s to ~2s (one round-trip for the slowest item).

#### Problem 5: Timer Effect Uses `eslint-disable react-hooks/set-state-in-effect`

The timer countdown has three places where `set-state-in-effect` is disabled with eslint comments. This is a genuine complexity — the timer is a side effect that needs to update state. But the pattern can be improved.

**Solution: Extract a `useTimer` hook.**

```typescript
function useTimer(
  timeLimitSec: number,
  startedAt: number,
  onTimeUp: () => void
): { timeRemaining: number | null; isTimeUp: boolean } {
  // Clean interval-based timer
  // Calls onTimeUp exactly once when timeRemaining reaches 0
  // Returns current time remaining + whether time is up
}
```

This isolates the timer logic and removes the need for eslint-disable comments in the runner.

#### Problem 6: No Progress Persistence on Refresh

All practice state lives in React state and refs. If the user refreshes during a run, they lose their progress. The run row is persisted in Convex, but the UI state (current index, current answer, timer) is not.

**Solution: Store current index in the run row.**

Add `currentItemIndex: v.optional(v.number())` to `topicLessonPractice`. Update it on each item advance. On mount, initialize `currentIndex` from the run row. This way, a refresh during a run resumes at the last item.

Answers-in-progress (unsaved textarea content) are not persisted — this is acceptable UX. The student retypes their current answer.

#### Problem 7: `color-mix` Verdict Badges

The `GradeCard` and `SummaryItemRow` components use `color-mix(in srgb, ...)` for verdict badge backgrounds — an anti-pattern per the style rulebook.

**Solution: Replace with CSS custom properties.** Use `bg-[var(--subject-chemistry)]/10 border-[var(--subject-chemistry)]/30 text-[var(--subject-chemistry)]` or Tailwind's opacity modifiers on background color tokens.

### 1.3 Proposed Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   Practice Arena Page                     │
│  Server: preloadQuery(api.subjects.list)                  │
│  Client Island:                                           │
│   ├─ PracticeArenaClient (phase machine)                  │
│   │   ├─ config → ConfigPanel                             │
│   │   │   ├─ SubjectSelector                              │
│   │   │   ├─ ModeSelector                                 │
│   │   │   ├─ DifficultySelector                           │
│   │   │   ├─ TopicPicker (grouped by chapter)             │
│   │   │   ├─ QuestionTypePicker                           │
│   │   │   └─ StartButton                                  │
│   │   ├─ starting → GeneratingSpinner                     │
│   │   ├─ running → PracticeRunner                         │
│   │   │   ├─ usePracticeRunner hook (7-state machine)     │
│   │   │   ├─ useTimer hook (isolated)                     │
│   │   │   ├─ ProgressBar                                  │
│   │   │   ├─ ItemInputRouter                              │
│   │   │   │   ├─ McqInput                                 │
│   │   │   │   ├─ EssayInput                               │
│   │   │   │   ├─ TranslationInput                         │
│   │   │   │   ├─ FormulaInput (wraps MathInput)           │
│   │   │   │   ├─ OralRecallInput                          │
│   │   │   │   ├─ StepProblemInput                         │
│   │   │   │   └─ DefaultTextInput                         │
│   │   │   └─ GradeCard (reusable)                         │
│   │   ├─ finishing → FinishingSpinner                     │
│   │   └─ summary → SummaryView                            │
│   │       ├─ GradeHero (reusable from my-topics)          │
│   │       ├─ MistakeReviewPanel                           │
│   │       └─ SummaryItemRow                               │
│   └─ error → ErrorCard                                    │
└──────────────────────────────────────────────────────────┘
```

### 1.4 File Split Plan

| Current | Proposed | Purpose |
|---|---|---|
| `PracticeRunner.tsx` (~900 lines) | `PracticeRunner.tsx` (~200 lines) | Orchestrator only |
| | `usePracticeRunner.ts` (~250 lines) | 7-state machine hook |
| | `useTimer.ts` (~60 lines) | Isolated timer hook |
| | `ItemInputRouter.tsx` (~60 lines) | Dispatches to type-specific inputs |
| | `McqInput.tsx` (~50 lines) | MCQ button group |
| | `EssayInput.tsx` (~60 lines) | Essay textarea + word count |
| | `TranslationInput.tsx` (~50 lines) | Source phrase + translation textarea |
| | `OralRecallInput.tsx` (~60 lines) | Textarea + self-check toggles |
| | `GradeCard.tsx` (~80 lines) | Reusable verdict + feedback card |
| `ConfigPanel.tsx` (~380 lines) | `ConfigPanel.tsx` (~150 lines) | Layout only |
| | `SubjectSelector.tsx` (~60 lines) | Subject list + selection |
| | `ModeSelector.tsx` (~80 lines) | Mode radio buttons |
| | `TopicPicker.tsx` (~80 lines) | Chapter-grouped topic selection |
| | `QuestionTypePicker.tsx` (~60 lines) | Toggle chips |

---

## 2. Code Style Guidelines

### 2.1 Extract Item Inputs to Components

Replace the 200-line `ItemInput` function in `PracticeRunner.tsx` with a clean dispatcher:

```typescript
function ItemInputRouter({ item, value, setValue, disabled, subjectSlug }: ItemInputRouterProps) {
  switch (item.type) {
    case "mcq": return <McqInput options={item.options} value={value} setValue={setValue} disabled={disabled} />;
    case "essay_analysis": return <EssayInput value={value} setValue={setValue} disabled={disabled} wordCountTarget={item.wordCountTarget} />;
    case "translation_drill": return <TranslationInput value={value} setValue={setValue} disabled={disabled} sourcePhrase={item.sourcePhrase} />;
    case "formula_derivation": return <FormulaInput value={value} setValue={setValue} disabled={disabled} startingExpression={item.startingExpression} />;
    case "oral_recall": return <OralRecallInput value={value} setValue={setValue} disabled={disabled} />;
    case "step_problem": return <StepProblemInput value={value} setValue={setValue} disabled={disabled} subjectSlug={subjectSlug} />;
    default: return <DefaultTextInput value={value} setValue={setValue} disabled={disabled} maxLength={maxLength} />;
  }
}
```

### 2.2 Extract `usePracticeRunner` Hook

The 7-state machine (loading → answering → grading → graded → finishing → summary → error) should be a reusable hook:

```typescript
function usePracticeRunner(runId: string, onFinish: (examGrades?: Map<string, GradeResponse>) => void) {
  return {
    phase, currentIndex, currentAnswer, setCurrentAnswer,
    grade, error, orderedItems, total, isExamMode, isTimedMode,
    timeRemaining, isTimeUp, examBulkPhase,
    onSubmit, onNext, onFinish: onFinishRun,
  };
}
```

### 2.3 Extract `useTimer` Hook

Isolate the timer logic from the runner, removing eslint-disable comments:

```typescript
function useTimer(timeLimitSec: number | null, startedAt: number, onTimeUp: () => void) {
  // Returns { timeRemaining, isTimeUp }
  // Calls onTimeUp exactly once when time reaches 0
}
```

### 2.4 Parallel Exam Grading

Replace sequential `for...of` with `Promise.allSettled`:

```typescript
// BEFORE (sequential, ~10s for 5 items):
for (const item of ungradedItems) {
  const res = await fetch(endpoint, ...); // blocks
  graded++;
}

// AFTER (parallel, ~2s for 5 items):
const results = await Promise.allSettled(
  ungradedItems.map(async (item) => {
    const res = await fetch(endpoint, ...);
    return res.ok ? (await res.json()) as GradeResponse : null;
  })
);
```

### 2.5 Standardize to English

| German (current) | English (proposed) |
|---|---|
| `Übungsarena` | `Practice Arena` |
| `Starte eine schnelle Übungseinheit...` | `Start a quick practice session...` |
| `Konfiguriere eine eigene Übungseinheit...` | `Configure a practice session across subjects, modes, and question types.` |
| `Generiere Übungsaufgaben...` | `Generating practice questions...` |
| `Netzwerkfehler` | `Network error` |
| `KI-Generierung fehlgeschlagen` | `AI generation failed. Try again in a moment.` |
| `Zurück zur Konfiguration` | `Back to config` |
| `Wiederholung fehlgeschlagen` | `Retry failed` |
| `Fehler bei der Wiederholung` | `Retry error` |

### 2.6 Remove `color-mix` Verdict Badges

Replace inline `color-mix` styles with CSS custom property classes. Use the existing `var(--subject-chemistry)` / `var(--subject-german)` / `var(--subject-french)` pattern already established elsewhere in the app.

### 2.7 Add `currentItemIndex` to Run Row for Resume

```typescript
// convex/schema.ts — topicLessonPractice table
currentItemIndex: v.optional(v.number()),
```

Update the runner to write `currentItemIndex` on each advance, and read it on mount to initialize `currentIndex`.

---

## 3. Quality Constraints

### 3.1 Performance Budgets

| Metric | Target | Measurement |
|---|---|---|
| **Config panel first paint** | < 300ms | Preloaded subjects available on first render |
| **Practice generation** | < 4.0s p95 | POST `/api/practice/arena/start` → items appear |
| **Per-item grading (sequential)** | < 2.0s p95 | POST `/api/practice/arena/grade` → verdict appears |
| **Exam bulk grading** | < 3.0s p95 | After parallelization: slowest single grade + overhead |
| **Summary page load** | < 200ms | Two Convex queries + in-memory computation |
| **Retry wrong items** | < 3.0s p95 | POST `/api/practice/arena/retry` → items appear |

### 3.2 Query Latency Budgets (p95)

| Query | Budget | Notes |
|---|---|---|
| `practiceArena.getArenaRun` | < 30ms | Single document get |
| `practiceArena.getArenaRunItems` | < 100ms | Index scan + per-item attempt join |
| `practiceArena.listTopicsForSubject` | < 150ms | After batching chapter queries |
| `practiceArena.getLessonContentForTopics` | < 200ms | Per-topic lesson lookup |
| `practiceArena.getSubjectSlugForTopic` | < 30ms | Topic → chapter → subject chain |

### 3.3 Caps on Unbounded Collects

| Location | Current | Cap |
|---|---|---|
| `listTopicsForSubject` — chapters | `.collect()` — no cap | `.take(20)` |
| `listTopicsForSubject` — topics per chapter | `.collect()` — per chapter | Combined `.take(200)` |
| `getArenaRunItems` — items | `.collect()` — no cap | `.take(50)` (max config is 8 items) |
| `getArenaRunItems` — attempts | Per-item `.first()` — O(items) | Already bounded by items cap |
| `finishArenaPracticeInner` — items + attempts | `.collect()` — no cap | Same as above, bounded by item count |

### 3.4 Error States

| State | Visual | Action |
|---|---|---|
| **AI generation failed** | Error card with retry button | "Try again" → re-POST to start route |
| **Grader failed** | Inline error message | "Try again" → re-submit same answer |
| **Network error** | Error card | "Back to config" button |
| **Run already graded** | Auto-redirects to summary | None — handled automatically |
| **Topic not found** | Error card | "Back to config" |
| **No subjects enrolled** | ConfigPanel empty state | "Enroll in a subject to start practicing" |
| **MCQ with no options** | Warning message | "This MCQ has no options recorded" |
| **Refresh during run** | Resumes at last `currentItemIndex` | Answer field empty, re-type and continue |

### 3.5 Accessibility

- All inputs have `<label>` associations
- MCQ buttons use `role="radio"` or `aria-pressed`
- Timer is announced via `aria-live="polite"` region
- MathInput toolbar buttons have `aria-label`
- Progress bar has `aria-valuenow` + `aria-valuemax`
- Oral recall self-check buttons have clear labels

---

## 4. Testing Strategy

### 4.1 Unit Tests (Vitest)

| Test file | What it covers |
|---|---|
| `convex/practiceArena.test.ts` | `startArenaPractice` (single/multi-topic, mode flags), `retryWrongItems` (round increment, wrong item filter), `finishArenaPractice` (mastery/confidence update), `recordArenaAttempt` (answeredCount increment, auto-finish) |
| `src/lib/hooks/usePracticeRunner.test.ts` | State machine transitions, next/previous logic, exam answer collection |
| `src/lib/hooks/useTimer.test.ts` | Countdown, time-up callback, cleanup on unmount |
| `src/lib/ai/prompts/practiceArena.test.ts` | Item generation schema validation, mode-specific prompts |

### 4.2 Component Tests (React Testing Library)

| Test | What it verifies |
|---|---|
| `ConfigPanel` renders subject list | Enrolled subjects shown, non-enrolled hidden |
| `ConfigPanel` mode selection | Clicking a mode updates selection + topic behavior |
| `ConfigPanel` start disabled when no topic selected | Button disabled state |
| `ConfigPanel` question type toggle minimum 1 | Can't deselect last question type |
| `McqInput` renders options + selection | Clicking an option selects it, deselects others |
| `EssayInput` shows word count | Word count updates as user types |
| `OralRecallInput` self-check toggles | "[self-check: correct]" appended to value |
| `MathInput` toolbar buttons insert LaTeX | Click "Fraction" inserts `\frac{}{}` |
| `PracticeRunner` exam mode hides feedback | No GradeCard rendered in exam mode |
| `PracticeRunner` timed mode shows countdown | Timer visible, turns red < 60s |
| `SummaryView` renders grade hero | Correct grade number + label + color |
| `SummaryView` retry wrong button | Button click calls onRetryWrong with correct itemIds |
| `SummaryItemRow` renders verdict badge | Correct color + label + score |

### 4.3 API Route Tests

| Test | What it verifies |
|---|---|
| `POST /api/practice/arena/start` returns runId + itemIds | Valid response shape |
| `POST /api/practice/arena/start` 422 on empty topic list | Validation error |
| `POST /api/practice/arena/grade` returns verdict + feedback + betterAnswer | All fields present |
| `POST /api/practice/arena/grade` 404 on invalid runId | Not found |
| `POST /api/practice/arena/retry` returns new runId | Valid response, wrongItemIds filtered |

### 4.4 Manual QA Checklist

- [ ] Open `/practice` — config panel renders with enrolled subjects
- [ ] Select a subject, pick a topic, configure mode + difficulty + question types, click Start
- [ ] Answer a question — grade card appears with verdict + feedback + better answer
- [ ] Complete all questions — summary page renders with grade hero
- [ ] Summary shows mistake review panel with per-item feedback
- [ ] Click "Retry wrong" — new run starts with only wrong items
- [ ] Click "New session" — returns to config
- [ ] Timed mode: timer counts down, auto-submits on time-up
- [ ] Exam simulation: no feedback during run, bulk grading on finish
- [ ] MathInput: toolbar buttons insert LaTeX, preview renders
- [ ] MCQ input: click option to select, A/B/C/D labels visible
- [ ] Translation drill: source phrase visible, translation textarea
- [ ] Oral recall: self-check buttons work, [self-check:] tag appended
- [ ] Refresh during a run — resumes at last item
- [ ] Open `/practice?topicId=...` — auto-starts a 5-question sequential run
- [ ] Dark mode — all components render legibly

---

## 5. Deployment Plan

### 5.1 Phase A: Refactor Extraction (zero visual change)

| Step | What | Risk |
|---|---|---|
| **A1** | Extract `usePracticeRunner` hook from `PracticeRunner.tsx` | High — must preserve all 7 states + exam grading + timer integration |
| **A2** | Extract `useTimer` hook — remove eslint-disable comments | Medium — timer behavior must be identical |
| **A3** | Extract `ItemInputRouter` + all input components (McqInput, EssayInput, TranslationInput, FormulaInput, OralRecallInput, StepProblemInput) | Medium — must handle all 8 question types |
| **A4** | Extract `GradeCard` as reusable component (shared with my-topics practice) | Low — pure extraction |
| **A5** | Extract `SubjectSelector`, `ModeSelector`, `TopicPicker`, `QuestionTypePicker` from `ConfigPanel` | Low — pure extraction |

**Validation:** Full QA checklist pass + `npm run typecheck` + `npm run test` after each step.

### 5.2 Phase B: Performance Improvements

| Step | What | Risk |
|---|---|---|
| **B1** | Parallelize exam bulk grading with `Promise.allSettled` | Medium — must handle partial failures gracefully |
| **B2** | Batch chapter queries in `listTopicsForSubject` | Low — shared index, same output shape |
| **B3** | Add `currentItemIndex` to schema + resume-on-refresh | Medium — schema change + client logic |
| **B4** | Add caps on unbounded `collect()` calls | Low |

**Validation:** Exam mode finishes faster (parallel grading). Refresh during run resumes correctly.

### 5.3 Phase C: UI & Polish

| Step | What | Risk |
|---|---|---|
| **C1** | Standardize all labels to English | Low — string changes only |
| **C2** | Remove `color-mix` verdict badges — replace with CSS custom properties | Low — visual change |
| **C3** | Share `GradeHero` component between practice arena + my-topics results | Low — uses existing component from my-topics B6 |
| **C4** | Dark mode audit of all practice components | Low |
| **C5** | Mobile responsive audit (MathInput toolbar, MCQ options, timer) | Low |

**Validation:** Full QA checklist. All labels in English. Verdict badges use CSS variables.

### 5.4 Phase D: Error Handling & Resilience

| Step | What | Risk |
|---|---|---|
| **D1** | Add specific error messages for each failure mode (AI generation vs network vs grader) | Low |
| **D2** | Add retry-with-backoff for grader failures | Medium — exponential backoff with max 3 retries |
| **D3** | Add offline detection — disable Start button when offline | Low |
| **D4** | Add query latency telemetry to arena queries | Low |

### 5.5 Feature Flag

Gate behind `NEXT_PUBLIC_PRACTICE_ARENA_V2`:

```typescript
const useV2 = process.env.NEXT_PUBLIC_PRACTICE_ARENA_V2 === "true";
if (useV2) return <PracticeArenaPageV2 {...props} />;
return <PracticeArenaPageV1 {...props} />;
```

### 5.6 Migration Strategy

| Migration | Approach | Rollback |
|---|---|---|
| Schema: `currentItemIndex` | Add optional field, no backfill | Remove field |
| Exam grading: sequential → parallel | Feature-flagged, verify identical results | Revert to sequential |
| Labels: German → English | String replacements | Revert strings |
| Components: extracted | New files, old code removed | Revert to monolith |
