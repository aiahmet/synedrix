# Planner Improvement Design Doc

> Status: proposal
> Target: Synedrix Planner surface (`/planner`, `convex/planner.ts`, `components/planner/`)
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

The Planner renders as a single page at `/planner` with one monolithic
client component (`PlannerClient.tsx`, 567 lines) that embeds 7 inlined
sub-components:

```
PlannerClient
  PlannerHeader          — weekly stats strip (minutes, sessions, streak, goal rate)
  RecoveryPlanCard       — conditional: recovery plan with priority topics
  GoalsPanel             — inline CRUD for daily/weekly goals + progress bars
  NextBestPanel          — algorithmic "Next Best Topic" recommendation
  OverdueTopicsPanel     — overdue topics list with days-since badges
  SessionTemplatesPanel  — inline CRUD for reusable session templates
```

The page preloads two Convex queries simultaneously:

```ts
// app/(app)/planner/page.tsx
[preloaded, recoveryPreloaded] = await Promise.all([
  preloadQuery(api.planner.getPlannerOverview, {}),
  preloadQuery(api.planner.getRecoveryPlan, {}),
]);
```

**Problems:**

1. **Monolithic query.** `getPlannerOverview` does too much in one call:
   goals, templates, next-best, overdue topics, and weekly stats. Any one
   sub-result being slow blocks the entire page.

2. **Duplicate work.** `getRecoveryPlan` fetches sessions, all progress,
   all topics, all chapters, and all subjects — nearly the same data as
   `getPlannerOverview` — but from scratch. The two queries share zero
   cached state.

3. **N+1 chain resolution.** `getPlannerOverview` iterates all
   `userTopicProgress` rows and calls `resolveTopicChain` per-row to
   build the overdue topics list. With 60+ topics across 6 subjects,
   this is ~180 sequential DB reads inside a loop.

4. **No independent loading.** If the recovery plan query is slow
   (which it often is — it re-fetches the entire topic catalog), the
   page waits. Recovery is a secondary concern; it should never gate
   the primary planner surface.

5. **Client-side mutation state.** Goals and templates are created,
   incremented, and deleted via direct `useMutation` calls with
   optimistic local state but no shared hook. Each panel manages its
   own form state inline.

6. **Session lifecycle gap.** `SessionLauncher` → `FocusMode` →
   `studySessions.start` → `studySessions.complete` is a good flow,
   but the completed session has no post-session surface. After
   finishing, the user is dropped back to the planner with no summary
   or momentum carry-forward.

### 1.2 Target Architecture

**Three-tier preloading with `Suspense` boundaries:**

```
┌──────────────────────────────────────────────────────────┐
│ Tier 1 (Critical — page shell)                             │
│   PlannerHeader: weeklyStats                              │
│   └─ Suspense boundary with skeleton                      │
│                                                          │
│ Tier 2 (Above-fold — primary content)                     │
│   GoalsPanel        NextBestPanel                         │
│   └─ Suspense boundary with skeleton cards                │
│                                                          │
│ Tier 3 (Below-fold — secondary content)                   │
│   RecoveryPlanCard  OverdueTopicsPanel                    │
│   SessionTemplatesPanel                                   │
│   └─ Suspense boundary with lazy-loaded cards             │
└──────────────────────────────────────────────────────────┘
```

**Split the monolithic query into focused queries:**

| Query | Returns | Tier |
|---|---|---|
| `planner.getWeeklyStats` | streak, minutes, sessions, goal rate | 1 |
| `planner.getGoals` | daily + weekly goals with progress | 2 |
| `planner.getNextBest` | single recommendation | 2 |
| `planner.getSessionTemplates` | template list | 3 |
| `planner.getOverdueTopics` | overdue topics, capped at 10 | 3 |
| `planner.getRecoveryPlan` | plan + priority topics | 3 |

Each query is independently preloadable and independently
`Suspense`-wrapped. The page renders progressively.

**Shared `_lib/plannerHelpers.ts` for cross-query logic:**

```ts
// convex/_lib/plannerHelpers.ts
export async function computeWeeklyStats(
  ctx: QueryCtx,
  userId: Id<"users">,
  now: number,
): Promise<WeeklyStats>

export async function collectOverdueTopics(
  ctx: QueryCtx,
  userId: Id<"users">,
  now: number,
  limit: number,
): Promise<OverdueTopic[]>

export async function resolveGoalSubjects(
  ctx: QueryCtx,
  goals: Doc<"goals">[],
): Promise<EnrichedGoal[]>

export async function resolveTemplateSubjects(
  ctx: QueryCtx,
  templates: Doc<"sessionTemplates">[],
): Promise<EnrichedTemplate[]>
```

Each helper has a hard cap on `collect()` calls. The helpers share
fetched caches through the `QueryCtx` scope when possible.

**Custom hooks for client mutation patterns:**

```ts
// components/planner/hooks.ts
export function useGoals(goals: EnrichedGoal[]): GoalsHandle {
  // Encapsulates create, increment, remove with optimistic updates
}

export function useSessionTemplates(
  templates: EnrichedTemplate[]
): TemplatesHandle {
  // Encapsulates create, remove with optimistic updates
}
```

**Post-session surface:**

After `FocusMode` completes, render a compact summary card inline on
the planner page (not a modal overlay) showing session duration,
reflection, and a "Continue to next topic" CTA driven by
`recommendNextBest`.

### 1.3 Component Split

Move each panel into its own file under `components/planner/`:

```
components/planner/
  PlannerHeader.tsx
  RecoveryPlanCard.tsx
  GoalsPanel.tsx
  GoalRow.tsx
  NextBestPanel.tsx
  OverdueTopicsPanel.tsx
  SessionTemplatesPanel.tsx
  SessionLauncher.tsx       (existing)
  FocusMode.tsx              (existing)
  PostSessionSummary.tsx     (new)
  hooks.ts                   (new)
```

`PlannerClient.tsx` becomes a thin orchestrator (~60 lines):

```tsx
export function PlannerClient({ preloadedStats, preloadedGoals, ... }) {
  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-8">
      <Suspense fallback={<PlannerHeaderSkeleton />}>
        <PlannerHeaderWrapper preloaded={preloadedStats} />
      </Suspense>
      <Suspense fallback={<DualCardSkeleton />}>
        <div className="grid gap-5 lg:grid-cols-2">
          <GoalsPanelWrapper preloaded={preloadedGoals} />
          <NextBestPanelWrapper preloaded={preloadedNextBest} />
        </div>
      </Suspense>
      <Suspense fallback={<CardSkeleton />}>
        <OverdueTopicsPanelWrapper preloaded={preloadedOverdue} />
      </Suspense>
      <Suspense fallback={<CardSkeleton />}>
        <RecoveryPlanCardWrapper preloaded={preloadedRecovery} />
      </Suspense>
      <Suspense fallback={<CardSkeleton />}>
        <SessionTemplatesPanelWrapper preloaded={preloadedTemplates} />
      </Suspense>
    </div>
  );
}
```

### 1.4 Data Flow Diagram

```
/app/planner (Server Component)
  │
  ├─ preloadQuery(api.planner.getWeeklyStats)      ──┐
  ├─ preloadQuery(api.planner.getGoals)            ──┤ Tier 1
  ├─ preloadQuery(api.planner.getNextBest)         ──┤ + Tier 2
  ├─ preloadQuery(api.planner.getOverdueTopics)    ──┤ preloaded
  ├─ preloadQuery(api.planner.getRecoveryPlan)     ──┤ together
  └─ preloadQuery(api.planner.getSessionTemplates) ──┘
       │
       ▼
  PlannerClient (Client Component)
       │
       ├─ <Suspense>
       │    <PlannerHeaderWrapper>
       │      usePreloadedQuery(preloadedStats) → <PlannerHeader>
       │
       ├─ <Suspense>
       │    <GoalsPanelWrapper>
       │      usePreloadedQuery(preloadedGoals) → <GoalsPanel>
       │    <NextBestPanelWrapper>
       │      usePreloadedQuery(preloadedNextBest) → <NextBestPanel>
       │
       └─ <Suspense> (Tier 3)
              <OverdueTopicsPanelWrapper>
              <RecoveryPlanCardWrapper>
              <SessionTemplatesPanelWrapper>
```

---

## 2. Code Style Guidelines

### 2.1 File Size Limits

| File | Max lines | Rationale |
|---|---|---|
| `PlannerClient.tsx` | 80 | Orchestration only |
| Per-panel component | 200 | Panel + local state + markup |
| `convex/planner.ts` | 300 | One query/mutation per ~50 lines |
| `_lib/plannerHelpers.ts` | 150 | Single-responsibility helpers |
| `hooks.ts` | 120 | One hook per export |

### 2.2 Shared Types

Define the planner data shapes once in a shared type module and
reuse them across all queries and components:

```ts
// convex/_lib/plannerTypes.ts
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
```

Every query that returns these shapes imports from
`_lib/plannerTypes.ts`. No duplicated `v.object(...)` blocks.

### 2.3 Custom Hooks for Mutation State

Extract mutation + form state into `hooks.ts`:

```ts
// components/planner/hooks.ts
export function useGoalsManager(
  initialGoals: EnrichedGoal[]
): {
  goals: EnrichedGoal[];
  createGoal: (args: CreateGoalArgs) => Promise<void>;
  incrementGoal: (goalId: Id<"goals">) => Promise<void>;
  removeGoal: (goalId: Id<"goals">) => Promise<void>;
  isCreating: boolean;
}

export function useTemplatesManager(
  initialTemplates: EnrichedTemplate[]
): {
  templates: EnrichedTemplate[];
  createTemplate: (args: CreateTemplateArgs) => Promise<void>;
  removeTemplate: (templateId: Id<"sessionTemplates">) => Promise<void>;
  isCreating: boolean;
}
```

Hooks handle optimistic updates, rollback on error, and loading
states. Panels consume hooks and render UI only.

### 2.4 Style Guide Compliance

All planner panels must pass the `docs/SYNEDRIX-FRONTEND-STYLE.md`
checklist:

- **Single-layer cards.** Use `CockpitCard`. No triple-nested chrome.
- **No icon containers.** Remove `bg-[var(--color-subject-french)]/15`
  wrappers around `Warning` / `ClockCounterClockwise` icons.
- **No pill chips on stat callouts.** The `PlannerHeader` stat items
  use `bg-surface-elevated` bordered boxes — flatten to typography
  with `text-[15px] font-semibold tabular-nums` in a horizontal row.
- **No `color-mix` hardcodes.** The recovery plan card uses
  `bg-[var(--color-subject-french)]/15` — replace with
  `text-muted-foreground` or `text-accent`.
- **Buttons: `h-10 rounded-md`.** Inline form buttons in GoalsPanel
  and SessionTemplatesPanel occasionally use `h-7`, `h-8` — normalize.
- **No uppercase tracking eyebrow chips.** The "Daily" / "Weekly"
  section labels in GoalsPanel are `text-[10.5px] font-medium uppercase
  tracking-[0.12em]` — replace with plain lowercase `text-[12.5px]`.
- **Icons at native size.** No `flex h-7 w-7 items-center justify-center
  rounded-md` wrappers around Phosphor icons.

### 2.5 No Comments

Per `AGENTS.md`: zero inline comments. JSDoc on exported symbols only.
Refactor unclear logic until it speaks for itself.

---

## 3. Quality Constraints

### 3.1 Performance Budgets

| Metric | Target | Measurement |
|---|---|---|
| Page LCP (above-fold) | < 1.2s | Tier 1 + Tier 2 queries resolve |
| Page LCP (full) | < 2.5s | All tiers resolve |
| `getWeeklyStats` query p95 | < 50ms | Convex dashboard |
| `getGoals` query p95 | < 60ms | Convex dashboard |
| `getNextBest` query p95 | < 200ms | Convex dashboard (iterates all topics) |
| `getOverdueTopics` query p95 | < 150ms | Convex dashboard |
| `getRecoveryPlan` query p95 | < 300ms | Convex dashboard |
| Client bundle (planner route) | < 45 KB | Next.js bundle analyzer |

### 3.2 Caps on All Collects

| Query | Collection | Hard Cap | Rationale |
|---|---|---|---|
| `getWeeklyStats` | `studySessions` | `.take(100)` | 100 sessions covers ~3 months of daily use |
| `getWeeklyStats` | `goals` | `.take(50)` | 50 goals is generous for a single user |
| `getGoals` | `goals` | `.take(50)` | Same as above |
| `getNextBest` | `userTopicProgress` | `.collect()` → capped at source | Subject-scoped: 1 subject ≈ 15 topics |
| `getNextBest` | `chapters` | N/A (per-subject, ~8 chapters) | Already small |
| `getNextBest` | `topics` | N/A (per-chapter, ~4 topics) | Already small |
| `getOverdueTopics` | `userTopicProgress` | `.collect()` → capped at `.take(200)` | 200 progress rows ceiling |
| `getRecoveryPlan` | `studySessions` | `.take(100)` | Same as weekly stats |
| `getRecoveryPlan` | `userTopicProgress` | `.collect()` → capped at `.take(200)` | Same |
| `getRecoveryPlan` | `topics`, `chapters`, `subjects` | `.collect()` | Canonical data: bounded at ~60 rows each |

### 3.3 N+1 Elimination

**Current:** `resolveTopicChain` called per-progress-row inside a loop.

**Target:** Batch-resolve all topic chains in one pass using
`resolveTopicChains` (already exists in `_lib/topicChain.ts`):

```ts
const chains = await resolveTopicChains(
  ctx,
  overdueCandidates.map((p) => p.topicId)
);
for (const [topicId, chain] of chains) {
  // Build overdue topics from pre-resolved chains
}
```

This replaces O(n × 3) sequential DB reads with O(1) batched reads.

### 3.4 Duplicate Work Elimination

**Current:** `getPlannerOverview` and `getRecoveryPlan` each fetch
`sessions`, `userTopicProgress`, `topics`, `chapters`, and `subjects`
independently.

**Target:** Extract shared fetching into `_lib/plannerHelpers.ts` with
internal caching. When both queries are preloaded together (they are),
the Convex runtime shares the read cache for identical DB gets within
the same request tick. However, the two queries are separate function
invocations and do **not** share state. The fix is to move the shared
data fetching into `getPlannerOverview` and pass the result to
`getRecoveryPlan` — but Convex queries can't call each other.

**Solution:** Move `getRecoveryPlan` into `getPlannerOverview` as a
sub-field. The recovery plan becomes a field on the overview response
rather than a separate query. This eliminates 100% of the duplicate
work.

Alternatively (preferred for tiered loading): accept the minor
duplication because Convex's internal cache deduplicates identical
reads within the same millisecond window. The tiered approach wins
because it unblocks the above-fold content before recovery finishes.

### 3.5 Accessibility

- All interactive elements reachable via keyboard (Tab, Enter, Escape).
- FocusMode Escape key already wired; add `aria-label` to timer buttons.
- Goal increment checkboxes reachable via Space/Enter.
- Focus rings on all interactive elements per style guide §7.
- `prefers-reduced-motion` respected (FocusMode already does this via
  `useReducedMotion`).

### 3.6 Dark Mode Parity

- All cards use `CockpitCard` which includes `dark:shadow-*`.
- Verify stat strip renders correctly in dark mode (delete the
  `bg-surface-elevated` boxes and use plain typography).
- Recovery plan warning icon: `text-accent` (works in both themes)
  instead of hardcoded `text-[var(--color-subject-french)]`.

### 3.7 Error Boundaries

Each `Suspense` boundary has a corresponding error boundary:

```tsx
<Suspense fallback={<PlannerHeaderSkeleton />}>
  <ErrorBoundary fallback={<PlannerHeaderError />}>
    <PlannerHeaderWrapper preloaded={preloadedStats} />
  </ErrorBoundary>
</Suspense>
```

The `error.tsx` at the route level catches uncaught errors. Add
per-section error boundaries so a failed recovery plan query doesn't
crash the entire planner page.

### 3.8 Empty States

| Panel | Empty State |
|---|---|
| `GoalsPanel` | "No goals yet. Set a daily or weekly goal to track your consistency." (exists) |
| `NextBestPanel` | "All topics mastered. Take a break or explore deeper." (exists) |
| `OverdueTopicsPanel` | "No overdue topics. Keep the momentum." (exists) |
| `SessionTemplatesPanel` | "Templates help you start focused sessions faster." (exists) |
| `RecoveryPlanCard` | Hidden entirely when `isRecoveryNeeded === false` (exists) |

All empty states use `CockpitCard` with centered typography, per the
style guide.

---

## 4. Testing Strategy

### 4.1 Unit Tests (Vitest)

| Target | File | What to Test |
|---|---|---|
| `_lib/plannerHelpers.ts` | `convex/_lib/plannerHelpers.test.ts` | `computeWeeklyStats` with known session arrays; `collectOverdueTopics` with known progress; `resolveGoalSubjects` with mock subjects |
| `_lib/streak.ts` | `convex/_lib/streak.test.ts` | `computeStreak` edge cases: empty, today-only, gap, DST boundary, timezone variance |
| `hooks.ts` | `components/planner/hooks.test.ts` | `useGoalsManager` optimistic create, increment, remove; rollback on mutation failure |
| `FocusMode.tsx` | `components/planner/FocusMode.test.ts` | Timer start/pause/resume, phase transitions, reflection submit, Escape key handling |

### 4.2 Integration Tests (Convex Test Helpers)

| Target | File | What to Test |
|---|---|---|
| `planner.getWeeklyStats` | `convex/planner.test.ts` | Returns correct stats when sessions exist; returns zeros when no sessions |
| `planner.getGoals` | `convex/planner.test.ts` | Returns daily/weekly split; resolves subject titles |
| `planner.getNextBest` | `convex/planner.test.ts` | Returns null when no enrolled subjects; returns recommendation with mastery < 0.85; skips fully-mastered topics |
| `planner.getOverdueTopics` | `convex/planner.test.ts` | Returns topics not studied in 3+ days; excludes mastery ≥ 0.85; respects cap of 10 |
| `planner.getRecoveryPlan` | `convex/planner.test.ts` | Returns plan when ≥3 missed days; returns null when consistent |
| `planner.createTemplate` / `removeTemplate` | `convex/planner.test.ts` | Creates with required fields; rejects non-owner removal |
| `goals.create` / `goals.increment` / `goals.remove` | `convex/goals.test.ts` | CRUD lifecycle; ownership guards |

### 4.3 Component Tests (React Testing Library)

| Component | What to Test |
|---|---|
| `PlannerHeader` | Renders stats; formats minutes, streak, goal rate |
| `GoalsPanel` | Renders empty state; form toggle; goal creation flow; progress bar width calculation |
| `NextBestPanel` | Renders null state; renders topic with mastery bar and CTA link |
| `OverdueTopicsPanel` | Renders empty state; renders topic list with days-since badges |
| `RecoveryPlanCard` | Renders narrative; priority topic list; suggested session minutes |
| `SessionTemplatesPanel` | Renders empty state; template creation; template removal |
| `FocusMode` | Renders timer; pause/resume toggle; reflection phase; completion animation |

### 4.4 Manual QA Checklist

- [ ] Planner loads with skeleton states that match final layout heights.
- [ ] Stats strip updates after completing a session via FocusMode.
- [ ] Creating a goal immediately appears in the list with correct type.
- [ ] Incrementing a goal updates the progress bar and count.
- [ ] Removing a goal disappears without page reload.
- [ ] Recovery plan appears after 3+ consecutive missed days.
- [ ] Recovery plan is hidden when streak is active.
- [ ] Next Best Topic links to the correct topic detail page.
- [ ] Overdue topics list shows topics sorted by days-since-study.
- [ ] FocusMode timer persists across tab switches (check after 30s).
- [ ] FocusMode Escape key opens reflection phase; second Escape closes.
- [ ] All interactions work with keyboard only.
- [ ] Dark mode: all cards, text, and focus rings are legible.
- [ ] Mobile: planner collapses to single column; FocusMode is fullscreen.
- [ ] Error boundary catches a failed query and shows retry button.

---

## 5. Deployment Plan

### 5.1 Feature Flag

Gate all changes behind `NEXT_PUBLIC_PLANNER_V2`:

```ts
// app/(app)/planner/page.tsx
import { PlannerClientV2 } from "./PlannerClientV2";
import { PlannerClient } from "./PlannerClient";

const useV2 = process.env.NEXT_PUBLIC_PLANNER_V2 === "true";

export default async function PlannerPage() {
  // ...
  return useV2
    ? <PlannerClientV2 preloadedStats={...} preloadedGoals={...} ... />
    : <PlannerClient preloaded={preloaded} recoveryPreloaded={recoveryPreloaded} />;
}
```

New Convex queries are additive (no existing query signatures change).
Old queries remain untouched. Rollback is flipping the env var.

### 5.2 Phases

#### Phase A: Refactor (no visual change) — ~4 hours

| # | Task | Files |
|---|---|---|
| A1 | Extract `_lib/plannerTypes.ts` with shared types | `convex/_lib/plannerTypes.ts` (new) |
| A2 | Extract `_lib/plannerHelpers.ts`: `computeWeeklyStats`, `collectOverdueTopics`, `resolveGoalSubjects`, `resolveTemplateSubjects` | `convex/_lib/plannerHelpers.ts` (new) |
| A3 | Refactor `getPlannerOverview` to use helpers | `convex/planner.ts` |
| A4 | Use `resolveTopicChains` (batch) instead of per-row `resolveTopicChain` in overdue topics | `convex/planner.ts` |
| A5 | Extract `GoalsPanel`, `GoalRow`, `NextBestPanel`, `OverdueTopicsPanel`, `SessionTemplatesPanel`, `RecoveryPlanCard` into own files | `components/planner/*.tsx` (new) |
| A6 | Extract `useGoalsManager` and `useTemplatesManager` hooks | `components/planner/hooks.ts` (new) |
| A7 | Simplify `PlannerHeader` stat strip: remove bordered boxes, use typography row | `components/planner/PlannerHeader.tsx` |
| A8 | Replace `color-mix` icon wrappers with native-sized icons per style guide | `RecoveryPlanCard.tsx`, `GoalsPanel.tsx` |
| A9 | Typecheck + test run: `npm run typecheck && npm run test` | — |

**Validation gate:** All existing planner behavior is unchanged. Zero visual diffs.

#### Phase B: Tiered Preloading — ~3 hours

| # | Task | Files |
|---|---|---|
| B1 | Split `getPlannerOverview` into `getWeeklyStats`, `getGoals`, `getNextBest`, `getOverdueTopics`, `getSessionTemplates` | `convex/planner.ts` |
| B2 | Preload all 6 queries in parallel in page.tsx | `app/(app)/planner/page.tsx` |
| B3 | Create `PlannerClientV2.tsx` with `Suspense` boundaries per tier | `app/(app)/planner/PlannerClientV2.tsx` (new) |
| B4 | Build skeleton components: `PlannerHeaderSkeleton`, `DualCardSkeleton`, `CardSkeleton` | `app/(app)/planner/skeletons.tsx` (new) |
| B5 | Add per-section error boundaries | `app/(app)/planner/PlannerClientV2.tsx` |
| B6 | Update `loading.tsx` to match skeleton layout | `app/(app)/planner/loading.tsx` |
| B7 | Feature-flag gate in page.tsx | `app/(app)/planner/page.tsx` |
| B8 | Typecheck + test: `npm run typecheck && npm run test` | — |

**Validation gate:** Page renders progressively. Recovery plan loads last without blocking goals.

#### Phase C: Post-Session Surface — ~1.5 hours

| # | Task | Files |
|---|---|---|
| C1 | Build `PostSessionSummary` card (duration, reflection, next topic CTA) | `components/planner/PostSessionSummary.tsx` (new) |
| C2 | Wire into `PlannerClientV2` — shown after `FocusMode` completes | `PlannerClientV2.tsx` |
| C3 | Store last session in Zustand for cross-route persistence | `src/lib/stores/plannerStore.ts` (new) |
| C4 | Typecheck + manual QA | — |

#### Phase D: Performance Hardening — ~2 hours

| # | Task | Files |
|---|---|---|
| D1 | Add caps (`take(100)`, `take(200)`) to remaining uncapped collects | `convex/_lib/plannerHelpers.ts` |
| D2 | Add query latency monitoring (Convex built-in + `aiGenerations`-style telemetry) | `convex/planner.ts` |
| D3 | Bundle-analyze the planner route; code-split FocusMode (it imports `motion`) | `next.config.ts` |
| D4 | Typecheck, test, Lighthouse audit | — |

### 5.3 Rollback

If `NEXT_PUBLIC_PLANNER_V2` causes issues in production:

1. Set `NEXT_PUBLIC_PLANNER_V2=false` in deployment environment.
2. Redeploy. The old `PlannerClient` + `getPlannerOverview` +
   `getRecoveryPlan` path is untouched.
3. New Convex queries can stay deployed — they are net-new functions
   that nothing calls when the flag is off.

### 5.4 Monitoring

After Phase B deploys:

- Watch Convex dashboard for `getWeeklyStats`, `getGoals`,
  `getNextBest` p95 latency.
- Watch Next.js RSC payload size for `/planner`.
- Watch client-side error rate (Clerk + Convex errors in the planner
  route).

### 5.5 Cleanup

After 2 weeks of stable V2:

1. Remove `NEXT_PUBLIC_PLANNER_V2` flag.
2. Delete old `PlannerClient.tsx` and `getPlannerOverview` /
   `getRecoveryPlan` (the monolithic versions).
3. Rename `PlannerClientV2.tsx` → `PlannerClient.tsx`.
4. Remove unused imports and dead code.

---

## Appendix: Summary of Architectural Decisions

| Decision | Rationale |
|---|---|
| Split monolithic query into 6 focused queries | Progressive rendering; independent failure domains |
| Keep recovery plan as separate query (not merged) | Recovery is below-fold; shouldn't block above-fold content |
| Use `resolveTopicChains` (batch) for overdue topics | Eliminates N+1 chain resolution |
| Extract shared types to `_lib/plannerTypes.ts` | Single source of truth for shape definitions |
| Extract helpers to `_lib/plannerHelpers.ts` | Reuse across queries; caps enforced in one place |
| Extract hooks for mutation state | Panels render UI; hooks manage state |
| Feature flag: `NEXT_PUBLIC_PLANNER_V2` | Zero-risk deployment; instant rollback |
| Four-phase rollout | Minimize blast radius; validate each phase independently |
