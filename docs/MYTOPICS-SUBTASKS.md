# My Topics Improvement Subtasks

> 27 subtasks across 4 phases. Each is self-contained with concrete inputs, outputs, and a validation command.

---

## Dependency Graph

```
Phase A (Refactor & Performance):
A1 ── A2 ── B2, B3
A3 ── A4
A5
A6
A7 ── (from A4: needs batch-load output shape)
A8 ── (from A7: needs PracticeClient hook extraction)
A9 ── (from A4: needs batch-load in place for caps)

Phase B (UI improvements):
B1 ── (independent)
B2 ── (depends on A2: needs deleteUserTopic mutation)
B3 ── (depends on A2: needs renameUserTopic mutation)
B4 ── (independent)
B5 ── (independent)
B6 ── (independent)
B7 ── (depends on A8: needs usePracticeRun hook)

Phase C (Edge cases + polish):
C1, C2, C3, C4, C5 (all independent of each other)

Phase D (Performance hardening):
D1, D2, D3 (all independent of each other)
```

**Parallel starting points:** A1, A5, B1, B4, B5, C2, C3 have zero dependencies and can be started simultaneously.

---

## Phase A: Refactor & Performance (zero visual change)

### A1 — Add `deletedAt` field to topics schema

| Field | Value |
|---|---|
| **Input** | Read: `convex/schema.ts` — find `topics` table definition (around line 55) |
| **Modify** | `convex/schema.ts` — add `deletedAt: v.optional(v.number())` to the `topics` defineTable |
| **What** | Optional field for soft-deletes. No backfill needed. Existing topics have `undefined`. |
| **Validate** | `npm run typecheck` |
| **Effort** | 5 min |

### A2 — Add `deleteUserTopic` and `renameUserTopic` mutations

| Field | Value |
|---|---|
| **Input** | Read: `convex/topics.ts` — existing mutation patterns (lines 1–450), specifically `createUserTopic` (lines 63–123) and `regenerateTopicLesson` (lines 125–169) |
| **Modify** | `convex/topics.ts` — add two new mutations after `markMastered` |
| **What** | `deleteUserTopic`: checks ownership (`source === "user"` && `ownerId === user._id`), patches `deletedAt: Date.now()`. Returns `null`. `renameUserTopic`: checks ownership, generates new slug via `uniqueSlug`, patches `title` + `slug`. Returns `null`. |
| **Validate** | `npm run typecheck` + manual: call both mutations via Convex dashboard, verify rows update |
| **Effort** | 25 min |

### A3 — Consolidate `getBySlugAndOwner` into `getOwnedTopicBySlug`

| Field | Value |
|---|---|
| **Input** | Read: `convex/topics.ts` — `getBySlugAndOwner` (lines 315–352) and `getOwnedTopicBySlug` (lines 354–430). Find all callers of `getBySlugAndOwner` via code search. |
| **Modify** | `convex/topics.ts` — remove `getBySlugAndOwner`. Update all callers to use `getOwnedTopicBySlug` |
| **What** | `getOwnedTopicBySlug` already resolves the owner server-side via `resolveUser` — no need for explicit `ownerId` arg. Consolidate into one query. Update callers in `TopicList.tsx`, `NextBestTopicCard.tsx`, `ContinueStudyingCard.tsx`, and any other references. |
| **Validate** | `npm run typecheck` + `npm run test` |
| **Effort** | 20 min |

### A4 — Batch-load lessons + runs in `listUserTopicsByOwner`

| Field | Value |
|---|---|
| **Input** | Read: `convex/topics.ts` — `listUserTopicsByOwner` handler (lines 244–313), specifically the per-topic `for` loop |
| **Modify** | `convex/topics.ts` — replace the N+1 loop with two batch queries |
| **What** | After collecting all topics, run ONE `topicLessons.by_topic` collection (filter in-memory by matching `topicId` from the topics set) and ONE `topicLessonPractice.by_user` scan. Build `Map<Id<"topics">, latestLesson>` and `Map<Id<"topics">, latestRun>` in memory. Return the same output shape. Add `.take(100)` on topics, `.take(500)` on lessons, `.take(500)` on runs. Filter out topics where `deletedAt !== undefined`. |
| **Validate** | `npm run typecheck` + manual: compare topic list before/after — same topics, same order, same data |
| **Effort** | 35 min |

### A5 — Add server preloading to `my-topics/page.tsx`

| Field | Value |
|---|---|
| **Input** | Read: `app/(app)/my-topics/page.tsx` (all ~230 lines). Reference: `app/(app)/dashboard/page.tsx` for preloading pattern. |
| **Modify** | `app/(app)/my-topics/page.tsx` — convert from `"use client"` to server component with `preloadQuery`. Create `MyTopicsClient.tsx` as a thin client island that uses `usePreloadedQuery`. |
| **What** | Server page: auth check, `getToken({ template: "convex" })`, `preloadQuery(api.topics.listUserTopicsByOwner, {})`, passes `preloaded` to client island. Client island: `usePreloadedQuery(preloaded)`, renders topic list. Keep `EmptyState` and `Skeleton` in the client island. |
| **Validate** | `npm run typecheck` + manual: open `/my-topics` — topics appear immediately (no skeleton flash) |
| **Effort** | 30 min |

### A6 — Add server preloading to `my-topics/[topicSlug]/lesson/page.tsx`

| Field | Value |
|---|---|
| **Input** | Read: `app/(app)/my-topics/[topicSlug]/lesson/page.tsx` (lines 1–38) and `LessonClient.tsx` (lines 1–290) |
| **Modify** | Both files — page server component preloads `getOwnedTopicBySlug`, passes `topicPreloaded` to `LessonClient`. `LessonClient` uses `usePreloadedQuery` for the topic, keeps `useQuery` for the lesson (it depends on `topic.id`). |
| **What** | Server preloads the topic query so the first paint already has the topic data. The lesson query still runs client-side since it depends on `topic.id` — but the topic resolution is instant. |
| **Validate** | `npm run typecheck` + manual: open a lesson page — no skeleton flash for topic resolution |
| **Effort** | 25 min |

### A7 — Add parallel preloading to results page

| Field | Value |
|---|---|
| **Input** | Read: `app/(app)/my-topics/[topicSlug]/practice/results/page.tsx` (lines 1–30) and `ResultsClient.tsx` (lines 1–400) |
| **Modify** | Both files — page preloads `getOwnedTopicBySlug`. Create new `ResultsClientV2.tsx` that uses `usePreloadedQuery` for topic, then preloads the remaining 3 queries client-side |
| **What** | The server preloads the topic. The client island then preloads `getLatestPracticeRunForOwnedTopic`, `getLessonPracticeRun`, and `getLessonPracticeRunItems` in parallel via `Promise.all` — no more sequential waterfall. |
| **Validate** | `npm run typecheck` + manual: open a results page — all data loads simultaneously |
| **Effort** | 30 min |

### A8 — Extract `usePracticeRun` hook from `PracticeClient.tsx`

| Field | Value |
|---|---|
| **Input** | Read: `app/(app)/my-topics/[topicSlug]/practice/PracticeClient.tsx` — the full 6-state machine (lines 50–230) |
| **Create** | `src/lib/hooks/usePracticeRun.ts` |
| **Modify** | `app/(app)/my-topics/[topicSlug]/practice/PracticeClient.tsx` — replace lines 50–230 with single hook call |
| **What** | Extract the state machine: `phase`, `runId`, `itemIds`, `currentIndex`, `currentAnswer`, `grade`, `error`, `items`, `progress`, `answeredCount`, `total`, `onSubmit`, `onNext`, `onFinish`, `onAbandon`. The hook accepts `(topicSlug)` and returns the full state object. Keeps the start-effect, submit-handler, grading logic, finish/abandon mutations. |
| **Validate** | `npm run typecheck` + manual: run a full practice session — all 5 questions, grading, finish, results page |
| **Effort** | 45 min |

### A9 — Add caps on all unbounded `collect()` calls

| Field | Value |
|---|---|
| **Input** | Read: `convex/topics.ts` — every `.collect()` call in `listUserTopicsByOwner`, `getTopicLesson` |
| **Modify** | `convex/topics.ts` — replace unbounded `.collect()` with `.take(N)` per the design doc caps: topics `.take(100)`, lessons `.take(500)` (single batch scan), runs `.take(500)`, versions `.take(20)` |
| **What** | Prevent unbounded growth. Already partially addressed in A4 for `listUserTopicsByOwner`. |
| **Validate** | `npm run typecheck` |
| **Effort** | 10 min |

---

## Phase B: UI Improvements

### B1 — Create `TopicsSearch` component

| Field | Value |
|---|---|
| **Input** | Read: `components/dashboard/SubjectsSearch.tsx` for search pattern reference |
| **Create** | `components/dashboard/TopicsSearch.tsx` |
| **Modify** | `app/(app)/my-topics/page.tsx` (or `MyTopicsClient.tsx` from A5) — add `<TopicsSearch>` above the topic list |
| **What** | Client-side search with two controls: a `<input>` for title substring match + a `<select>` for difficulty filter (All / EASY / MEDIUM / HARD). Filter runs in `useMemo` on the topics array. Search state lives in the client island. |
| **Validate** | `npm run typecheck` + manual: type "log" — only matching topics; select "HARD" — only HARD topics; both combined |
| **Effort** | 25 min |

### B2 — Add delete button + confirmation to topic rows

| Field | Value |
|---|---|
| **Input** | Read: `app/(app)/my-topics/page.tsx` — the topic row rendering (lines 68–169) |
| **Modify** | `app/(app)/my-topics/page.tsx` — add a small delete icon button (trash icon) at the end of each topic row. Click shows a confirmation dialog ("Delete this topic? Lessons and practice history will be preserved.") with Confirm / Cancel. Confirm calls `deleteUserTopic` mutation from A2. |
| **What** | Inline delete with confirmation. After delete, the topic disappears from the list (Convex reactivity). |
| **Validate** | `npm run typecheck` + manual: delete a topic — confirmation appears, topic removed on confirm |
| **Effort** | 20 min |

### B3 — Add rename inline edit to topic rows

| Field | Value |
|---|---|
| **Input** | Read: `app/(app)/my-topics/page.tsx` — topic title rendering (lines 82–84) |
| **Modify** | `app/(app)/my-topics/page.tsx` — wrap topic title in a click-to-edit pattern. Click the title → inline `<input>` appears with current title. Press Enter → calls `renameUserTopic` mutation. Press Escape → cancel. |
| **What** | Inline rename. After rename, the slug updates and links still resolve correctly (the mutation updates both title + slug). |
| **Validate** | `npm run typecheck` + manual: click a topic title, type a new name, press Enter — title + slug update |
| **Effort** | 25 min |

### B4 — Standardize all labels to English

| Field | Value |
|---|---|
| **Input** | Read: `app/(app)/my-topics/page.tsx` (all German labels), `LessonClient.tsx`, `PracticeClient.tsx`, `ResultsClient.tsx` |
| **Modify** | All four files — replace German strings with English per the table in the design doc §2.5 |
| **What** | "Deine Themen" → "Your Topics", "Mein Thema" → "My topic", "Wartet auf erste Übung" → "Awaiting first practice", "Übung starten" → "Start practice", "Lektion öffnen" → "Open lesson", "Noch keine eigenen Themen erstellt" → "No topics created yet", "Fächer durchsuchen" → "Browse subjects". Also update the breadcrumb path from `/ meine-themen` to `/ your-topics`. |
| **Validate** | `npm run typecheck` + visual: all labels read in English |
| **Effort** | 20 min |

### B5 — Remove all `color-mix` icon containers

| Field | Value |
|---|---|
| **Input** | Read: `app/(app)/my-topics/page.tsx` — empty state icon container (lines 190–200), `LessonClient.tsx` — icon containers (lines 55–64, 217–226, 284–292), `PracticeClient.tsx` — loading spinner icon container (lines 274–281), `ResultsClient.tsx` — no-grade icon container (lines 347–353) |
| **Modify** | All four files — remove `<span>` wrappers with `color-mix` backgrounds. Replace with plain icons at native size with subject color via CSS variables. |
| **What** | Anti-pattern #2 removal per the frontend style rulebook. Icons render at `h-6 w-6` with `style={{ color: "var(--subject-chemistry)" }}` or appropriate subject color variable. |
| **Validate** | `npm run typecheck` + visual: icons visible without background containers |
| **Effort** | 15 min |

### B6 — Split `ResultsClient.tsx` into `GradeHero` + `ItemRow`

| Field | Value |
|---|---|
| **Input** | Read: `app/(app)/my-topics/[topicSlug]/practice/results/ResultsClient.tsx` — grade card (lines 110–170) and `ItemRow` (lines 228–398) |
| **Create** | `components/dashboard/GradeHero.tsx`, `components/dashboard/PracticeItemRow.tsx` |
| **Modify** | `ResultsClient.tsx` — import and use both components, remove inline definitions |
| **What** | `GradeHero`: the big 1-6 grade badge + score percentage + summary text. `PracticeItemRow`: per-item verdict chip + feedback + better answer + rubric expandable + tutor deep-link. Both are pure presentational components. |
| **Validate** | `npm run typecheck` + manual: results page renders identically |
| **Effort** | 25 min |

### B7 — Extract `AnswerInput` component from `PracticeClient.tsx`

| Field | Value |
|---|---|
| **Input** | Read: `app/(app)/my-topics/[topicSlug]/practice/PracticeClient.tsx` — textarea + submit button section (lines 360–410) |
| **Create** | `components/dashboard/PracticeAnswerInput.tsx` |
| **Modify** | `PracticeClient.tsx` — import and use `PracticeAnswerInput`, remove inline textarea + submit button |
| **What** | `PracticeAnswerInput`: textarea with maxLength + char count + submit button (disabled when empty) + grading spinner. Props: `{ answer, onChange, disabled, onSubmit, isGrading }`. Pure presentational. |
| **Validate** | `npm run typecheck` + manual: practice textarea + submit works identically |
| **Effort** | 15 min |

---

## Phase C: Edge Cases & Polish

### C1 — Audit all empty states per design doc §3.4

| Field | Value |
|---|---|
| **Input** | Read: all four My Topics client files — every conditional return path |
| **Modify** | Any file where an empty/error state is missing or incomplete |
| **What** | Verify each state from the table in §3.4 renders correctly with the right message, icon, and CTA. Fix any missing states (e.g., the "degraded lesson" state already exists in `LessonClient.tsx` but may need a "Regenerate" button per C4). |
| **Validate** | Visual: trigger each state manually, verify correct rendering |
| **Effort** | 20 min |

### C2 — Dark mode audit of all My Topics components

| Field | Value |
|---|---|
| **Input** | Read: `app/(app)/my-topics/page.tsx`, `LessonClient.tsx`, `PracticeClient.tsx`, `ResultsClient.tsx`, `AddTopicForm.tsx` |
| **Modify** | Any hardcoded light-mode colors → CSS custom properties |
| **What** | Set `prefers-color-scheme: dark` in dev tools. Verify: search input visible, topic rows readable, grade badges legible, practice textarea contrast sufficient, results feedback cards visible, `AddTopicForm` inputs visible, streaming preview readable, empty state icons visible. |
| **Validate** | Visual: dark mode toggle — all components render legibly |
| **Effort** | 20 min |

### C3 — Mobile responsive audit

| Field | Value |
|---|---|
| **Input** | Read: all My Topics files — check responsive classes |
| **Modify** | Adjust responsive classes where needed |
| **What** | Set viewport to 375px. Verify: topic rows stack vertically (already `flex-col sm:flex-row`), practice textarea doesn't overlap keyboard, results grade card stacks vertically, delete/rename actions accessible, search + filter wrap correctly, breadcrumb doesn't overflow. |
| **Validate** | Visual: mobile viewport — all components usable |
| **Effort** | 15 min |

### C4 — Add "Regenerate" button to degraded lesson state

| Field | Value |
|---|---|
| **Input** | Read: `app/(app)/my-topics/[topicSlug]/lesson/LessonClient.tsx` — `DegradedLesson` component (lines 238–256) |
| **Modify** | `LessonClient.tsx` — add a "Regenerate lesson" button to the `DegradedLesson` component that navigates back to the chapter page (where `AddTopicForm` lives) |
| **What** | The degraded lesson card currently has no CTA — just an explanation. Add a button: "Regenerate from chapter →" linking to `/subjects/${topic.subjectSlug}/${topic.chapterSlug}`. |
| **Validate** | `npm run typecheck` + visual: degraded lesson card shows regenerate button |
| **Effort** | 10 min |

### C5 — Add sort option to index page

| Field | Value |
|---|---|
| **Input** | Read: `app/(app)/my-topics/page.tsx` — topic list rendering |
| **Modify** | `app/(app)/my-topics/page.tsx` — add a sort dropdown: "Newest first" (default), "Last practiced", "Alphabetical" |
| **What** | Client-side sort using `useMemo`. The topic list is already in-memory — sorting is instant. |
| **Validate** | `npm run typecheck` + visual: change sort option — list reorders correctly |
| **Effort** | 15 min |

---

## Phase D: Performance Hardening (deferrable)

### D1 — Add query latency telemetry

| Field | Value |
|---|---|
| **Input** | Read: `src/lib/ai/telemetry.ts` — `logAiGeneration` pattern |
| **Modify** | `convex/topics.ts` — add timing around `listUserTopicsByOwner` and `getOwnedTopicBySlug` handler bodies, fire-and-forget telemetry write |
| **What** | Record p50/p95 latency for the two most-used queries. Use `ctx.scheduler.runAfter(0, ...)` for non-blocking telemetry writes. |
| **Validate** | `npm run typecheck` + check telemetry table for `task: "topics.query.listUserTopicsByOwner"` rows |
| **Effort** | 15 min |

### D2 — Add `Suspense` boundaries for supplementary data

| Field | Value |
|---|---|
| **Input** | Read: `LessonClient.tsx` (lesson loading, lines 40–44), `ResultsClient.tsx` (chained item loading) |
| **Modify** | Both files — wrap lesson sections and results items in `<Suspense fallback={<Skeleton />}>` |
| **What** | The lesson page shows the topic header immediately while lesson sections stream in. The results page shows the grade hero immediately while item rows load. |
| **Validate** | `npm run typecheck` + visual: topic header renders before lesson sections appear |
| **Effort** | 20 min |

### D3 — Add pagination consideration for > 50 topics

| Field | Value |
|---|---|
| **Input** | Read: `convex/topics.ts` — `listUserTopicsByOwner` |
| **Modify** | Add a `cursor` + `limit` arg pattern (like `listMessages` in `convex/tutor.ts`) |
| **What** | Optional pagination for power users. If omitted, returns first 50. Otherwise, uses `cursor` for offset-based pagination. Client renders "Load more" button. Only implement if needed — defer to future phase. |
| **Validate** | `npm run typecheck` |
| **Effort** | 30 min |

---

## Summary

| Phase | Subtasks | Est. time | What changes |
|---|---|---|---|
| **A** (Refactor & Performance) | 9 tasks | ~3.75 hrs | Schema field, 2 new mutations, consolidated queries, batch-loaded N+1 → 2 queries, server preloading on 3 pages, extracted `usePracticeRun` hook, caps on collects — zero visual change |
| **B** (UI improvements) | 7 tasks | ~2.5 hrs | `TopicsSearch` component, delete + rename actions, English labels, `color-mix` removal, `GradeHero` + `PracticeItemRow` + `PracticeAnswerInput` component extraction |
| **C** (Edge cases & Polish) | 5 tasks | ~1.5 hrs | Empty state audit, dark mode audit, mobile audit, regenerate button on degraded lesson, sort option |
| **D** (Performance hardening) | 3 tasks | ~1 hr | Telemetry, Suspense boundaries, pagination — all deferrable |

**Total: 27 subtasks, ~8.75 hours estimated.**

**Parallel starting points:** A1, A5, B1, B4, B5, C2, C3 have zero dependencies and can be started simultaneously.
