# My Topics Improvement Design Doc

> Status: proposal
> Target: Synedrix My Topics surface (`/my-topics`, `convex/topics.ts`, `app/api/topics/*`, `components/dashboard/AddTopicForm.tsx`)
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

The My Topics surface spans **five route segments** and **four layers**:

| Layer | Files | Lines | Responsibility |
|---|---|---|---|
| **Index page** | `app/(app)/my-topics/page.tsx` | ~230 | List user-owned topics, empty state, skeleton |
| **Lesson page** | `app/(app)/my-topics/[topicSlug]/lesson/page.tsx` | ~35 | Auth gate, seed bootstrap |
| | `app/(app)/my-topics/[topicSlug]/lesson/LessonClient.tsx` | ~290 | Topic resolution, lesson rendering, "not found" / "no lesson" / "degraded" / "valid" states |
| **Practice page** | `app/(app)/my-topics/[topicSlug]/practice/page.tsx` | ~35 | Auth gate, seed bootstrap |
| | `app/(app)/my-topics/[topicSlug]/practice/PracticeClient.tsx` | ~700 | State machine (starting → answering → grading → graded → finishing → error), practice run lifecycle |
| **Results page** | `app/(app)/my-topics/[topicSlug]/practice/results/page.tsx` | ~30 | Auth gate |
| | `app/(app)/my-topics/[topicSlug]/practice/results/ResultsClient.tsx` | ~400 | Chained query resolution, grade card, per-item feedback table, tutor deep-link |
| **Chapter entry** | `components/dashboard/AddTopicForm.tsx` | ~310 | Lesson generation form, `experimental_useObject` streaming |
| **Convex backend** | `convex/topics.ts` | ~450 | User topic CRUD, lesson management, practice run queries |
| | `convex/practice.ts` | (existing) | Practice run lifecycle (lesson practice variants) |
| **API routes** | `app/api/topics/lesson/stream.ts` | — | Streaming lesson generation (AI → Convex) |
| | `app/api/topics/practice/start.ts` | — | Practice run creation (AI → Convex) |
| | `app/api/topics/practice/grade.ts` | — | Per-item AI grading |

### 1.2 Key Architectural Problems

#### Problem 1: No Server Preloading — Everything is Client-Side `useQuery`

Every page in the My Topics surface is a thin server shell that does auth + seed bootstrap, then mounts a client island that calls `useQuery`. This means:

- **FOUC (Flash of Unstyled Content):** Every page shows a skeleton while Convex initializes. On cold starts, this is 200–500ms of blank space.
- **Waterfall on results page:** `ResultsClient` chain-loads 4 queries: `getOwnedTopicBySlug` → `getLatestPracticeRunForOwnedTopic` → `getLessonPracticeRun` → `getLessonPracticeRunItems`. Each waits for the previous result.
- **No streaming:** The lesson page waits for `topic` AND `lesson` to resolve before showing anything. These could load in parallel.

**Solution: Tiered preloading with `preloadQuery` on the server.**

The pages already have access to Clerk's `auth()` — they can preload the Convex queries server-side using `preloadQuery` with the Clerk JWT token:

```typescript
// app/(app)/my-topics/[topicSlug]/lesson/page.tsx (proposed)
export default async function MyTopicLessonPage({ params }) {
  const { userId, getToken } = await auth();
  if (!userId) redirect("/sign-in");
  const { topicSlug } = await params;
  const token = await getToken({ template: "convex" });

  const topicPreloaded = await preloadQuery(
    api.topics.getOwnedTopicBySlug,
    { slug: topicSlug },
    token ? { token } : {}
  );

  return <LessonClient topicSlug={topicSlug} topicPreloaded={topicPreloaded} />;
}
```

The client island uses `usePreloadedQuery` instead of `useQuery` — data is available on first paint. For the results page, preload all four queries in parallel.

#### Problem 2: N+1 Queries in `listUserTopicsByOwner`

For each topic in the list, `listUserTopicsByOwner` does two sub-queries:
1. `topicLessons.by_topic` — fetch all lessons, sort by version, take latest
2. `topicLessonPractice.by_user_topic` — fetch all runs, sort by startedAt, take latest

For 20 topics, that's 40 additional queries. Each adds ~15–30ms.

**Solution: Batch the joins.**

Replace the per-topic sub-queries with two batch queries:

```typescript
// After collecting all topics, batch-load lessons and runs
const allLessons = await ctx.db
  .query("topicLessons")
  .withIndex("by_topic", (q) => ...) // Use .filter with "in" on topicIds
  .collect();

const allRuns = await ctx.db
  .query("topicLessonPractice")
  .withIndex("by_user", (q) => q.eq("userId", ownerId))
  .collect();
```

Then build a `Map<topicId, latestLesson>` and `Map<topicId, latestRun>` in memory. Two queries instead of 2N.

Since Convex doesn't support `IN` filters natively, use a single `.by_user` index scan for runs (already scoped to the owner) and a single collection from `topicLessons` filtered in memory by `topicId`.

#### Problem 3: Duplicate Query — `getOwnedTopicBySlug` vs `getBySlugAndOwner`

These two queries do the same thing: resolve a slug to a user-owned topic with chapter/subject context. `getOwnedTopicBySlug` adds `latestLesson` to the return shape. `getBySlugAndOwner` requires an explicit `ownerId` arg — but the server already knows the owner from auth.

**Solution: Consolidate into a single `getOwnedTopicBySlug` query.**

Add `latestLesson` to the return shape (already there). Remove `getBySlugAndOwner` — all callers of `getBySlugAndOwner` can use `getOwnedTopicBySlug` since the server-side `resolveUser` already gates by the authenticated user.

#### Problem 4: Missing CRUD — No Delete or Rename

User-owned topics have no delete or rename mutations. A student who creates a topic with a typo in the title is stuck with it. A topic created for a one-off study session clutters the list forever.

**Solution: Add `deleteUserTopic` and `renameUserTopic` mutations.**

```typescript
// convex/topics.ts
export const deleteUserTopic = mutation({
  args: { topicId: v.id("topics") },
  returns: v.null(),
  handler: async (ctx, { topicId }) => {
    const user = await requireUser(ctx);
    const topic = await ctx.db.get(topicId);
    if (!topic || topic.source !== "user" || topic.ownerId !== user._id) {
      throw new ConvexError("forbidden");
    }
    // Soft-delete: set `deletedAt` on the topic row.
    // Lessons and practice runs remain for analytics.
    await ctx.db.patch(topicId, { deletedAt: Date.now() });
  },
});

export const renameUserTopic = mutation({
  args: { topicId: v.id("topics"), title: v.string() },
  returns: v.null(),
  handler: async (ctx, { topicId, title }) => {
    const user = await requireUser(ctx);
    const topic = await ctx.db.get(topicId);
    if (!topic || topic.source !== "user" || topic.ownerId !== user._id) {
      throw new ConvexError("forbidden");
    }
    const slug = await uniqueSlug(ctx, title);
    await ctx.db.patch(topicId, { title: title.trim(), slug });
  },
});
```

Add `deletedAt: v.optional(v.number())` to the `topics` table schema. Filter deleted topics out of `listUserTopicsByOwner` and `getOwnedTopicBySlug`.

#### Problem 5: Monolithic Practice Client (~700 lines)

`PracticeClient.tsx` manages a 6-state machine, 4 `useQuery` subscriptions, 2 mutations, 3 fetch calls, error handling, progress bar, and all the UI rendering — all in one file with no extracted sub-components beyond `PracticeShell` and `GradeCard`.

**Solution: Extract the state machine into a `usePracticeRun` hook.**

```typescript
// src/lib/hooks/usePracticeRun.ts
function usePracticeRun(topicSlug: string) {
  // Returns { phase, runId, items, currentIndex, currentAnswer,
  //            grade, error, progress, onSubmit, onNext, onAbandon }
}
```

This shrinks `PracticeClient` to ~150 lines of pure rendering. The hook is testable in isolation.

#### Problem 6: No Filtering or Search on the My Topics Page

The index page renders all topics in a flat list. A power user with 50+ topics has no way to find one quickly.

**Solution: Add a search input + difficulty filter.**

Add a client-side `<TopicsSearch>` component that filters by title substring + difficulty. Since `listUserTopicsByOwner` already returns the full list (and is capped), client-side filtering is instant and doesn't need a server round-trip.

#### Problem 7: Mixed German/English UI Labels

The index page uses "Deine Themen" / "Mein Thema" / "Wartet auf erste Übung" etc. But the lesson page uses "my topic" / "Start practice" / "Abandon". The practice page uses English button labels. The inconsistency is jarring — pick one language and stick with it.

**Solution: Standardize to English.**

Per the AGENTS.md convention of English-first code, standardize all user-facing labels to English: "Your Topics" instead of "Deine Themen", "My topic" instead of "Mein Thema", "Awaiting first practice" instead of "Wartet auf erste Übung". This brings My Topics in line with the rest of the app (dashboard, subjects, planner, review, tutor are all English).

### 1.3 Proposed Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     My Topics Index                       │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Server Page (preloadQuery)                         │  │
│  │  ├─ preloadQuery(api.topics.listUserTopicsByOwner) │  │
│  │  └─ RSC: auth gate + seed bootstrap                │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Client Island (usePreloadedQuery)                  │  │
│  │  ├─ TopicsSearch (client-side filter)              │  │
│  │  ├─ TopicList (sorted, filtered, paginated)        │  │
│  │  │   ├─ TopicRow (title, objectives, grade, CTA)   │  │
│  │  │   └─ actions: Rename, Delete (inline)           │  │
│  │  └─ EmptyState (when no topics)                    │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                  My Topics / Lesson                       │
│  Server Page: preloadQuery(getOwnedTopicBySlug)          │
│  Client Island (usePreloadedQuery):                      │
│   ├─ Not Found (topic === null)                          │
│   ├─ No Lesson (topic.latestLesson === null)             │
│   ├─ Degraded Lesson (!lesson.schemaValid)               │
│   └─ Valid Lesson (sections + glossary)                  │
│       ├─ Regenerate CTA                                  │
│       └─ Start Practice CTA                              │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                 My Topics / Practice                      │
│  Server Page: preloadQuery(getOwnedTopicBySlug)          │
│  Client Island:                                          │
│   ├─ usePracticeRun(topicSlug) — state machine hook      │
│   │   ├─ POST /api/topics/practice/start → runId        │
│   │   ├─ useQuery(getLessonPracticeRunItems, runId)      │
│   │   └─ POST /api/topics/practice/grade → verdict      │
│   └─ PracticeShell + GradeCard + AnswerInput             │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                My Topics / Results                        │
│  Server Page: parallel preload of all 4 queries          │
│  Client Island:                                          │
│   ├─ GradeHero (big 1-6 grade card)                      │
│   ├─ ItemRow[] (per-item feedback + tutor deep-link)     │
│   └─ NoGradeYet (when no graded run exists)              │
└──────────────────────────────────────────────────────────┘
```

### 1.4 Tiered Loading Strategy

| Tier | What loads | Suspense boundary |
|---|---|---|
| **T0** (shell) | Breadcrumb nav, page heading, skeleton containers | Immediate — always render |
| **T1** (critical) | Topic list / topic detail / lesson sections | `<Suspense>` wrapping the data-dependent region |
| **T2** (supplementary) | Practice items, grade cards, results items | `<Suspense>` wrapping each supplementary section |

### 1.5 File Split Plan

| Current | Proposed | Purpose |
|---|---|---|
| `PracticeClient.tsx` (~700 lines) | `PracticeClient.tsx` (~150 lines) | Render only: shell + state machine display |
| | `usePracticeRun.ts` (~250 lines) | 6-state machine: start, submit, grade, next, finish, abandon |
| | `AnswerInput.tsx` (~60 lines) | Textarea + submit button + char count |
| `ResultsClient.tsx` (~400 lines) | `ResultsClient.tsx` (~120 lines) | Orchestrator: chain queries, render sections |
| | `GradeHero.tsx` (~80 lines) | Big 1-6 grade display + summary |
| | `ItemRow.tsx` (~120 lines) | Per-item verdict + feedback + better answer |
| `page.tsx` (index) | `page.tsx` (~100 lines) | Server preloading + client island |
| | `TopicsSearch.tsx` (~60 lines) | Client-side search + difficulty filter |
| | `TopicRow.tsx` (~100 lines) | Single topic row with actions |
| `convex/topics.ts` (~450 lines) | `convex/topics.ts` (~300 lines) | Core CRUD, batch-loaded queries |
| | `convex/topicActions.ts` (~80 lines) | deleteUserTopic, renameUserTopic |

---

## 2. Code Style Guidelines

### 2.1 Server Preloading Pattern

Adopt the same pattern used by the dashboard and planner pages:

```typescript
// page.tsx — server component
export default async function MyTopicsPage() {
  const { userId, getToken } = await auth();
  if (!userId) redirect("/sign-in");
  const token = await getToken({ template: "convex" }).catch(() => null);

  const topicsPreloaded = await preloadQuery(
    api.topics.listUserTopicsByOwner,
    {},  // ownerId resolved server-side via auth
    token ? { token } : {}
  );

  return <MyTopicsClient topicsPreloaded={topicsPreloaded} />;
}
```

### 2.2 Batch Queries Instead of N+1

Replace the per-topic loop in `listUserTopicsByOwner`:

```typescript
// BEFORE (N+1):
for (const topic of topics) {
  const lessons = await ctx.db.query("topicLessons")
    .withIndex("by_topic", (q) => q.eq("topicId", topic._id))
    .collect();  // N queries
  // ... same for runs
}

// AFTER (2 queries):
const allLessons = await ctx.db.query("topicLessons")
  .withIndex("by_topic", (q) => ...)
  .collect();
const allRuns = await ctx.db.query("topicLessonPractice")
  .withIndex("by_user", (q) => q.eq("userId", ownerId))
  .collect();

const lessonMap = groupBy(allLessons, "topicId");
const runMap = groupBy(allRuns, "topicId");
```

### 2.3 Remove `color-mix` Icon Containers

Per the frontend style rulebook (anti-pattern #2), remove all icon background containers. Replace patterns like:

```tsx
// BEFORE — anti-pattern
<span className="flex h-10 w-10 items-center justify-center rounded-lg"
  style={{ backgroundColor: "color-mix(in srgb, var(--subject-chemistry) 14%, transparent)", color: "var(--subject-chemistry)" }}>
  <User className="h-5 w-5" weight="duotone" />
</span>

// AFTER
<User className="h-6 w-6" style={{ color: "var(--subject-chemistry)" }} weight="duotone" />
```

### 2.4 Consolidate Duplicate Queries

Remove `getBySlugAndOwner` — all its callers can use `getOwnedTopicBySlug` which already resolves the owner server-side via `resolveUser`.

### 2.5 Standardize to English Labels

| German (current) | English (proposed) |
|---|---|
| `/ meine-themen` | `/ your-topics` |
| `Deine Themen` | `Your Topics` |
| `Erstellte Themen` | `Created Topics` |
| `Mein Thema` | `My topic` |
| `Wartet auf erste Übung` | `Awaiting first practice` |
| `Übung starten` | `Start practice` |
| `Lektion öffnen` | `Open lesson` |
| `Noch keine eigenen Themen erstellt` | `No topics created yet` |
| `Fächer durchsuchen` | `Browse subjects` |
| `Deine erstellten Themen erscheinen hier` | `Your created topics appear here` |

### 2.6 Extract `usePracticeRun` Hook

The 6-state practice machine should be a reusable hook:

```typescript
type PracticePhase = "starting" | "answering" | "grading" | "graded" | "finishing" | "error";

function usePracticeRun(topicSlug: string) {
  return {
    phase: PracticePhase;
    runId: Id<"topicLessonPractice"> | null;
    items: PracticeItem[] | undefined;
    currentIndex: number;
    currentAnswer: string;
    setCurrentAnswer: (a: string) => void;
    grade: GradeResponse | null;
    error: string | null;
    progress: number;
    answeredCount: number;
    total: number;
    onSubmit: () => Promise<void>;
    onNext: () => void;
    onAbandon: () => Promise<void>;
  };
}
```

### 2.7 Add Soft-Delete Schema Field

```typescript
// convex/schema.ts — topics table
topics: defineTable({
  // ... existing fields
  deletedAt: v.optional(v.number()),
})
```

Filter in all topic-listing queries: `.filter((q) => q.eq(q.field("deletedAt"), undefined))` or the equivalent in-memory filter.

---

## 3. Quality Constraints

### 3.1 Performance Budgets

| Metric | Target | Measurement |
|---|---|---|
| **Index page first paint** | < 300ms | Preloaded query available on first render |
| **Lesson page first paint** | < 300ms | Preloaded topic + lesson available on first render |
| **Practice page generation** | < 3.0s p95 | POST `/api/topics/practice/start` → items appear |
| **Per-item grading** | < 2.0s p95 | POST `/api/topics/practice/grade` → verdict appears |
| **Results page first paint** | < 400ms | All 4 preloaded queries available on first render |
| **Topic list query** | < 150ms p95 | After batch-load optimization |

### 3.2 Query Latency Budgets (p95)

| Query | Budget | Notes |
|---|---|---|
| `topics.listUserTopicsByOwner` | < 150ms | After batch-load: 1 topics scan + 1 lessons scan + 1 runs scan |
| `topics.getOwnedTopicBySlug` | < 80ms | Single slug lookup + 1 lesson scan |
| `topics.getTopicLesson` | < 50ms | Single topic index scan |
| `practice.getLatestPracticeRunForOwnedTopic` | < 50ms | Single user+topic index scan |
| `practice.getLessonPracticeRun` | < 30ms | Single document get |
| `practice.getLessonPracticeRunItems` | < 60ms | Indexed scan by practice set |

### 3.3 Caps on Unbounded Collects

| Location | Current | Cap |
|---|---|---|
| `listUserTopicsByOwner` — topics | `.collect()` — no cap | `.take(100)` |
| `listUserTopicsByOwner` — lessons (per-topic) | `.collect()` — N queries, unbounded | Batch: `.take(500)` on single scan |
| `listUserTopicsByOwner` — runs (per-topic) | `.collect()` — N queries, unbounded | Batch: `.take(500)` on single scan |
| `getTopicLesson` — versions | `.collect()` — all versions | `.take(20)` — 20 versions is plenty |
| Practice items per run | `.collect()` — depends on item count | Capped at 5 by the API route, but `.take(10)` defensively |

### 3.4 Empty State Differentiation

| State | Visual | Action |
|---|---|---|
| **No topics** (new user) | Illustration + explanation + CTA | "Browse subjects →" linking to `/subjects` |
| **Topic not found** (wrong slug) | "No topic matches" message | "Back to your topics →" |
| **No lesson yet** (generation failed) | "No lesson generated yet" message | "Try starting practice" or regenerate CTA |
| **Degraded lesson** (!schemaValid) | Warning card with explanation | Navigate to practice or regenerate |
| **No graded run** (never practiced) | "No graded run yet" message | "Start a practice →" |
| **Practice run error** (generation failed) | Error card with retry | Retry + "Back to lesson" buttons |

### 3.5 Accessibility

- All form inputs have associated `<label>` elements (already present in `AddTopicForm`)
- Practice textarea has `aria-label` and max length indicator
- Grade cards use `role="region"` with descriptive labels
- Delete/rename actions have confirmation dialogs (not destructive without confirm)
- Keyboard navigation: Tab through topic list, Enter to open lesson

### 3.6 Dark Mode

- All `color-mix` hardcodes to be replaced with CSS custom properties
- Grade hero badge uses CSS variables for tones (already using `var(--subject-chemistry)` pattern)
- Practice textarea focus ring visible in dark mode
- Search input placeholder visible in dark mode

---

## 4. Testing Strategy

### 4.1 Unit Tests (Vitest)

| Test file | What it covers |
|---|---|
| `convex/topics.test.ts` | `createUserTopic` (slug generation, ownership), `regenerateTopicLesson` (version bump, forbidden for non-owner), `deleteUserTopic` (soft-delete, forbidden), `renameUserTopic` (slug update), `listUserTopicsByOwner` (filtering deleted, batch-load correctness) |
| `src/lib/hooks/usePracticeRun.test.ts` | State machine transitions: idle → starting → answering → grading → graded → finishing, error recovery, abandon flow |
| `convex/topics.batch.test.ts` | Batch-loaded lesson/run joins produce same results as N+1 approach |

### 4.2 Convex Integration Tests

| Test | What it verifies |
|---|---|
| `createUserTopic` creates topic + lesson atomically | Both rows exist, slug is unique |
| `regenerateTopicLesson` increments version | Version = prior max + 1 |
| `deleteUserTopic` soft-deletes | `deletedAt` set, topic excluded from `listUserTopicsByOwner` |
| `renameUserTopic` updates title + slug | New slug reflects new title, old slug freed |
| `getOwnedTopicBySlug` returns null for canonical topics | `source !== "user"` gate works |
| `getOwnedTopicBySlug` returns null for other user's topics | `ownerId !== user._id` gate works |
| `listUserTopicsByOwner` excludes deleted topics | Soft-deleted topics not in list |
| `listUserTopicsByOwner` batch-load produces correct `latestLesson` and `latestRun` | Matches highest version / most recent run |

### 4.3 Component Tests (React Testing Library)

| Test | What it verifies |
|---|---|
| `TopicsSearch` filters by title substring | Type "log" → only topics with "log" in title shown |
| `TopicsSearch` filters by difficulty | Select "HARD" → only HARD topics shown |
| `TopicRow` renders lesson + practice CTAs | Both links present with correct hrefs |
| `TopicRow` renders grade badge when run exists | Grade number + label visible |
| `TopicRow` delete button shows confirmation | Confirm dialog appears, delete called on confirm |
| `LessonClient` renders sections + glossary | All headings + definitions visible |
| `LessonClient` "not found" state | Correct message for wrong slug |
| `LessonClient` "no lesson" state | CTA to practice or regenerate |
| `LessonClient` "degraded lesson" state | Warning card with explanation |
| `AnswerInput` submit disabled when empty | Button disabled when textarea is empty |
| `GradeHero` renders correct grade + color | Grade 1 = chemistry green, grade 6 = french red |
| `ItemRow` renders verdict + feedback + better answer | Correct colors, labels, markdown |
| `ItemRow` renders tutor deep-link | Link includes correct query params |

### 4.4 API Route Tests

| Test | What it verifies |
|---|---|
| `POST /api/topics/lesson/stream` streams valid lesson | Sections + glossary in response |
| `POST /api/topics/lesson/stream` 401 without auth | Unauthorized |
| `POST /api/topics/practice/start` generates 5 items | Returns runId + 5 itemIds |
| `POST /api/topics/practice/start` 422 on empty lesson | Validation error |
| `POST /api/topics/practice/grade` returns verdict + feedback + betterAnswer | All fields present |
| `POST /api/topics/practice/grade` 404 on invalid runId | Not found |

### 4.5 Manual QA Checklist

- [ ] Open `/my-topics` — topics list renders with lesson + practice CTAs
- [ ] Open `/my-topics` with no topics — empty state with "Browse subjects" CTA
- [ ] Type in search — topic list filters in real-time
- [ ] Filter by difficulty — only matching topics shown
- [ ] Click "Open lesson" — lesson page renders with sections
- [ ] Click "Start practice" — practice generates 5 questions
- [ ] Answer a question — grade card appears with verdict + feedback + better answer
- [ ] Complete all 5 questions — navigates to results page
- [ ] Results page shows grade hero + per-item feedback
- [ ] Click "Discuss with tutor" on results — navigates to tutor with context
- [ ] Click "Ask tutor about this" on an item — navigates to tutor with focusItemId
- [ ] Delete a topic — confirmation dialog, topic removed from list
- [ ] Rename a topic — inline edit, slug updates
- [ ] Open `/my-topics/nonexistent` — "not found" state
- [ ] Regenerate a lesson — new version appears
- [ ] Dark mode — all components render legibly
- [ ] Mobile — practice textarea doesn't overlap with keyboard

---

## 5. Deployment Plan

### 5.1 Phase A: Refactor & Performance (zero visual change)

**Goal:** Server preloading, batch queries, hook extraction — no user-visible changes.

| Step | What | Risk |
|---|---|---|
| **A1** | Add `deletedAt` field to `topics` schema | Low — optional field, no migration needed |
| **A2** | Add `deleteUserTopic` and `renameUserTopic` mutations to `convex/topics.ts` | Low — net-new mutations |
| **A3** | Consolidate `getBySlugAndOwner` into `getOwnedTopicBySlug` — update all callers | Medium — must update TopicList, NextBestTopicCard, ContinueStudyingCard |
| **A4** | Batch-load lessons + runs in `listUserTopicsByOwner` | Medium — must produce identical output shape |
| **A5** | Add server preloading to `my-topics/page.tsx` | Low — additive, doesn't remove client path |
| **A6** | Add server preloading to `my-topics/[topicSlug]/lesson/page.tsx` | Low |
| **A7** | Add server preloading to `my-topics/[topicSlug]/practice/results/page.tsx` (parallel preload all 4) | Medium — must handle missing token case |
| **A8** | Extract `usePracticeRun` hook from `PracticeClient.tsx` | Medium — must preserve all 6 states + error paths |
| **A9** | Add caps on all unbounded `collect()` calls per §3.3 | Low |

**Validation:** Full QA checklist pass + `npm run typecheck` + `npm run test` after each step.

### 5.2 Phase B: UI Improvements

**Goal:** Search, delete/rename UI, English labels, `color-mix` removal.

| Step | What | Risk |
|---|---|---|
| **B1** | Create `TopicsSearch` component (client-side filter) | Low — pure UI, no data changes |
| **B2** | Add delete button + confirmation dialog to `TopicRow` | Low — calls existing mutation from A2 |
| **B3** | Add rename inline edit to `TopicRow` | Low — calls existing mutation from A2 |
| **B4** | Standardize all labels to English | Low — string changes only |
| **B5** | Remove all `color-mix` icon containers | Low — visual change, rulebook compliance |
| **B6** | Split `ResultsClient.tsx` into `GradeHero` + `ItemRow` | Low — component extraction |
| **B7** | Split `PracticeClient.tsx` into `AnswerInput` | Low — component extraction |

**Validation:** Full QA checklist. Verify search works on 20+ topics. Verify delete/rename mutations persist.

### 5.3 Phase C: Edge Cases & Polish

**Goal:** Handle all empty/error states, dark mode audit, mobile audit.

| Step | What | Risk |
|---|---|---|
| **C1** | Audit all empty states per §3.4 — ensure each renders correctly | Low |
| **C2** | Dark mode audit of all My Topics components | Low |
| **C3** | Mobile responsive audit (practice textarea, results table) | Low |
| **C4** | Add "Regenerate lesson" button to degraded lesson state | Low — calls existing `regenerateTopicLesson` |
| **C5** | Add topic count + "last practiced" sort option to index page | Low |

**Validation:** Full QA checklist. Dark mode toggle. Mobile viewport at 375px.

### 5.4 Phase D: Performance Hardening (deferrable)

| Step | What | Risk |
|---|---|---|
| **D1** | Add query latency telemetry to `listUserTopicsByOwner` and `getOwnedTopicBySlug` | Low |
| **D2** | Add `Suspense` boundaries for supplementary data (lesson sections, practice items) | Low |
| **D3** | Consider pagination for topic list when > 50 topics | Medium — schema + UI change |

### 5.5 Feature Flag

Gate behind `NEXT_PUBLIC_MYTOPICS_V2`:

```typescript
// app/(app)/my-topics/page.tsx
const useV2 = process.env.NEXT_PUBLIC_MYTOPICS_V2 === "true";
if (useV2) {
  return <MyTopicsPageV2 {...props} />;
}
return <MyTopicsPageV1 />;
```

### 5.6 Migration Strategy

| Migration | Approach | Rollback |
|---|---|---|
| Schema: `topics.deletedAt` | Add optional field, no backfill needed | Remove field |
| Schema: `topics.slug` rename | `renameUserTopic` generates new slug, old routes still resolve by slug | N/A — slugs are unique |
| Query: batch-load | Replace N+1 with batch, validate identical output | Revert to N+1 |
| Labels: German → English | String replacements across 5 files | Revert strings |
