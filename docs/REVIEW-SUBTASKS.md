# Review Center Improvement — Subtask Breakdown

> Derived from `docs/REVIEW-IMPROVEMENT-DESIGN-DOC.md`
> 27 subtasks across 4 phases
> Each subtask includes exact files, line numbers, dependencies, and validation

---

## Dependency Graph

```
A1 ──→ A2 ──→ A3 ──→ A4
                    │
A5 ─────────────────┤
                    │
                    ├──→ A6 ──→ A7
                    │
                    └──→ A8 (validation gate)

B1 ──→ B2 ──→ B3 ──→ B4 ──→ B5 ──→ B6 ──→ B7 ──→ B8 (validation gate)

C1 ──→ C2 ──→ C3 ──→ C4 ──→ C5 (validation gate)

D1 ──→ D2 ──→ D3 ──→ D4 (validation gate)
```

---

## Phase A: Refactor (no visual change except English labels) — 8 subtasks, ~4 hours

### A1: Create `convex/_lib/reviewTypes.ts` with shared type definitions

**Files:**
- Create: `convex/_lib/reviewTypes.ts`

**Inputs:**
- Read: `convex/reviewCenter.ts` lines 11-52 (return type shape for `getReviewQueue`)
- Read: `convex/reviewCenter.ts` lines 144-157 (inline `QueueItem` type)
- Read: `app/(app)/review/ReviewCenterClient.tsx` lines 13-24 (client-side `QueueItem` type)

**What to do:**
Extract the duplicated `QueueItem` and `QueueHeader` shapes into a single types module:

```ts
// convex/_lib/reviewTypes.ts
import type { Id } from "../_generated/dataModel";

export type ReviewItemKind =
  | "flashcard"
  | "mistake"
  | "weak_topic"
  | "formula_pack"
  | "vocabulary_deck";

export interface QueueItem {
  readonly kind: ReviewItemKind;
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

**Validation:** `npm run typecheck`

**Dependencies:** None (can start immediately)

**Est. time:** 15 min

---

### A2: Create `convex/_lib/reviewHelpers.ts` with shared computation helpers

**Files:**
- Create: `convex/_lib/reviewHelpers.ts`

**Inputs:**
- Read: `convex/reviewCenter.ts` lines 61-166 (flashcard resolution chain: reviews → flashcards → decks → topics → chapters → subjects)
- Read: `convex/reviewCenter.ts` lines 168-320 (mistake resolution + deduplication + queue item building)
- Read: `convex/reviewCenter.ts` lines 322-400 (weak topic resolution + N+1 chain)
- Read: `convex/reviewCenter.ts` lines 402-480 (formula sheets + vocabulary decks nested scan)
- Read: `convex/_lib/topicChain.ts` (resolveTopicChains signature)

**What to do:**
Extract four helper functions from the duplicated/repetitive logic:

1. **`resolveFlashcardReviewChains`** — takes overdue + due-today flashcard reviews, batch-resolves:
   - All flashcard rows via `Promise.all(ctx.db.get(id))`
   - All deck rows (deduped) via batch
   - All topic rows via batch `ctx.db.get(id)`
   - All chapter + subject rows via `resolveTopicChains`
   - Returns a flat map of `review → { flashcard, deck, topic, chapter, subject }`
   - Hard cap: 100 reviews per input array

2. **`resolveMistakeReviewChains`** — takes overdue + due-today mistakes, batch-resolves:
   - All topic rows via `resolveTopicChains`
   - Returns a flat map of `mistake → { topic, chapter, subject }`
   - Hard cap: 100 mistakes per input array

3. **`collectFormulaPacks`** — takes enrolled subject IDs, a `Set<string>` for dedup, and a limit:
   - Pre-collects all topic IDs across subjects via batch chapter + topic queries
   - Batch-queries `topicResources` for `kind: "formula_sheet"` across all topic IDs
   - Returns deduped `QueueItem[]` capped at `limit`
   - Hard cap: 5 subjects, 30 chapters per subject, 20 topics per subject

4. **`collectVocabularyDecks`** — same pattern as formula packs but for `kind: "vocabulary_deck"`
   - Same caps as formula packs

**Validation:** `npm run typecheck`

**Dependencies:** A1 (needs types)

**Est. time:** 50 min

---

### A3: Refactor `getReviewQueue` to use helpers internally

**Files:**
- Modify: `convex/reviewCenter.ts` lines 53-480 (entire handler body)

**Inputs:**
- Read: `convex/reviewCenter.ts` full handler (lines 53-480)
- Read: `convex/_lib/reviewHelpers.ts` (just created in A2)
- Read: `convex/_lib/reviewTypes.ts` (from A1)

**What to do:**
Rewrite the handler body to call the four helpers from A2 instead of
doing inline computation. The return shape stays identical — no schema
change. The handler becomes ~80 lines of orchestration:

```ts
handler: async (ctx) => {
  const user = await resolveUser(ctx);
  if (!user) return emptyQueue();
  const now = Date.now();
  const userId = user._id;

  // Fetch raw data in parallel
  const [profile, enrollments, overdueFlashcards, dueTodayFlashcards,
         overdueMistakes, dueTodayMistakes, progress] =
    await Promise.all([/* 7 parallel queries */]);

  // Resolve chains using helpers
  const [flashcardChains, mistakeChains] = await Promise.all([
    resolveFlashcardReviewChains(ctx, overdueFlashcards, dueTodayFlashcards),
    resolveMistakeReviewChains(ctx, overdueMistakes, dueTodayMistakes),
  ]);

  // Build queue items from resolved chains
  const items = buildQueueItems(flashcardChains, mistakeChains);

  // Weak topics using resolveTopicChains (batch)
  const weakIds = progress.filter(...).slice(0, 8).map(p => p.topicId);
  const weakChains = await resolveTopicChains(ctx, weakIds);
  for (const [tid, chain] of weakChains) { /* add to items */ }

  // Formula packs + vocabulary decks via helpers
  const [formulaItems, vocabItems] = await Promise.all([
    collectFormulaPacks(ctx, enrolledSubjectIds, seenSet, 5),
    collectVocabularyDecks(ctx, enrolledSubjectIds, seenSet, 5),
  ]);
  items.push(...formulaItems, ...vocabItems);

  items.sort(...);
  // ... return same shape
}
```

**Validation:** `npm run typecheck`

**Dependencies:** A2

**Est. time:** 35 min

---

### A4: Use `resolveTopicChains` (batch) for weak topic resolution

**Files:**
- Modify: `convex/reviewCenter.ts` lines ~322-370 (weak topic loop)

**Inputs:**
- Read: `convex/reviewCenter.ts` weak topic section — the per-row `ctx.db.get(topicId)` → `get(chapterId)` → `get(subjectId)` pattern
- Read: `convex/_lib/topicChain.ts` lines 42-90 (`resolveTopicChains` function)

**What to do:**
Replace the sequential per-row resolution with batch `resolveTopicChains`:

```ts
// Before (N+1 — ~8 topics × 3 gets = 24 sequential DB reads):
for (const wp of weakCandidates.slice(0, 8)) {
  const topic = await ctx.db.get(wp.topicId);
  if (!topic) continue;
  const chapter = await ctx.db.get(topic.chapterId);
  if (!chapter) continue;
  const subject = await ctx.db.get(chapter.subjectId);
  if (!subject) continue;
  // ... build item
}

// After (batch — 1 call, O(1) reads after pre-fetch):
const weakIds = weakCandidates.slice(0, 6).map((p) => p.topicId);
const chains = await resolveTopicChains(ctx, weakIds);
for (const [topicId, chain] of chains) {
  const { topic, chapter, subject } = chain;
  const wp = weakCandidates.find((p) => p.topicId === topicId);
  if (!wp) continue;
  // ... build item using chain.topic, chain.chapter, chain.subject
}
```

**Validation:** `npm run typecheck`

**Dependencies:** A3 (if A3 already moved this into `reviewHelpers.ts`, this is automatic — the helper already uses `resolveTopicChains`)

**Est. time:** 15 min

---

### A5: Split `ReviewCenterClient.tsx` into separate component files

**Files:**
- Create: `components/review/ReviewHeader.tsx`
- Create: `components/review/ReviewSection.tsx`
- Create: `components/review/ReviewQueueCard.tsx`
- Create: `components/review/EmptyState.tsx`
- Create: `components/review/RescuePlanButton.tsx`
- Create: `components/review/types.ts`
- Modify: `app/(app)/review/ReviewCenterClient.tsx` → shrink to ~50 lines

**Inputs:**
- Read: `app/(app)/review/ReviewCenterClient.tsx` (full ~240 lines)

**What to do:**
Extract each section of the client component into its own file:

| Section | Source lines | New file |
|---|---|---|
| Header + rescue plan button | 94-160 | `components/review/ReviewHeader.tsx` |
| Section shell (label + card list) | 163-181 | `components/review/ReviewSection.tsx` |
| Review queue card | 183-222 | `components/review/ReviewQueueCard.tsx` |
| Empty state | 224-end | `components/review/EmptyState.tsx` |
| Rescue plan button logic | 75-91 | `components/review/RescuePlanButton.tsx` |
| QueueItem type + kindMeta | 13-38 | `components/review/types.ts` |

Each extracted file must:
- Import only the dependencies it needs (icons, `Link`, `usePreloadedQuery`)
- Keep the exact same props interface
- No logic changes — pure extraction
- Use English labels instead of German (see A7)

The remaining `ReviewCenterClient.tsx` should import all extracted
components and compose them, with the client-side sorting/bucketing
logic:

```tsx
export function ReviewCenterClient({ queuePreloaded }: Props) {
  const data = usePreloadedQuery(queuePreloaded);
  const sections = useMemo(() => {
    const due: QueueItem[] = [];
    const dueToday: QueueItem[] = [];
    // ... same bucketing logic
    return { due, dueToday, weak, packs };
  }, [data.items]);

  if (data.items.length === 0) return <EmptyState variant={...} />;

  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <ReviewHeader data={data} />
      {sections.due.length > 0 && <ReviewSection label="Overdue" items={sections.due} tone="var(--subject-french)" />}
      {sections.dueToday.length > 0 && <ReviewSection label="Due today" items={sections.dueToday} />}
      {sections.weak.length > 0 && <ReviewSection label="Weak foundations" items={sections.weak} />}
      {sections.packs.length > 0 && <ReviewSection label="Formula & vocabulary packs" items={sections.packs} />}
    </div>
  );
}
```

**Validation:** `npm run typecheck`

**Dependencies:** None (pure extraction, can start immediately)

**Est. time:** 35 min

---

### A6: Replace `color-mix` icon containers with native-sized icons

**Files:**
- Modify: `components/review/ReviewQueueCard.tsx` lines ~183-202 (icon wrapper)
- Modify: `components/review/EmptyState.tsx` lines ~224-248 (empty state icon + double-bezel card)

**Inputs:**
- Read: `docs/SYNEDRIX-FRONTEND-STYLE.md` §8 (icons at native size, no bg-accent/10 containers)
- Read: `docs/SYNEDRIX-FRONTEND-STYLE.md` §5 (single-layer cards)

**What to do:**

**ReviewQueueCard icon:** Remove the `color-mix` wrapper:

```tsx
// Before:
<span
  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
  style={{
    backgroundColor: accentTone
      ? `color-mix(in srgb, ${accentTone} 12%, transparent)`
      : "color-mix(in srgb, var(--color-accent) 12%, transparent)",
    color: accentTone ?? "var(--color-accent)",
  }}
>
  <Icon className="h-4 w-4" weight="duotone" />
</span>

// After:
<Icon
  className="h-4 w-4 shrink-0"
  style={{ color: accentTone ?? "var(--accent)" }}
  weight="duotone"
/>
```

**EmptyState:** Replace double-bezel card with `CockpitCard` and remove icon container:

```tsx
// Before:
<div className="rounded-2xl border border-border bg-surface-elevated p-1.5">
  <div className="rounded-xl bg-background p-7 text-center">
    <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg"
      style={{ backgroundColor: "color-mix(in srgb, var(--color-accent) 14%, transparent)", color: "var(--color-accent)" }}>
      <ClockCounterClockwise className="h-5 w-5" weight="duotone" />
    </span>
    ...
  </div>
</div>

// After:
<CockpitCard>
  <div className="flex flex-col items-center gap-3 py-10 text-center">
    <ClockCounterClockwise className="h-5 w-5 text-accent" weight="duotone" />
    ...
  </div>
</CockpitCard>
```

**Validation:** `npm run typecheck`

**Dependencies:** A5 (needs extracted component files) or can be done directly on `ReviewCenterClient.tsx` if A5 is skipped

**Est. time:** 15 min

---

### A7: Standardize all labels to English

**Files:**
- Modify: `components/review/ReviewHeader.tsx`
- Modify: `components/review/ReviewSection.tsx`
- Modify: `components/review/ReviewQueueCard.tsx`
- Modify: `components/review/EmptyState.tsx`

**Inputs:**
- Read: `app/(app)/review/ReviewCenterClient.tsx` — all German labels

**What to do:**
Replace every German label with English:

| Line context | German | English |
|---|---|---|
| Breadcrumb | `/ wiederholungen` | `/ review` |
| H1 | `Wiederholungen` | `Review Center` |
| Stats | `{n} überfällig · {m} heute fällig · {k} schwache Themen` | `{n} overdue · {m} due today · {k} weak topics` |
| Rescue CTA | `Rettungsplan erstellen` | `Generate rescue plan` |
| Rescue loading | `Generiere...` | `Generating...` |
| Rescue error | `Plan konnte nicht generiert werden – versuche es erneut` | `Could not generate plan — try again` |
| Section | `Überfällig` | `Overdue` |
| Section | `Heute fällig` | `Due today` |
| Section | `Schwache Grundlagen` | `Weak foundations` |
| Section | `Formel- & Vokabelsammlungen` | `Formula & vocabulary packs` |
| Kind label | `Karteikarten-Wiederholung` | `Flashcard review` |
| Kind label | `Fehler-Wiederholung` | `Mistake review` |
| Kind label | `Schwaches Thema` | `Weak topic` |
| Kind label | `Formelsammlung` | `Formula sheet` |
| Kind label | `Vokabelstapel` | `Vocabulary deck` |
| Empty H2 | `Keine anstehenden Wiederholungen` | `Nothing to review` |
| Empty body | `Deine Wiederholungsliste ist leer. Lerne ein Thema, schließe eine Übung ab oder gehe Karteikarten durch – fällige Aufgaben erscheinen hier automatisch.` | `Your review queue is empty. Study a topic, complete a practice set, or review flashcards — due items appear here automatically.` |
| Empty CTA | `Fächer durchsuchen` | `Browse subjects` |

**Validation:** `npm run typecheck`

**Dependencies:** A5 (needs extracted files) or can be done on ReviewCenterClient.tsx directly

**Est. time:** 20 min

---

### A8: Validation gate — typecheck + test

**What to do:**
Run full typecheck and test suite. Fix any type errors or test failures
introduced by A1-A7.

**Validation:** `npm run typecheck && npm run test`

**Dependencies:** A1-A7 all complete

**Est. time:** 15 min

---

## Phase B: Tiered Preloading — 8 subtasks, ~3.5 hours

### B1: Split `getReviewQueue` into 6 focused queries

**Files:**
- Modify: `convex/planner.ts` — add 6 new queries alongside existing `getReviewQueue`

**Inputs:**
- Read: `convex/reviewCenter.ts` full file (after A3 refactor)
- Read: `convex/_lib/reviewHelpers.ts` (from A2)
- Read: `convex/_lib/reviewTypes.ts` (from A1)

**What to do:**
Add 6 new queries. Keep the existing `getReviewQueue` untouched for V1:

1. **`getQueueHeader`** — fetches counts only (flashcard overdue/due-today, mistake overdue/due-today, weak topic count). Returns `QueueHeader`. This is the fastest query.

2. **`getFlashcardQueue`** — fetches overdue + due-today flashcards (capped 100 each), resolves chains via helper, returns deduped `QueueItem[]` (capped 15).

3. **`getMistakeQueue`** — fetches overdue + due-today mistakes (capped 100 each), resolves chains via helper, returns deduped `QueueItem[]` (capped 15).

4. **`getWeakTopics`** — fetches `userTopicProgress` (capped 500), filters to mastery < 0.5, batch-resolves chains via `resolveTopicChains`, returns `QueueItem[]` (capped 6).

5. **`getFormulaPacks`** — calls `collectFormulaPacks` helper, returns `QueueItem[]` (capped 5).

6. **`getVocabularyDecks`** — calls `collectVocabularyDecks` helper, returns `QueueItem[]` (capped 5).

Each query must have its own `v.object(...)` return type declaration.
Do not remove `getReviewQueue` — the V1 path still needs it.

**Validation:** `npm run typecheck`

**Dependencies:** A2 (helpers) + A1 (types)

**Est. time:** 45 min

---

### B2: Preload all queries in page.tsx

**Files:**
- Modify: `app/(app)/review/page.tsx` lines 15-22

**Inputs:**
- Read: `app/(app)/review/page.tsx` (full ~63 lines)

**What to do:**
Replace the single-query preload with 6-query preload:

```ts
// Before:
queuePreloaded = await preloadQuery(api.reviewCenter.getReviewQueue, {}, token ? { token } : {});

// After:
[headerPreloaded, flashcardPreloaded, mistakePreloaded,
 weakPreloaded, formulaPreloaded, vocabPreloaded] = await Promise.all([
  preloadQuery(api.reviewCenter.getQueueHeader, {}, token ? { token } : {}),
  preloadQuery(api.reviewCenter.getFlashcardQueue, {}, token ? { token } : {}),
  preloadQuery(api.reviewCenter.getMistakeQueue, {}, token ? { token } : {}),
  preloadQuery(api.reviewCenter.getWeakTopics, {}, token ? { token } : {}),
  preloadQuery(api.reviewCenter.getFormulaPacks, {}, token ? { token } : {}),
  preloadQuery(api.reviewCenter.getVocabularyDecks, {}, token ? { token } : {}),
]);
```

Handle each preloaded value potentially being null (Convex not configured).

**Validation:** `npm run typecheck`

**Dependencies:** B1

**Est. time:** 15 min

---

### B3: Create `ReviewCenterClientV2.tsx` with Suspense boundaries

**Files:**
- Create: `app/(app)/review/ReviewCenterClientV2.tsx`

**Inputs:**
- Read: `app/(app)/review/ReviewCenterClient.tsx` (the thin version after A5, ~50 lines)
- Read: `docs/REVIEW-IMPROVEMENT-DESIGN-DOC.md` §1.2-1.4

**What to do:**
Create a new client component that:
1. Takes 6 preloaded query props (one per focused query)
2. Renders each section inside its own `Suspense` boundary
3. Uses wrapper components (each wrapper calls `usePreloadedQuery`)

```tsx
"use client";

import { Suspense, useMemo } from "react";
import { usePreloadedQuery, Preloaded } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ReviewHeader } from "@/components/review/ReviewHeader";
import { ReviewSection } from "@/components/review/ReviewSection";
import { EmptyState } from "@/components/review/EmptyState";
import {
  HeaderSkeleton,
  SectionSkeleton,
} from "./skeletons";

export function ReviewCenterClientV2({
  headerPreloaded,
  flashcardPreloaded,
  mistakePreloaded,
  weakPreloaded,
  formulaPreloaded,
  vocabPreloaded,
}: { /* 6 Preloaded props */ }) {
  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <Suspense fallback={<HeaderSkeleton />}>
        <HeaderWrapper preloaded={headerPreloaded} />
      </Suspense>

      <Suspense fallback={<SectionSkeleton count={3} />}>
        <FlashcardSection preloaded={flashcardPreloaded} label="Overdue" />
      </Suspense>

      <Suspense fallback={<SectionSkeleton count={3} />}>
        <MistakeSection preloaded={mistakePreloaded} label="Due today" />
      </Suspense>

      <Suspense fallback={<SectionSkeleton count={3} />}>
        <WeakTopicsSection preloaded={weakPreloaded} />
      </Suspense>

      <Suspense fallback={<SectionSkeleton count={2} />}>
        <ResourcesSection formulaPreloaded={formulaPreloaded} vocabPreloaded={vocabPreloaded} />
      </Suspense>
    </div>
  );
}

// Wrapper components:
function HeaderWrapper({ preloaded }: { preloaded: Preloaded<typeof api.reviewCenter.getQueueHeader> }) {
  const data = usePreloadedQuery(preloaded);
  return <ReviewHeader data={data} />;
}

function FlashcardSection({ preloaded, label }: { preloaded: Preloaded<typeof api.reviewCenter.getFlashcardQueue>; label: string }) {
  const items = usePreloadedQuery(preloaded);
  if (items.length === 0) return null;
  return <ReviewSection label={label} items={items} tone="var(--subject-french)" />;
}
// ... etc.
```

**Validation:** `npm run typecheck`

**Dependencies:** A5 (extracted components) + B1 (new queries) + B2 (preloading)

**Est. time:** 40 min

---

### B4: Build skeleton components

**Files:**
- Create: `app/(app)/review/skeletons.tsx`

**Inputs:**
- Read: `components/review/ReviewHeader.tsx` (to match layout height)
- Read: `components/review/ReviewSection.tsx` (card dimensions)
- Read: `components/dashboard/CockpitCard.tsx` (card dimensions)

**What to do:**
Create two skeleton components:

```tsx
export function HeaderSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-4 w-20 animate-pulse rounded bg-muted/30" />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="h-7 w-48 animate-pulse rounded bg-muted/20" />
          <div className="mt-1 h-4 w-64 animate-pulse rounded bg-muted/20" />
        </div>
      </div>
    </div>
  );
}

export function SectionSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="h-5 w-24 animate-pulse rounded bg-muted/20 mb-1" />
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-md bg-muted/15" />
      ))}
    </div>
  );
}
```

**Validation:** Visual check that skeletons match real component heights

**Dependencies:** A5 (panel dimensions known)

**Est. time:** 10 min

---

### B5: Add per-section error boundaries

**Files:**
- Modify: `app/(app)/review/ReviewCenterClientV2.tsx` (from B3)

**Inputs:**
- Read: `app/(app)/review/error.tsx` — doesn't exist yet, route-level error is inline in page.tsx

**What to do:**
Wrap each Suspense boundary with an error boundary so a failed
`getFormulaPacks` doesn't crash the entire review page. Each
error boundary renders a compact inline error card:

```tsx
function SectionError({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <p className="text-[12px] text-muted-foreground">
          Could not load {label}.
        </p>
        <button type="button" onClick={onRetry}
          className="inline-flex h-8 items-center rounded-md bg-foreground px-3 text-[11.5px] font-medium text-background">
          Retry
        </button>
      </div>
    </div>
  );
}
```

Use React's class-based `ErrorBoundary` or a simple `useState` error
boundary pattern for each section.

**Validation:** `npm run typecheck`

**Dependencies:** B3

**Est. time:** 20 min

---

### B6: Create section wrapper components

**Files:**
- Create: `components/review/FlashcardSection.tsx`
- Create: `components/review/MistakeSection.tsx`
- Create: `components/review/WeakTopicsSection.tsx`
- Create: `components/review/ResourcesSection.tsx`

**What to do:**
Extract the wrapper components from `ReviewCenterClientV2.tsx` into
their own files so they can be tested independently:

```tsx
// FlashcardSection.tsx
"use client";
import { usePreloadedQuery, Preloaded } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ReviewSection } from "./ReviewSection";

export function FlashcardSection({
  preloaded,
  label,
  tone,
}: {
  readonly preloaded: Preloaded<typeof api.reviewCenter.getFlashcardQueue>;
  readonly label: string;
  readonly tone?: string;
}) {
  const items = usePreloadedQuery(preloaded);
  if (items.length === 0) return null;
  return <ReviewSection label={label} items={items} tone={tone} />;
}
```

Similar pattern for MistakeSection, WeakTopicsSection, ResourcesSection.

**Validation:** `npm run typecheck`

**Dependencies:** B1 (queries exist) + A5 (ReviewSection exists)

**Est. time:** 20 min

---

### B7: Feature-flag gate in page.tsx

**Files:**
- Modify: `app/(app)/review/page.tsx` lines 1-63

**Inputs:**
- Read: `app/(app)/review/page.tsx` (full file)

**What to do:**
Add a feature flag so V1 and V2 paths coexist:

```ts
const useV2 = process.env.NEXT_PUBLIC_REVIEW_V2 === "true";

// Preload both V1 and V2 queries (or conditionally):
if (useV2) {
  [headerPreloaded, flashcardPreloaded, mistakePreloaded,
   weakPreloaded, formulaPreloaded, vocabPreloaded] =
    await Promise.all([/* 6 V2 queries */]);
  // Still preload V1 for fallback:
  queuePreloaded = await preloadQuery(api.reviewCenter.getReviewQueue, {}, token ? { token } : {});
}

return useV2
  ? <ReviewCenterClientV2 /* 6 preloaded props */ />
  : <ReviewCenterClient queuePreloaded={queuePreloaded} />;
```

**Validation:** `npm run typecheck`

**Dependencies:** B2 + B3 + A5

**Est. time:** 15 min

---

### B8: Validation gate — typecheck + test

**What to do:**
Run full typecheck and test suite. Fix any errors introduced by B1-B7.
Manually verify the review page renders with `NEXT_PUBLIC_REVIEW_V2=false`
(V1 path) and `=true` (V2 path).

**Validation:** `npm run typecheck && npm run test`

**Dependencies:** B1-B7 all complete

**Est. time:** 20 min

---

## Phase C: Rescue Plan Integration — 5 subtasks, ~2 hours

### C1: Add `rescuePlans` table to schema

**Files:**
- Modify: `convex/schema.ts` — add new table definition before the closing `});`

**What to do:**
Add the rescue plans table:

```ts
rescuePlans: defineTable({
  userId: v.id("users"),
  plan: v.string(),
  priorityTopics: v.array(v.id("topics")),
  generatedAt: v.number(),
  expiresAt: v.number(),
}).index("by_user", ["userId"]),
```

**Validation:** `npm run typecheck`

**Dependencies:** None (can start immediately)

**Est. time:** 10 min

---

### C2: Add `rescuePlanId` field to `QueueHeader`

**Files:**
- Modify: `convex/reviewCenter.ts` — `getQueueHeader` query return type and handler

**Inputs:**
- Read: `convex/schema.ts` — rescuePlans table (from C1)

**What to do:**
Add a `rescuePlanId` field to the `QueueHeader` return type. The query
handler checks for an existing non-expired rescue plan:

```ts
const existingPlan = await ctx.db
  .query("rescuePlans")
  .withIndex("by_user", (q) => q.eq("userId", userId))
  .first();

const hasValidPlan = existingPlan !== null && existingPlan.expiresAt > now;

return {
  // ... existing fields
  rescuePlanId: hasValidPlan ? existingPlan._id : null,
  hasRescuePlanEligible: !hasValidPlan && overdueCount >= 5,
};
```

**Validation:** `npm run typecheck`

**Dependencies:** C1

**Est. time:** 15 min

---

### C3: Modify rescue plan API route to persist plan

**Files:**
- Modify: `app/api/review/rescue-plan/route.ts`

**Inputs:**
- Read: `app/api/review/rescue-plan/route.ts` (full file)

**What to do:**
After generating the AI rescue plan, persist it to the `rescuePlans`
table via a Convex mutation before redirecting:

```ts
// After AI generation:
const planId = await ctx.runMutation(api.reviewCenter.saveRescuePlan, {
  plan: generatedContent,
  priorityTopics: priorityTopicIds,
});

// Redirect to plan view page:
return Response.json({ redirectUrl: `/review/rescue-plan/${planId}` });
```

Add a `saveRescuePlan` mutation to `convex/reviewCenter.ts`:

```ts
export const saveRescuePlan = mutation({
  args: {
    plan: v.string(),
    priorityTopics: v.array(v.id("topics")),
  },
  returns: v.id("rescuePlans"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    return await ctx.db.insert("rescuePlans", {
      userId: user._id,
      plan: args.plan,
      priorityTopics: args.priorityTopics,
      generatedAt: now,
      expiresAt: now + 7 * DAY_MS,
    });
  },
});
```

**Validation:** `npm run typecheck`

**Dependencies:** C1 + C2

**Est. time:** 25 min

---

### C4: Update `RescuePlanButton` to show "View plan" when plan exists

**Files:**
- Modify: `components/review/RescuePlanButton.tsx` (from A5)

**Inputs:**
- Read: `components/review/RescuePlanButton.tsx`
- Read: `convex/_lib/reviewTypes.ts` — `QueueHeader` type

**What to do:**
The rescue plan button should show different UI based on whether a
plan already exists:

```tsx
export function RescuePlanButton({
  hasRescuePlanEligible,
  rescuePlanId,
}: {
  readonly hasRescuePlanEligible: boolean;
  readonly rescuePlanId: string | null;
}) {
  if (rescuePlanId) {
    return (
      <Link
        href={`/review/rescue-plan/${rescuePlanId}`}
        className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-background px-4 text-[13px] font-medium text-foreground transition-colors hover:bg-surface"
      >
        <FirstAid className="h-3.5 w-3.5" weight="duotone" />
        View rescue plan
      </Link>
    );
  }

  if (!hasRescuePlanEligible) return null;

  // ... existing generate button logic
}
```

**Validation:** `npm run typecheck`

**Dependencies:** A5 (RescuePlanButton extracted) + C2 (rescuePlanId field)

**Est. time:** 20 min

---

### C5: Validation gate — typecheck + manual QA

**What to do:**
Run typecheck. Manually verify:
- Rescue plan "Generate" button appears when overdue ≥ 5 and no existing plan.
- After generating, the button becomes "View rescue plan" with a link.
- Existing plan persists across page reloads.
- Expired plans trigger a new "Generate" button.

**Validation:** `npm run typecheck` + manual QA

**Dependencies:** C1-C4 complete

**Est. time:** 15 min

---

## Phase D: Performance Hardening — 4 subtasks, ~2 hours

### D1: Apply caps to remaining uncapped collects

**Files:**
- Modify: `convex/_lib/reviewHelpers.ts` (from A2)
- Modify: `convex/reviewCenter.ts` — remaining uncapped queries from B1

**What to do:**
Audit every `collect()` and `take()` call across all review helpers
and queries. Apply these caps:

| Location | Current | Target |
|---|---|---|
| `resolveFlashcardReviewChains` — overdue reviews | `.take(200)` | `.take(100)` |
| `resolveFlashcardReviewChains` — due-today reviews | `.take(200)` | `.take(100)` |
| `resolveMistakeReviewChains` — overdue mistakes | `.take(200)` | `.take(100)` |
| `resolveMistakeReviewChains` — due-today mistakes | `.take(200)` | `.take(100)` |
| `getWeakTopics` — progress | `.collect()` | `.take(500)` |
| `getWeakTopics` — candidates displayed | `.slice(0, 8)` | `.slice(0, 6)` |
| `collectFormulaPacks` — chapters per subject | `.take(100)` | `.take(30)` |
| `collectFormulaPacks` — topics per chapter | `.take(300)` | `.take(50)` |
| `collectFormulaPacks` — topics scanned for resources | `.slice(0, 50)` | `.slice(0, 20)` |
| `collectVocabularyDecks` — same as formula | same | same |

Document every cap in JSDoc on the helper/query.

**Validation:** `npm run typecheck`

**Dependencies:** A2 (helpers exist) or B1 (queries exist)

**Est. time:** 20 min

---

### D2: Flatten formula/vocabulary scan to batch queries

**Files:**
- Modify: `convex/_lib/reviewHelpers.ts` — `collectFormulaPacks` and `collectVocabularyDecks` functions

**Inputs:**
- Read: `convex/reviewCenter.ts` lines 402-480 (current nested formula/vocab scan in `getReviewQueue`)

**What to do:**
Replace the deeply nested `for (subject) → for (chapter) → for (topic) → query resource` pattern with a flat batch:

```ts
export async function collectFormulaPacks(
  ctx: QueryCtx,
  enrolledSubjectIds: Id<"subjects">[],
  seen: Set<string>,
  limit: number,
): Promise<QueueItem[]> {
  // Step 1: Collect all chapters across all subjects (batch)
  const chapterLists = await Promise.all(
    enrolledSubjectIds.slice(0, 5).map((subjId) =>
      ctx.db.query("chapters")
        .withIndex("by_subject", (q) => q.eq("subjectId", subjId))
        .take(30)
    )
  );
  const allChapters = chapterLists.flat();

  // Step 2: Collect all topics across all chapters (batch)
  const topicLists = await Promise.all(
    allChapters.map((ch) =>
      ctx.db.query("topics")
        .withIndex("by_chapter", (q) => q.eq("chapterId", ch._id))
        .take(50)
    )
  );
  const allTopics = topicLists.flat().slice(0, 100);

  // Step 3: Batch-query resources for all topics
  const topicIds = allTopics.map((t) => t._id);
  const resources = await Promise.all(
    topicIds.map((tid) =>
      ctx.db.query("topicResources")
        .withIndex("by_topic_kind", (q) =>
          q.eq("topicId", tid).eq("kind", "formula_sheet")
        )
        .first()
    )
  );

  // Step 4: Filter non-null and build QueueItems
  const items: QueueItem[] = [];
  for (let i = 0; i < resources.length; i++) {
    const resource = resources[i];
    if (!resource) continue;
    const topic = allTopics[i];
    const key = `formula_pack::${resource._id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // ... build QueueItem
    if (items.length >= limit) break;
  }
  return items;
}
```

Same pattern for `collectVocabularyDecks`.

This replaces ~80 lines of nested loops with flat batch queries.

**Validation:** `npm run typecheck`

**Dependencies:** A2 (helpers exist)

**Est. time:** 30 min

---

### D3: Add query latency telemetry

**Files:**
- Modify: `convex/reviewCenter.ts` — add timing wrappers to slow queries

**What to do:**
Wrap each new query handler with a timing pattern that logs slow queries:

```ts
handler: async (ctx) => {
  const start = Date.now();
  const result = await actualHandler(ctx);
  const latencyMs = Date.now() - start;
  if (latencyMs > 500) {
    await ctx.db.insert("aiGenerations", {
      userId: user._id,
      task: "reviewCenter.getFormulaPacks",
      model: "convex-query",
      inputTokens: 0,
      outputTokens: 0,
      latencyMs,
      schemaValid: true,
    });
  }
  return result;
},
```

Only log queries exceeding 500ms. Focus on the expensive ones:
`getFormulaPacks` and `getVocabularyDecks`.

**Validation:** `npm run typecheck`

**Dependencies:** B1 (queries exist)

**Est. time:** 15 min

---

### D4: Validation gate — typecheck + test + manual QA

**What to do:**
Run full typecheck and test suite. Manually verify:
- Review page loads with all sections.
- Performance is measurably faster (fewer sequential DB reads).
- Caps are respected (no unbounded collections).
- Telemetry logs appear for slow queries.

**Validation:** `npm run typecheck && npm run test`

**Dependencies:** D1-D3 complete

**Est. time:** 15 min

---

## Quick Reference

### Files Created (16 new)

| File | Phase | Purpose |
|---|---|---|
| `convex/_lib/reviewTypes.ts` | A1 | Shared type definitions |
| `convex/_lib/reviewHelpers.ts` | A2 | Shared computation helpers |
| `components/review/types.ts` | A5 | Client-side QueueItem type + kindMeta |
| `components/review/ReviewHeader.tsx` | A5 | Header with counts + rescue CTA |
| `components/review/ReviewSection.tsx` | A5 | Section shell (label + card list) |
| `components/review/ReviewQueueCard.tsx` | A5 | Single review card |
| `components/review/EmptyState.tsx` | A5 | Differentiated empty states |
| `components/review/RescuePlanButton.tsx` | A5 | Rescue plan client logic |
| `app/(app)/review/ReviewCenterClientV2.tsx` | B3 | V2 client with Suspense |
| `app/(app)/review/skeletons.tsx` | B4 | Skeleton components |
| `components/review/FlashcardSection.tsx` | B6 | Flashcard section wrapper |
| `components/review/MistakeSection.tsx` | B6 | Mistake section wrapper |
| `components/review/WeakTopicsSection.tsx` | B6 | Weak topics section wrapper |
| `components/review/ResourcesSection.tsx` | B6 | Formula + vocab combined wrapper |

### Files Modified (6 existing)

| File | Phase | Changes |
|---|---|---|
| `convex/reviewCenter.ts` | A3, A4, B1, C2, C3, D3 | Use helpers, batch resolve, add 6 new queries + 1 mutation |
| `app/(app)/review/ReviewCenterClient.tsx` | A5, A7 | Shrink to 50-line orchestrator, English labels |
| `app/(app)/review/page.tsx` | B2, B7 | Preload 6 queries, feature flag |
| `convex/schema.ts` | C1 | Add rescuePlans table |
| `app/api/review/rescue-plan/route.ts` | C3 | Persist plan to rescuePlans table |

### Estimates by Phase

| Phase | Subtasks | Est. time | Risk |
|---|---|---|---|
| A (Refactor) | 8 | ~4 hrs | Low — no visual change (except English labels) |
| B (Tiered loading) | 8 | ~3.5 hrs | Medium — new Suspense + error boundaries |
| C (Rescue plan) | 5 | ~2 hrs | Medium — new table + API route changes |
| D (Performance) | 4 | ~2 hrs | Low — caps + batch queries |
| **Total** | **25** | **~11.5 hrs** | |

### Parallelizable Subtasks

These can all be started simultaneously (zero shared dependencies):

- **Wave 1:** A1, A5, C1 — all independent
- **Wave 2:** A2, A3, A4 (sequential, depends on A1)
- **Wave 3:** A6, A7 (depends on A5)
- **Wave 4:** A8 (validation gate)
- **Wave 5:** B1-B8 (sequential, depends on Phase A)
- **Wave 6:** C2-C5 (sequential, depends on Phase B + C1)
- **Wave 7:** D1-D4 (mostly-sequential, depends on Phase A+B)
