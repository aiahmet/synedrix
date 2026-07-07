# Synedrix Dashboard Improvement — Subtask Breakdown

> Derived from `docs/DASHBOARD-IMPROVEMENT-DESIGN-DOC.md`
>
> Each subtask is small enough to complete in one session (~15–45 min),
> has a clear definition of "done," specific files to touch, a validation
> command, and explicit dependencies. Tasks are ordered within each phase
> so you can work top-to-bottom with minimal blocking.

---

## Phase A: Shared Library Extraction (no visual changes)

### A1 — Create `convex/_lib/streak.ts`

**Inputs:** `convex/dashboard.ts` (lines 198–232, `computeStreak`),
`convex/planner.ts` (lines 244–252, `computeStreak`).

**What:** Move the `computeStreak` function into a shared
`convex/_lib/streak.ts` module. Unify the two implementations (the
dashboard version accepts a `timeZone` options object; the planner
version is a simplified UTC-only variant). The unified version:

```typescript
export function computeStreak(
  completedAtTimes: readonly number[],
  nowMs: number,
  options: { readonly timeZone: string },
): number
```

Use the `Intl.DateTimeFormat` approach from the dashboard version (it
handles DST correctly). The planner version's `Math.floor(ms / DAY_MS)`
approach is simpler but wrong across DST boundaries — unify on the
`Intl` version.

**Files to create:**
- `convex/_lib/streak.ts`

**Validation:**
- `npm run typecheck`
- Manual: open `/dashboard` and `/planner` — streaks should match

**Dependencies:** None.

**Done when:** Both `dashboard.ts` and `planner.ts` import from
`_lib/streak.ts` and produce identical streak values for the same input.

---

### A2 — Add unit tests for `computeStreak`

**Inputs:** `convex/_lib/streak.ts` (from A1).

**What:** Write Vitest tests covering:

| Case | Input | Expected |
|---|---|---|
| No completions | `[]` | `0` |
| Only today | `[now]` | `1` |
| Today + yesterday | `[now, now - DAY]` | `2` |
| Today + 2 days ago (gap) | `[now, now - 2*DAY]` | `1` (gap breaks) |
| Yesterday but not today | `[now - DAY]` | `1` (yesterday counts if today missing) |
| 7 consecutive days | `[now - 6*DAY .. now]` | `7` |
| DST spring-forward night | Times crossing a DST boundary | Streak unbroken |

**Files to create:**
- `convex/_lib/streak.test.ts`

**Validation:**
- `npm run test -- --run convex/_lib/streak.test.ts`

**Dependencies:** A1 complete.

**Done when:** All test cases pass.

---

### A3 — Update call sites for `computeStreak`

**Inputs:** `convex/_lib/streak.ts` (from A1).

**What:** Replace the two inline `computeStreak` definitions in:
1. `convex/dashboard.ts` — called in `getOverview` (line ~192) and
   `getDailyMission` (line ~440).
2. `convex/planner.ts` — called in `getPlannerOverview` (line ~140) and
   `getRecoveryPlan` (line ~230).

Remove the local definitions, add the import, and pass the `timeZone`
option consistently. For the planner (which previously used UTC-only),
pass `{ timeZone: "UTC" }`.

**Files to modify:**
- `convex/dashboard.ts`
- `convex/planner.ts`

**Validation:**
- `npm run typecheck`

**Dependencies:** A1 complete.

**Done when:** No local `computeStreak` definitions remain; typecheck passes.

---

### A4 — Create `convex/_lib/topicChain.ts`

**Inputs:** The repeated pattern across `dashboard.ts`, `planner.ts`,
`tutorContext.ts`, `tutorAutoReview.ts`, `reviewCenter.ts`, `progress.ts`
where 3–4 sequential `ctx.db.get()` calls resolve `topicId → chapterId →
subjectId`.

**What:** Create two helpers:

```typescript
export async function resolveTopicChain(
  ctx: QueryCtx,
  topicId: Id<"topics">,
): Promise<{
  topic: Doc<"topics">;
  chapter: Doc<"chapters">;
  subject: Doc<"subjects">;
} | null>

export async function resolveTopicChains(
  ctx: QueryCtx,
  topicIds: readonly Id<"topics">[],
): Promise<Map<Id<"topics">, {
  topic: Doc<"topics">;
  chapter: Doc<"chapters">;
  subject: Doc<"subjects">;
}>
```

The batch version deduplicates chapter and subject fetches using `Map`
caches. Both return `null` or omit entries for broken chains (missing
topic/chapter/subject).

**Files to create:**
- `convex/_lib/topicChain.ts`

**Validation:**
- `npm run typecheck`

**Dependencies:** None.

**Done when:** The module exports both functions with correct types.

---

### A5 — Add unit tests for `resolveTopicChain`

**Inputs:** `convex/_lib/topicChain.ts` (from A4).

**What:** Mock `QueryCtx` with a minimal `db.get` that returns seeded
rows. Test:

| Case | Expected |
|---|---|
| Valid topic → chapter → subject chain | Returns all three docs |
| Topic not found | Returns `null` |
| Chapter not found | Returns `null` |
| Subject not found | Returns `null` |
| Batch with 5 valid topics (some sharing chapters) | Returns 5 entries; chapter cache hits |
| Batch with 2 valid, 1 broken | Returns 2 entries |

**Files to create:**
- `convex/_lib/topicChain.test.ts`

**Validation:**
- `npm run test -- --run convex/_lib/topicChain.test.ts`

**Dependencies:** A4 complete.

**Done when:** All test cases pass.

---

### A6 — Update dashboard queries to use `resolveTopicChain`

**Inputs:** `convex/_lib/topicChain.ts` (from A4).

**What:** Replace the manual topic→chapter→subject chains in:

1. `convex/dashboard.ts`:
   - `getContinueStudying` (lines ~260–270: topic → chapter → subject)
   - `getDailyMission` (lines ~420–435: nextBest topic → chapter → subject)
   - `getMistakesToRevisit` (lines ~490–540: 3-level chain with Maps)
   - `getRecoveredTopics` (lines ~615–625: per-topic chain in loop)
   - `getTimeBySubject` (lines ~690–710: subject resolution from sessions)

2. `convex/planner.ts`:
   - `getPlannerOverview` (overdue topics chain, lines ~180–200)

Use `resolveTopicChain` for single lookups and `resolveTopicChains` for
the mistakes/recovered loops.

**Files to modify:**
- `convex/dashboard.ts`
- `convex/planner.ts`

**Validation:**
- `npm run typecheck`

**Dependencies:** A4 complete.

**Done when:** All topic→chapter→subject chains use the shared helper;
typecheck passes.

---

### A7 — Add hard caps to all `collect()` calls in dashboard queries

**Inputs:** `convex/dashboard.ts`.

**What:** Every `.collect()` in dashboard query handlers gets a `.take(N)`
with a named constant. Current unbounded collects:

| Query | Table | Cap constant | Value |
|---|---|---|---|
| `getOverview` | `userTopicProgress` | `PROGRESS_OVERVIEW_CAP` | 2000 |
| `getOverview` | `userSubjects` | `ENROLLMENT_CAP` | 200 |
| `getOverview` | `subjects` | — (canonical, always small) | no cap needed |
| `getOverview` | `studySessions` | `SESSION_OVERVIEW_CAP` | 500 |
| `getContinueStudying` | `userTopicProgress` | `CONT_STUDYING_CAP` | 2000 |
| `getRecentActivity` | `studySessions` | `ACTIVITY_HARD_CAP` | 100 (exists) |
| `getRecentActivity` | `topicLessonPractice` | `ACTIVITY_HARD_CAP` | 100 (exists) |
| `getRecentActivity` | `tutorThreads` | `ACTIVITY_HARD_CAP` | 100 (exists) |
| `getMistakesToRevisit` | `mistakeEntries` | `MISTAKES_CAP` | 200 |
| `getRecoveredTopics` | `studySessions` | `RECOVERY_SESSIONS_CAP` | 300 |
| `getRecoveredTopics` | `userTopicProgress` | `RECOVERY_PROGRESS_CAP` | 500 |
| `getTimeBySubject` | `studySessions` | `TIME_BY_SUBJECT_CAP` | 500 |
| `getWeeklyConsistency` | `studySessions` | `WEEKLY_CONSISTENCY_CAP` | 500 |

**Files to modify:**
- `convex/dashboard.ts`

**Validation:**
- `npm run typecheck`

**Dependencies:** None (can run in parallel with A4–A6).

**Done when:** Every `collect()` has a `.take(N)` with a named constant;
typecheck passes.

---

### A8 — Create grouped preload types

**Inputs:** `app/(app)/dashboard/DashboardOverviewClient.tsx` (the 12
individual props), `app/(app)/dashboard/page.tsx` (the 12 individual
preload variables).

**What:** Define three grouped types and update the page + client to use
them. This is a pure type refactor — no behavior change.

```typescript
// app/(app)/dashboard/_lib/types.ts

export interface Tier0Preloads {
  readonly overview: Preloaded<typeof api.dashboard.getOverview>;
  readonly subjects: Preloaded<typeof api.subjects.list>;
}

export interface Tier1Preloads {
  readonly continueStudying: Preloaded<typeof api.dashboard.getContinueStudying>;
  readonly recentActivity: Preloaded<typeof api.dashboard.getRecentActivity>;
  readonly whatsNew: Preloaded<typeof api.telemetry.getRecentSystemUpdates>;
  readonly ownedTopics: Preloaded<typeof api.dashboard.listOwnedTopicsForCurrentUser>;
  readonly dailyMission: Preloaded<typeof api.dashboard.getDailyMission>;
  readonly weeklyConsistency: Preloaded<typeof api.dashboard.getWeeklyConsistency>;
}

export interface Tier2Preloads {
  readonly mistakesRevisit: Preloaded<typeof api.dashboard.getMistakesToRevisit>;
  readonly goalsSnapshot: Preloaded<typeof api.goals.getSnapshot>;
  readonly recoveredTopics: Preloaded<typeof api.dashboard.getRecoveredTopics>;
  readonly timeBySubject: Preloaded<typeof api.dashboard.getTimeBySubject>;
}
```

Update `DashboardOverviewClient` to accept `tier0`, `tier1`, `tier2`
instead of 12 individual props.

**Files to create:**
- `app/(app)/dashboard/_lib/types.ts`

**Files to modify:**
- `app/(app)/dashboard/page.tsx`
- `app/(app)/dashboard/DashboardOverviewClient.tsx`

**Validation:**
- `npm run typecheck`

**Dependencies:** None (pure type refactor).

**Done when:** The client component receives 3 grouped props; typecheck
passes; the dashboard renders identically.

---

### A9 — Validate Phase A

**What:** Run the full validation suite end-to-end.

```bash
npm run typecheck
npm run test
npm run lint
```

Open `/dashboard` in the browser and verify:
- All cards render as before
- Streak values match between dashboard and planner
- No console errors
- No layout shift

**Dependencies:** A1–A8 all complete.

**Done when:** All checks pass; dashboard renders identically to `main`.

---

## Phase B: Tiered Preloading + Progressive Rendering

### B1 — Create `_lib/preloadDashboard.ts`

**Inputs:** `app/(app)/dashboard/page.tsx` (current preloading logic).

**What:** Extract the preloading logic into three pure async functions:

```typescript
export async function preloadTier0(
  dashboardTimeZone: string,
): Promise<{ success: false } | { success: true; preloads: Tier0Preloads }>

export async function preloadTier1(
  userId: string,
): Promise<Tier1Preloads>

export async function preloadTier2(
  userId: string,
): Promise<Tier2Preloads>
```

`preloadTier1` and `preloadTier2` are called unconditionally — they
return their preloads even if some queries fail (the client handles
null data per-card). Each function has its own try/catch so a Tier 2
failure doesn't block Tier 1 rendering.

**Files to create:**
- `app/(app)/dashboard/_lib/preloadDashboard.ts`

**Validation:**
- `npm run typecheck`

**Dependencies:** A8 complete (needs the grouped types).

**Done when:** `page.tsx` calls these three functions instead of inline
preloading; typecheck passes.

---

### B2 — Create `DashboardShell`

**Inputs:** `app/(app)/dashboard/layout.tsx` (existing layout),
`components/dashboard/CockpitCard.tsx` (styling reference).

**What:** A layout wrapper that provides the max-width container, spacing,
and section slots for the dashboard. Replaces the inline
`<div className="mx-auto flex max-w-5xl ...">` in `page.tsx`.

```typescript
export function DashboardShell({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:gap-7">
      {children}
    </div>
  );
}
```

Trivial component, but extracting it gives us a single place to change
dashboard-wide layout later.

**Files to create:**
- `app/(app)/dashboard/_components/DashboardShell.tsx`

**Validation:**
- `npm run typecheck`

**Dependencies:** None.

**Done when:** Component exists and typechecks.

---

### B3 — Create `DashboardGrid`

**Inputs:** The card rendering order in `DashboardOverviewClient.tsx`.

**What:** A responsive CSS grid for the below-fold cards. Desktop: 2
columns. Mobile: 1 column. Cards are placed via named grid areas or
column spans.

```typescript
export function DashboardGrid({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {children}
    </div>
  );
}
```

**Files to create:**
- `app/(app)/dashboard/_components/DashboardGrid.tsx`

**Validation:**
- `npm run typecheck`

**Dependencies:** None.

**Done when:** Component exists and typechecks.

---

### B4 — Create `ActivitySection`

**Inputs:** `RecentActivityStrip`, `WhatsNewStrip` — the bottom two cards
in the current dashboard.

**What:** A section wrapper with a mono label ("Activity") and the two
cards stacked. Extracted so the main client component doesn't hardcode
the ordering.

**Files to create:**
- `app/(app)/dashboard/_components/ActivitySection.tsx`

**Validation:**
- `npm run typecheck`

**Dependencies:** None.

**Done when:** Component exists and typechecks.

---

### B5 — Create skeleton components

**Inputs:** `CockpitCard` dimensions, current card layout.

**What:** Two skeleton components that match the dimensions of the real
cards they replace:

- `Tier1Skeleton`: Three stacked `CockpitCard`-sized pulse rectangles
  (stats row + continue studying + subject strip).
- `Tier2Skeleton`: A `DashboardGrid` of 4 pulse `CockpitCard` rectangles
  in 2×2 layout desktop, 4×1 mobile.

Use `animate-pulse bg-muted/20` for the pulse effect. Match the exact
height of the real cards to prevent layout shift.

**Files to create:**
- `app/(app)/dashboard/_components/Tier1Skeleton.tsx`
- `app/(app)/dashboard/_components/Tier2Skeleton.tsx`

**Validation:**
- `npm run typecheck`
- Manual: throttle network to Slow 3G; skeletons should appear before cards

**Dependencies:** B2, B3 (need `CockpitCard` and `DashboardGrid` for
correct dimensions).

**Done when:** Skeletons render with zero layout shift when replaced by
real cards.

---

### B6 — Rewrite `page.tsx` with tiered preloading and Suspense

**Inputs:** All B1–B5 components, current `page.tsx`.

**What:** Rewrite the server component to:
1. Call `preloadTier0()`. If it fails, render `OfflineDashboard`.
2. Fetch the overview to check `isEmpty`. If empty, render
   `EmptySubjectsState`.
3. Fire `preloadTier1()` and `preloadTier2()` in parallel (they don't
   depend on each other).
4. Render `<DashboardShell>` with:
   - `<DashboardHeader>` (existing header markup, extracted inline)
   - `<Suspense fallback={<Tier1Skeleton />}>` wrapping Tier 1 cards
   - `<Suspense fallback={<Tier2Skeleton />}>` wrapping Tier 2 cards

The `DashboardOverviewClient` now receives `tier0`, `tier1`, `tier2`
grouped preloads and renders cards within a `DashboardGrid`.

**Files to modify:**
- `app/(app)/dashboard/page.tsx`
- `app/(app)/dashboard/DashboardOverviewClient.tsx`

**Files to create:**
- `app/(app)/dashboard/_components/DashboardHeader.tsx` (extracted from page.tsx)

**Validation:**
- `npm run typecheck`
- Manual: open `/dashboard`; verify all cards render; throttle network to
  confirm progressive rendering

**Dependencies:** B1–B5 all complete.

**Done when:** Tiered preloading is wired; Suspense boundaries render
skeletons then cards; no regressions.

---

### B7 — Refactor `DashboardOverviewClient` to use `Suspense` internally

**Inputs:** B6's rewritten `DashboardOverviewClient`.

**What:** The client component now:
1. Immediately renders Tier 1 cards (they are preloaded and ready).
2. Wraps Tier 2 cards in a client-side `<Suspense>` with
   `<Tier2Skeleton>` as fallback. This means Tier 2 can hydrate
   progressively even after the page is interactive.

Note: Convex's `usePreloadedQuery` is synchronous once preloaded, so the
`<Suspense>` boundary here is about React's render phase, not data
fetching. The actual benefit is that if Tier 2 preloads arrive late, the
Tier 1 cards are already interactive.

**Files to modify:**
- `app/(app)/dashboard/DashboardOverviewClient.tsx`

**Validation:**
- `npm run typecheck`
- Manual: verify Tier 1 cards are interactive before Tier 2 appears

**Dependencies:** B6 complete.

**Done when:** Client Suspense boundaries work; no hydration mismatches.

---

### B8 — Validate Phase B

**What:** Full validation:

```bash
npm run typecheck
npm run test
npm run lint
```

Browser QA:
- Fresh sign-up → empty state
- User with data → progressive card rendering
- Slow 3G → skeletons appear → cards fill in
- Dark mode → all cards readable
- Mobile → single column; no overflow

**Dependencies:** B1–B7 all complete.

**Done when:** All checks pass.

---

## Phase C: Layout & Anti-Pattern Fixes

### C1 — Implement two-column desktop grid

**Inputs:** `DashboardGrid` (from B3), the flat card list in
`DashboardOverviewClient`.

**What:** Assign cards to grid positions:

```
Desktop (lg+):
┌──────────────────────────────────────────┐
│  ContinueStudyingCard        (full width) │
│  CockpitStatsRow             (full width) │
│  SubjectMasteryStrip         (full width) │
├────────────────────┬─────────────────────┤
│  AskTutorCta        │  Practice Arena CTA  │
├────────────────────┼─────────────────────┤
│  DailyMissionCard   │  GoalSnapshot        │
├────────────────────┼─────────────────────┤
│  WeeklyConsistency  │  TimeBySubject       │
├────────────────────┴─────────────────────┤
│  MistakesRevisitStrip     (full width)    │
│  RecoveredTopicsCard      (full width)    │
├──────────────────────────────────────────┤
│  RecentActivityStrip      (full width)    │
│  WhatsNewStrip            (full width)    │
└──────────────────────────────────────────┘

Mobile (< 1024px):
  All cards single column, same order
```

Cards in the two-column section use `DashboardGrid` with each card as a
direct child. Full-width cards sit outside the grid.

**Files to modify:**
- `app/(app)/dashboard/DashboardOverviewClient.tsx`

**Validation:**
- `npm run typecheck`
- Manual: resize browser; verify grid adapts at 1024px breakpoint

**Dependencies:** Phase B complete (needs `DashboardGrid`).

**Done when:** Desktop shows 2-column layout; mobile shows single column.

---

### C2 — Remove icon containers from `CockpitStatsRow`

**Inputs:** `components/dashboard/CockpitStatsRow.tsx`, frontend style
rulebook §1 (banned: `bg-accent/10 ring-1 ring-accent/10` around icons).

**What:** Three icon containers to fix:

1. **"Due today" card** (line ~50):
   ```tsx
   // BEFORE (banned):
   <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/10">
     <CheckCircle className="h-[1.05rem] w-[1.05rem] text-accent" weight="duotone" />
   </span>
   // AFTER:
   <CheckCircle className="h-[1.05rem] w-[1.05rem] text-muted-foreground" weight="duotone" />
   ```

2. **"Streak" card** (line ~80): Same pattern. Remove the conditional
   `bg-accent/15 ring-accent/20` container; render `Flame` icon at
   native size. The streak-is-hot state is communicated through the icon
   weight (`fill` vs `duotone`) and the copy, not the container chrome.

3. **"Mastery" card** (line ~120): The `MasteryRing` is its own
   component and is not an icon container — it's a data visualization.
   Leave it as-is.

**Files to modify:**
- `components/dashboard/CockpitStatsRow.tsx`

**Validation:**
- `npm run typecheck`
- Manual: verify the three stat cards still look correct without icon
  containers; verify the streak flame shows `fill` weight when hot

**Dependencies:** None (can run anytime).

**Done when:** No `bg-accent/10 ring-1 ring-accent/10` remains in
`CockpitStatsRow`; cards still look correct.

---

### C3 — Audit and fix `ContinueStudyingCard` pill chip

**Inputs:** `components/dashboard/ContinueStudyingCard.tsx`, rulebook §1.

**What:** The subject label uses a pill chip:

```tsx
// BANNED (§1): pill/track uppercase eyebrow chip
<span
  className="rounded-full px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em]"
  style={{ color: fillVar, backgroundColor: `color-mix(...)` }}
>
  {data.subject.title}
</span>
```

Replace with plain text in the subject's color:

```tsx
<span
  className="font-mono text-[10.5px] uppercase tracking-[0.16em]"
  style={{ color: fillVar }}
>
  {data.subject.title}
</span>
```

The subject color is enough to identify the subject; the pill background
adds chrome without information.

**Files to modify:**
- `components/dashboard/ContinueStudyingCard.tsx`

**Validation:**
- `npm run typecheck`
- Manual: verify the card still reads as subject-scoped without the pill

**Dependencies:** None.

**Done when:** Pill chip is removed; subject title is plain colored text.

---

### C4 — Validate Phase C

**What:** Full validation + visual QA:

```bash
npm run typecheck
npm run test
npm run lint
```

Browser QA:
- Desktop: 2-column grid; no icon containers; no pill chips
- Mobile: single column; same card order
- Dark mode: all cards readable
- No layout shift between skeletons and real cards

**Dependencies:** C1–C3 all complete.

**Done when:** All checks pass; dashboard matches the design doc target.

---

## Phase D: Performance Hardening (optional, deferrable)

### D1 — Add `dashboardSnapshots` table (schema)

**What:** Add to `convex/schema.ts`:

```typescript
dashboardSnapshots: defineTable({
  userId: v.id("users"),
  overview: v.string(), // JSON blob of precomputed overview
  computedAt: v.number(),
}).index("by_user", ["userId"]),
```

Run `npx convex dev` to regenerate types.

**Files to modify:**
- `convex/schema.ts`

**Validation:**
- `npm run typecheck`
- `npx convex dev` succeeds

**Dependencies:** None.

**Done when:** Schema change deploys without errors.

---

### D2 — Create snapshot refresh mutation

**What:** A Convex internal mutation that:
1. Calls the `getOverview` logic.
2. Serializes the result to JSON.
3. Upserts a `dashboardSnapshots` row for the user.

A scheduled mutation runs this every 60 seconds for all active users
(users with a session in the last 24 hours).

**Files to create:**
- `convex/_lib/snapshotDashboard.ts`

**Files to modify:**
- `convex/dashboard.ts` (add `refreshSnapshot` internal mutation)
- `convex/crons.ts` (add scheduled job, or create if missing)

**Validation:**
- `npm run typecheck`
- Manual: verify snapshot row exists after first dashboard load

**Dependencies:** D1 complete.

**Done when:** Snapshot is computed and refreshed on schedule.

---

### D3 — Add query latency monitoring

**What:** Add `console.time` / `console.timeEnd` wrappers around each
dashboard query handler (development only, gated behind
`process.env.NODE_ENV === "development"`). Log the p50/p95 latencies to
Convex's built-in function logs.

Alternatively, use Convex's built-in function duration metrics (available
in the dashboard) — no code changes needed. If the built-in metrics are
sufficient, skip this task.

**Files to modify:**
- `convex/dashboard.ts` (if custom timing is needed)

**Validation:**
- Check Convex dashboard → Functions → duration percentiles

**Dependencies:** None.

**Done when:** Latency data is visible in Convex dashboard.

---

### D4 — Implement client-side stale-while-revalidate for Tier 2

**What:** Tier 2 queries use TanStack Query's `staleTime` on the client
side. The initial data comes from the preload; subsequent navigations
serve from cache for 5 minutes, then revalidate in the background.

```typescript
const { data: tier2 } = useQuery({
  queryKey: ["dashboard", "tier2"],
  queryFn: () => fetchTier2Data(),
  staleTime: 5 * 60 * 1000,
  initialData: preloadedTier2,
});
```

This reduces Convex read load for frequently-revisited dashboards.

**Files to create:**
- `app/(app)/dashboard/_lib/useTier2Queries.ts`

**Files to modify:**
- `app/(app)/dashboard/DashboardOverviewClient.tsx`

**Validation:**
- `npm run typecheck`
- Manual: open dashboard, navigate away, come back — Tier 2 cards should
  appear instantly from cache

**Dependencies:** Phase B complete (needs the new client component).

**Done when:** Tier 2 data is cached for 5 minutes; Convex reads drop on
revisit.

---

## Dependency Graph

```
Phase A (parallelizable within):
  A1 ──→ A2
  A1 ──→ A3
               A4 ──→ A5
               A4 ──→ A6
  A7 (independent)
  A8 (independent)
                           ──→ A9 (integration gate)

Phase B (sequential within):
  A8 ──→ B1 ──→ B6 ──→ B7 ──→ B8
  B2 ──────────→ B6
  B3 ──────────→ B6 ──→ B5
  B4 ──────────→ B6

Phase C (parallelizable within):
  B8 ──→ C1 ──→ C4
          C2 ──→ C4
          C3 ──→ C4

Phase D (sequential within):
  D1 ──→ D2
  D3 (independent)
  B8 ──→ D4
```

---

## Effort Estimates

| Task | Est. time | Risk |
|---|---|---|
| A1 | 30 min | Low |
| A2 | 45 min | Low |
| A3 | 20 min | Low |
| A4 | 45 min | Low |
| A5 | 45 min | Low |
| A6 | 30 min | Low |
| A7 | 30 min | Low |
| A8 | 30 min | Low |
| A9 | 30 min | Low |
| B1 | 30 min | Low |
| B2 | 10 min | None |
| B3 | 15 min | None |
| B4 | 15 min | None |
| B5 | 30 min | Low |
| B6 | 60 min | Medium |
| B7 | 45 min | Medium |
| B8 | 30 min | Low |
| C1 | 30 min | Low |
| C2 | 15 min | None |
| C3 | 10 min | None |
| C4 | 20 min | Low |
| D1 | 15 min | Low |
| D2 | 60 min | Medium |
| D3 | 30 min | Medium |
| D4 | 45 min | Medium |
| **Total A** | **~4.5 hrs** | |
| **Total B** | **~3.5 hrs** | |
| **Total C** | **~1.25 hrs** | |
| **Total D** | **~2.5 hrs** | |
| **Grand total** | **~11.75 hrs** | |

---

## Quick-Start: First 3 Tasks

If you want to start immediately, here are the first three independent
tasks (no dependencies, can run in parallel):

1. **A1** — Extract `computeStreak` to `convex/_lib/streak.ts`
2. **A4** — Create `convex/_lib/topicChain.ts` with `resolveTopicChain`
3. **A7** — Add hard caps to all `collect()` calls in `convex/dashboard.ts`

Run all three, then continue with their dependents (A2→A3, A5→A6, then
A8, then A9).
