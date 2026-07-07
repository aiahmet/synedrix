# Synedrix Dashboard Improvement — Design Document

> July 7, 2026 · Status: Draft for review
>
> This document defines the architecture, code style, quality bar, testing
> strategy, and deployment plan for improving the Synedrix dashboard from
> its current state to a production-grade cockpit.

---

## Table of Contents

1. [Current State Audit](#1-current-state-audit)
2. [Architecture](#2-architecture)
3. [Code Style Guidelines](#3-code-style-guidelines)
4. [Quality Constraints](#4-quality-constraints)
5. [Testing Strategy](#5-testing-strategy)
6. [Deployment Plan](#6-deployment-plan)
7. [Migration & Rollback](#7-migration--rollback)
8. [Open Questions & Risks](#8-open-questions--risks)

---

## 1. Current State Audit

### 1.1 What exists today

The dashboard is a server-rendered Next.js 16 page at `/dashboard` with a
single client island (`DashboardOverviewClient`). It preloads up to **13
Convex queries** from the server and composes them into a scrollable
cockpit:

```
page.tsx (RSC)
├── header (mono eyebrow + Welcome back H1 + description)
├── DashboardOverviewClient ("use client")
│   ├── ContinueStudyingCard           ← next-best topic + tutor CTA
│   ├── CockpitStatsRow                ← due today / streak / mastery
│   ├── SubjectMasteryStrip            ← per-subject mastery bars
│   ├── Practice Arena CTA (inline icon link)
│   ├── AskTutorCta                    ← tutor composer on dashboard
│   ├── "View your authored topics" link (conditional)
│   ├── DailyMissionCard               ← next-best + daily goal
│   ├── MistakesRevisitStrip           ← upcoming mistake reviews
│   ├── WeeklyConsistencyGraph         ← 7-day activity chart
│   ├── GoalCompletionSnapshot         ← daily + weekly goal bars
│   ├── RecoveredTopicsCard            ← topics that bounced back
│   ├── TimeBySubjectStrip             ← minutes-per-subject breakdown
│   ├── RecentActivityStrip            ← last 5 actions
│   └── WhatsNewStrip                  ← 3 most recent AI updates
└── Convex offline notice (conditional)
```

### 1.2 Convex queries on the dashboard

| Query | Source | Purpose |
|---|---|---|
| `dashboard.getOverview` | `convex/dashboard.ts` | Mastery, streak, due counts, subject list |
| `subjects.list` | `convex/subjects.ts` | Canonical subject catalog |
| `dashboard.getContinueStudying` | `convex/dashboard.ts` | Most recently studied topic under mastery threshold |
| `dashboard.getRecentActivity` | `convex/dashboard.ts` | Fusion of sessions + practice + tutor threads |
| `telemetry.getRecentSystemUpdates` | `convex/telemetry.ts` | Recent AI curriculum updates |
| `dashboard.listOwnedTopicsForCurrentUser` | `convex/dashboard.ts` | Count of user-authored topics |
| `dashboard.getDailyMission` | `convex/dashboard.ts` | Next-best topic, daily goal, due counts, streak |
| `dashboard.getMistakesToRevisit` | `convex/dashboard.ts` | Upcoming mistake review items |
| `dashboard.getWeeklyConsistency` | `convex/dashboard.ts` | 7-day session/duration bars |
| `goals.getSnapshot` | `convex/goals.ts` | Daily + weekly goal progress |
| `dashboard.getRecoveredTopics` | `convex/dashboard.ts` | Topics that improved ≥0.15 mastery in 30 days |
| `dashboard.getTimeBySubject` | `convex/dashboard.ts` | Minutes + session count per subject |

### 1.3 Identified problems

#### A. Page-level: query explosion with no prioritization

The dashboard page preloads 13 queries in a waterfall. The critical path
(overview + subjects) runs first, then the remaining 10 fire only if the
user has data. This is correct but the second batch is fire-and-forget:
all 10 preloads race in `Promise.all` with no priority tiering. If a
single query (e.g. `getRecoveredTopics`) times out or scans a large
table, the entire client island blocks.

**Severity:** Medium. The `Promise.all` pattern means one slow query
blocks rendering of all 10 secondary cards. In practice, Convex is fast,
but as the user accumulates data, queries like `getRecentActivity` (which
joins 3 tables with up to 300 rows) will slow.

#### B. `DashboardOverviewClient`: too many nullable preloads

The client component accepts 6 nullable preloads and 6 required ones.
Each nullable preload gates a conditional render. The prop surface has
grown organically: when a new card was added, a new prop was appended.
There is no batch abstraction or grouped preload pattern.

**Severity:** Low (maintainability). The component works correctly but
is 160+ lines of prop declarations before any logic begins.

#### C. `getOverview` is pathologically heavy

The handler does:
1. Load all `userTopicProgress` rows for the user (unbounded collect).
2. Load all `userSubjects` rows (unbounded collect).
3. Load **all** `subjects` rows.
4. Load **all** `studySessions` for the user (unbounded collect).
5. For every distinct topic ID in progress, batch-load the topic rows (up
   to 200).
6. For every distinct chapter ID in those topics, batch-load chapters (up
   to 100).
7. For every subject ID, load **all** its chapters.
8. For every chapter, load **all** its topics to count them.
9. Run two flashcard-review queries (due today, due tomorrow).

This is 9+ queries with multiple unbounded collects. For the current
single-user Gymnasium scope, the data is small (6 subjects, ~50 chapters,
~200 topics), so it works. But the design is fragile: a power user with
1000+ progress rows will hit slow reads.

**Severity:** Medium (latency), High (design debt). The overview does too
much. `getDailyMission` independently re-derives streak and due counts
that `getOverview` already computed. `getMistakesToRevisit` independently
loads topic→chapter→subject chains.

#### D. Duplicate computation across queries

Several queries independently load the same reference data
(topic→chapter→subject chains, session completions, flashcard reviews).
There is no shared Convex `internalQuery` cache or denormalized summary
table. Each query repeats the identity lookup, user fetch, and chain-
walking.

**Severity:** Medium. Adds latency and cost, but Convex's read-replica
model means the DB impact is low. The main cost is developer confusion:
changing the streak algorithm requires touching `getOverview`,
`getDailyMission`, `getWeeklyConsistency`, and `planner.getPlannerOverview`.

#### E. Missing loading states per card

The client island is all-or-nothing. If any required preload is null, the
entire dashboard falls through to `EmptySubjectsState`. There are no
per-card skeletons, no progressive rendering. A user with data sees all
cards appear simultaneously after every query resolves.

**Severity:** Low (UX). Convex is fast enough that this is rarely visible,
but a slow network or cold Convex deployment makes the dashboard feel
sluggish.

#### F. `CockpitStatsRow` ships two anti-patterns

Per the rulebook (`docs/SYNEDRIX-FRONTEND-STYLE.md` §1):
- Icon containers: the "Due today" card wraps the icon in
  `bg-accent/10 ring-1 ring-accent/10` — banned.
- The streak card does the same with a conditional accent ring.

**Severity:** Low (visual). The rulebook bans these, but the row is
otherwise well-structured.

#### G. Dashboard lacks a compositional layout system

Cards are rendered in a flat vertical list in
`DashboardOverviewClient`. There is no grid layout, no two-column
desktop arrangement, no section grouping. The order is hardcoded
and the page reads as a long scroll.

**Severity:** Medium (information architecture). On desktop (1440px+),
the page wastes horizontal space. Cards like `WeeklyConsistencyGraph` and
`TimeBySubjectStrip` could sit side-by-side.

---

## 2. Architecture

### 2.1 Target architecture: tiered preloading with progressive rendering

```
                       Server (RSC)
                     ┌──────────────────────────────────────┐
    Tier 0 (critical)│  auth() → user → seed bootstrap       │
                     │  preload: getOverview + subjects.list  │
                     └──────────────┬───────────────────────┘
                                    │
    Tier 1 (above-fold)│  if !isEmpty → preload in parallel:  │
                     │  getContinueStudying + getDailyMission  │
                     │  + getWeeklyConsistency                  │
                     └──────────────┬───────────────────────┘
                                    │
    Tier 2 (below-fold)│ preload in parallel:                  │
                     │  getMistakesToRevisit + goals.getSnapshot│
                     │  + getRecoveredTopics + getTimeBySubject │
                     │  + getRecentActivity + whatsNew          │
                     └──────────────┬───────────────────────┘
                                    │
                       Client Island
                     ┌──────────────────────────────────────────┐
                     │  <DashboardShell>                        │
                     │    <ContinueStudyingCard />    ← Tier 1   │
                     │    <CockpitStatsRow />         ← Tier 1   │
                     │    <SubjectMasteryStrip />     ← Tier 0   │
                     │    <DashboardGrid>             ← Tier 1+2 │
                     │      <WeeklyConsistencyGraph />           │
                     │      <TimeBySubjectStrip />               │
                     │      ...                                  │
                     │    </DashboardGrid>                       │
                     │    <ActivitySection>           ← Tier 2   │
                     │      <RecentActivityStrip />              │
                     │      <WhatsNewStrip />                    │
                     │    </ActivitySection>                     │
                     │  </DashboardShell>                        │
                     └──────────────────────────────────────────┘
```

**Key principles:**

1. **Three-tier preloading.** Tier 0 (critical) must succeed for the page
   to render at all. Tier 1 (above-fold) renders the primary value in the
   first viewport. Tier 2 (below-fold) can arrive later and fill in.

2. **Progressive rendering via `Suspense` boundaries.** Each tier wraps
   in its own `<Suspense>` with a card-level skeleton. Cards appear as
   their data resolves instead of all at once.

3. **Grouped preloads.** The 6 nullable secondary preloads are collapsed
   into a single `DashboardSecondaryPreloads` type passed as one prop.
   The client component destructures once.

4. **Compositional grid.** Desktop gets a 2-column grid for the
   below-fold section. Mobile stays single-column.

### 2.2 Data layer: denormalized dashboard summary

**Problem:** `getOverview` does too much work that other queries repeat.

**Solution:** Introduce a `dashboardSnapshots` table (or extend the
existing `userTopicProgress` aggregation path) that is written to by
mutations that touch mastery, sessions, or flashcard reviews. The
dashboard reads a single precomputed row per user instead of joining 9
tables.

**Alternative (preferred for now): `internalQuery` refactoring.**

Since Convex does not support cross-query caching and the data volume is
small for a single-user app, the simpler path is:

1. Extract shared sub-computations (streak, due counts, topic→subject
   mapping) into `_lib/` helpers consumed by all dashboard queries.
2. Keep `getOverview` as-is but cap the `collect()` calls and add
   pagination markers.
3. Defer the denormalized snapshot table to a later phase when data
   volume becomes an actual bottleneck.

**Decision:** Refactor first, denormalize later. The `_lib/` helpers
eliminate the duplicate-computation problem without a schema migration.

### 2.3 Component tree (target)

```
app/(app)/dashboard/
├── page.tsx                    ← RSC, tiered preloading
├── DashboardOverviewClient.tsx  ← client island, Suspense boundaries
├── layout.tsx                  ← unchanged
├── loading.tsx                 ← full-page skeleton (exists)
├── error.tsx                   ← error boundary (exists)
└── _components/                ← NEW: colocated primitives
    ├── DashboardShell.tsx       ← layout wrapper with grid
    ├── DashboardGrid.tsx        ← 2-col desktop grid for below-fold
    ├── ActivitySection.tsx      ← bottom section (recent + what's new)
    ├── Tier1Skeleton.tsx        ← skeleton for above-fold cards
    └── Tier2Skeleton.tsx        ← skeleton for below-fold cards
```

`components/dashboard/` stays as-is for the card primitives (they are
reused across the app). Only page-level composition moves to the colocated
`_components/` directory.

### 2.4 Data flow diagram

```
┌──────────┐   preloadQuery    ┌──────────┐   realtime sub   ┌──────────┐
│  page.tsx │ ───────────────> │  Convex  │ <───────────── │  Client  │
│   (RSC)   │                  │  Server  │                 │  Island  │
└──────────┘                  └──────────┘                 └──────────┘
     │                              │                            │
     │  Tier 0: getOverview        │                            │
     │  + subjects.list             │                            │
     │                              │                            │
     │  Tier 1: getContinueStudying │                            │
     │  + getDailyMission           │                            │
     │  + getWeeklyConsistency      │                            │
     │                              │                            │
     │  Tier 2: getMistakesToRevisit│                            │
     │  + goals.getSnapshot         │                            │
     │  + getRecoveredTopics        │                            │
     │  + getTimeBySubject          │                            │
     │  + getRecentActivity         │                            │
     │  + telemetry.getWhatsNew     │                            │
     │                              │                            │
     ▼                              ▼                            ▼
  <DashboardShell>           Convex DB                   usePreloadedQuery
  ┌────────────────┐                                    ┌──────────────┐
  │ <Suspense>     │                                    │ Tier 1 cards │
  │   Tier 1 cards │                                    │ (above fold) │
  │ </Suspense>    │                                    └──────────────┘
  │ <Suspense>     │                                    ┌──────────────┐
  │   Tier 2 cards │                                    │ Tier 2 cards │
  │ </Suspense>    │                                    │ (below fold) │
  └────────────────┘                                    └──────────────┘
```

---

## 3. Code Style Guidelines

### 3.1 Server Component (page.tsx)

- **RSC only.** No `"use client"`. The server component is a pure data
  orchestrator.
- **Tiered preloading with clear section comments.** Each tier gets a
  labeled block: `// ── Tier 0: critical path ──`.
- **No inline preload variable explosion.** Use a single
  `DashboardPreloads` interface returned by a helper function
  `preloadDashboardData()` in a colocated `_lib/preloadDashboard.ts`.
- **Guard clauses at the top.** Auth check, seed bootstrap, Convex
  readiness check — each as a guard that returns early or sets a flag.
- **One try/catch per tier, not one giant try/catch.** If Tier 1 fails,
  Tier 2 should still attempt to load.

**Example target shape:**

```typescript
// app/(app)/dashboard/page.tsx

export default async function DashboardPage() {
  const { userId, firstName } = await authenticateAndGetUser();
  await ensureSeedBootstrapped();

  const tier0 = await preloadTier0();
  if (!tier0.success) return <OfflineDashboard />;

  const overview = await fetchQuery(api.dashboard.getOverview, tier0.params);
  if (overview.isEmpty) return <EmptyDashboard />;

  const [tier1, tier2] = await Promise.all([
    preloadTier1(),
    preloadTier2(),
  ]);

  return (
    <DashboardShell>
      <DashboardHeader firstName={firstName} />
      <DashboardOverviewClient
        tier0={tier0.preloads}
        tier1={tier1.preloads}
        tier2={tier2.preloads}
      />
    </DashboardShell>
  );
}
```

### 3.2 Client Component (DashboardOverviewClient)

- **Grouped props, not flat explosion.** Accept 3-4 grouped preload
  objects instead of 12 individual props.
- **One `Suspense` boundary per tier.** Tier 1 renders immediately.
  Tier 2 wraps in `<Suspense fallback={<Tier2Skeleton />}>`.
- **No conditional rendering based on nullability.** Each card checks
  its own data and returns `null` when empty. The parent doesn't branch.
- **Grid layout via a colocated `DashboardGrid`.** The flat list of
  cards becomes a structured grid with named sections.
- **`"use client"` at the top with a clear JSDoc block** explaining
  what crosses the boundary and why.

### 3.3 Convex queries

- **One query = one file section with clear `// ──` delimiters.**
- **Extract shared helpers to `convex/_lib/dashboardHelpers.ts`:**
  - `resolveUser(ctx)` — identity + user fetch (exists in `users.ts`).
  - `computeStreak(completedTimes, now, timeZone)` — already exists but
    duplicated. Move to `_lib/`.
  - `resolveTopicChain(ctx, topicId)` — topic → chapter → subject in one
    call. Returns `{ topic, chapter, subject } | null`.
  - `resolveTopicChains(ctx, topicIds)` — batch version with Map output.
- **Cap all `collect()` calls.** Every unbounded collect gets a `.take(N)`
  with a clearly named constant (e.g. `PROGRESS_HARD_CAP = 2000`).
- **Returns types are explicit Zod validators.** No `v.any()` escapes.
- **No business logic in query handlers beyond aggregation.** Scoring,
  thresholding, and recommendation logic lives in `_lib/`.

### 3.4 Dashboard card components

- **Every card is a single-layer `CockpitCard`.** No double-bezel, no
  decoration ring. Per the rulebook (§5).
- **Headers use `CockpitCardHeader`.** Mono uppercase label, optional
  trailing action.
- **No icon containers.** Per rulebook (§1, §8). Icons render at native
  size with direct color tokens.
- **Empty state within the card.** When a card has no data, it renders a
  muted "Nothing to show" row instead of hiding. This keeps layout stable.
- **Responsive behavior is per-card.** Cards declare their own
  `className` for grid placement. The grid is the only place that
  controls column spans.
- **Links use `next/link` with `prefetch={false}` for dashboard cards.**
  The dashboard has many links; prefetching all of them wastes bandwidth.

### 3.5 Naming conventions

| Concept | Naming |
|---|---|
| Page-level data preloader | `preloadDashboardData()` in `_lib/preloadDashboard.ts` |
| Grouped preload type | `DashboardPreloads` |
| Tier-level preload type | `Tier1Preloads`, `Tier2Preloads` |
| Card component | `DailyMissionCard`, `WeeklyConsistencyGraph` |
| Convex query | `dashboard.getOverview`, `dashboard.getDailyMission` |
| Convex internal helper | `_lib/dashboardHelpers.ts` |
| Shared streak computation | `_lib/streak.ts` (consumed by dashboard + planner + goals) |
| Topic chain resolver | `_lib/topicChain.ts` |

---

## 4. Quality Constraints

### 4.1 TypeScript strictness

- **`strict: true` in `tsconfig.json`** (already enabled).
- **No `as` casts except for Convex ID narrowing** (e.g.
  `topicId as Id<"topics">` after a filter guard). All other casts are
  banned.
- **No `any`.** Exception: Convex's `ctx.db.patch` accepts
  `Record<string, unknown>` — that's the only allowed escape hatch.
- **Exhaustive checks on all discriminated unions.** Every
  `switch (status)` must cover all union members or include a
  `satisfies never` default.
- **`readonly` on all component props and function parameters.**
  Already enforced — maintain this.

### 4.2 Convex schema validation

- **Every query `returns` validator must match the actual returned
  shape exactly.** Use `v.object({ ... })` with no `v.optional()` on
  fields that are always returned.
- **No `v.any()` in return validators.** If a field can be null, use
  `v.union(v.string(), v.null())`, not `v.optional(v.string())` followed
  by a truthy check that forgets the null branch.
- **Run `npx convex dev` before merging.** The Convex type generator
  must produce fresh `_generated/api.d.ts` types.
- **Add a `validateDashboardQueries` test** that calls every dashboard
  query against a seeded test user and asserts the return shapes.

### 4.3 Performance budget

| Metric | Budget | Measurement |
|---|---|---|
| Dashboard page LCP (server render) | < 800ms | Convex dashboard latency panel |
| Client island hydration | < 200ms | React DevTools profiler |
| Tier 1 (above-fold) time to visible | < 500ms from navigation | Custom `performance.mark` |
| Tier 2 (below-fold) time to visible | < 1200ms from navigation | Custom `performance.mark` |
| `getOverview` handler latency | < 150ms p95 | Convex dashboard |
| Any secondary query handler latency | < 80ms p95 | Convex dashboard |
| Dashboard JS bundle (client island) | < 15 KB gzipped | `next build` output |

### 4.4 Accessibility

- **Every interactive element is keyboard-accessible.** Links are
  `<a>` tags (via `next/link`). Buttons are `<button>`.
- **Focus rings on all interactive elements.** Use the rulebook's
  crisp focus: `focus-visible:ring-1 focus-visible:ring-foreground/40`.
- **MasteryRing SVG has `role="img"` and `aria-label`.**
- **Color is not the only differentiator.** The mastery bars use both
  color AND percentage text. The streak flame uses both color AND the
  number.
- **`prefers-reduced-motion`** disables the mastery bar width transition.

### 4.5 Dark mode

- **Every card must render correctly in both themes.** Test with
  `document.documentElement.classList.toggle("dark")`.
- **Shadows use the layered light+dark pattern** from `CockpitCard`.
- **No hardcoded hex colors.** Use CSS custom properties from the
  `@theme` config in `app/globals.css`.

---

## 5. Testing Strategy

### 5.1 Unit tests (Vitest)

**Layer: Convex `_lib/` helpers.**

| Test file | What it covers |
|---|---|
| `convex/_lib/streak.test.ts` | `computeStreak` with edge cases: 0 completions, today-only, gap days, DST boundaries, 365+ day streaks |
| `convex/_lib/topicChain.test.ts` | `resolveTopicChain` mock: valid chain, broken chain (missing topic), missing chapter, missing subject |
| `convex/_lib/dashboardHelpers.test.ts` | `computeMasteryBreakdown`, `computeDueCounts`, `sortSubjectsByMastery` |
| `convex/dashboard.test.ts` | `getOverview` with a seeded test user: empty progress, single subject with progress, multiple subjects, mastery calculation accuracy |

**Pattern:**

```typescript
// convex/_lib/streak.test.ts
import { describe, it, expect } from "vitest";
import { computeStreak } from "./streak";

describe("computeStreak", () => {
  it("returns 0 for empty completions", () => {
    expect(computeStreak([], Date.now(), "UTC")).toBe(0);
  });

  it("returns 1 when only today has a session", () => {
    const now = Date.now();
    expect(computeStreak([now], now, "UTC")).toBe(1);
  });

  it("returns 2 for today + yesterday", () => {
    const now = Date.now();
    const yesterday = now - 86_400_000;
    expect(computeStreak([now, yesterday], now, "UTC")).toBe(2);
  });

  it("breaks streak on a gap day", () => {
    const now = Date.now();
    const twoDaysAgo = now - 2 * 86_400_000;
    expect(computeStreak([now, twoDaysAgo], now, "UTC")).toBe(1);
  });
});
```

### 5.2 Integration tests (Convex test helpers)

**Layer: Convex query handlers.**

Use Convex's ` convex-test` or a custom test harness that:
1. Seeds a test user with known data.
2. Calls each dashboard query.
3. Asserts the return shape and values.

```typescript
// convex/dashboard.integration.test.ts
import { describe, it, expect } from "./testHelpers";

describe("dashboard.getOverview", () => {
  it("returns isEmpty: true for a fresh user", async () => {
    const ctx = await createTestContext({ user: "fresh" });
    const result = await ctx.runQuery("dashboard:getOverview", { timeZone: "UTC" });
    expect(result.isEmpty).toBe(true);
    expect(result.subjects).toHaveLength(0);
  });

  it("computes mastery correctly for a user with progress", async () => {
    const ctx = await createTestContext({ user: "withProgress" });
    const result = await ctx.runQuery("dashboard:getOverview", { timeZone: "UTC" });
    expect(result.isEmpty).toBe(false);
    expect(result.stats.overallMastery).toBeGreaterThan(0);
    expect(result.subjects.length).toBeGreaterThan(0);
  });
});
```

### 5.3 Component tests (React Testing Library)

**Layer: Client card components.**

| Test file | What it covers |
|---|---|
| `components/dashboard/CockpitStatsRow.test.tsx` | Renders three cards; shows correct values; handles zero state for each stat |
| `components/dashboard/ContinueStudyingCard.test.tsx` | Renders with data; renders correct links; handles user-owned vs canonical topic |
| `components/dashboard/SubjectMasteryStrip.test.tsx` | Renders multiple subjects; handles empty list; renders correct mastery percentages |
| `components/dashboard/DailyMissionCard.test.tsx` | Shows next-best topic; shows daily goal progress; handles null nextBest |

### 5.4 Visual regression tests

**Not in scope for this phase.** Dashboard is data-driven with real
Convex queries; visual diffs against seeded data would require a stable
test environment. Defer to Phase 4 (Polish).

### 5.5 Manual QA checklist

Before merging any dashboard change:

- [ ] Fresh sign-up: dashboard shows `EmptySubjectsState` with CTA.
- [ ] User with data: all cards render; no layout shift during load.
- [ ] Dark mode: all cards readable; shadows are correct.
- [ ] Mobile (< 640px): single column; no horizontal overflow.
- [ ] Tablet (640-1024px): grid adapts correctly.
- [ ] Desktop (> 1024px): two-column grid for below-fold cards.
- [ ] Keyboard navigation: Tab through all links; focus rings visible.
- [ ] Convex offline: offline notice renders; page doesn't crash.
- [ ] Network slow (throttle to Slow 3G in DevTools): skeletons appear;
  cards progressively fill in.
- [ ] Mastery at 0%: ring renders empty; no NaN or division-by-zero.
- [ ] Mastery at 100%: ring renders full; text says 100%.
- [ ] Streak at 0: encouraging copy; flame icon is outline.
- [ ] No mistakes to revisit: strip shows "Nothing to review" empty state.

---

## 6. Deployment Plan

### 6.1 Phased rollout

#### Phase A: Refactor (no visual changes)

**Duration:** 1–2 days.

1. Extract `computeStreak` to `convex/_lib/streak.ts`. Update all 4
   call sites (`dashboard.ts` ×2, `planner.ts`, `tutorStrategy.ts`).
2. Extract `resolveTopicChain` + `resolveTopicChains` to
   `convex/_lib/topicChain.ts`. Update all ~8 call sites.
3. Add `PROGRESS_HARD_CAP` constants to all `collect()` calls in
   dashboard queries.
4. Collapse the 12 individual props in `DashboardOverviewClient` into
   3 grouped preload types (`Tier0Preloads`, `Tier1Preloads`,
   `Tier2Preloads`).
5. Run full test suite. Deploy.

**Risk:** Low. Pure extraction; no data flow changes.

#### Phase B: Tiered preloading + Suspense

**Duration:** 2–3 days.

1. Create `app/(app)/dashboard/_lib/preloadDashboard.ts` with
   `preloadTier0()`, `preloadTier1()`, `preloadTier2()`.
2. Add `DashboardShell`, `DashboardGrid`, `ActivitySection` to
   `app/(app)/dashboard/_components/`.
3. Add `Tier1Skeleton` and `Tier2Skeleton`.
4. Rewrite `page.tsx` to use tiered preloading with `Suspense`
   boundaries.
5. Rewrite `DashboardOverviewClient` to consume grouped preloads and
   render within `Suspense`.
6. Test progressive rendering on slow network.
7. Run full QA checklist. Deploy.

**Risk:** Medium. The data flow changes; all cards must still receive
the same data they do today.

#### Phase C: Layout improvements

**Duration:** 1–2 days.

1. Implement `DashboardGrid` with CSS grid: 1 column mobile, 2 columns
   desktop.
2. Assign cards to grid areas:
   - Full-width row: `ContinueStudyingCard`, `CockpitStatsRow`,
     `SubjectMasteryStrip`.
   - Two-column: `DailyMissionCard` + `GoalCompletionSnapshot` (left),
     `WeeklyConsistencyGraph` + `TimeBySubjectStrip` (right).
   - Full-width row: `MistakesRevisitStrip`, `RecoveredTopicsCard`.
   - Full-width row: `RecentActivityStrip` + `WhatsNewStrip`.
3. Remove `CockpitStatsRow` icon containers (anti-pattern fix).
4. Run full QA checklist. Deploy.

**Risk:** Low. Layout-only changes; no data flow changes.

#### Phase D: Performance hardening (optional, deferrable)

**Duration:** 2–3 days.

1. Add query latency monitoring via Convex dashboard.
2. If `getOverview` exceeds 150ms p95, add pagination to internal
   collects.
3. Add a `dashboardSnapshots` table with a scheduled mutation that
   refreshes every 60 seconds (if query latency is the bottleneck).
4. Implement `stale-while-revalidate` pattern for tier 2 queries using
   TanStack Query on the client side (opt-in behind a feature flag).

**Risk:** Medium. Schema migration required for snapshots table.

### 6.2 Feature flags

All phases use a single environment variable:

```
NEXT_PUBLIC_DASHBOARD_V2=false
```

Phases A–C are gated behind this flag in `page.tsx`:

```typescript
const useV2 = process.env.NEXT_PUBLIC_DASHBOARD_V2 === "true";

if (useV2) {
  return <DashboardV2 ... />;
}
return <DashboardV1 ... />; // current implementation, untouched
```

This allows side-by-side testing in production and instant rollback.

### 6.3 Monitoring

- **Convex dashboard** for query latency (p50, p95, p99).
- **Vercel Analytics** for Web Vitals (LCP, CLS, INP) on `/dashboard`.
- **Custom `performance.mark`** for tier render times (development only;
  stripped in production).

### 6.4 Rollback procedure

1. Set `NEXT_PUBLIC_DASHBOARD_V2=false` in Vercel environment variables.
2. Redeploy (or wait for ISR revalidation if using edge config).
3. Confirm `/dashboard` renders the V1 path.
4. Investigate the V2 issue in a preview deployment.

---

## 7. Migration & Rollback

### 7.1 Schema migrations

**Phase D (optional) introduces `dashboardSnapshots`:**

```typescript
// convex/schema.ts addition
dashboardSnapshots: defineTable({
  userId: v.id("users"),
  overview: v.string(), // JSON blob of precomputed overview
  computedAt: v.number(),
}).index("by_user", ["userId"]),
```

- **Forward migration:** `npx convex deploy` applies the new schema.
  Existing rows are unaffected.
- **Backfill:** A one-off mutation computes snapshots for all existing
  users. Run once after deploy.
- **Rollback:** Remove the table definition and redeploy. No data loss
  because the snapshot is derived.

### 7.2 Data migration

No data migration is required for Phases A–C. Phase D's snapshot table
is additive; deleting it reverts to live query computation.

### 7.3 Client-side cache invalidation

Convex's real-time subscriptions handle cache invalidation automatically.
When a mutation updates `userTopicProgress`, all subscribed dashboard
queries re-run. No manual cache busting is needed.

---

## 8. Open Questions & Risks

### 8.1 Open questions

1. **Should `getOverview` be split into 2–3 smaller queries?**
   Pro: faster parallel execution, better caching. Con: more client-side
   assembly logic, more preload calls. Recommendation: defer until
   latency data shows a bottleneck.

2. **Should the dashboard use a virtual list for many subjects?**
   Currently 6 subjects max. If user-authored subjects grow beyond ~20,
   `SubjectMasteryStrip` should virtualize. Recommendation: add a
   `maxSubjects` prop (default 20) and revisit when the limit is hit.

3. **Should `DailyMissionCard` and `GetStartedCard` merge?**
   They overlap: both show next-best topic. The mission card adds daily
   goals and due counts. Recommendation: keep separate for now; the
   mission card is goal-oriented, the continue card is action-oriented.

4. **Dark mode shadows: one pattern or per-card?**
   The `CockpitCard` defines the canonical shadow. All dashboard cards
   use `CockpitCard`. Recommendation: keep the single pattern.

### 8.2 Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Tiered preloading introduces waterfall | Low | Medium | Tier 1 and Tier 2 fire in parallel after Tier 0; no additional waterfall |
| `Suspense` boundaries cause layout shift | Medium | Low | Skeletons match card dimensions exactly; `CockpitCard` has fixed padding |
| `_lib/` extraction introduces import errors | Low | Medium | Typecheck catches all; run `npm run typecheck` after every extraction |
| Phase D snapshot table drifts from live data | Medium | High | Add a `driftDetected` field; run a reconciliation query on each dashboard load |
| Feature flag logic complicates `page.tsx` | Low | Low | Flag is removed after Phase C is stable; V1 code is deleted |

---

## Appendix A: File change inventory

### Files to create

| File | Phase | Purpose |
|---|---|---|
| `convex/_lib/streak.ts` | A | Shared streak computation |
| `convex/_lib/streak.test.ts` | A | Unit tests for streak |
| `convex/_lib/topicChain.ts` | A | Shared topic→chapter→subject resolution |
| `convex/_lib/topicChain.test.ts` | A | Unit tests for topic chain |
| `app/(app)/dashboard/_lib/preloadDashboard.ts` | B | Tiered preloading helpers |
| `app/(app)/dashboard/_components/DashboardShell.tsx` | B | Layout wrapper |
| `app/(app)/dashboard/_components/DashboardGrid.tsx` | B | 2-col grid |
| `app/(app)/dashboard/_components/ActivitySection.tsx` | B | Bottom section |
| `app/(app)/dashboard/_components/Tier1Skeleton.tsx` | B | Above-fold skeleton |
| `app/(app)/dashboard/_components/Tier2Skeleton.tsx` | B | Below-fold skeleton |
| `convex/_lib/dashboardHelpers.test.ts` | A | Unit tests for shared helpers |

### Files to modify

| File | Phase | Changes |
|---|---|---|
| `convex/dashboard.ts` | A | Use `_lib/streak`, `_lib/topicChain`; add caps to collects |
| `convex/planner.ts` | A | Use `_lib/streak` |
| `convex/tutorStrategy.ts` | A | Use `_lib/streak` (if applicable) |
| `app/(app)/dashboard/page.tsx` | B, C | Tiered preloading; grid layout |
| `app/(app)/dashboard/DashboardOverviewClient.tsx` | B, C | Grouped props; Suspense boundaries; grid |
| `components/dashboard/CockpitStatsRow.tsx` | C | Remove icon containers |
| `convex/schema.ts` | D | Add `dashboardSnapshots` table (optional) |

### Files to delete (after Phase C is stable)

| File | Reason |
|---|---|
| `app/(app)/dashboard/DashboardOverviewClient.tsx` | Replaced by new client component (or renamed to `DashboardClientV2.tsx` during flag period) |

---

## Appendix B: Dashboard card priority matrix

| Card | Value to user | Data freshness need | Render priority |
|---|---|---|---|
| ContinueStudyingCard | High — primary action | Real-time | Tier 1 (above fold) |
| CockpitStatsRow | High — at-a-glance state | Real-time | Tier 1 |
| SubjectMasteryStrip | High — context for actions | Real-time | Tier 0 (part of overview) |
| DailyMissionCard | Medium — daily guidance | Stale-OK for 5 min | Tier 1 |
| WeeklyConsistencyGraph | Medium — motivation | Stale-OK for 1 hour | Tier 2 |
| GoalCompletionSnapshot | Medium — accountability | Real-time | Tier 2 |
| MistakesRevisitStrip | Medium — actionable | Real-time | Tier 2 |
| RecoveredTopicsCard | Low — encouragement | Stale-OK for 1 hour | Tier 2 |
| TimeBySubjectStrip | Low — reflection | Stale-OK for 1 hour | Tier 2 |
| RecentActivityStrip | Low — log | Real-time | Tier 2 |
| WhatsNewStrip | Low — discovery | Stale-OK for 1 day | Tier 2 |

---

> **Next step:** Review this document with the team, resolve open
> questions (§8.1), then begin Phase A (refactor extraction) with
> `convex/_lib/streak.ts` as the first deliverable.
