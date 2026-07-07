# Planner Improvement — Subtask Breakdown

> Derived from `docs/PLANNER-IMPROVEMENT-DESIGN-DOC.md`
> 27 subtasks across 4 phases
> Each subtask includes exact files, line numbers, dependencies, and validation

---

## Dependency Graph

```
A1 ──→ A2 ──→ A3 ──→ A4
                    │
A5 ─────────────────┤
                    │
A6 ─────────────────┤
                    │
                    ├──→ A7 (independent of A5/A6, depends on A3)
                    │
                    └──→ A8 ──→ A9 (validation gate)

B1 ──→ B2 ──→ B3 ──→ B4 ──→ B5 ──→ B6 ──→ B7 ──→ B8 (validation gate)

C1 ──→ C2 ──→ C3 ──→ C4 (validation gate)

D1 ──→ D2 (parallel) + D3 (parallel) ──→ D4 (validation gate)
```

---

## Phase A: Refactor (no visual change) — 9 subtasks, ~4.5 hours

### A1: Create `convex/_lib/plannerTypes.ts` with shared type definitions

**Files:**
- Create: `convex/_lib/plannerTypes.ts`

**Inputs:**
- Read: `convex/planner.ts` lines 13-97 (return type shapes for `getPlannerOverview`)
- Read: `convex/planner.ts` lines 186-241 (`listTemplates` return type)
- Read: `convex/planner.ts` lines 275-320 (`getRecoveryPlan` return type)
- Read: `convex/goals.ts` lines 7-41 (`list` return type)
- Read: `convex/goals.ts` lines 146-168 (`getSnapshot` return type)

**What to do:**
Extract every duplicated shape into a single types module. The shapes that appear
across multiple queries are: `EnrichedGoal`, `EnrichedTemplate`, `OverdueTopic`,
`NextBestRecommendation`, `WeeklyStats`, `PriorityTopic`, `RecoveryPlan`.

```ts
// convex/_lib/plannerTypes.ts
import type { Id } from "../_generated/dataModel";

export interface WeeklyStats {
  readonly totalMinutes: number;
  readonly totalSessions: number;
  readonly streakDays: number;
  readonly goalCompletionRate: number;
}

export interface EnrichedGoal {
  readonly id: Id<"goals">;
  readonly title: string;
  readonly type: "daily" | "weekly";
  readonly targetCount: number | null;
  readonly completedCount: number;
  readonly deadline: number | null;
  readonly subjectTitle: string | null;
  readonly subjectColor: string | null;
}

export interface GoalSnapshotDaily {
  readonly id: Id<"goals">;
  readonly title: string;
  readonly targetCount: number | null;
  readonly completedCount: number;
  readonly subjectTitle: string | null;
  readonly subjectColor: string | null;
}

export interface GoalSnapshotWeekly extends GoalSnapshotDaily {
  readonly deadline: number | null;
}

export interface EnrichedTemplate {
  readonly id: Id<"sessionTemplates">;
  readonly title: string;
  readonly description: string | null;
  readonly subjectId: Id<"subjects"> | null;
  readonly subjectTitle: string | null;
  readonly subjectColor: string | null;
  readonly intentionHint: string | null;
  readonly targetMinutes: number | null;
}

export interface NextBestRecommendation {
  readonly subject: {
    readonly slug: string;
    readonly title: string;
    readonly color?: string;
  };
  readonly chapter: {
    readonly slug: string;
    readonly title: string;
  };
  readonly topic: {
    readonly id: Id<"topics">;
    readonly slug: string;
    readonly title: string;
    readonly examRelevance: number;
    readonly mastery: number;
    readonly source: "canonical" | "user";
    readonly ownerId: Id<"users"> | null;
  };
  readonly reason: string;
}

export interface OverdueTopic {
  readonly id: Id<"topics">;
  readonly slug: string;
  readonly title: string;
  readonly subjectTitle: string;
  readonly subjectSlug: string;
  readonly subjectColor: string | null;
  readonly chapterSlug: string;
  readonly mastery: number;
  readonly lastStudied: number | null;
  readonly daysSinceStudy: number | null;
}

export interface PriorityTopic {
  readonly title: string;
  readonly slug: string;
  readonly subjectTitle: string;
  readonly subjectSlug: string;
  readonly subjectColor: string | null;
  readonly chapterSlug: string;
  readonly mastery: number;
  readonly daysSinceStudy: number;
  readonly reason: string;
}

export interface RecoveryPlan {
  readonly overdueCount: number;
  readonly totalTopics: number;
  readonly suggestedSessionMinutes: number;
  readonly priorityTopics: readonly PriorityTopic[];
  readonly narrative: string;
}
```

**Validation:** `npm run typecheck`

**Dependencies:** None (can start immediately)

**Est. time:** 20 min

---

### A2: Create `convex/_lib/plannerHelpers.ts` with shared computation helpers

**Files:**
- Create: `convex/_lib/plannerHelpers.ts`

**Inputs:**
- Read: `convex/planner.ts` lines 89-142 (getPlannerOverview handler — goals enrichment, stats computation, overdue topics)
- Read: `convex/planner.ts` lines 155-181 (template subject resolution)
- Read: `convex/planner.ts` lines 330-380 (getRecoveryPlan — duplicate sessions fetch, overdue computation)
- Read: `convex/_lib/streak.ts` (computeStreak signature)
- Read: `convex/_lib/topicChain.ts` (resolveTopicChain / resolveTopicChains signatures)

**What to do:**
Extract four pure functions from the duplicated logic across
`getPlannerOverview` and `getRecoveryPlan`:

1. `computeWeeklyStats(ctx, userId, now)` — fetches sessions (take 100),
   goals (take 50), computes minutes/sessions/streak/goalRate.

2. `collectOverdueTopics(ctx, userId, now, limit)` — fetches progress
   (take 200), filters mastery < 0.85 and daysSinceStudy ≥ 3, uses
   `resolveTopicChains` for batch resolution (not per-row
   `resolveTopicChain`), returns sorted array capped at `limit`.

3. `resolveGoalSubjects(ctx, goals)` — batch-resolves subject titles
   and colors for a goals array, returns `EnrichedGoal[]`.

4. `resolveTemplateSubjects(ctx, templates)` — batch-resolves subject
   titles and colors for a templates array, returns `EnrichedTemplate[]`.

Each helper must have a hard cap on all `.collect()` or `.take()` calls
documented in its JSDoc.

**Validation:** `npm run typecheck`

**Dependencies:** A1 (needs types)

**Est. time:** 45 min

---

### A3: Refactor `getPlannerOverview` to use helpers

**Files:**
- Modify: `convex/planner.ts` lines 13-184

**Inputs:**
- Read: `convex/planner.ts` full getPlannerOverview handler (lines 89-184)
- Read: `convex/_lib/plannerHelpers.ts` (just created in A2)

**What to do:**
Rewrite the handler body of `getPlannerOverview` to call the four helpers
from A2 instead of doing inline computation. The return shape stays
identical — no schema change. The handler should become ~30 lines of
orchestration:

```ts
handler: async (ctx) => {
  const user = await resolveUser(ctx);
  if (!user) { /* return empty default */ }

  const now = Date.now();
  const [goals, templates, weeklyStats, overdueTopics, nextBest] =
    await Promise.all([
      /* goals query */,
      /* templates query */,
      computeWeeklyStats(ctx, user._id, now),
      collectOverdueTopics(ctx, user._id, now, 10),
      recommendNextBest(ctx, { userId: user._id, scope: { kind: "all_enrolled" } }),
    ]);

  return {
    goals: await resolveGoalSubjects(ctx, goals),
    templates: await resolveTemplateSubjects(ctx, templates),
    nextBest,
    overdueTopics,
    weeklyStats,
  };
},
```

**Important:** The `v.object(...)` return type declaration does not change.
This is a pure implementation refactor.

**Validation:** `npm run typecheck`

**Dependencies:** A2

**Est. time:** 30 min

---

### A4: Use `resolveTopicChains` (batch) instead of per-row `resolveTopicChain`

**Files:**
- Modify: `convex/planner.ts` line ~122-142 (overdue topics loop in getPlannerOverview)
- Modify: `convex/planner.ts` lines 330-380 (overdue topics in getRecoveryPlan)

**Inputs:**
- Read: `convex/_lib/topicChain.ts` lines 42-90 (`resolveTopicChains` function)
- Read: `convex/planner.ts` lines 122-142 (current per-row loop with `resolveTopicChain`)
- Read: `convex/planner.ts` lines 330-380 (duplicate loop in getRecoveryPlan)

**What to do:**
Both `getPlannerOverview` and `getRecoveryPlan` iterate `userTopicProgress`
rows and call `resolveTopicChain` per-row inside the loop — an N+1 pattern
where each call does 3 sequential DB reads.

If A3 already moved overdue computation into `collectOverdueTopics` in
`_lib/plannerHelpers.ts`, the fix is automatic — the helper already uses
`resolveTopicChains`. If the recovery plan still has its own inline loop,
replace it with a call to the helper.

Specifically:

```ts
// Before (per-row, N+1):
for (const p of allProgress) {
  const chain = await resolveTopicChain(ctx, p.topicId);
  // ...
}

// After (batch, O(1) reads):
const candidateIds = allProgress
  .filter(/* ... */)
  .map((p) => p.topicId);
const chains = await resolveTopicChains(ctx, candidateIds);
for (const [topicId, chain] of chains) {
  // ...
}
```

**Validation:** `npm run typecheck`

**Dependencies:** A3 (collectOverdueTopics already moved)

**Est. time:** 20 min

---

### A5: Split `PlannerClient.tsx` into separate panel files

**Files:**
- Create: `components/planner/PlannerHeader.tsx`
- Create: `components/planner/RecoveryPlanCard.tsx`
- Create: `components/planner/GoalsPanel.tsx`
- Create: `components/planner/GoalRow.tsx`
- Create: `components/planner/NextBestPanel.tsx`
- Create: `components/planner/OverdueTopicsPanel.tsx`
- Create: `components/planner/SessionTemplatesPanel.tsx`
- Modify: `app/(app)/planner/PlannerClient.tsx` → shrink to ~60 lines

**Inputs:**
- Read: `app/(app)/planner/PlannerClient.tsx` (full 567 lines)

**What to do:**
Extract each inlined function component into its own file:

| Component | Source lines | New file |
|---|---|---|
| `PlannerHeader` | 59-91 | `components/planner/PlannerHeader.tsx` |
| `RecoveryPlanCard` | 93-167 | `components/planner/RecoveryPlanCard.tsx` |
| `GoalsPanel` | 169-273 | `components/planner/GoalsPanel.tsx` |
| `GoalRow` | 275-315 | `components/planner/GoalRow.tsx` |
| `NextBestPanel` | 317-396 | `components/planner/NextBestPanel.tsx` |
| `OverdueTopicsPanel` | 398-461 | `components/planner/OverdueTopicsPanel.tsx` |
| `SessionTemplatesPanel` | 463-567 | `components/planner/SessionTemplatesPanel.tsx` |

Each extracted file must:
- Import only the dependencies it needs (icons, `CockpitCard`, `cn`, `resolveColorVar`, `api`)
- Export a single default or named component
- Keep the exact same props interface (move it inline in the new file)
- No logic changes — pure extraction

The remaining `PlannerClient.tsx` (~60 lines) should import all 7 panels
and compose them in the same layout order.

**Validation:** `npm run typecheck`

**Dependencies:** None (pure extraction, can start immediately)

**Est. time:** 40 min

---

### A6: Extract mutation hooks into `hooks.ts`

**Files:**
- Create: `components/planner/hooks.ts`

**Inputs:**
- Read: `app/(app)/planner/PlannerClient.tsx` lines 169-273 (GoalsPanel form state + mutation calls)
- Read: `app/(app)/planner/PlannerClient.tsx` lines 463-567 (SessionTemplatesPanel form state + mutation calls)
- Read: `convex/goals.ts` lines 75-144 (create, increment, remove mutations)
- Read: `convex/planner.ts` lines 243-273 (createTemplate, removeTemplate mutations)

**What to do:**
Extract the mutation + form state patterns into two hooks:

```ts
// components/planner/hooks.ts

export function useGoalsManager(initialGoals: EnrichedGoal[]): {
  goals: EnrichedGoal[];
  createGoal: (args: {
    title: string;
    type: "daily" | "weekly";
    targetCount?: number;
  }) => Promise<void>;
  incrementGoal: (goalId: Id<"goals">) => Promise<void>;
  removeGoal: (goalId: Id<"goals">) => Promise<void>;
  isCreating: boolean;
}

export function useTemplatesManager(initialTemplates: EnrichedTemplate[]): {
  templates: EnrichedTemplate[];
  createTemplate: (args: {
    title: string;
    targetMinutes?: number;
  }) => Promise<void>;
  removeTemplate: (templateId: Id<"sessionTemplates">) => Promise<void>;
  isCreating: boolean;
}
```

Each hook manages:
- Local state for the list (initialized from props)
- Optimistic updates on create/remove
- Error rollback if the mutation fails
- `isCreating` loading flag for the form

**Validation:** `npm run typecheck`

**Dependencies:** None (can start immediately)

**Est. time:** 35 min

---

### A7: Simplify `PlannerHeader` stat strip per style guide

**Files:**
- Modify: `components/planner/PlannerHeader.tsx` (if A5 is done)
- OR: `app/(app)/planner/PlannerClient.tsx` lines 59-91 (if A5 is not done yet)

**Inputs:**
- Read: `docs/SYNEDRIX-FRONTEND-STYLE.md` §1 (banned anti-patterns: carded rows, pill chips)
- Read: `app/(app)/planner/PlannerClient.tsx` lines 59-91 (PlannerHeader)

**What to do:**
The current stat strip wraps each stat in a bordered `bg-surface-elevated`
box with uppercase label, value, and sub-label — this is the "carded list
rows" anti-pattern from the style guide. Replace with a plain typography
row:

```tsx
function PlannerHeader({ stats }: { readonly stats: WeeklyStats }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2.5">
        <Calendar className="h-4 w-4 text-accent" weight="duotone" />
        <h1 className="text-[16px] font-semibold tracking-tight text-foreground">
          Planner
        </h1>
      </div>
      <p className="text-[12.5px] text-muted-foreground">
        Plan sessions, set goals, and track consistency.
      </p>
      <div className="mt-2 flex items-center gap-5">
        <span className="text-[15px] font-semibold tabular-nums text-foreground">
          {stats.totalMinutes}m
          <span className="ml-1 text-[12px] font-normal text-muted-foreground">
            this week · {stats.totalSessions} sessions
          </span>
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span className="text-[15px] font-semibold tabular-nums text-foreground">
          {stats.streakDays}d
          <span className="ml-1 text-[12px] font-normal text-muted-foreground">
            streak
          </span>
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span className="text-[15px] font-semibold tabular-nums text-foreground">
          {stats.goalCompletionRate}%
          <span className="ml-1 text-[12px] font-normal text-muted-foreground">
            goals done
          </span>
        </span>
      </div>
    </div>
  );
}
```

No more bordered boxes. Typography does the work.

**Validation:** `npm run typecheck`

**Dependencies:** A3 (needs `WeeklyStats` type from A1/A3)

**Est. time:** 15 min

---

### A8: Remove `color-mix` icon wrappers per style guide

**Files:**
- Modify: `components/planner/RecoveryPlanCard.tsx` lines ~98-100 (warning icon wrapper)
- Modify: `components/planner/GoalsPanel.tsx` lines ~172 (Target icon) — already plain, verify
- Modify: `components/planner/OverdueTopicsPanel.tsx` lines ~408 (ClockCounterClockwise icon wrapper)

**Inputs:**
- Read: `docs/SYNEDRIX-FRONTEND-STYLE.md` §8 (icons at native size, no bg-accent/10 containers)

**What to do:**
Find and remove any `flex h-7 w-7 items-center justify-center rounded-md
bg-[var(--color-subject-french)]/15` wrappers around Phosphor icons.
Replace with plain icon renders at their native size:

```tsx
// Before:
<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--color-subject-french)]/15">
  <Warning className="h-3.5 w-3.5 text-[var(--color-subject-french)]" weight="fill" />
</span>

// After:
<Warning className="h-4 w-4 text-accent" weight="duotone" />
```

Also remove the hardcoded `text-[var(--color-subject-french)]` from
the overdue topics section header and recovery plan; use `text-accent`
or `text-muted-foreground` instead.

**Validation:** `npm run typecheck`

**Dependencies:** A5 (needs extracted RecoveryPlanCard, GoalsPanel, OverdueTopicsPanel) or can be done on PlannerClient directly if A5 is skipped

**Est. time:** 15 min

---

### A9: Validation gate — typecheck + test

**What to do:**
Run full typecheck and test suite. Fix any type errors or test failures
introduced by A1-A8.

**Validation:** `npm run typecheck && npm run test`

**Dependencies:** A1-A8 all complete

**Est. time:** 15 min

---

## Phase B: Tiered Preloading — 8 subtasks, ~3.5 hours

### B1: Split `getPlannerOverview` into focused queries

**Files:**
- Modify: `convex/planner.ts` — add new queries

**Inputs:**
- Read: `convex/planner.ts` lines 13-184 (current getPlannerOverview)
- Read: `convex/_lib/plannerHelpers.ts` (helpers from A2)
- Read: `convex/_lib/plannerTypes.ts` (types from A1)

**What to do:**
Add 5 new queries alongside the existing `getPlannerOverview` (which stays
untouched for backward compatibility):

1. **`getWeeklyStats`** — calls `computeWeeklyStats` helper, returns `WeeklyStats`
2. **`getGoals`** — fetches goals (take 50), calls `resolveGoalSubjects`, returns `EnrichedGoal[]`
3. **`getNextBest`** — calls `recommendNextBest`, returns `NextBestRecommendation | null`
4. **`getOverdueTopics`** — calls `collectOverdueTopics` helper, returns `OverdueTopic[]`
5. **`getSessionTemplates`** — fetches templates, calls `resolveTemplateSubjects`, returns `EnrichedTemplate[]`

Each query must have its own `v.object(...)` return type declaration using
the shared types. Do not remove `getPlannerOverview` — the V1 path still
needs it.

**Validation:** `npm run typecheck`

**Dependencies:** A2 (helpers) + A1 (types)

**Est. time:** 40 min

---

### B2: Preload all queries in page.tsx

**Files:**
- Modify: `app/(app)/planner/page.tsx` lines 18-43

**Inputs:**
- Read: `app/(app)/planner/page.tsx` (full 43 lines)

**What to do:**
Replace the two-query preload with six-query preload:

```ts
// Before:
[preloaded, recoveryPreloaded] = await Promise.all([
  preloadQuery(api.planner.getPlannerOverview, {}, token ? { token } : {}),
  preloadQuery(api.planner.getRecoveryPlan, {}, token ? { token } : {}),
]);

// After:
[statsPreloaded, goalsPreloaded, nextBestPreloaded, overduePreloaded,
 recoveryPreloaded, templatesPreloaded] = await Promise.all([
  preloadQuery(api.planner.getWeeklyStats, {}, token ? { token } : {}),
  preloadQuery(api.planner.getGoals, {}, token ? { token } : {}),
  preloadQuery(api.planner.getNextBest, {}, token ? { token } : {}),
  preloadQuery(api.planner.getOverdueTopics, {}, token ? { token } : {}),
  preloadQuery(api.planner.getRecoveryPlan, {}, token ? { token } : {}),
  preloadQuery(api.planner.getSessionTemplates, {}, token ? { token } : {}),
]);
```

Handle each preloaded value potentially being null (Convex not configured),
same as the existing two-value pattern.

**Validation:** `npm run typecheck`

**Dependencies:** B1

**Est. time:** 15 min

---

### B3: Create `PlannerClientV2.tsx` with Suspense boundaries

**Files:**
- Create: `app/(app)/planner/PlannerClientV2.tsx`

**Inputs:**
- Read: `app/(app)/planner/PlannerClient.tsx` (the thin ~60 line version after A5)
- Read: `docs/PLANNER-IMPROVEMENT-DESIGN-DOC.md` §1.2-1.3

**What to do:**
Create a new client component that:
1. Takes 6 preloaded query props (one per focused query)
2. Renders each panel inside its own `Suspense` boundary
3. Uses a wrapper component pattern (each wrapper calls `usePreloadedQuery`
   and passes the resolved data to the panel)

```tsx
"use client";

import { Suspense } from "react";
import { usePreloadedQuery, Preloaded } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PlannerHeader } from "@/components/planner/PlannerHeader";
import { GoalsPanel } from "@/components/planner/GoalsPanel";
import { NextBestPanel } from "@/components/planner/NextBestPanel";
import { OverdueTopicsPanel } from "@/components/planner/OverdueTopicsPanel";
import { RecoveryPlanCard } from "@/components/planner/RecoveryPlanCard";
import { SessionTemplatesPanel } from "@/components/planner/SessionTemplatesPanel";
import {
  PlannerHeaderSkeleton,
  DualCardSkeleton,
  CardSkeleton,
} from "./skeletons";

export function PlannerClientV2({
  statsPreloaded,
  goalsPreloaded,
  nextBestPreloaded,
  overduePreloaded,
  recoveryPreloaded,
  templatesPreloaded,
}: { /* 6 preloaded props */ }) {
  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-8">
      <Suspense fallback={<PlannerHeaderSkeleton />}>
        <StatsWrapper preloaded={statsPreloaded} />
      </Suspense>

      <Suspense fallback={<DualCardSkeleton />}>
        <div className="grid gap-5 lg:grid-cols-2">
          <GoalsWrapper preloaded={goalsPreloaded} />
          <NextBestWrapper preloaded={nextBestPreloaded} />
        </div>
      </Suspense>

      <Suspense fallback={<CardSkeleton />}>
        <RecoveryWrapper preloaded={recoveryPreloaded} />
      </Suspense>

      <Suspense fallback={<CardSkeleton />}>
        <OverdueWrapper preloaded={overduePreloaded} />
      </Suspense>

      <Suspense fallback={<CardSkeleton />}>
        <TemplatesWrapper preloaded={templatesPreloaded} />
      </Suspense>
    </div>
  );
}

// One wrapper per query:
function StatsWrapper({ preloaded }: { preloaded: Preloaded<typeof api.planner.getWeeklyStats> }) {
  const data = usePreloadedQuery(preloaded);
  return <PlannerHeader stats={data} />;
}
// ... etc.
```

**Validation:** `npm run typecheck`

**Dependencies:** A5 (extracted panels) + B1 (new queries) + B2 (preloading)

**Est. time:** 35 min

---

### B4: Build skeleton components

**Files:**
- Create: `app/(app)/planner/skeletons.tsx`

**Inputs:**
- Read: `app/(app)/planner/loading.tsx` (existing skeleton, 24 lines)
- Read: `components/planner/PlannerHeader.tsx` (to match layout height)
- Read: `components/dashboard/CockpitCard.tsx` (card dimensions)

**What to do:**
Create three skeleton components that match the exact layout dimensions
of their real counterparts:

```tsx
export function PlannerHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-1">
      <div className="h-5 w-24 animate-pulse rounded bg-muted/30" />
      <div className="h-4 w-64 animate-pulse rounded bg-muted/20" />
      <div className="mt-2 flex items-center gap-5">
        <div className="h-6 w-32 animate-pulse rounded bg-muted/20" />
        <div className="h-6 w-16 animate-pulse rounded bg-muted/20" />
        <div className="h-6 w-20 animate-pulse rounded bg-muted/20" />
      </div>
    </div>
  );
}

export function DualCardSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="h-56 animate-pulse rounded-xl bg-muted/15" />
      <div className="h-56 animate-pulse rounded-xl bg-muted/15" />
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="h-40 animate-pulse rounded-xl bg-muted/15" />
  );
}
```

**Validation:** Visual check that skeletons match real component heights

**Dependencies:** A5 (panel dimensions known)

**Est. time:** 15 min

---

### B5: Add per-section error boundaries

**Files:**
- Modify: `app/(app)/planner/PlannerClientV2.tsx` (from B3)

**Inputs:**
- Read: `app/(app)/planner/error.tsx` (existing route-level error, 31 lines)

**What to do:**
Wrap each section in an error boundary so a failed `getRecoveryPlan`
doesn't crash the entire planner page. Each error boundary renders a
compact inline error card:

```tsx
function SectionError({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <CockpitCard>
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <p className="text-[12px] text-muted-foreground">
          Could not load {label}.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-8 items-center rounded-md bg-foreground px-3 text-[11.5px] font-medium text-background"
        >
          Retry
        </button>
      </div>
    </CockpitCard>
  );
}
```

Wrap each Suspense boundary with a companion error boundary. Use
React's `ErrorBoundary` class component pattern since Next.js doesn't
yet have a built-in hook-based error boundary.

**Validation:** `npm run typecheck`

**Dependencies:** B3

**Est. time:** 20 min

---

### B6: Update `loading.tsx` to match skeleton layout

**Files:**
- Modify: `app/(app)/planner/loading.tsx` (24 lines)

**Inputs:**
- Read: `app/(app)/planner/loading.tsx` (existing skeleton)
- Read: `app/(app)/planner/skeletons.tsx` (from B4)

**What to do:**
Replace the current loading skeleton (which shows 3 stat boxes + 2
cards + 1 bottom card) with the same three skeleton components used
by the Suspense boundaries. The loading page should match the final
layout exactly:

```tsx
import {
  PlannerHeaderSkeleton,
  DualCardSkeleton,
  CardSkeleton,
} from "./skeletons";

export default function PlannerLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-8">
      <PlannerHeaderSkeleton />
      <DualCardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}
```

**Validation:** Visual check — layout must match `PlannerClientV2`

**Dependencies:** B4

**Est. time:** 10 min

---

### B7: Feature-flag gate in page.tsx

**Files:**
- Modify: `app/(app)/planner/page.tsx` lines 1-43

**Inputs:**
- Read: `app/(app)/planner/page.tsx` (full file)

**What to do:**
Add a feature flag so V1 and V2 paths coexist:

```ts
const useV2 = process.env.NEXT_PUBLIC_PLANNER_V2 === "true";

// ... inside the component:

if (useV2) {
  if (!statsPreloaded || !goalsPreloaded || /* ... */) {
    return <OfflineFallback />;
  }
  return (
    <PlannerClientV2
      statsPreloaded={statsPreloaded}
      goalsPreloaded={goalsPreloaded}
      nextBestPreloaded={nextBestPreloaded}
      overduePreloaded={overduePreloaded}
      recoveryPreloaded={recoveryPreloaded}
      templatesPreloaded={templatesPreloaded}
    />
  );
}

// V1 path (unchanged):
return (
  <PlannerClient preloaded={preloaded} recoveryPreloaded={recoveryPreloaded} />
);
```

The page must preload both V1 and V2 queries (or conditionally preload
based on the flag). For simplicity, preload all 8 queries (2 V1 + 6 V2)
in parallel — Convex handles the extra preloads lazily.

**Validation:** `npm run typecheck`

**Dependencies:** B2 + B3 + A5

**Est. time:** 15 min

---

### B8: Validation gate — typecheck + test

**What to do:**
Run full typecheck and test suite. Fix any type errors or test failures
introduced by B1-B7. Manually verify the planner page renders with
`NEXT_PUBLIC_PLANNER_V2=false` (V1 path) and `=true` (V2 path).

**Validation:** `npm run typecheck && npm run test`

**Dependencies:** B1-B7 all complete

**Est. time:** 20 min

---

## Phase C: Post-Session Surface — 4 subtasks, ~1.5 hours

### C1: Build `PostSessionSummary` card

**Files:**
- Create: `components/planner/PostSessionSummary.tsx`

**Inputs:**
- Read: `components/planner/FocusMode.tsx` lines 239-258 (FocusDone — current end state)
- Read: `convex/_lib/recommendNextBest.ts` (for next topic recommendation signature)
- Read: `convex/_lib/plannerTypes.ts` (NextBestRecommendation type)

**What to do:**
Create a card that displays after a session completes:

```tsx
export function PostSessionSummary({
  durationSec,
  reflection,
  nextTopic,
}: {
  readonly durationSec: number;
  readonly reflection: string;
  readonly nextTopic: NextBestRecommendation | null;
}) {
  const minutes = Math.floor(durationSec / 60);
  return (
    <CockpitCard>
      <div className="flex flex-col gap-4 p-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-accent" weight="duotone" />
          <span className="text-[13px] font-semibold text-foreground">
            Session complete
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[28px] tabular-nums text-foreground">
            {minutes}m
          </span>
          <span className="text-[12px] text-muted-foreground">
            focused
          </span>
        </div>
        {reflection && (
          <p className="text-[12.5px] italic text-muted-foreground border-l-2 border-border pl-3">
            &ldquo;{reflection}&rdquo;
          </p>
        )}
        {nextTopic && (
          <Link
            href={`/subjects/${nextTopic.subject.slug}/${nextTopic.chapter.slug}/${nextTopic.topic.slug}`}
            className="inline-flex h-9 items-center gap-1.5 self-start rounded-md bg-accent px-4 text-[12.5px] font-medium text-accent-foreground"
          >
            Continue to {nextTopic.topic.title}
            <ArrowRight className="h-3 w-3" weight="bold" />
          </Link>
        )}
      </div>
    </CockpitCard>
  );
}
```

**Validation:** `npm run typecheck`

**Dependencies:** A1 (types)

**Est. time:** 25 min

---

### C2: Wire into `PlannerClientV2`

**Files:**
- Modify: `app/(app)/planner/PlannerClientV2.tsx`

**Inputs:**
- Read: `components/planner/PostSessionSummary.tsx` (from C1)
- Read: `components/planner/SessionLauncher.tsx` (to understand session lifecycle)
- Read: `components/planner/FocusMode.tsx` lines 86-92 (onSessionEnd callback)

**What to do:**
Add a state variable in `PlannerClientV2` to track the most recently
completed session:

```tsx
const [lastSession, setLastSession] = useState<{
  durationSec: number;
  reflection: string;
} | null>(null);
```

When a session is completed (via SessionLauncher → FocusMode →
onSessionEnd), store it in state. Render `PostSessionSummary` above
the grid if `lastSession` is set. Pass `nextBest` data to it.

This requires `PlannerClientV2` to own the `onSessionEnd` callback and
wrap children that trigger sessions with it.

**Validation:** `npm run typecheck`

**Dependencies:** B3 (PlannerClientV2 exists) + C1 (PostSessionSummary exists)

**Est. time:** 25 min

---

### C3: Store last session in Zustand for cross-route persistence

**Files:**
- Create: `src/lib/stores/plannerStore.ts`

**What to do:**
Create a simple Zustand store so the post-session summary survives
navigation:

```ts
import { create } from "zustand";

interface PlannerStore {
  lastSession: { durationSec: number; reflection: string } | null;
  setLastSession: (s: { durationSec: number; reflection: string } | null) => void;
}

export const usePlannerStore = create<PlannerStore>((set) => ({
  lastSession: null,
  setLastSession: (s) => set({ lastSession: s }),
}));
```

Update `PlannerClientV2` to read from Zustand instead of local state.
Clear the stored session when the user clicks "Continue to next topic".

**Validation:** `npm run typecheck`

**Dependencies:** C2

**Est. time:** 15 min

---

### C4: Validation gate — typecheck + manual QA

**What to do:**
Run typecheck. Manually verify:
- Complete a session via FocusMode → summary card appears
- Summary card shows correct duration and reflection
- "Continue to next topic" link navigates to the correct topic
- Summary card disappears after clicking "Continue"
- Summary card persists across page navigation

**Validation:** `npm run typecheck` + manual QA

**Dependencies:** C1-C3 complete

**Est. time:** 15 min

---

## Phase D: Performance Hardening — 4 subtasks, ~2.5 hours

### D1: Add caps to remaining uncapped collects

**Files:**
- Modify: `convex/_lib/plannerHelpers.ts` (from A2)
- Modify: `convex/planner.ts` — remaining uncapped queries

**Inputs:**
- Read: `convex/_lib/plannerHelpers.ts` (all helpers)
- Read: `convex/planner.ts` — all new queries from B1

**What to do:**
Audit every `collect()` and `take()` call across all planner queries
and helpers. Apply these caps:

| Location | Current | Target |
|---|---|---|
| `computeWeeklyStats` — sessions | `.take(500)` → already has 100 limit | `.take(100)` |
| `computeWeeklyStats` — goals | via `getPlannerOverview` | `.take(50)` |
| `collectOverdueTopics` — progress | `.collect()` | `.take(200)` |
| `getRecoveryPlan` — sessions | `.take(500)` | `.take(100)` |
| `getRecoveryPlan` — progress | `.collect()` | `.take(200)` |
| `getRecoveryPlan` — topics, chapters, subjects | `.collect()` | `.collect()` (canonical data, bounded) |
| `recommendNextBest` — topics per chapter | `.collect()` | `.collect()` (already scoped, ~4 per chapter) |

Document every cap in JSDoc on the helper/query.

**Validation:** `npm run typecheck`

**Dependencies:** A2 (helpers exist) or B1 (queries exist)

**Est. time:** 20 min

---

### D2: Add query latency telemetry

**Files:**
- Modify: `convex/planner.ts` — add timing wrappers

**What to do:**
Wrap each new query handler with a timing pattern that logs to the
`aiGenerations` table (or a new `queryTelemetry` table):

```ts
handler: async (ctx) => {
  const start = Date.now();
  const result = await actualHandler(ctx);
  const latencyMs = Date.now() - start;
  if (latencyMs > 500) {
    await ctx.db.insert("aiGenerations", {
      userId: user._id,
      task: "planner.getWeeklyStats",
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

Only log slow queries (>500ms) to avoid polluting the telemetry table.
Alternatively, use Convex's built-in function metrics dashboard.

**Validation:** `npm run typecheck`

**Dependencies:** B1 (queries exist)

**Est. time:** 25 min

---

### D3: Code-split FocusMode (lazy load `motion`)

**Files:**
- Modify: `components/planner/SessionLauncher.tsx` lines 1-9
- Modify: `components/planner/FocusMode.tsx` lines 1-16

**Inputs:**
- Read: `components/planner/SessionLauncher.tsx` (65 lines)
- Read: `components/planner/FocusMode.tsx` lines 1-16 (motion import)

**What to do:**
`FocusMode` imports `motion/react` which adds ~28 KB to the planner
bundle. Since FocusMode is only needed after the user clicks a session
launcher button, lazy-load it:

```tsx
// components/planner/SessionLauncher.tsx
import { lazy, Suspense } from "react";

const FocusMode = lazy(() =>
  import("@/components/planner/FocusMode").then((m) => ({ default: m.FocusMode }))
);

export function SessionLauncher(props) {
  // ... existing logic ...

  return (
    <>
      <button type="button" onClick={handleOpen} className="contents">
        {children}
      </button>
      {focusOpen && (
        <Suspense fallback={null}>
          <FocusMode
            open={focusOpen}
            onClose={() => setFocusOpen(false)}
            subjectTitle={subjectTitle}
            topicTitle={topicTitle}
            goalLabel={goalLabel}
            onSessionEnd={handleSessionEnd}
          />
        </Suspense>
      )}
    </>
  );
}
```

**Validation:** `npm run typecheck` + check bundle size with `npm run build`

**Dependencies:** None

**Est. time:** 20 min

---

### D4: Validation gate — typecheck + test + Lighthouse

**What to do:**
Run full typecheck and test suite. Run `npm run build` and verify the
planner route chunk size is under 45 KB (excluding shared vendor chunks).
Run Lighthouse on the planner page and verify LCP < 2.5s.

**Validation:** `npm run typecheck && npm run test && npm run build`

**Dependencies:** D1-D3

**Est. time:** 25 min

---

## Quick Reference

### Files Created (15 new)

| File | Phase | Purpose |
|---|---|---|
| `convex/_lib/plannerTypes.ts` | A1 | Shared type definitions |
| `convex/_lib/plannerHelpers.ts` | A2 | Shared computation helpers |
| `components/planner/PlannerHeader.tsx` | A5 | Header with stats |
| `components/planner/RecoveryPlanCard.tsx` | A5 | Recovery plan card |
| `components/planner/GoalsPanel.tsx` | A5 | Goals CRUD panel |
| `components/planner/GoalRow.tsx` | A5 | Single goal row |
| `components/planner/NextBestPanel.tsx` | A5 | Next-best topic card |
| `components/planner/OverdueTopicsPanel.tsx` | A5 | Overdue topics list |
| `components/planner/SessionTemplatesPanel.tsx` | A5 | Templates CRUD panel |
| `components/planner/hooks.ts` | A6 | Goals + templates mutation hooks |
| `app/(app)/planner/PlannerClientV2.tsx` | B3 | V2 client with Suspense |
| `app/(app)/planner/skeletons.tsx` | B4 | Skeleton components |
| `components/planner/PostSessionSummary.tsx` | C1 | Post-session summary card |
| `src/lib/stores/plannerStore.ts` | C3 | Zustand session store |

### Files Modified (8 existing)

| File | Phase | Changes |
|---|---|---|
| `convex/planner.ts` | A3, A4, B1 | Use helpers, batch resolve, add 5 new queries |
| `app/(app)/planner/PlannerClient.tsx` | A5, A7 | Shrink to 60-line orchestrator |
| `app/(app)/planner/page.tsx` | B2, B7 | Preload 6 queries, feature flag |
| `app/(app)/planner/loading.tsx` | B6 | Use shared skeletons |
| `components/planner/SessionLauncher.tsx` | D3 | Lazy-load FocusMode |

### Estimates by Phase

| Phase | Subtasks | Est. time | Risk |
|---|---|---|---|
| A (Refactor) | 9 | ~4.5 hrs | Low — no visual change |
| B (Tiered loading) | 8 | ~3.5 hrs | Medium — new Suspense + error boundaries |
| C (Post-session) | 4 | ~1.5 hrs | Low — additive feature |
| D (Performance) | 4 | ~2.5 hrs | Low — caps + code splitting only |
| **Total** | **25** | **~12 hrs** | |

### Parallelizable Subtasks

These can all be started simultaneously (zero shared dependencies):

- **Wave 1:** A1, A5, A6, D3 — all independent
- **Wave 2:** A2, A3, A4 (sequential, depends on A1)
- **Wave 3:** A7, A8 (depends on A3 or A5)
- **Wave 4:** A9 (validation gate)
- **Wave 5:** B1-B8 (sequential, depends on Phase A)
- **Wave 6:** C1-C4 (sequential, depends on Phase B)
- **Wave 7:** D1-D4 (depends on Phase A or B, D2/D3 parallel after D1)
