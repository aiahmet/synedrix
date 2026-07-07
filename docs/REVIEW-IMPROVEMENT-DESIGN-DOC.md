# Review Center Improvement Design Doc

> Status: proposal
> Target: Synedrix Review surface (`/review`, `convex/reviewCenter.ts`, dashboard review components)
> Author: [generated]

---

## Table of Contents

1. [Architecture](#1-architecture)
2. [Code Style Guidelines](#2-code-style-guidelines)
3. [Quality Constraints](#3-quality-constraints)
4. [Testing Strategy](#4-testing-strategy)
5. [Deployment Plan](#5-deployment-plan)

---

## 1. Architecture

### 1.1 Current State

The Review Center (/review) is a single page with one client component
(`ReviewCenterClient.tsx`, ~240 lines) and one server component
(`page.tsx`, ~60 lines). It preloads a single Convex query:

```
page.tsx → preloadQuery(api.reviewCenter.getReviewQueue, {})
         → ReviewCenterClient
           → usePreloadedQuery → data.items[]
           → sections: { due, dueToday, weak, packs }
           → <Section> → <ReviewQueueCard>
```

**`getReviewQueue` (convex/reviewCenter.ts, ~480 lines)** does everything
in one handler:

1. Fetches overdue + due-today flashcards (2 queries, each `.take(200)`)
2. Fetches overdue + due-today mistakes (2 queries, each `.take(200)`)
3. Resolves flashcard → deck → topic → chapter → subject chain
   (sequential: 4 batch levels of resolution)
4. Resolves mistake → topic → chapter → subject chain
5. Builds deduped queue items from flashcards (per-deck dedupe)
6. Builds deduped queue items from mistakes (per-topic dedupe)
7. Fetches `userTopicProgress` (`.collect()`, uncapped)
8. For each weak candidate (up to 8), resolves topic → chapter → subject
   via sequential `ctx.db.get()` calls (N+1 pattern)
9. For each enrolled subject (up to 5), fetches chapters → topics →
   formula_sheet resources (nested N+1: ~160 queries)
10. For each enrolled subject, repeats the same for vocabulary_deck
    resources (another ~160 queries)
11. Sorts, dedupes, slices to 20 items

**Problems:**

1. **Single monolithic query.** Everything blocks on everything. If the
   formula sheet scan is slow, the flashcard queue is delayed.

2. **Sequential chain resolution.** Flashcard resolution goes:
   reviews → flashcards (parallel) → decks (parallel) → topics
   (parallel) → chapters (parallel) → subjects (parallel). Each step
   gates on the previous. With the existing `resolveTopicChains` helper
   in `_lib/topicChain.ts`, the topic → chapter → subject portion can
   be batched, but the flashcard → deck → topic portion is still
   sequential.

3. **N+1 weak topic resolution.** Each weak candidate does sequential
   `ctx.db.get(topicId)` → `get(chapterId)` → `get(subjectId)`.

4. **Exponential formula/vocabulary scan.** For each subject:
   chapters → per-chapter topics → per-topic resource lookup. With
   6 subjects × ~8 chapters × ~4 topics, this is ~192 individual
   `ctx.db.get()` or `first()` calls in a deeply nested loop.

5. **No tiered loading.** A slow secondary concern (vocabulary decks)
   blocks primary concerns (overdue flashcards, mistakes).

6. **Duplicate work with dashboard queries.** `getMistakesToRevisit`
   and `getRecoveredTopics` in `convex/dashboard.ts` re-fetch mistakes
   and sessions that `getReviewQueue` already computes.

7. **Uncapped collections.** `userTopicProgress` is `.collect()`'d
   without a cap — it could grow unboundedly.

8. **Mixed language.** `ReviewCenterClient.tsx` uses German labels
   ("Überfällig", "Heute fällig", "Wiederholungen") while the rest of
   the app uses English.

9. **Style violations.** `ReviewQueueCard` wraps icons in `color-mix`
   containers — the anti-pattern from the style guide. Empty state uses
   a double-bezel card with icon container. Rescue plan button doesn't
   use CockpitCard.

### 1.2 Target Architecture

**Split into focused queries with independent loading:**

```
┌──────────────────────────────────────────────────────────┐
│ Tier 1 (Critical — always needed)                         │
│   getReviewQueueHeader: overdueCount, dueTodayCount,      │
│     weakTopicCount, hasRescuePlanEligible                 │
│   └─ Suspense boundary with header skeleton               │
│                                                          │
│ Tier 2 (Primary — flashcards + mistakes)                  │
│   getFlashcardQueue: deduped flashcard items              │
│   getMistakeQueue: deduped mistake items                  │
│   └─ Suspense boundary with card skeletons                │
│                                                          │
│ Tier 3 (Secondary — weak topics, resources)               │
│   getWeakTopics: weak topic candidates                    │
│   getFormulaPacks: formula sheets for enrolled subjects   │
│   getVocabularyDecks: vocabulary decks for enrolled subjects│
│   └─ Suspense boundary with lazy-loaded sections          │
└──────────────────────────────────────────────────────────┘
```

**Split `getReviewQueue` into focused queries:**

| Query | Returns | Tier |
|---|---|---|
| `reviewCenter.getQueueHeader` | counts + hasRescuePlanEligible | 1 |
| `reviewCenter.getFlashcardQueue` | deduped flashcard items | 2 |
| `reviewCenter.getMistakeQueue` | deduped mistake items | 2 |
| `reviewCenter.getWeakTopics` | weak topic candidates (capped 8) | 3 |
| `reviewCenter.getFormulaPacks` | formula sheet summaries | 3 |
| `reviewCenter.getVocabularyDecks` | vocabulary deck summaries | 3 |

Each query is independently preloadable and independently
`Suspense`-wrapped. The page renders progressively.

**Shared `_lib/reviewHelpers.ts` for cross-query logic:**

```ts
// convex/_lib/reviewHelpers.ts

export async function resolveFlashcardReviewChains(
  ctx: QueryCtx,
  reviews: Doc<"flashcardReviews">[],
): Promise<ResolvedFlashcardReview[]>

export async function resolveMistakeReviewChains(
  ctx: QueryCtx,
  mistakes: Doc<"mistakeEntries">[],
): Promise<ResolvedMistakeReview[]>

export async function collectFormulaPacks(
  ctx: QueryCtx,
  enrolledSubjectIds: Id<"subjects">[],
  seen: Set<string>,
  limit: number,
): Promise<QueueItem[]>

export async function collectVocabularyDecks(
  ctx: QueryCtx,
  enrolledSubjectIds: Id<"subjects">[],
  seen: Set<string>,
  limit: number,
): Promise<QueueItem[]>
```

Each helper:
- Uses `resolveTopicChains` for batch topic → chapter → subject resolution
- Hard-caps all `collect()` and `take()` calls
- Accepts a `Set<string>` for cross-query deduplication
- Returns typed items the client can render

**Shared `_lib/reviewTypes.ts`:**

```ts
export interface QueueItem {
  readonly kind: "flashcard" | "mistake" | "weak_topic" | "formula_pack" | "vocabulary_deck";
  readonly priority: number;
  readonly at: number;
  readonly title: string;
  readonly subtitle: string;
  readonly href: string;
  readonly subjectSlug: string | null;
  readonly subjectColor: string | null;
  readonly count: number | null;
  readonly topicId: Id<"topics"> | null;
}

export interface QueueHeader {
  readonly overdueCount: number;
  readonly dueTodayCount: number;
  readonly weakTopicCount: number;
  readonly formulaPackCount: number;
  readonly vocabularyDeckCount: number;
  readonly hasRescuePlanEligible: boolean;
}
```

### 1.3 Data Flow Diagram

```
/app/review (Server Component)
  │
  ├─ preloadQuery(api.reviewCenter.getQueueHeader)      ──┐
  ├─ preloadQuery(api.reviewCenter.getFlashcardQueue)   ──┤ all
  ├─ preloadQuery(api.reviewCenter.getMistakeQueue)     ──┤ preloaded
  ├─ preloadQuery(api.reviewCenter.getWeakTopics)       ──┤ together
  ├─ preloadQuery(api.reviewCenter.getFormulaPacks)     ──┤ in
  └─ preloadQuery(api.reviewCenter.getVocabularyDecks)  ──┘ parallel
       │
       ▼
  ReviewCenterClientV2 (Client Component)
       │
       ├─ <Suspense fallback={<HeaderSkeleton />}>
       │    <HeaderWrapper preloaded={headerPreloaded} />
       │
       ├─ <Suspense fallback={<SectionSkeleton count={3} />}>
       │    <FlashcardSection preloaded={flashcardPreloaded} />
       │
       ├─ <Suspense fallback={<SectionSkeleton count={3} />}>
       │    <MistakeSection preloaded={mistakePreloaded} />
       │
       ├─ <Suspense fallback={<SectionSkeleton count={3} />}>
       │    <WeakTopicsSection preloaded={weakPreloaded} />
       │
       └─ <Suspense fallback={<SectionSkeleton count={3} />}>
            <ResourcesSection preloaded={formulaPreloaded, vocabPreloaded} />
```

### 1.4 Component Architecture

```
components/review/
  ReviewHeader.tsx           — counts bar + rescue plan CTA
  ReviewSection.tsx          — section shell (label + card list)
  ReviewQueueCard.tsx        — single review card (reusable across sections)
  FlashcardSection.tsx       — wrapper: usePreloadedQuery + section
  MistakeSection.tsx         — wrapper: usePreloadedQuery + section
  WeakTopicsSection.tsx      — wrapper: usePreloadedQuery + section
  ResourcesSection.tsx       — wrapper: formula + vocab combined
  EmptyState.tsx             — differentiated empty states
  RescuePlanButton.tsx       — extracted rescue plan client logic
  skeletons.tsx              — shared skeleton components
  types.ts                   — client-side QueueItem type (mirrors convex)
```

`ReviewCenterClient.tsx` becomes a thin orchestrator (~50 lines).

### 1.5 Rescue Plan Integration

Current: rescue plan is triggered by a POST to `/api/review/rescue-plan`
which generates AI content and redirects.

Improvement: pre-check whether a rescue plan already exists (via a
`rescuePlans` table or a field on the queue header). If one exists,
show a "View your rescue plan" link instead of the "Generate" button.

Add a `rescuePlans` table:

```ts
rescuePlans: defineTable({
  userId: v.id("users"),
  plan: v.string(),         // AI-generated markdown
  priorityTopics: v.array(v.id("topics")),
  generatedAt: v.number(),
  expiresAt: v.number(),    // plans expire after 7 days
}).index("by_user", ["userId"]),
```

The queue header query checks for an existing non-expired plan.

---

## 2. Code Style Guidelines

### 2.1 File Size Limits

| File | Max lines | Rationale |
|---|---|---|
| `ReviewCenterClient.tsx` | 80 | Orchestration only |
| `ReviewSection.tsx` | 80 | Section shell + card list |
| `ReviewQueueCard.tsx` | 60 | Single card component |
| `EmptyState.tsx` | 60 | Differentiated empty states |
| `RescuePlanButton.tsx` | 50 | Client-side rescue plan logic |
| `convex/reviewCenter.ts` | 250 | Multiple focused queries |
| `_lib/reviewHelpers.ts` | 200 | Shared helpers |
| `_lib/reviewTypes.ts` | 80 | Shared type definitions |

### 2.2 Shared Types

Define QueueItem and QueueHeader once in `_lib/reviewTypes.ts`. Every
query and component imports from there. No duplicated `v.object(...)`
blocks.

### 2.3 Style Guide Compliance

All review components must pass the checklist from
`docs/SYNEDRIX-FRONTEND-STYLE.md`:

**Current violations to fix:**

| Surface | Violation | Fix |
|---|---|---|
| `ReviewQueueCard` icon | `color-mix(in srgb, ...)` wrapper around icon | Render icon at native size with `text-accent` or subject color |
| `EmptyState` icon | `color-mix` + `h-10 w-10` container | Render `ClockCounterClockwise` at `h-5 w-5` native size |
| `EmptyState` card | Double-bezel (`rounded-2xl` outer + `rounded-xl` inner) | Use `CockpitCard` |
| `ReviewQueueCard` | Bordered card inside a section | Use CockpitCard; sections are typography dividers, not cards |
| German labels | "Überfällig", "Heute fällig", "Wiederholungen" | "Overdue", "Due today", "Review Center" |
| `RescuePlanButton` | Separate button not inside CockpitCard | Wrap in CockpitCard with header |

### 2.4 Consistent Language

The Review Center is the only surface using German. Standardize to
English:

| German | English |
|---|---|
| Wiederholungen | Review Center |
| Überfällig | Overdue |
| Heute fällig | Due today |
| Schwache Grundlagen | Weak foundations |
| Formel- & Vokabelsammlungen | Formula & vocabulary packs |
| Karteikarten-Wiederholung | Flashcard review |
| Fehler-Wiederholung | Mistake review |
| Schwaches Thema | Weak topic |
| Formelsammlung | Formula sheet |
| Vokabelstapel | Vocabulary deck |
| Rettungsplan erstellen | Generate rescue plan |
| Keine anstehenden Wiederholungen | Nothing to review |

### 2.5 No Comments

Per `AGENTS.md`: zero inline comments. JSDoc on exported symbols only.

---

## 3. Quality Constraints

### 3.1 Performance Budgets

| Metric | Target | Measurement |
|---|---|---|
| Page LCP (header) | < 300ms | Tier 1 query resolves |
| Page LCP (above-fold) | < 1.0s | Tiers 1+2 resolve |
| Page LCP (full) | < 2.0s | All tiers resolve |
| `getQueueHeader` p95 | < 40ms | Convex dashboard |
| `getFlashcardQueue` p95 | < 100ms | Convex dashboard |
| `getMistakeQueue` p95 | < 80ms | Convex dashboard |
| `getWeakTopics` p95 | < 100ms | Convex dashboard |
| `getFormulaPacks` p95 | < 200ms | Convex dashboard (expensive scan) |
| `getVocabularyDecks` p95 | < 200ms | Convex dashboard |

### 3.2 Caps on All Collects

| Location | Current | Target |
|---|---|---|
| `getFlashcardQueue` — overdue | `.take(200)` | `.take(100)` |
| `getFlashcardQueue` — due today | `.take(200)` | `.take(100)` |
| `getMistakeQueue` — overdue | `.take(200)` | `.take(100)` |
| `getMistakeQueue` — due today | `.take(200)` | `.take(100)` |
| `getWeakTopics` — progress | `.collect()` | `.take(500)` |
| `getWeakTopics` — candidates displayed | `.slice(0, 8)` | `.slice(0, 6)` |
| `getFormulaPacks` — subjects | `.slice(0, 5)` | `.slice(0, 5)` (unchanged, already capped) |
| `getFormulaPacks` — chapters per subject | `.take(100)` | `.take(30)` |
| `getFormulaPacks` — topics per chapter | `.take(300)` | `.take(50)` |
| `getFormulaPacks` — topics scanned | `.slice(0, 50)` | `.slice(0, 20)` |
| `getVocabularyDecks` — same as formula | same | same caps |

### 3.3 N+1 Elimination

**Weak topic resolution:** Replace sequential `ctx.db.get()` with
`resolveTopicChains`:

```ts
// Before (N+1):
for (const wp of weakCandidates.slice(0, 8)) {
  const topic = await ctx.db.get(wp.topicId);
  const chapter = await ctx.db.get(topic.chapterId);
  const subject = await ctx.db.get(chapter.subjectId);
  // ...
}

// After (batch):
const candidateIds = weakCandidates.slice(0, 6).map((p) => p.topicId);
const chains = await resolveTopicChains(ctx, candidateIds);
for (const [topicId, chain] of chains) {
  // chain.topic, chain.chapter, chain.subject
}
```

**Formula/vocabulary scan:** Pre-load all chapters and topics per
subject in batch, then query resources in one pass:

```ts
// Collect all topic IDs across all enrolled subjects first
const allTopicIds = /* flat list */;
// Batch-query topicResources for all of them
const resources = await Promise.all(
  allTopicIds.map((tid) =>
    ctx.db.query("topicResources")
      .withIndex("by_topic_kind", (q) =>
        q.eq("topicId", tid).eq("kind", kind)
      )
      .first()
  )
);
// Filter non-null and build items
```

This replaces the deeply nested `for (subject) → for (chapter) → for
(topic) → query resource` pattern with one flat batch.

### 3.4 Empty State Differentiation

Current: one generic empty state. Target: three differentiated states:

| State | Trigger | Message |
|---|---|---|
| New user | No progress, no flashcards, no mistakes | "Start studying topics to build your review queue." |
| Caught up | Has progress but no overdue items | "You're all caught up. Great work." |
| Nothing enrolled | No enrolled subjects | "Enroll in a subject to start your review queue." |

### 3.5 Accessibility

- All review cards are links — ensure keyboard focus rings.
- Rescue plan button shows loading spinner with `aria-busy`.
- Section headers use semantic `<h2>` (already done).
- Cards use `aria-label` with kind + title for screen readers.

### 3.6 Dark Mode Parity

- All cards use `CockpitCard` which includes dark mode shadows.
- `color-mix` icon containers replaced with semantic color tokens
  that work in both themes.
- Rescue plan loading spinner uses `border-accent-foreground` for
  contrast in both themes.

---

## 4. Testing Strategy

### 4.1 Unit Tests (Vitest)

| Target | File | What to Test |
|---|---|---|
| `_lib/reviewHelpers.ts` | `convex/_lib/reviewHelpers.test.ts` | `resolveFlashcardReviewChains` with known review arrays; `resolveMistakeReviewChains`; deduplication logic; caps respected |
| `_lib/reviewTypes.ts` | N/A (types only) | No tests needed |

### 4.2 Integration Tests (Convex Test Helpers)

| Target | File | What to Test |
|---|---|---|
| `reviewCenter.getQueueHeader` | `convex/reviewCenter.test.ts` | Returns correct counts; hasRescuePlanEligible when overdue ≥ 5 |
| `reviewCenter.getFlashcardQueue` | `convex/reviewCenter.test.ts` | Returns deduped flashcards; overdue sorted before due-today; respects caps |
| `reviewCenter.getMistakeQueue` | `convex/reviewCenter.test.ts` | Returns deduped mistakes; resolves topic chains; respects caps |
| `reviewCenter.getWeakTopics` | `convex/reviewCenter.test.ts` | Returns topics with mastery < 0.5; filters to enrolled subjects only; respects cap of 6 |
| `reviewCenter.getFormulaPacks` | `convex/reviewCenter.test.ts` | Returns formula sheets for enrolled subjects; empty when no STEM subjects enrolled |
| `reviewCenter.getVocabularyDecks` | `convex/reviewCenter.test.ts` | Returns vocabulary decks for enrolled subjects; empty when no language subjects enrolled |

### 4.3 Component Tests (React Testing Library)

| Component | What to Test |
|---|---|
| `ReviewHeader` | Renders counts correctly; rescue plan button shows when eligible; hides when not eligible |
| `ReviewSection` | Renders label and card list; renders empty state when items is [] |
| `ReviewQueueCard` | Renders kind-specific icon and label; renders count badge when count > 1; links to correct href |
| `EmptyState` | Renders correct variant (new/caught-up/no-enrollment) |
| `RescuePlanButton` | Shows loading state; handles error; navigates on success |

### 4.4 Manual QA Checklist

- [ ] Review page loads with flashcard and mistake sections visible first.
- [ ] Formula packs and vocabulary decks load progressively.
- [ ] Overdue items appear before due-today items.
- [ ] Rescue plan button appears when overdue count ≥ 5.
- [ ] Rescue plan button shows loading spinner during generation.
- [ ] Rescue plan button shows error message on failure.
- [ ] Empty state shows correct message for new user.
- [ ] Empty state shows correct message for caught-up user.
- [ ] All review cards link to the correct topic/subject page.
- [ ] Deduplication works: same deck appears once, not per-card.
- [ ] All text is in English (no German labels).
- [ ] Dark mode: all cards, text, focus rings are legible.
- [ ] Keyboard navigation works through all review cards.
- [ ] Rescue plan redirects to the correct page after generation.

---

## 5. Deployment Plan

### 5.1 Feature Flag

Gate all changes behind `NEXT_PUBLIC_REVIEW_V2`:

```ts
// app/(app)/review/page.tsx
const useV2 = process.env.NEXT_PUBLIC_REVIEW_V2 === "true";

// Preload V2 queries when flag is on
if (useV2) {
  [headerPreloaded, flashcardPreloaded, mistakePreloaded,
   weakPreloaded, formulaPreloaded, vocabPreloaded] =
    await Promise.all([/* 6 queries */]);
}

return useV2
  ? <ReviewCenterClientV2 /* 6 preloaded props */ />
  : <ReviewCenterClient queuePreloaded={queuePreloaded} />;
```

New Convex queries are additive. Old `getReviewQueue` query stays
untouched. Rollback is flipping the env var.

### 5.2 Phases

#### Phase A: Refactor (no visual change) — ~4 hours

| # | Task | Files |
|---|---|---|
| A1 | Create `_lib/reviewTypes.ts` with shared QueueItem and QueueHeader types | `convex/_lib/reviewTypes.ts` (new) |
| A2 | Create `_lib/reviewHelpers.ts`: `resolveFlashcardReviewChains`, `resolveMistakeReviewChains`, `collectFormulaPacks`, `collectVocabularyDecks` | `convex/_lib/reviewHelpers.ts` (new) |
| A3 | Refactor `getReviewQueue` to use helpers internally | `convex/reviewCenter.ts` |
| A4 | Replace per-row topic resolution with `resolveTopicChains` batch call in weak topics | `convex/reviewCenter.ts` |
| A5 | Split `ReviewCenterClient.tsx` into separate component files: `ReviewHeader`, `ReviewSection`, `ReviewQueueCard`, `EmptyState`, `RescuePlanButton` | `components/review/*.tsx` (new) |
| A6 | Replace `color-mix` icon containers with native-sized icons per style guide | `ReviewQueueCard.tsx`, `EmptyState.tsx` |
| A7 | Standardize all labels to English | All review components |
| A8 | Typecheck + test run | — |

**Validation gate:** All existing review behavior is unchanged. Zero visual diffs (except English labels).

#### Phase B: Tiered Preloading — ~3 hours

| # | Task | Files |
|---|---|---|
| B1 | Split `getReviewQueue` into 6 focused queries: `getQueueHeader`, `getFlashcardQueue`, `getMistakeQueue`, `getWeakTopics`, `getFormulaPacks`, `getVocabularyDecks` | `convex/reviewCenter.ts` |
| B2 | Preload all 6 queries in parallel in page.tsx | `app/(app)/review/page.tsx` |
| B3 | Create `ReviewCenterClientV2.tsx` with `Suspense` boundaries per tier | `app/(app)/review/ReviewCenterClientV2.tsx` (new) |
| B4 | Build skeleton components: `HeaderSkeleton`, `SectionSkeleton` | `app/(app)/review/skeletons.tsx` (new) |
| B5 | Add per-section error boundaries | `ReviewCenterClientV2.tsx` |
| B6 | Create wrapper components that call `usePreloadedQuery` for each section | `components/review/FlashcardSection.tsx` etc. (new) |
| B7 | Feature-flag gate in page.tsx | `app/(app)/review/page.tsx` |
| B8 | Typecheck + test: `npm run typecheck && npm run test` | — |

**Validation gate:** Page renders progressively. Flashcards and mistakes appear before formula packs.

#### Phase C: Rescue Plan Integration — ~2 hours

| # | Task | Files |
|---|---|---|
| C1 | Add `rescuePlans` table to schema | `convex/schema.ts` |
| C2 | Add `rescuePlanId` field to `QueueHeader` — check for existing non-expired plan | `convex/reviewCenter.ts` |
| C3 | Modify rescue plan API route to persist plan to `rescuePlans` table | `app/api/review/rescue-plan/route.ts` |
| C4 | Update `RescuePlanButton` to show "View plan" instead of "Generate" when plan exists | `components/review/RescuePlanButton.tsx` |
| C5 | Typecheck + manual QA | — |

#### Phase D: Performance Hardening — ~2 hours

| # | Task | Files |
|---|---|---|
| D1 | Apply caps to remaining uncapped collects | `convex/_lib/reviewHelpers.ts`, `convex/reviewCenter.ts` |
| D2 | Flatten formula/vocabulary scan to batch queries (pre-collect all topic IDs, batch-query resources) | `convex/_lib/reviewHelpers.ts` |
| D3 | Add query latency telemetry for slow queries (>500ms) | `convex/reviewCenter.ts` |
| D4 | Typecheck, test, manual QA | — |

### 5.3 Rollback

If `NEXT_PUBLIC_REVIEW_V2` causes issues:

1. Set `NEXT_PUBLIC_REVIEW_V2=false` in deployment environment.
2. Redeploy. The old `ReviewCenterClient` + `getReviewQueue` path is untouched.
3. New Convex queries stay deployed — additive only.

### 5.4 Cleanup

After 2 weeks of stable V2:

1. Remove `NEXT_PUBLIC_REVIEW_V2` flag.
2. Delete old `ReviewCenterClient.tsx` and `getReviewQueue`.
3. Rename `ReviewCenterClientV2.tsx` → `ReviewCenterClient.tsx`.
4. Remove unused imports and dead code.

---

## Appendix: Summary of Architectural Decisions

| Decision | Rationale |
|---|---|
| Split monolithic query into 6 focused queries | Progressive rendering; independent failure domains |
| Use `resolveTopicChains` (batch) for weak topics | Eliminates N+1 resolution |
| Flatten formula/vocabulary scan to batch queries | Eliminates nested `for` loops × per-topic queries |
| Add `rescuePlans` table for plan persistence | Plans survive page reloads; avoid re-generation |
| Standardize to English labels | Consistent with rest of app |
| Extract `_lib/reviewTypes.ts` and `_lib/reviewHelpers.ts` | Single source of truth; reusable across queries |
| Four-phase rollout with feature flag | Zero-risk deployment; instant rollback |
