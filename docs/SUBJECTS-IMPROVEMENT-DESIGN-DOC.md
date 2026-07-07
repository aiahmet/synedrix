# Subjects Catalog & Subject Hub Improvement Design Doc

> Status: proposal
> Target: Synedrix Subjects surface (`/subjects`, `/subjects/[slug]`, `/subjects/[slug]/[chapterSlug]`, `/subjects/[slug]/[chapterSlug]/[topicSlug]`, and sub-pages)
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

The Subjects surface is the largest feature area in the app, spanning **10 routes** and **25+ components**:

| Layer | Files | Lines | Responsibility |
|---|---|---|---|
| **Catalog page** | `app/(app)/subjects/page.tsx` | ~110 | Server preloading, auth gate, German labels |
| | `app/(app)/subjects/SubjectsClient.tsx` | ~30 | Thin client island → `SubjectsGrid` |
| **Subject hub** | `app/(app)/subjects/[slug]/page.tsx` | ~80 | Server preloading `getHub`, offline fallback |
| | `app/(app)/subjects/[slug]/SubjectHubClient.tsx` | ~130 | Orchestrates 10+ sub-components, confidence chart mapping |
| **Chapter page** | `app/(app)/subjects/[slug]/[chapterSlug]/page.tsx` | ~110 | Server preloading, offline fallback |
| | `app/(app)/subjects/[slug]/[chapterSlug]/ChapterDetailClient.tsx` | ~100 | Topic list, add topic form, next best, ask tutor |
| **Topic page** | `app/(app)/subjects/[slug]/[chapterSlug]/[topicSlug]/page.tsx` | ~130 | Server preloading, offline fallback |
| | `app/(app)/subjects/[slug]/[chapterSlug]/[topicSlug]/TopicDetailClient.tsx` | ~190 | 20+ components, prerequisite lock, tutor sheet |
| **Sub-pages** | `notes/`, `roadmap/`, `tests/`, `practice/`, `review/` | ~50 each | Thin shells → client islands |
| **Components** | `components/dashboard/` (25 files) | ~3,500 | SubjectGrid, SubjectCard, SubjectHeader, SubjectRoadmap, SubjectDetailStats, ChapterHeader, ChapterList, TopicList, TopicHeader, TopicDepthTabs, TopicObjectiveList, TopicNotesPanel, TopicTutorSheet, TopicFormulaSheet, TopicVocabularyDeck, CanonicalPracticeLauncher, CanonicalFlashcardDeck, ConfidenceSlider, CommonMistakesPanel, PrerequisiteStrip, DependedOnByStrip, MiniMasteryCheck, NextBestTopicCard, AskTutorCta, InlinePracticeGenerator, etc. |
| **Convex backend** | `convex/subjects.ts` | ~2,250 | `list`, `getBySlug`, `getHub`, `getChapterBySlug`, `getTopicBySlug`, `getTopicDetailBySlug`, `getRecentlyStudiedTopicsInSubject`, `getDependedOnBy`, `getTopicById`, `enroll`, `leave`, `migrateIconSlugs` |

### 1.2 Key Architectural Problems

#### Problem 1: Monolithic `convex/subjects.ts` (~2,250 lines)

This single file contains 12 exports and is the largest file in the entire project. It mixes four distinct domains:
- **Catalog queries** (`list`, `getBySlug`, `getHub`)
- **Drilldown queries** (`getChapterBySlug`, `getTopicBySlug`, `getTopicDetailBySlug`)
- **Related data queries** (`getRecentlyStudiedTopicsInSubject`, `getDependedOnBy`, `getTopicById`)
- **Mutations** (`enroll`, `leave`, `migrateIconSlugs`)

**Solution: Split into focused modules.**

```
convex/subjects.ts (~400 lines)         → list, getBySlug, enroll, leave, migrateIconSlugs
convex/subjectHub.ts (~600 lines)       → getHub (already the biggest single query)
convex/chapters.ts (~300 lines)         → getChapterBySlug + chapter aggregate helpers
convex/topicDetail.ts (~500 lines)      → getTopicDetailBySlug, getRecentlyStudiedTopicsInSubject
convex/topicGraph.ts (~200 lines)       → getDependedOnBy, getTopicById, prerequisite resolution helpers
convex/_lib/subjectAggregate.ts (~100)  → computeSubjectAggregate (shared helper)
```

#### Problem 2: `getHub` is a ~600-line Mega-Query

This single query loads: subject row, enrollment, all chapters, all topics per chapter, all prerequisite edges, all prerequisite topics/chapters/subjects, all user progress, all mistakes, all notes, all practice runs, per-run skill aggregation, foundations-to-fix analysis. That's **10+ sub-queries** in one handler.

**Solution: Split into focused queries + memoized helpers.**

The hub page renders 10+ components, each needing a different slice of data. Instead of one mega-query, provide focused queries that each component subscribes to independently:

```
Page preloads:
  preloadQuery(api.subjects.getBySlug, { slug })          → subject + enrollment + aggregate

Client subscribes:
  useQuery(api.subjectHub.getChapters, { subjectId })      → chapters with topics + prereqs
  useQuery(api.subjectHub.getFoundations, { subjectId })   → foundationsToFix
  useQuery(api.subjectHub.getRecentMistakes, { subjectId }) → recentMistakes
  useQuery(api.subjectHub.getSavedNotes, { subjectId })    → savedNotes
  useQuery(api.subjectHub.getPracticeRuns, { subjectId })  → practiceRuns + skills
  useQuery(api.subjects.getNextBest, { subjectId })        → nextBest recommendation
```

Each query has a `Suspense` boundary so the page renders progressively: header → stats → roadmap → panels. No single query blocks the entire page.

#### Problem 3: N+1 Prerequisite Resolution in `getTopicDetailBySlug`

For each prerequisite edge, `getTopicDetailBySlug` does 4 sequential `Promise.all` batches:
1. Fetch prerequisite topics
2. Fetch chapters for those topics
3. Fetch subjects for those chapters
4. Fetch user progress for those prerequisites

That's 4 network round-trips for data that can be fetched in 2 (topics + chapters in parallel, then subjects + progress in parallel from known IDs).

**Solution: Parallelize the independent batches.**

Since the prerequisite topic IDs are known after step 1, steps 2+3+4 can all run in parallel — they don't depend on each other:

```typescript
const prereqTopics = await Promise.all(edgeIds.map(id => ctx.db.get(id)));
const chapterIds = [...new Set(prereqTopics.filter(Boolean).map(t => t.chapterId))];
const subjectIds = [];

// Fetch chapters, subjects, AND progress in parallel
const [chapters, progress] = await Promise.all([
  Promise.all(chapterIds.map(id => ctx.db.get(id))),
  Promise.all(edgeIds.map(id => ctx.db.query("userTopicProgress").withIndex("by_user_topic", ...).first()))
]);

// Subjects from chapters (in-memory, no network)
for (const ch of chapters) if (ch) subjectIds.push(ch.subjectId);
const subjects = await Promise.all(subjectIds.map(id => ctx.db.get(id)));
```

#### Problem 4: German Labels Throughout

The subjects catalog and hub use a mix of German and English:
- "/ faecher" (German)
- "Wähle deine Fächer, {firstName}." (German)
- "Fächerkatalog ist nicht erreichbar" (German — offline fallback)
- "Zurück zum Cockpit" (German)
- But the subject hub, chapter page, and topic page are mostly English

**Solution: Standardize to English per the rest of the app.**

#### Problem 5: `getBySlug` and `getHub` Have Significant Overlap

Both return: subject + enrollment state + chapter list (with per-chapter topic counts, mastery, lastStudied) + aggregate + nextBest. `getHub` adds: per-topic prerequisites, foundationsToFix, recentMistakes, savedNotes, practiceRuns. The overlap means ~200 lines of duplicated aggregate computation.

**Solution: Extract shared aggregate computation into `_lib/subjectAggregate.ts`.**

After splitting per Problem 1, the shared helper is used by both `getBySlug` and `getHub`, eliminating the duplicate logic.

#### Problem 6: `TopicDetailClient` Imports 20+ Components

The topic detail page is the most visually dense page in the app with 18+ sub-components. The client island has no `Suspense` boundaries — all data must load before anything renders.

**Solution: Add `Suspense` boundaries around supplementary panels.**

The topic header + objectives + lesson blocks load first (critical path). Then:
- `<Suspense>` around prerequisite strip + depended-on-by
- `<Suspense>` around formula sheet + vocabulary deck (may not exist for all subjects)
- `<Suspense>` around practice launcher + flashcard deck
- `<Suspense>` around common mistakes + notes

#### Problem 7: `ChapterDetailClient` Uses Double-Bezel `color-mix` Anti-Pattern

The `ChapterOrSubjectNotFound` component still uses the legacy `rounded-2xl border border-border bg-surface-elevated p-1.5` double-bezel pattern with `color-mix` icon containers — the exact anti-pattern that was already removed from all other subject/chapter/topic fallbacks.

**Solution: Replace with `CockpitCard` + plain icon (matching all other fallbacks).**

---

### 2. Code Style Guidelines

### 2.1 Split `convex/subjects.ts`

See file split plan in Problem 1. Each new module:
- Has its own `_lib/` for internal helpers
- Exports only public queries/mutations
- Shares `_lib/subjectAggregate.ts` for the common computation

### 2.2 Standardize to English Labels

| Current (German) | Proposed (English) |
|---|---|
| `/ faecher` | `/ subjects` |
| `Wähle deine Fächer, {firstName}.` | `Choose your subjects, {firstName}.` |
| `Jedes Fach hier schaltet dieselben fünf Systeme frei...` | `Every subject unlocks the same five systems: curriculum, AI tutor, practice arena, review queue, and planner. Enroll once and the cockpit tracks the rest.` |
| `Zurück zum Cockpit` | `Back to cockpit` |
| `Fächerkatalog ist nicht erreichbar` | `Subject catalog is unreachable` |
| `Die Auswahl benötigt Convex...` | `The catalog needs Convex to load the curriculum. Start the dev server and the grid will appear here.` |
| `Öffne das Cockpit` | `Open cockpit` |

### 2.3 Remove Double-Bezel Anti-Pattern from `ChapterDetailClient`

Replace:
```tsx
<div className="rounded-2xl border border-border bg-surface-elevated p-1.5 shadow-[var(--shadow-soft)]">
  <div className="rounded-xl bg-background p-7 text-center sm:p-8">
    <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
      style={{ backgroundColor: "color-mix(in srgb, var(--subject-french) 12%, transparent)", ... }}>
      <Books className="h-5 w-5" weight="duotone" />
    </span>
    ...
```

With:
```tsx
<CockpitCard>
  <div className="flex flex-col items-center gap-3 py-10 text-center">
    <Books className="h-6 w-6" style={{ color: "var(--subject-french)" }} weight="duotone" />
    ...
```

### 2.4 Add `Suspense` Boundaries to Topic Page

```tsx
// TopicDetailClient.tsx
return (
  <div>
    <TopicHeader ... />
    <TopicObjectiveList ... />
    <TopicDepthTabs ... />
    
    <Suspense fallback={<SkeletonPanel />}>
      <div className="grid lg:grid-cols-3">
        <Suspense fallback={<SkeletonPanel />}>
          <PrerequisiteStrip ... />
          <DependedOnByStrip ... />
        </Suspense>
        <Suspense fallback={<SkeletonPanel />}>
          <FormulaSheet ... />
          <VocabularyDeck ... />
          <PracticeLauncher ... />
          <FlashcardDeck ... />
        </Suspense>
      </div>
    </Suspense>
    
    <Suspense fallback={<SkeletonPanel />}>
      <CommonMistakesPanel ... />
      <TopicNotesPanel ... />
    </Suspense>
  </div>
);
```

### 2.5 Extract Prerequisite Resolution Helper

Create `convex/_lib/prerequisiteChain.ts`:

```typescript
async function resolvePrerequisiteChain(
  ctx: QueryCtx,
  topicId: Id<"topics">,
  userId: Id<"users"> | null
): Promise<PrerequisiteInfo[]> {
  // Fetches edges → topics → chapters → subjects → progress
  // Returns resolved prerequisite objects with mastery + unlock state
}
```

Used by both `getTopicDetailBySlug` and `getHub`.

### 2.6 Consolidate `SubjectsGrid` + `SubjectsSearch` + `SubjectCard`

These three components work together on the catalog page. The `SubjectsGrid` handles both rendering AND filtering/sorting logic. Extract the filter logic into a `useSubjectFilters` hook:

```typescript
function useSubjectFilters(subjects: SubjectSummary[]) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "name" | "mastery">("recent");
  
  const filtered = useMemo(() => {
    let result = subjects.filter(s => s.title.toLowerCase().includes(search.toLowerCase()));
    // sort
    return result;
  }, [subjects, search, sortBy]);
  
  return { filtered, search, setSearch, sortBy, setSortBy };
}
```

---

## 3. Quality Constraints

### 3.1 Performance Budgets

| Metric | Target | Measurement |
|---|---|---|
| **Catalog first paint** | < 300ms | Preloaded `api.subjects.list` available on first render |
| **Subject hub first paint** | < 400ms | Preloaded `getBySlug` for header + aggregate |
| **Subject hub full page** | < 1.5s | After split queries: all panels render within 1.5s |
| **Chapter page first paint** | < 300ms | Preloaded `getChapterBySlug` |
| **Topic page first paint** | < 400ms | Preloaded `getTopicDetailBySlug` for critical path |
| **Topic page full page** | < 2.0s | After Suspense: supplementary panels load progressively |
| **Enrollment toggle** | < 100ms | `enroll` / `leave` mutation latency |

### 3.2 Query Latency Budgets (p95)

| Query | Budget | Notes |
|---|---|---|
| `subjects.list` | < 150ms | 3 batch scans + in-memory aggregation |
| `subjects.getBySlug` | < 150ms | Single slug lookup + chapter/topic batch + progress join |
| `subjectHub.getChapters` | < 200ms | Chapters + topics + prereqs per topic (after split) |
| `subjectHub.getFoundations` | < 100ms | In-memory analysis over pre-cached prerequisite data |
| `subjectHub.getRecentMistakes` | < 100ms | Indexed scan with take(15) |
| `subjectHub.getSavedNotes` | < 80ms | Indexed scan with take(20) |
| `subjectHub.getPracticeRuns` | < 150ms | Indexed scan + per-run skill aggregation |
| `chapters.getChapterBySlug` | < 100ms | Subject + chapter lookup + topic list + progress join |
| `topicDetail.getTopicDetailBySlug` | < 300ms | After prerequisite parallelization: 2 round-trips instead of 4 |
| `topicGraph.getDependedOnBy` | < 150ms | Prerequisite edge scan + topic/chapter/subject resolution |
| `subjects.getRecentlyStudiedTopicsInSubject` | < 150ms | Progress scan + topic/chapter join |

### 3.3 Caps on Unbounded Collects

| Location | Current | Cap |
|---|---|---|
| `subjects.list` — subjects | `.collect()` — no cap (finite: ~6 subjects) | Already bounded |
| `subjects.list` — chapters | `.collect()` — no cap (~30 chapters total) | Already bounded by small dataset |
| `subjects.list` — topics | `.collect()` — all topics | Already bounded |
| `getHub` — mistakes | `.take(200)` | Already capped |
| `getHub` — notes | `.take(100)` | Already capped |
| `getHub` — practice runs | `.take(100)` | Already capped |
| `getHub` — practice items per run | `.take(100)` | Already capped |
| `getHub` — mistakes output | `.slice(0, 15)` | Already capped |
| `getHub` — notes output | `.slice(0, 20)` | Already capped |
| `getHub` — runs output | `.slice(0, 10)` | Already capped |
| `getHub` — foundations | `.slice(0, 5)` | Already capped |
| `getRecentlyStudiedTopicsInSubject` — progress | None — capped at 500 in code | Add `.take(500)` on the index scan |
| `getTopicDetailBySlug` — lessonBlocks | `.collect()` per depth (3 queries) | Already bounded by seeded content |
| `getTopicDetailBySlug` — commonMistakes | `.collect()` → `.slice(0, 5)` | Add `.take(100)` before sort; current collect is unbounded |

### 3.4 Error States

| State | Visual | Action |
|---|---|---|
| **Catalog offline** | `CockpitCard` fallback with "unreachable" message | "Open cockpit" CTA → `/dashboard` |
| **Subject not found** | `CockpitCard` with "No subject called X" | "Back to subjects" CTA |
| **Chapter not found** | `CockpitCard` with "Could not load chapter" | "Back to subject" CTA |
| **Topic not found** | Double-bezel card → **replace with `CockpitCard`** | "Back to chapter" CTA |
| **Prerequisite locked** | PrerequisiteLockBanner (already exists) | Link to prerequisite topic |
| **Not enrolled** | Subject header shows "Enroll" CTA (already exists) | Click to enroll |

### 3.5 Progressive Loading for Topic Page

The topic page is the densest surface. After adding Suspense boundaries:

| Tier | Components | Load time |
|---|---|---|
| **T0** (critical) | TopicHeader, TopicObjectiveList, TopicDepthTabs | < 400ms (preloaded) |
| **T1** (sidebar) | PrerequisiteStrip, DependedOnByStrip, tutor CTAs | < 600ms |
| **T2** (resources) | FormulaSheet, VocabularyDeck, PracticeLauncher, FlashcardDeck | < 800ms |
| **T3** (supplementary) | CommonMistakesPanel, TopicNotesPanel, MiniMasteryCheck, NextBestTopicCard | < 1.2s |

---

## 4. Testing Strategy

### 4.1 Unit Tests (Vitest)

| Test file | What it covers |
|---|---|
| `convex/_lib/subjectAggregate.test.ts` | `computeSubjectAggregate` with various chapter/topic/progress combinations |
| `convex/_lib/prerequisiteChain.test.ts` | Prerequisite resolution: chain of 3 topics, cross-subject prerequisites, unlocked/locked thresholds |
| `convex/subjects.test.ts` | `list` (sorting: enrolled first, by enrolledAt, alphabetical), `enroll` (idempotent), `leave` (idempotent) |
| `convex/chapters.test.ts` | `getChapterBySlug` (topic ordering: canonical before user, exam relevance sort) |
| `convex/topicDetail.test.ts` | `getTopicDetailBySlug` (prerequisite resolution, missing topic, cross-chapter guard) |
| `src/lib/hooks/useSubjectFilters.test.ts` | Search, sort by name/mastery/recent, empty results |

### 4.2 Component Tests (React Testing Library)

| Test | What it verifies |
|---|---|
| `SubjectsGrid` renders all subjects | Cards for each subject, enrolled badge |
| `SubjectsGrid` filters by search | Typing filters to matching subjects only |
| `SubjectsSearch` updates parent state | onChange fires with search term |
| `SubjectCard` shows enroll button when not enrolled | "Enroll" CTA visible |
| `SubjectCard` shows enrolled state + mastery ring | Mastery ring + "Enrolled" badge visible |
| `SubjectHeader` renders title + description + enroll toggle | All elements present |
| `SubjectRoadmap` renders chapters with topics | Chapter headers, topic links within each |
| `TopicDepthTabs` switches depths | Click "rigorous" → rigorous content visible |
| `TopicObjectiveList` shows checkmarks at ≥0.6 mastery | Check icons on mastered objectives |
| `PrerequisiteStrip` shows lock icon for locked prereqs | Lock icon + muted styling |
| `CanonicalPracticeLauncher` links to practice | Correct href with topic slug |
| `ConfidenceSlider` updates on drag | Mutation called with new confidence value |
| `SubjectDetailStats` shows correct numbers | Mastery %, topics studied, last studied |

### 4.3 Manual QA Checklist

- [ ] Open `/subjects` — catalog renders with all subjects, enrolled first
- [ ] Type in search — list filters in real-time
- [ ] Click a subject card — navigates to subject hub
- [ ] Subject hub shows header + roadmap + stats + panels
- [ ] Subject hub shows "Enroll" CTA when not enrolled
- [ ] Click a chapter — chapter page shows topic list with mastery bars
- [ ] Click a topic — topic page shows lesson blocks with depth tabs
- [ ] Switch depth tabs — content changes to simple/standard/rigorous
- [ ] Prerequisite strip shows lock icon for locked topics
- [ ] Confidence slider updates (drag to new value)
- [ ] Canonical practice launcher links to `/practice?topicId=...`
- [ ] Flashcard deck renders with card count
- [ ] Click "Ask the tutor" — tutor sheet slides open
- [ ] Sub-pages (notes, roadmap, tests, practice, review) render correctly
- [ ] Dark mode — all components render legibly
- [ ] All labels are English (no German remnants)

---

## 5. Deployment Plan

### 5.1 Phase A: Split & Standardize (zero visual change)

| Step | What | Risk |
|---|---|---|
| **A1** | Split `convex/subjects.ts` into 5 modules per §1.2 Problem 1 | High — 12 exports, must maintain identical API surface |
| **A2** | Extract `_lib/subjectAggregate.ts` shared helper | Low — pure function extraction |
| **A3** | Extract `_lib/prerequisiteChain.ts` shared helper | Medium — used by both `getTopicDetailBySlug` and `getHub` |
| **A4** | Replace double-bezel `color-mix` anti-pattern in `ChapterDetailClient` | Low — visual only |
| **A5** | Standardize all German labels to English | Low — string changes only |
| **A6** | Extract `useSubjectFilters` hook from `SubjectsGrid` | Low — pure extraction |

**Validation:** Full QA checklist pass + `npm run typecheck` + `npm run test` after each step.

### 5.2 Phase B: Query Optimization & Progressive Loading

| Step | What | Risk |
|---|---|---|
| **B1** | Split `getHub` mega-query into focused queries per §1.2 Problem 2 | High — must maintain identical output across 6 queries |
| **B2** | Add `Suspense` boundaries to `SubjectHubClient` for progressive rendering | Medium — must not break layout |
| **B3** | Add `Suspense` boundaries to `TopicDetailClient` for progressive rendering | Medium — 4-tier loading strategy |
| **B4** | Parallelize prerequisite resolution in `getTopicDetailBySlug` | Medium — must verify prerequisite lock logic identical |
| **B5** | Add `.take()` caps where missing | Low |

**Validation:** Full QA checklist. Progressive loading visible in dev tools (Contentful Paint). Prerequisite lock logic unchanged.

### 5.3 Phase C: Sub-Page Polish

| Step | What | Risk |
|---|---|---|
| **C1** | Audit subject-level sub-pages (notes, roadmap, tests, practice) for consistency | Low |
| **C2** | Audit topic-level review page | Low |
| **C3** | Add loading skeletons to sub-pages that lack them | Low |
| **C4** | Dark mode audit of subject sub-pages | Low |
| **C5** | Mobile responsive audit of subject sub-pages | Low |

### 5.4 Phase D: Performance Hardening (deferrable)

| Step | What | Risk |
|---|---|---|
| **D1** | Add query latency telemetry to subject queries | Low |
| **D2** | Consider caching `getHub` chapter structure (chapters + topics with prereqs rarely change) | Medium — requires cache invalidation on new topics |
| **D3** | Consider preloading next-best topic recommendations | Low |

### 5.5 Feature Flag

Gate behind `NEXT_PUBLIC_SUBJECTS_V2`:

```typescript
const useV2 = process.env.NEXT_PUBLIC_SUBJECTS_V2 === "true";
if (useV2) return <SubjectHubPageV2 {...props} />;
return <SubjectHubPageV1 {...props} />;
```

### 5.6 Migration Strategy

| Migration | Approach | Rollback |
|---|---|---|
| Convex module split | New modules, old `subjects.ts` becomes re-export barrel, then remove barrel | Restore single file |
| `getHub` query split | New queries alongside old, V2 client uses new, remove old after verification | Revert to mega-query |
| German → English | String replacements | Revert strings |
| Double-bezel → CockpitCard | Component swap | Revert component |
