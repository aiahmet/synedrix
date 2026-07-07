# Subject UX Improvement Plan

**Status:** Draft for implementation
**Owner:** App team
**Goal:** A user on any subject-related page should never wonder "what do I click next?" — every screen must point at one clear next action, and every dead-end must have a real exit.

---

## TL;DR

The current subject implementation is **architecturally complete** — there are real CTAs on every page, the next-best-topic algorithm works, and the data layer is solid. But the **CTAs are buried, the path forward is implicit, and three primary surfaces (user-created topics, tutor, in-progress sessions) are orphaned**.

This plan has **four phases, in priority order**:

1. **Tie the end of every action to the start of the next** (Resume card on dashboard, "After this topic" post-lesson CTA, prominent "Up next" on subject page, nav-link to `/my-topics`).
2. **Make the curriculum feel like a path, not a list** (visual chapter progression, current-chapter emphasis, mastery rings on subject cards, prerequisite banner instead of sidebar).
3. **Surface context the app already has** (recent activity strip, in-progress session indicator, tutor entry from every page, "Recently studied" quick links).
4. **Polish** (mark-as-mastered, difficulty legend, search, "what's new" feed).

Each phase ships behind the existing design system (`CockpitCard`, mono-uppercase labels, per-subject hue tokens). No new visual language is introduced — only the existing primitives are re-arranged for clarity.

---

## 1. Current State Analysis

### 1.1 Routes & their primary purpose

| Route | Server | Primary purpose | Primary CTA |
|---|---|---|---|
| `/dashboard` | `app/(app)/dashboard/page.tsx` | Cockpit overview | "Pick a topic" / "Browse subjects" (both → `/subjects`) |
| `/subjects` | `app/(app)/subjects/page.tsx` | Subject catalog | "Continue" / "Start first topic" / "Add subject" per card |
| `/subjects/[slug]` | `app/(app)/subjects/[slug]/page.tsx` | Subject detail | "Start a study session" + small "Up next" pill |
| `/subjects/[slug]/[chapterSlug]` | `app/(app)/subjects/[slug]/[chapterSlug]/page.tsx` | Chapter drilldown | Per-row "Start topic" / "Open lesson" |
| `/subjects/[slug]/[chapterSlug]/[topicSlug]` | `app/(app)/subjects/[slug]/[chapterSlug]/[topicSlug]/page.tsx` | Atomic topic page | "Start topic study session" + tabs + right-column widgets |
| `/tutor` | `app/(app)/tutor/page.tsx` | AI tutor | Composer (3-pane layout) |
| `/my-topics` | `app/(app)/my-topics/page.tsx` | User-created topics | "Open lesson" / "Start practice" per row |
| `/my-topics/[slug]/lesson` | `app/(app)/my-topics/[slug]/lesson/page.tsx` | Lesson view | "Start practice" |
| `/my-topics/[slug]/practice` | `app/(app)/my-topics/[slug]/practice/page.tsx` | Practice run | "Submit answer" → "Next question" / "Finish" |
| `/my-topics/[slug]/practice/results` | `app/(app)/my-topics/[slug]/practice/results/page.tsx` | Results | "Discuss with tutor" / "Run another practice" / "Back to lesson" |

### 1.2 Current flow diagram (canonical subjects)

```
                                  ┌──────────────────┐
                                  │   /dashboard     │
                                  │                  │
                                  │  CockpitStats    │
                                  │  SubjectMastery  │──┐
                                  │  Strip           │  │
                                  └────────┬─────────┘  │
                                           │            │
              ┌────────────────────────────┼────────────┘
              │                            │
              ▼                            ▼
       ┌──────────────┐            ┌────────────────┐
       │  /subjects   │            │  /subjects/    │
       │              │            │  [slug]        │
       │  SubjectCard │            │                │
       │  + filter    │            │  SubjectHeader │
       │  + sort      │            │  + small       │
       └──────┬───────┘            │  "Up next"     │
              │                    │  SubjectDetail │
              │                    │  Stats         │
              │                    │  ChapterList   │
              │                    └──────┬─────────┘
              │                           │
              │                           ▼
              │                    ┌────────────────────┐
              │                    │  /subjects/        │
              │                    │  [slug]/           │
              │                    │  [chapterSlug]     │
              │                    │                    │
              │                    │  ChapterHeader     │
              │                    │  TopicList         │
              │                    │  AddTopicForm      │
              │                    └──────┬─────────────┘
              │                           │
              │                           ▼
              │                    ┌────────────────────────┐
              │                    │  /subjects/[slug]/     │
              │                    │  [chapterSlug]/        │
              │                    │  [topicSlug]           │
              │                    │                        │
              │                    │  TopicHeader + Start   │
              │                    │  TopicObjectiveList    │
              │                    │  TopicDepthTabs        │
              │                    │  PracticeLauncher      │
              │                    │  FlashcardDeck         │
              │                    │  PrerequisiteStrip*    │  ← right column
              │                    │  NextBestTopicCard*    │  ← right column, below fold
              │                    │  AskTutorCta*          │  ← right column
              │                    └──────┬─────────────────┘
              │                           │
              │                           ▼
              │                    ┌────────────────────────┐
              │                    │  /tutor?subject=&topic=│
              │                    │                        │
              │                    │  3-pane layout         │
              │                    │  (history|chat|memory) │
              │                    └──────┬─────────────────┘
              │                           │
              │                           ▼
              │                       (no automatic
              │                        next step —
              │                        user must
              │                        navigate back)
              │
              └──── (no "back to dashboard" or "next topic"
                     shortcut from any of these routes)
```

### 1.3 What's already good

- **Atomic-topic page** is rich: objectives, 3-depth lesson tabs, common mistakes, formulas, vocabulary, canonical practice, flashcard deck, prerequisites, next-best, tutor entry.
- **Context-aware CTAs**: `SubjectCard` switches between "Continue" / "Start first topic" / "Add subject" based on enrollment + progress.
- **`recommendNextBest()` algorithm** in `convex/subjects.ts` correctly scores (1 − mastery) × examRelevance × recencyBoost.
- **Atomic empty states**: offline fallbacks, no-tenant fallbacks, "no topic matches" cards all have honest exits.
- **Convex reactivity** makes post-action UI updates instant (enroll, submit answer, start study session).

### 1.4 What's broken (UX-grade issues)

These are the gaps a new or returning user actually hits. Each is grounded in the current code; file paths are referenced.

#### Critical — block the learning flow

1. **No "Continue studying" CTA on `/dashboard`.** A returning user lands on the cockpit, sees stats, sees the SubjectMasteryStrip with progress bars, and... has no obvious next action. The `CockpitStatsRow` CTAs ("Pick a topic", "Browse subjects") both go to `/subjects` (catalog). The user has to scan the catalog to find what to resume. (File: `components/dashboard/CockpitStatsRow.tsx:48-52` and `:73-76`; `components/dashboard/SubjectMasteryStrip.tsx:78-89`.)

2. **"Up next" pill is small and easy to miss.** The `SubjectHeader` renders it as a small pill *inside* the description area, only when the user is enrolled. The student opening a subject for the first time never sees the system's "start here" recommendation prominently. (File: `components/dashboard/SubjectHeader.tsx:182-203`.)

3. **`NextBestTopicCard` is below the fold on the topic page.** The student reads a long lesson, scrolls past all the practice/flashcard cards, and the "what's next" CTA is in the right column, often after a prerequisite strip. The natural reading rhythm is lesson → next, but the UI puts next behind a sidebar. (File: `app/(app)/subjects/[slug]/[chapterSlug]/[topicSlug]/TopicDetailClient.tsx:108-122`.)

4. **Practice / Flashcards / Next Topic are sibling cards in a 2-column grid — no clear sequence.** The user just finished a lesson. What comes first: practice to consolidate, or flashcards to lock in terms, or jump to the next topic? The cards are equivalent-weight; nothing tells them the loop order. (File: same `TopicDetailClient.tsx:95-104`.)

5. **`/my-topics` (user-created topics) is unreachable from `/dashboard` and `/subjects`.** A student who authored a topic via `AddTopicForm` cannot find their topic again from the main UI. The only back-link is the breadcrumb on `/my-topics/[slug]/lesson`. The sidebar nav does not include it. (File: `app/(app)/layout.tsx:11-14`; `app/(app)/my-topics/page.tsx:6-12` empty state does have a "Browse subjects" button but the dashboard never links to /my-topics.)

#### Important — cause confusion

6. **Stats row CTAs are generic.** "Pick a topic", "Browse subjects", "Start a session" all link to the same `/subjects` route. The "Due today" stat does not link to a review queue. (File: `components/dashboard/CockpitStatsRow.tsx`.)

7. **Tutor is only reachable from the topic page or by direct URL.** A student confused at the chapter page has no "Ask the tutor" entry point. The "AskTutorCta" lives only on the topic detail. (File: `components/dashboard/AskTutorCta.tsx` is rendered solely from `TopicDetailClient.tsx`.)

8. **No "in-progress session" indicator.** If a student starts a tutor chat, navigates away, and returns, the tutor is "open" again via query params but no UI tells them they have an active session. Same for an in-progress practice run. (File: `app/(app)/tutor/page.tsx:31-34` accepts `?session=`; no global UI surfaces it.)

9. **No "recent activity" / "where you left off" strip.** The dashboard shows aggregate stats and per-subject mastery, but the user's last 1–2 actions are not surfaced. They have to remember what they were doing.

10. **`SubjectCard` lacks a visual mastery ring.** It has a 3px progress strip at the bottom (only on enrolled cards). The `MasteryRing` component exists and is used on `SubjectDetailStats` + `CockpitStatsRow` but not on the catalog cards. The catalog grid therefore does not "scream" progress at a glance. (File: `components/dashboard/SubjectCard.tsx:230-247`.)

11. **`ChapterList` is a flat numbered list, not a curriculum "path".** The chapters render in order, but there is no visual signal for "this is the chapter you're on" vs "this is done" vs "this is locked." A user opening a new subject sees 5–10 identical-looking rows. (File: `components/dashboard/ChapterList.tsx`.)

12. **Prerequisite lock is a sidebar hint.** If a topic is locked, the "Finish X first" hint is in the right column (`PrerequisiteStrip`). The student may have already started reading the lesson before noticing the lock. (File: `components/dashboard/PrerequisiteStrip.tsx:81-91`.)

13. **The `/tutor` page does not have a "back to lesson" button.** It has a 3-pane layout and a composer, but the only exit is the browser back button. (File: `app/(app)/tutor/TutorClient.tsx` — `fallbackLessonHref` is computed but only used as an error fallback in the `Composer`.)

#### Polish — nice to have

14. No "mark as mastered" / "skip topic" button. Students cannot say "I already know this" to skip ahead.
15. No difficulty / exam-relevance legend. The pills are unexplained to new users.
16. No search/filter on `/subjects` (only the chip-based filter).
17. No `/progress` page — students cannot see weekly/monthly activity.
18. No "what's new" feed.
19. No tutorial / first-run tooltip on the cockpit.
20. No keyboard shortcuts (e.g., `g s` to go to subjects, `g t` to go to tutor).

---

## 2. Implementation Plan

The plan is sequenced so each phase ships a coherent improvement. Each phase is independently demoable.

### Phase 1 — Connection clarity
**Goal:** A user on `/dashboard`, `/subjects`, `/subjects/[slug]`, or a topic page has ONE clear "next" CTA on screen at all times.

**Estimated scope:** 2–3 days, mostly client-side.

#### 1.1 `ContinueStudyingCard` on the dashboard

- **New file:** `components/dashboard/ContinueStudyingCard.tsx`
- **Logic:** Use the most recent `userTopicProgress.lastStudied` (already loaded in `convex/dashboard.ts` — see the `perTopicMastery` loop around line 152). Resolve the corresponding `topic` + `chapter` + `subject` rows, then render a `CockpitCard` with:
  - Subject color band + chapter + topic title
  - Last-studied relative date
  - Mastery percentage with `MasteryRing`
  - Two CTAs: "Continue" (primary, → `/subjects/[subject]/[chapter]/[topic]`) and "Discuss with tutor" (secondary, → `/tutor?subject=...&topic=...`).
- **Backing query:** Add a new Convex query `api.dashboard.getContinueStudying` that returns `{ subject, chapter, topic, lastStudied, mastery } | null`. Backed by the same `by_user` index already used in `getOverview`. This is a free read (no new schema).
- **Where it renders:** `app/(app)/dashboard/DashboardOverviewClient.tsx` — render above `CockpitStatsRow` (line 56-65) when not empty. When the cockpit is empty, do not show it (the `EmptySubjectsState` already serves first-time users).
- **Empty case:** When the user has no `lastStudied`, fall through to a "Start your first session" CTA linking to `/subjects` (already-implemented pattern).

#### 1.2 Promote "Up next" to a full-width banner on the subject page

- **Change:** In `app/(app)/subjects/[slug]/SubjectDetailClient.tsx`, render a new `UpNextBanner` card directly between the `SubjectHeader` and `SubjectDetailStats` (around line 53-58). The banner uses the `data.nextBest` field already returned by `api.subjects.getBySlug`.
- **Reuse:** The visual language should be the same as `NextBestTopicCard` (`components/dashboard/NextBestTopicCard.tsx:48-110`), but stretched to a full-width banner with a stronger CTA ("Start here" instead of "Continue next").
- **Keep:** The pill inside `SubjectHeader` becomes a redundant signal — remove it. The pill-vs-banner decision is unambiguous: when the system knows what to do next, that should be a hero CTA, not a label. (Confirms the thinker's recommendation.)
- **Empty case:** When the subject has no next-best, render a quiet "You've finished every topic in this subject — explore another." card with a link to `/subjects`.

#### 1.3 Post-lesson "After this topic" CTA on the topic page

- **Change:** In `app/(app)/subjects/[slug]/[chapterSlug]/[topicSlug]/TopicDetailClient.tsx`, move `NextBestTopicCard` out of the right-column `lg:col-span-3` sidebar (line 119) and render it as a full-width card *after* the lesson block + practice + flashcard cards but *before* the closing div. Put it in the main column (span 2 of the lg grid) under the `CommonMistakesPanel` and the practice/flashcard cards. The reading order becomes: lesson → practice → flashcards → "What's next".
- **New visual emphasis:** Add a small "After this topic" eyebrow + an arrow icon to the card so the user understands the sequence. Reuse the existing `NextBestTopicCard` component but with a `variant="post-lesson"` prop that stretches the layout and changes the label.
- **Empty case:** Already handled — when `nextBest` is null, the card renders an empty state (see `NextBestTopicCard.tsx:35-47`).

#### 1.4 Add "Your topics" to the main app navigation

- **Change:** In `app/(app)/layout.tsx`, the `navItems` array (line 11-14) currently has three items: `/dashboard`, `/subjects`, `/tutor`. Add a fourth:
  ```ts
  { href: "/my-topics", label: "Your topics", Icon: UserCircle }
  ```
  (`UserCircle` is already used in `components/dashboard/TopicList.tsx:8` for the same semantic.)
- **Trade-off considered:** Adding a 4th item makes the mobile bottom bar slightly tighter (4 tabs instead of 3). The mobile bar already uses `min-w-[64px]` per item, so 4 items still fit a 320px viewport. The desktop sidebar at `w-56` (224px) accommodates 4 items comfortably.
- **Alternative considered (rejected):** Merge user topics into the `/subjects` catalog with a "My topics" filter chip. Rejected because user topics are a *separate* data domain (decision D1 in `docs/USER-TOPIC-LESSON-PLAN.md`): they live in the same `topics` table but with a different lifecycle (authored, regenerated, owned). Mixing them in the catalog would dilute the canonical curriculum and require teaching the user which is which.

#### 1.5 "Discuss with tutor" exit on `/tutor`

- **Change:** In `app/(app)/tutor/TutorClient.tsx`, the composer has a `fallbackLessonHref` (line 386) but it is only used as an error-state CTA. Add a persistent "Back to lesson" button in the `SessionHeader` (file: `components/tutor/SessionHeader.tsx` — needs audit; see also `MemoryPanel.tsx`) when the tutor was opened with a `?topic=` param. The button is a `<Link href={fallbackLessonHref}>` with a left-arrow icon, placed in the header's right side.
- **Audit needed:** Read `components/tutor/SessionHeader.tsx` to confirm the header layout supports an additional link without breaking the existing focus/elapsed-time UI.

### Phase 2 — Visual curriculum
**Goal:** The user opens a subject and sees a *path*, not a *list*. The current chapter is visually distinct. The next chapter is obvious.

**Estimated scope:** 3–4 days, mostly visual.

#### 2.1 Mastery ring on `SubjectCard`

- **Change:** In `components/dashboard/SubjectCard.tsx`, add a `MasteryRing` (already imported-able, see `components/dashboard/MasteryRing.tsx`) to the top-right of the card body for enrolled cards. Replace or augment the 3px bottom strip (line 230-247) with the ring. Keep the strip if the design feels naked without it; the ring is the primary signal, the strip is the secondary fill.
- **Where:** In the top-row of the card (line 130-149), next to the title. For enrolled cards only — non-enrolled cards keep their current layout.

#### 2.2 Chapter path visualization on the subject page

- **Change:** Replace the flat `ChapterList` rendering in `app/(app)/subjects/[slug]/SubjectDetailClient.tsx` with a new `ChapterPath` component that:
  - Renders chapters as a vertical sequence of numbered nodes connected by a vertical "progress" line.
  - Each node shows the chapter title, a `MasteryRing`, the topics-touched progress, and a "Continue" or "Start" CTA.
  - The current chapter (the one containing the user's most-recently-studied topic) is visually distinct: elevated surface, accent ring, "Current" eyebrow.
  - Future chapters are dimmed (lower opacity, lock icon if prerequisites aren't met).
  - Completed chapters (all topics ≥ 85% mastery) get a check icon.
- **New file:** `components/dashboard/ChapterPath.tsx`
- **Replace:** `ChapterList` is removed from the subject page rendering (or kept for a "View as list" toggle).
- **Server data:** Already returned by `api.subjects.getBySlug` — `data.chapters` (line 56 of `SubjectDetailClient.tsx`) carries `topicCount`, `topicsStudied`, `mastery`, `lastStudiedAt` per chapter. No Convex change needed.

#### 2.3 Prerequisite lock as a top-of-page banner

- **Change:** In `app/(app)/subjects/[slug]/[chapterSlug]/[topicSlug]/TopicDetailClient.tsx`, detect when any prerequisite has `unlocked === false` (data is already in `data.prerequisites` at line 116). When detected, render a `<Banner variant="locked">` component at the very top of the page, above the `TopicHeader`. The banner:
  - Says "Locked — finish X first" with the locked prereq title as a link.
  - Uses the `subject-french` hue (red) to signal "do not proceed."
  - Disables the "Start topic study session" CTA (replaces it with "Finish prereq first").
- **Keep:** The `PrerequisiteStrip` in the right column remains as the long-form list.

#### 2.4 Inline tutor entry from chapter + subject pages

- **Change:** Create a reusable `AskTutorCta` variant that does not require a `topicSlug` (only `subjectSlug`). Render it on:
  - `app/(app)/subjects/[slug]/SubjectDetailClient.tsx` — below the stats row.
  - `app/(app)/subjects/[slug]/[chapterSlug]/ChapterDetailClient.tsx` — below the topic list.
- **Reuse:** The existing `AskTutorCta` component (`components/dashboard/AskTutorCta.tsx`) takes a `subject` and an optional `topic` prop. The composer already URL-builds `/tutor?subject=...&topic=...`. When `topic` is null, it should pre-fill `?subject=...` and the tutor falls through to the subject-only thread (already supported by `app/(app)/tutor/page.tsx:43-44`).
- **Subject-only mode:** Update `AskTutorCta` to render a "Discuss the whole subject" copy variant when `topic` is null.

### Phase 3 — Context-aware recommendations
**Goal:** The app remembers what the user was doing and surfaces the resume CTA on every page they land on.

**Estimated scope:** 3–4 days.

#### 3.1 In-progress session indicator in the layout nav

- **New Convex query:** `api.studySessions.getActiveForCurrentUser` — returns the most recent in-progress study session (status === "in_progress") and the most recent in-progress `topicLessonPractice` run, or null/null.
- **New file:** `components/layout/ActiveSessionIndicator.tsx`
- **Render:** In `app/(app)/layout.tsx`, mount the indicator in the desktop top bar (line 117-129) and the mobile bottom bar (line 152-189). When active sessions exist, render a pulsing dot + "Resume" link. When none, render nothing.
- **No new schema:** All data is derived from existing tables.

#### 3.2 Recent activity strip on the dashboard

- **New Convex query:** `api.dashboard.getRecentActivity` — returns the last 5 user actions in a single response: completed study sessions, finished practice runs, last message in any tutor thread. Each with a timestamp + a deep link.
- **New file:** `components/dashboard/RecentActivityStrip.tsx`
- **Render:** On `/dashboard`, below the `SubjectMasteryStrip`. Each item is a clickable row with an icon, the action label, the subject context, and a relative date. "Open" goes to the deep link.
- **Empty case:** If the user has < 1 action, render nothing (the empty cockpit already has its own state).

#### 3.3 "Recently studied" quick links on the subject page

- **Change:** In `app/(app)/subjects/[slug]/SubjectDetailClient.tsx`, add a `RecentlyStudiedStrip` between the `UpNextBanner` (Phase 1.2) and `ChapterPath` (Phase 2.2). It shows the last 3 topics the user studied in *this* subject, with a mastery ring per topic. Each is a `<Link>` to the topic page.
- **Backing query:** Add a new Convex query `api.subjects.getRecentlyStudiedTopicsInSubject` that returns the last N `userTopicProgress` rows for the user, filtered to topics in this subject, with topic + chapter metadata joined. The data is already in the existing queries; this is a small derived view.

#### 3.4 "View your topics" link on the dashboard

- **Change:** In `app/(app)/dashboard/DashboardOverviewClient.tsx`, after the `SubjectMasteryStrip` (or, if no enrollments, in the `EmptySubjectsState`), render a small `<Link href="/my-topics">` chip: "View your authored topics →". Visible only when the user has at least one user-created topic.
- **Backing query:** Reuse `api.topics.listUserTopicsByOwner` (already implemented in `convex/topics.ts:355`) and check `length > 0`. If so, show the link.

### Phase 4 — Polish
**Goal:** Small details that make the loop feel tight.

**Estimated scope:** 2–3 days.

#### 4.1 "Mark as mastered" + "Skip" actions on the topic page

- **Change:** Add a small action group to the `TopicHeader` (`components/dashboard/TopicHeader.tsx`) next to the "Start topic study session" CTA:
  - "Mark as mastered" → calls a new Convex mutation `api.topics.markMastered` that upserts `userTopicProgress` with `mastery = 1.0` for this topic.
  - "Skip" → routes to `NextBestTopicCard`'s target (or `/subjects` if none).
- **Confirmation:** Both actions show a quick "Are you sure?" inline state before firing.

#### 4.2 Difficulty / exam-relevance legend

- **New file:** `components/dashboard/LegendTooltip.tsx`
- **Render:** A small `ⓘ` icon next to the "Topics" header on `ChapterList` / `ChapterPath`. Hover reveals a 3-line legend explaining EASY/MEDIUM/HARD and the "High yield" / "Core" / "Optional" labels.

#### 4.3 Search across subjects + topics

- **New file:** `components/dashboard/SubjectsSearch.tsx`
- **Where:** Above the `SubjectsGrid` (`components/dashboard/SubjectsGrid.tsx:60-69`). Adds a `<input>` that filters the visible cards by title + slug in real time (no Convex round-trip).
- **Phase 2 / 3 follow-up:** If the user has many topics, extend the search to filter topic lists in `ChapterList` / `ChapterPath`.

#### 4.4 "What's new" feed

- **New Convex query:** `api.telemetry.getRecentSystemUpdates` — returns the last 3 `aiGenerations` rows that resulted in lesson regeneration or new topic creation, scoped to the user. Each row has a "What's new" string.
- **Render:** On `/dashboard`, in a small `WhatsNewStrip` below the `RecentActivityStrip`. When the user has no recent activity, the strip is hidden.

---

## 3. File-by-File Changes

| File | Phase | Change |
|---|---|---|
| `app/(app)/dashboard/page.tsx` | 1, 3 | Preload `getContinueStudying` + `getRecentActivity` + `getRecentSystemUpdates` |
| `app/(app)/dashboard/DashboardOverviewClient.tsx` | 1, 3 | Render `ContinueStudyingCard`, `RecentActivityStrip`, `WhatsNewStrip`, "View your topics" link |
| `app/(app)/layout.tsx` | 1, 3 | Add `/my-topics` to `navItems`; mount `ActiveSessionIndicator` in top + bottom bars |
| `app/(app)/subjects/SubjectsClient.tsx` | 4 | Pass search filter into `SubjectsGrid` |
| `app/(app)/subjects/[slug]/page.tsx` | 1, 2, 3 | Preload `getRecentlyStudiedTopicsInSubject` |
| `app/(app)/subjects/[slug]/SubjectDetailClient.tsx` | 1, 2, 3 | Insert `UpNextBanner` after `SubjectHeader`; replace `ChapterList` with `ChapterPath`; insert `RecentlyStudiedStrip`; render subject-only `AskTutorCta` |
| `app/(app)/subjects/[slug]/[chapterSlug]/ChapterDetailClient.tsx` | 2 | Render subject-only `AskTutorCta` below `TopicList` |
| `app/(app)/subjects/[slug]/[chapterSlug]/[topicSlug]/page.tsx` | — | No change (preload remains the same) |
| `app/(app)/subjects/[slug]/[chapterSlug]/[topicSlug]/TopicDetailClient.tsx` | 1, 2 | Move `NextBestTopicCard` to main column under practice/flashcards; render prerequisite lock banner at top |
| `app/(app)/tutor/TutorClient.tsx` | 1 | Pass `fallbackLessonHref` into `SessionHeader`; render a "Back to lesson" link when `topic` is non-null |
| `app/(app)/tutor/page.tsx` | 1 | No change — query params already support the back-link |
| `components/dashboard/ContinueStudyingCard.tsx` | 1 | **NEW** |
| `components/dashboard/UpNextBanner.tsx` | 1 | **NEW** — full-width variant of `NextBestTopicCard` |
| `components/dashboard/ChapterPath.tsx` | 2 | **NEW** — replaces `ChapterList` on subject page |
| `components/dashboard/AskTutorCta.tsx` | 2 | Add `subjectOnly` mode (no `topic` prop) |
| `components/dashboard/SubjectCard.tsx` | 2 | Add `MasteryRing` for enrolled cards |
| `components/dashboard/TopicHeader.tsx` | 4 | Add "Mark as mastered" + "Skip" action group |
| `components/dashboard/SubjectsGrid.tsx` | 4 | Wire `SubjectsSearch` input |
| `components/dashboard/SubjectsSearch.tsx` | 4 | **NEW** |
| `components/dashboard/RecentActivityStrip.tsx` | 3 | **NEW** |
| `components/dashboard/WhatsNewStrip.tsx` | 4 | **NEW** |
| `components/dashboard/RecentlyStudiedStrip.tsx` | 3 | **NEW** |
| `components/dashboard/LegendTooltip.tsx` | 4 | **NEW** |
| `components/dashboard/NextBestTopicCard.tsx` | 1 | Add `variant` prop (`"default" | "post-lesson" | "up-next-banner"`) |
| `components/layout/ActiveSessionIndicator.tsx` | 3 | **NEW** |
| `components/tutor/SessionHeader.tsx` | 1 | Render a "Back to lesson" link when `fallbackLessonHref` is non-null |
| `components/tutor/MemoryPanel.tsx` | 1 | Audit; possibly add the same "Back to lesson" link |
| `convex/dashboard.ts` | 1, 3 | Add `getContinueStudying`; add `getRecentActivity` |
| `convex/studySessions.ts` | 3 | Add `getActiveForCurrentUser` |
| `convex/subjects.ts` | 3 | Add `getRecentlyStudiedTopicsInSubject` |
| `convex/telemetry.ts` | 4 | Add `getRecentSystemUpdates` |
| `convex/topics.ts` | 4 | Add `markMastered` mutation |

No schema changes are required. All new queries are derived from existing tables. `markMastered` is a small mutation on `userTopicProgress` that the schema already supports.

---

## 4. Sequencing & Dependencies

```
Phase 1 (2-3 days)
  ├─ 1.1 ContinueStudyingCard  ──┐
  ├─ 1.2 UpNextBanner            │
  ├─ 1.3 Post-lesson CTA         │  All independent
  ├─ 1.4 My topics nav           │
  └─ 1.5 Back-to-lesson on tutor ┘

Phase 2 (3-4 days)
  ├─ 2.1 Mastery ring on card    ──┐
  ├─ 2.2 ChapterPath              │  2.1 + 2.2 ship together
  ├─ 2.3 Prerequisite banner      │  Independent
  └─ 2.4 Inline tutor entry       ┘  Independent

Phase 3 (3-4 days)
  ├─ 3.1 Active session indicator ──┐
  ├─ 3.2 Recent activity strip     │  Independent
  ├─ 3.3 Recently studied on subject│  Independent
  └─ 3.4 View-your-topics link     ┘  Independent

Phase 4 (2-3 days)
  ├─ 4.1 Mark as mastered
  ├─ 4.2 Difficulty legend
  ├─ 4.3 Search
  └─ 4.4 What's new feed
```

**Phases 1 and 2 are user-visible UX wins.** Phase 3 is the "the app remembers" layer. Phase 4 is polish. Each phase is independently demoable to stakeholders.

**Phases can overlap:** Phase 1's 1.1 + 1.3 can ship in one PR (they touch different files). Phase 2.2 is the largest single piece of work; start it last in the phase.

---

## 5. Success Metrics

The plan succeeds if the following metrics move in the expected direction over a 4-week post-launch window. Each is measurable from existing Convex tables or PostHog-style events (no new telemetry required for Phase 1-2).

| Metric | Source | Pre-plan baseline | Target |
|---|---|---|---|
| **Subject detail → topic click-through rate** | `page_view` events on `/subjects/[slug]/[chapterSlug]/[topicSlug]` vs `/subjects/[slug]` | Baseline (capture) | +25% |
| **Dashboard → topic click-through rate** | Same, vs `/dashboard` | Baseline | +40% (the resume card is the primary lever here) |
| **Tutor session starts from topic page** | `studySessions.start` events with `topicId !== null` | Baseline | +15% (post-lesson CTA + inline tutor entry) |
| **User-created topic return visits** | Sessions on `/my-topics` and `/my-topics/[slug]/*` from returning users | Baseline | +50% (visibility via nav + dashboard link) |
| **Time from sign-in to first lesson read** | `studySessions.start` timestamp − `clerk.session.start` | Baseline | −20% (resume CTA cuts the scan-the-catalog time) |
| **Practice runs started from topic page** | `topicLessonPractice` rows where the `topicId` matches a `topics` row the user just visited | Baseline | +30% (post-lesson practice emphasis) |
| **% of sessions that complete a chapter in one sitting** | `userTopicProgress` rows with `lastStudied` within the same day as the chapter's first topic | Baseline | +20% (chapter path visualization makes the chunk visible) |

Qualitative signals to watch (manual review, not automated):

- "I didn't know I had authored topics" — should drop to zero after Phase 1.4.
- "I forget which subject I was studying" — should drop to zero after Phase 1.1.
- "I never know what to click" — measure via onboarding survey after Phase 2.

---

## 6. Out of scope (for this plan)

These are real improvements but are intentionally deferred. Each has its own design discussion; mixing them in would dilute the focus on "what do I click next?"

- **Review queue / spaced-repetition UI.** The schema has `flashcardReviews` + `dueAt` indexes; the dashboard "Due today" stat reads from this table. But there is no `/review` page yet. Build that as a separate workstream. When it exists, the dashboard's "Due today" card should link directly to it (and a `/review` nav item).
- **Weekly / monthly progress charts.** A `/progress` page is a great surface but is a separate product. The `getRecentActivity` query (Phase 3.2) is a stepping stone.
- **Onboarding tooltip tour.** A coach-mark tour on first dashboard visit would help, but a permanent UX fix is better than a one-time tour.
- **Keyboard shortcuts.** Power-user feature, no UX blocker.
- **Social / multi-user.** Synedrix is single-user; the schema supports `ParentObserver` and `Tutor` roles but no UI for them.

---

## 7. Open questions for the team

1. **Should "Up next" be a CTA on the chapter page too?** The current plan only adds it to the subject page. Adding it to the chapter page would create redundancy with the per-row "Start topic" CTAs. **Recommendation:** Defer; revisit after Phase 2.2 (ChapterPath) ships.
2. **Should the tutor live as a slide-over panel?** A slide-over Claude-style pattern would keep the lesson visible while chatting. **Recommendation:** Out of scope for this plan; would require a layout-level shell change. Strengthen the route + back-link instead.
3. **What's the right "Skip" behavior?** A skipped topic should be soft-marked (mastery = 0, but `skipCount > 0` so the algorithm learns). **Recommendation:** Phase 4.1 ships a simple "Skip → go to next-best" with no telemetry. The `skipCount` enhancement is a future plan.
4. **Should `ContinueStudyingCard` be hidden on `/tutor`?** A student in the middle of a tutor chat does not need a "continue studying" CTA — they're already studying. **Recommendation:** Yes, hide on `/tutor`. The `ActiveSessionIndicator` (Phase 3.1) replaces it.

---

## 8. Appendix — Reading the code

Quick map of where each gap lives in the codebase:

- **Dashboard:** `app/(app)/dashboard/{page,DashboardOverviewClient}.tsx`, `components/dashboard/{CockpitStatsRow,SubjectMasteryStrip,EmptySubjectsState,AvailableSubjectStrip}.tsx`, `convex/dashboard.ts`
- **Subject list:** `app/(app)/subjects/{page,SubjectsClient}.tsx`, `components/dashboard/{SubjectsGrid,SubjectCard}.tsx`, `convex/subjects.ts:list`
- **Subject detail:** `app/(app)/subjects/[slug]/{page,SubjectDetailClient}.tsx`, `components/dashboard/{SubjectHeader,SubjectDetailStats,ChapterList}.tsx`, `convex/subjects.ts:getBySlug`
- **Chapter detail:** `app/(app)/subjects/[slug]/[chapterSlug]/{page,ChapterDetailClient}.tsx`, `components/dashboard/{ChapterHeader,TopicList,AddTopicForm}.tsx`, `convex/subjects.ts:getChapterBySlug`
- **Topic detail:** `app/(app)/subjects/[slug]/[chapterSlug]/[topicSlug]/{page,TopicDetailClient}.tsx`, `components/dashboard/{TopicHeader,TopicObjectiveList,TopicDepthTabs,PrerequisiteStrip,CommonMistakesPanel,NextBestTopicCard,AskTutorCta,TopicFormulaSheet,TopicVocabularyDeck,CanonicalPracticeLauncher,CanonicalFlashcardDeck,LessonWorkedExamples}.tsx`, `convex/subjects.ts:getTopicDetailBySlug`
- **Tutor:** `app/(app)/tutor/{page,TutorClient}.tsx`, `components/tutor/{SessionHeader,HistoryPanel,MemoryPanel,Composer,MessageList,ReasoningPart,MessageActions,StreamingIndicator,SuggestionDock}.tsx`, `api/tutor/chat/route.ts`, `convex/{tutor,tutorContext,tutorMemory}.ts`
- **My topics:** `app/(app)/my-topics/{page,layout}.tsx`, `app/(app)/my-topics/[topicSlug]/{lesson,practice,practice/results}/*`, `convex/{topics,practice}.ts`
- **Layout / nav:** `app/(app)/layout.tsx`, `proxy.ts`
- **Existing planning docs:** `docs/SUBJECT-IMPROVEMENT-PLAN.md` (subject surface), `docs/USER-TOPIC-LESSON-PLAN.md` (user topics), `docs/PHASE-2-CORE-LOOP.md` (core learning loop), `docs/PHASE-3-INTELLIGENCE.md` (AI tutor), `docs/PHASE-4-POLISH.md` (ship polish). This plan complements those, not replaces them.
