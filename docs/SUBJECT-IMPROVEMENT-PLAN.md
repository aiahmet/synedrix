# Subject Implementation Improvement Plan

Handoff document for the next agent. The goal is to harden
the Subject surface across the stack, fix a real icon
mapping bug that shipped in the onboarding redesign, and
elevate the per-subject UX from "clickable card" to
"glanceable, progress-aware cockpit tile".

## 0. Brief Inference (design-taste-frontend lens)

Reading this as: a per-subject UI overhaul for a
single-user German Gymnasium study OS, with a
Linear-style minimalist language leaning on Tailwind v4
utilities, Geist + Geist Mono, a single teal accent, and
6 categorical subject hues. The brand aesthetic is
"disciplined study cockpit" — calm, serious, compact, fast.

Dials:

- **DESIGN_VARIANCE: 6** — structured but not chaotic. Cards
  align on a 12-col grid, but per-card progress bars and
  mini meta strips create intentional offset.
- **MOTION_INTENSITY: 4** — restrained. Hover lift, accent
  stripe on select, page-transition stagger. No scroll
  hijacks.
- **VISUAL_DENSITY: 4** — between art-gallery and daily-app.
  One progress bar per card, one chip strip per card, no
  spec-sheet 10-row tables.

Anti-default rules to honor throughout this work:

- **Zero em-dashes (`—`)** in any new user-facing string.
- **No 3-equal feature cards** — SubjectsGrid already varies
  the card surface; keep that.
- **One shape system per surface** — keep the existing
  `rounded-2xl` card / `rounded-full` chip / `rounded-lg`
  button stack consistent.
- **One accent per page** — the teal `--accent` plus the
  subject's hue. No new accent colors.

## 1. Audit (current state, before changes)

### 1.1 Critical bugs

**B1. Broken icon mapping contract.** `convex/seed.ts`
writes the Phosphor component NAMES into the `subjects.icon`
field:

| Slug  | `icon` (seed)        | `SUBJECT_ICON_MAP` key |
|-------|----------------------|-----------------------|
| math  | `"MathOperations"`   | `"math"`              |
| physics | `"Infinity"`       | `"physics"`           |
| chemistry | `"Flask"`        | `"chemistry"`         |
| french | `"Quotes"`          | `"french"`            |
| german | `"Notebook"`       | `"german"`            |
| english | `"Brain"`         | `"english"`           |

The new `SUBJECT_ICON_MAP` in `components/landing/icons.ts`
keys on SLUGS. So `resolveSubjectIcon("MathOperations")`
returns `Books` (fallback) for every subject. The new
onboarding `SubjectOption` therefore renders the `Books`
glyph for every subject — defeating the redesign.

**Fix contract decision (locked in §2.1):** keys are SLUGS,
seed is rewritten to match. The map values are the
categorically-correct glyphs the onboarding redesign
intended (Calculator / Atom / Flask / Dna / BookOpen /
Scroll / Globe / Brain / PaintBrush / PianoKeys / Code).

**B2. Dashboard subject components never use the icon field.**
`SubjectCard`, `SubjectHeader`, `AvailableSubjectStrip`,
`SubjectMasteryStrip` all hardcode `<Books …/>` and never
read `subject.icon`. The per-subject glyph is invisible
across the entire dashboard surface.

### 1.2 Visual / UX gaps

| Gap | Where | What to do |
| --- | --- | --- |
| No per-card progress | `SubjectCard` | Add thin mastery bar + last-studied relative date |
| No chapter teaser | `SubjectCard` | Extend `api.subjects.list` to return top 3 chapters with per-chapter mastery |
| No sort | `SubjectsGrid` | Add sort: `recent` (default for enrolled), `mastery` (desc), `name` (asc) |
| No "pick up where you left off" CTA | `SubjectCard` | If `enrolled && topicsStudied > 0`, show "Continue" linking to the most recent touched topic; else "Start first topic" |
| Filter chips use mono labels with counts | `SubjectsGrid` | Already implemented correctly; keep as-is, just verify in dark mode |
| `description` is a single sentence in seed | `convex/seed.ts` | Add a 2nd `shortBlurb` (≤ 80 chars) used in chips/strips; keep the longer `description` for the detail page header |
| `color` and `icon` are loose strings | `convex/schema.ts` | Promote to documented enums via JSDoc; do not change the Convex validator (Convex unions are noisy for the seed) |
| `chapterCount` returns total chapters but never the per-chapter order | `convex/subjects.ts` `list` | Extend response to include `chapters: Array<{ id, slug, title, order, topicCount, mastery }>` (top 3 by `order`); full chapter list stays in `getBySlug` |

### 1.3 Surface inventory (the four subject surfaces)

- `components/dashboard/SubjectCard.tsx` — grid tile (the
  primary entry point)
- `components/dashboard/SubjectHeader.tsx` — detail page
  header (`/subjects/[slug]`)
- `components/dashboard/AvailableSubjectStrip.tsx` — empty
  cockpit picker
- `components/dashboard/SubjectMasteryStrip.tsx` — cockpit
  row
- `components/dashboard/SubjectsGrid.tsx` — owner of
  filter + sort state
- `components/onboarding/screens.tsx` `SubjectOption` — the
  onboarding subject picker (already uses
  `resolveSubjectIcon`, blocked by B1)

## 2. Phased Plan

### Phase 0 — Pre-flight (no visible change)

**0.1.** Verify `lib/utils/subjectColor.ts` vs
`src/lib/utils/subjectColor.ts` — both may exist; the
canonical one is `src/lib/utils/subjectColor.ts` (the import
alias `@/lib/utils/subjectColor` maps to that path). If the
stray `lib/utils/subjectColor.ts` exists, delete it to
avoid import resolution drift.

**0.2.** Read every subject-related file listed in §1.3
before touching any of them. Confirm the schema fields
`icon: v.optional(v.string())` and
`color: v.optional(v.string())` in `convex/schema.ts`
match the actual usage (yes, both are used as free-form
strings; do NOT change the validator — Convex unions add
friction in the seed for no benefit).

### Phase 1 — Fix the icon contract (B1)

**1.1.** In `convex/seed.ts`, change every `icon` value to
the slug that `SUBJECT_ICON_MAP` understands:

| Slug      | New `icon` value (slug) |
|-----------|------------------------|
| math      | `"math"`               |
| physics   | `"physics"`            |
| chemistry | `"chemistry"`          |
| french    | `"french"`             |
| german    | `"german"`             |
| english   | `"english"`            |

**1.2.** In `components/landing/icons.ts`, leave
`SUBJECT_ICON_MAP` as-is. The onboarding `SubjectOption`
already calls `resolveSubjectIcon(subject.icon)`. With the
seed rewritten, every subject renders the right glyph.

**1.3.** Migration: existing deployments have rows with
old icon values. Add a one-shot Convex mutation
`convex/subjects.ts` `migrateIconSlugs` that walks the
`subjects` table, maps each legacy value
(`MathOperations → math`, `Infinity → physics`,
`Flask → chemistry`, `Quotes → french`,
`Notebook → german`, `Brain → english`), and patches
the row. Idempotent: no-op when `icon` already matches
the slug map. Run once via `npx convex run
api.subjects.migrateIconSlugs` after deploy.

**1.4.** In `components/landing/icons.ts`, remove the
`as unknown as PhosphorIconComponent` casts by adding a
single `function asIcon(c: unknown): PhosphorIconComponent`
helper. Then `SUBJECT_ICON_MAP` reads as
`math: asIcon(CalculatorIcon)` — the unsafe cast is
grep-able in one place.

### Phase 2 — Use real icons across all subject surfaces (B2)

For each component in §1.3, replace the hardcoded `<Books
…/>` with `<Icon …/>` where `Icon = resolveSubjectIcon(
subject.icon)`. Concretely:

| File | Change |
| --- | --- |
| `components/dashboard/SubjectCard.tsx` | Add `const Icon = resolveSubjectIcon(subject.icon);` near `resolveColorVar`. Replace `<Books …/>` with `<Icon …/>`. Add a JSDoc comment that the icon prop is the slug from the seed. |
| `components/dashboard/SubjectHeader.tsx` | Same. |
| `components/dashboard/AvailableSubjectStrip.tsx` | Same. |
| `components/dashboard/SubjectMasteryStrip.tsx` | Same. |
| `components/dashboard/SubjectsGrid.tsx` | The grid does not render an icon directly. Verify the `SubjectCard` it renders does (yes, after the SubjectCard change). |

For the **type contract on `Icon` prop**: the
`resolveSubjectIcon` return type in
`components/landing/icons.ts` is
`PhosphorIconComponent` (a `React.ComponentType` with the
`weight` and `className` props). All four subject
components can declare `const Icon: PhosphorIconComponent
= resolveSubjectIcon(subject.icon)`. Import the type from
`@/components/landing/icons`.

### Phase 3 — Surface-level UX improvements (per the dials)

**3.1. SubjectCard** — add the following fields to the
backend response (see §3.4 for the Convex change) and the
following UI:

- `mastery: number` — render a 3px-tall accent bar at the
  bottom of the card, `width: ${pct}%`, fill via
  `subject.color` (not the global accent). This is the
  card's "progress strip" — single hairline, no text.
- `topicsStudied: number` — replace the existing flat
  `"X topics"` text with `"X / Y topics"` when
  `topicsStudied > 0`.
- `lastStudiedAt: number | null` — render as
  `formatRelativeDate(lastStudiedAt)` next to a tiny
  `CalendarBlank` icon, mono, `text-[11px]`, in the
  meta row. Only show when `lastStudiedAt` is set.
- `firstTopic: { slug: string; title: string; mastery:
  number }` (new field) — used for the bottom CTA. If
  `enrolled && topicsStudied > 0`, the CTA reads
  `"Continue"` and links to
  `/subjects/${slug}/${firstTopic.chapterSlug}/${firstTopic.slug}`.
  If `enrolled && topicsStudied === 0`, the CTA reads
  `"Start first topic"` and links to the same path. If
  `!enrolled`, the existing "Add subject" CTA stays.
- Hover lift (`-translate-y-0.5`) and accent shadow on
  hover — already present; keep. Add a
  `prefers-reduced-motion` guard to disable the
  translate on hover for `MOTION_INTENSITY > 3` users.

**3.2. SubjectHeader** — the detail page header. Add:

- Estimated time to mastery: a small chip below the
  description that reads `"~ Nh to mastery"` where N is
  computed as
  `(unmasteredTopics * avgMinutes) / 60`. The avg is the
  mean of the topic's `estimatedMinutes` field across
  the subject, fallback to 30 if missing.
- The "next-best" topic CTA: if a `nextBest` recommendation
  exists, surface a small "Up next" pill linking to it.
  Use the existing `NextBestTopicCard` design language
  (same border, same accent). If no nextBest, hide the
  pill.

**3.3. AvailableSubjectStrip** — already correct, just
swap the icon (Phase 2). Verify the row count text
("X topics") is left-aligned to the subject title in
`text-[12.5px]` per the current `Onboarding` design.

**3.4. SubjectsGrid** — add sort options:

- Default sort: `recent` for enrolled subjects, alpha for
  available. The backend's existing sort (enrolled-first
  by `enrolledAt desc`, then alpha) handles this; do NOT
  change the backend sort.
- Client-side sort dropdown above the filter chips: three
  options — "Recent", "Mastery", "Name". When "Mastery"
  is selected, sort enrolled subjects by `mastery desc`,
  available by alpha. When "Name", sort all alpha.
- The sort + filter is owned by `SubjectsGrid` as
  `useState`. Persist nothing to localStorage for now
  (out of scope).

**3.5. SubjectMasteryStrip** — the cockpit row. Verify the
mastery bar fill uses `subject.color` (already does via
`resolveColorVar`). Add the per-subject icon (Phase 2).
The strip is the glanceable companion to the grid; it
should not be redundant with the grid. Limit the strip
to enrolled subjects with `topicsTotal > 0` (the current
`hasTopics` guard). The "All" link in the header stays.

### Phase 4 — Backend response extensions

**4.1.** Extend `api.subjects.list` (in `convex/subjects.ts`)
to return, for each subject:

- `mastery: number` — mean mastery across the user's
  progress for that subject's topics. Mirror the
  `getBySlug` aggregate computation.
- `topicsStudied: number` — count of topics with a
  `userTopicProgress` row.
- `lastStudiedAt: number | null` — max
  `userTopicProgress.lastStudied` across that subject's
  topics, `null` if none.
- `firstTopic: { slug: string; chapterSlug: string; title:
  string; mastery: number } | null` — the first canonical
  topic in the first chapter (by `order` asc, then topic
  `examRelevance` desc). `null` if the subject has no
  chapters.

Keep the response shape backward-compatible: the new
fields are additive. Update the Convex validator to
include them.

**4.2.** Avoid N+1. The `list` query already does a
sequential `collect` over chapters + topics per subject.
For the new per-subject mastery + lastStudied + firstTopic
fields, batch the topic reads across all subjects in a
single fan-out (same pattern as `getBySlug`'s fan-out).
Aim for two extra `db.query` reads total, not N*2.

**4.3.** Add a helper `aggregateSubjectProgress(ctx, userId,
subjectId)` at the top of `convex/subjects.ts` that returns
`{ mastery, topicsStudied, lastStudiedAt, firstTopic }`.
`getBySlug` already aggregates per-chapter; refactor it to
use the same helper. This is the only place where the
"subject-level mastery" math lives.

### Phase 5 — `convex/seed.ts` and schema polish

**5.1.** Add `shortBlurb` to the subject seed: a 1-line
description, ≤ 80 chars, used in `AvailableSubjectStrip`
and `SubjectCard` chips. The existing `description` stays
on the detail page. Field is added to the canonical seed
shape `SubjectSeed` only — DO NOT add it to the Convex
schema (it's a UI concern, derive it from the seed tree).

Example rewrites:

- math: `"Step-by-step solving workspace, formula sheet."`
- physics: `"Concepts paired with formulas, unit-aware problems."`
- chemistry: `"Reaction drills, organic patterns, equation practice."`
- french: `"Vocabulary decks, grammar drills, text analysis."`
- german: `"Text annotation, characterization templates."`
- english: `"Reading comprehension, literary analysis, essays."`

**5.2.** Add the `migrateIconSlugs` mutation from §1.3.

**5.3.** JSDoc every Convex validator that exposes the
free-form `color` and `icon` fields, citing the slug
convention (`color ∈ { "math" | "physics" | "chemistry" |
"french" | "german" | "english" }`, `icon` matches the
canonical seed slug). Convex unions are not used — the
JSDoc is the contract.

### Phase 6 — Validation

After every phase, run in this order:

```bash
# Type check
cd C:/Users/Ittn/Documents/SaaS/synedrix/synedrix && npx tsc --noEmit
# (Pre-existing AddTopicForm.tsx error is unrelated and
#  expected; do not chase it.)
```

After Phase 1 and 2:

```bash
# Verify the seed rewrites and migration logic
cd C:/Users/Ittn/Documents/SaaS/synedrix/synedrix && npx convex dev
# In a separate terminal:
npx convex run api.subjects.migrateIconSlugs
# Confirm: returns `{ migrated: N, alreadyValid: M }`.
```

After every phase:

- `npm run lint` (ESLint)
- `npm run test` (Vitest, if any unit tests for subjects
  exist; otherwise document the absence)

After Phase 2-3, run the design-taste-frontend pre-flight
check (Section 14 of the skill):

- [ ] No em-dashes (`—`) in any new user-facing string.
- [ ] Subject card does not look like a 3-equal-cards
  layout (it doesn't — it's a tile; the check is "did
  any new section accidentally introduce that pattern?").
- [ ] Eyebrow count ≤ ceil(sections / 3). The 3 sections
  in this work (grid, detail header, cockpit strip) can
  each carry 1 eyebrow mono label. Verify.
- [ ] Bento cells have real visual variation. The card's
  accent bar + icon + meta row + CTA strip are the
  variation. Verify each card cell is not a flat text
  box.
- [ ] Section-Layout-Repetition: card / header / strip
  are 3 distinct layout families. OK.

After Phase 4, run a smoke test:

```bash
# Start the dev server, log in, navigate to /subjects.
# Verify every card shows its per-subject glyph, mastery
# bar, last-studied date, and the right CTA.
# Use browser-use if available; otherwise curl the
# /subjects route HTML.
```

### Phase 7 — Documentation

- Add a short "Subject UX contract" JSDoc block at the
  top of `convex/subjects.ts` documenting:
  - The color/icon slug convention.
  - The aggregate helper signature.
  - The migration story (`migrateIconSlugs`).
- Update `AGENTS.md` under "Naming Consistency" (or
  equivalent) to cite the icon-slug contract, so a future
  contributor adding a 7th subject knows to update both
  the seed AND `SUBJECT_ICON_MAP` with matching slugs.

## 3. Out of scope

The following are intentionally NOT in this plan; the next
agent should leave them alone:

- Adding new subject rows beyond the 6 canonical
  ones in `seed.ts`. The seed is the source of truth.
- Refactoring the `tutorProfile.save` onboarding write
  (handled by the onboarding redesign work).
- Changing the AI prompt builders in
  `src/lib/ai/prompts/`.
- Backend denormalization of per-subject mastery onto
  `userSubjects`. The aggregate computation is
  acceptable at this scale (6 subjects, O(N) over a
  user's topics). If the curriculum grows past ~20
  subjects, revisit.
- Auth changes. `requireUser` / `resolveIdentityAndUser`
  contracts stay as-is.
- The onboarding redesign. This plan is the post-redesign
  surface work; it does NOT touch the 11-question flow.

## 4. Acceptance criteria

The work is "done" when all of the following hold:

1. Every subject component (SubjectCard, SubjectHeader,
   AvailableSubjectStrip, SubjectMasteryStrip,
   on-boarding SubjectOption) renders the per-subject
   glyph from `SUBJECT_ICON_MAP`, not the generic `Books`.
2. `migrateIconSlugs` runs idempotently on a deployment
   with old icon values; subsequent runs return
   `migrated: 0`.
3. `api.subjects.list` returns the new fields
   (`mastery`, `topicsStudied`, `lastStudiedAt`,
   `firstTopic`) for every subject. The Convex validator
   is updated to match.
4. `SubjectCard` shows the per-card progress bar, the
   `X / Y topics` text, the relative last-studied date,
   and a context-aware CTA (`Continue` / `Start first
   topic` / `Add subject`).
5. `SubjectsGrid` has a sort dropdown alongside the
   existing filter chips. Default sort is the backend
   order; user-overridden sort is client-side.
6. `npx tsc --noEmit` reports no errors in
   `components/dashboard/*Subject*`, `components/landing/icons.ts`,
   `components/onboarding/screens.tsx`, or `convex/subjects.ts`.
7. The em-dash pre-flight passes for every new string
   added in this work.

## 5. File-touch summary

- `convex/seed.ts` — rewrite 6 `icon` values; add 6
  `shortBlurb` values; add `migrateIconSlugs` mutation.
- `convex/subjects.ts` — add `aggregateSubjectProgress`
  helper; extend `list` response; refactor `getBySlug` to
  use the helper.
- `components/landing/icons.ts` — add `asIcon` helper;
  remove the `as unknown as PhosphorIconComponent` casts.
- `components/dashboard/SubjectCard.tsx` — Phase 2 icon
  + Phase 3 progress bar / CTA / last-studied chip.
- `components/dashboard/SubjectHeader.tsx` — Phase 2
  icon + Phase 3 ETA chip + nextBest pill.
- `components/dashboard/AvailableSubjectStrip.tsx` —
  Phase 2 icon.
- `components/dashboard/SubjectMasteryStrip.tsx` —
  Phase 2 icon.
- `components/dashboard/SubjectsGrid.tsx` — Phase 3
  sort dropdown.
- `AGENTS.md` — one-line update citing the icon-slug
  contract.
- `docs/SUBJECT-IMPROVEMENT-PLAN.md` — this file (already
  created).

## 6. Recommended agent order

If a single agent is executing, run in this order to keep
each step testable in isolation:

1. Phase 1 (icon contract fix). Run
   `migrateIconSlugs` on the dev deployment. Verify the
   6 subjects have the right icons on /subjects.
2. Phase 2 (dashboard icons). One file at a time. After
   each file, typecheck.
3. Phase 4 (backend response). Update `convex/subjects.ts`,
   typecheck, verify the response shape in
   `npx convex run api.subjects.list {}`.
4. Phase 3 (SubjectCard). The biggest single UI change.
   Typecheck, then visual smoke-test.
5. Phase 3 (SubjectHeader, SubjectsGrid sort, strip).
   Smaller changes; do them in any order.
6. Phase 5 (seed polish, JSDoc, AGENTS.md).
7. Phase 6 (validation). Final typecheck + lint + design
   pre-flight.

## 7. Risk register

- **R1. The migration on production data.** Pre-flight:
  write a query that lists every subject's current `icon`
  and confirm 6 rows are non-slug. Run the migration in a
  dry-run mode first if the Convex admin panel supports
  it. If not, snapshot the table.
- **R2. The aggregate query is O(topics per user) per
  dashboard render.** The dashboard already calls
  `api.subjects.list` on every page. Adding mastery math
  to that call could double the latency on a 100-topic
  curriculum. Mitigation: the math is computed via the
  existing `userTopicProgress` index — single
  `by_user` read + per-topic lookup is O(N) but
  Convex's `by_user` index is fast enough at the app's
  current scale (≤ ~200 topics). If latency becomes a
  problem, denormalize `userSubjectAggregate` keyed on
  `(userId, subjectId)` and update via mutation. Out of
  scope for this plan.
- **R3. The icon slug rewrite changes the wire format.**
  Existing client code that reads `subject.icon` will see
  different values. Mitigation: the only consumer is the
  components in §1.3, all of which are being updated in
  this plan.
