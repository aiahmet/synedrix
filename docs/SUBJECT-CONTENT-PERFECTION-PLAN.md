# Subject Content, Informational Texts, and Exercises — Perfection Plan
## Implementation plan for Synedrix

**Status:** Plan only. No code in this doc. The implementing agent should
read this plan end-to-end, then follow the ordered step list in §10 and
re-validate after each numbered step.

**Predecessor docs (read first, in this order):**

1. `docs/SUBJECT-IMPROVEMENT-PLAN.md` — already shipped. Covers
   per-subject icons, mastery chips, sort dropdown, header ETA. This
   plan does not touch those surfaces.
2. `docs/USER-TOPIC-LESSON-PLAN.md` — covers the user-generated topic
   loop (create topic → AI lesson → AI practice → AI grading → tutor
   context). The data model additions in this plan are deliberately
   compatible with the user-generated plan's tables
   (`topicLessons`, `topicLessonPractice`).

**Owner of decisions when ambiguous:** see §3 (Architecture Decisions,
locked) and §10 (Decision Log, open).

---

## 1. What "perfect" means

A German Gymnasium student opens the app on day one. Every canonical
subject already has:

- a **rich curriculum** (6–8 chapters, 4–8 topics per chapter, every
  topic exam-grade);
- a **three-depth lesson** at every topic — simple, standard, rigorous
  — where the depth difference is structural (concept vs.
  method+example vs. proof+edges), not just word count;
- a **formula sheet** (STEM subjects) or a **vocabulary list**
  (language subjects) the student can skim and use as a cheat sheet;
- a set of **canonical worked examples** that walk through real exam
  problems, step by step, with the error called out where the typical
  student slips;
- a list of **common mistakes** the typical student makes on the topic,
  each with the correction and the conceptual cause;
- a **canonical practice set** of 5–8 items, hand-written, that the
  student can take without waiting for AI generation;
- a **flashcard deck** (vocab / formulas / definitions) the student
  can review in the spaced-repetition queue;
- a **content quality bar**: every word is intentional, every
  formula checks out, every example has a real answer, every
  mistake is one a real student makes.

The implementing agent's job is to land all of this without
compromising the existing per-subject UX (per
`SUBJECT-IMPROVEMENT-PLAN.md`), the per-user-topic loop (per
`USER-TOPIC-LESSON-PLAN.md`), or the AI tutor chat (per
`PHASE-2-CORE-LOOP.md` §2.8).

---

## 2. Audit — the current content

### 2.1 Curriculum shape

Six subjects. Each ships with 1–2 chapters. Each chapter ships with
1–2 topics. Total: **6 subjects, 10 chapters, 11 topics**.

```
math      → algebra, calculus          (4 topics)
physics   → mechanics                   (1 topic)
chemistry → stoichiometry               (1 topic)
french    → grammar                     (1 topic)
german    → textanalyse                 (1 topic)
english   → literary-analysis           (1 topic)
```

For reference, the German Gymnasium curriculum for these six subjects
in Oberstufe covers roughly 200–300 topics. The current state is
~5% of that surface area.

### 2.2 Lesson block shape

Each topic has 3 lesson blocks (one per depth: simple, standard,
rigorous), authored as a single `content` field (a string). Block
content is plain prose split on `\n\n` into paragraphs at render time
(`components/dashboard/TopicDepthTabs.tsx:LessonBlockBody`).

**Sample block length** (math/algebra/logarithms, `standard`):
~250 words / 3 paragraphs. The `rigorous` block is ~280 words, the
`simple` block is ~210 words. Depth difference is real but thin.

**What the block does NOT carry:**

- No formulas (the renderer is plain prose)
- No worked examples (any worked-example content is inline prose)
- No common-mistake markers
- No vocabulary terms
- No link to a formula sheet
- No link to a practice set

### 2.3 Practice items

The `practiceItems` table exists in the schema and is currently used
only by the user-topic loop (`convex/practice.ts:startLessonPractice`
in the user-topic plan). There are **zero canonical practice items
seeded** for any of the 11 topics. Practice is on-demand AI
generation only.

### 2.4 Marketing / surface copy

`components/landing/data.ts` and `src/lib/subjectShortBlurbs.ts`
carry per-subject one-liners used in the catalog chips. They are
already polished (per the SUBJECT-IMPROVEMENT-PLAN) and the new
content does not need to change them.

### 2.5 Rendering surface

`components/dashboard/TopicDepthTabs.tsx` is the only place lesson
content is rendered. It calls a tiny `LessonBlockBody` helper that
splits on `\n\n` and renders `<p>` per paragraph. No markdown parser,
no formula engine, no code highlighter. To add structured
content (formulas, examples, mistakes, vocabulary), the renderer
must learn to parse the new content.

### 2.6 Content quality bar (current)

What the existing content does well:

- Reads as honest, exam-grade exposition (not marketing fluff).
- Sentence-level prose is sharp, no em-dashes, no padding.
- Each block stays in its target depth band (simple vs. standard vs.
  rigorous are real differences, not just length).
- Cross-references topics (Vieta's formulas → quadratics;
  change-of-base → logs → decibels).

What the existing content does not do:

- No formulas (math, physics, chemistry) — currently conveyed
  through Unicode superscripts and prose, which breaks for any
  nontrivial expression (fractions, sums, integrals).
- No worked examples (the prose alludes to "log_2(8a) = 3 +
  log_2(a)" but never walks through one as a real exam problem).
- No common-mistake callouts (the prose mentions "the most
  common confusion" but doesn't name the mistake or correct it).
- No vocabulary (language subjects don't ship word lists).
- No formula sheets (the student has no quick-reference surface).

### 2.7 What the user said

> "Improve the subject contents and informational texts and the
> exercises and all of that to improve it and basically perfect it"

That maps to: (a) curriculum expansion, (b) lesson block enrichment
(worked examples, common mistakes, formulas, vocabulary), and
(c) canonical practice items per topic. The plan covers all three
under a single phased rollout.

---

## 3. Architecture decisions (locked)

| # | Decision | Choice | Why |
|---|----------|--------|-----|
| D1 | Where does enriched content live? | **Extend `lessonBlocks` with new optional fields** (examples, commonMistakes, formulas, vocabulary) | A worked example is depth-scoped (the simple example differs from the rigorous one), so it belongs in the lesson block, not a separate table. The new fields are optional, so existing rows migrate without a script. |
| D2 | Formula + code rendering | **A small custom mini-markdown parser** (no new dependencies) | `react-markdown` + `remark-math` + `rehype-katex` is ~250 kB and adds three transitive deps. A 200-line typed parser that handles `$math$`, `$$block$$`, backtick code, `> [!example]`, `> [!mistake]`, and tables covers everything the seed needs. No new dep, full type safety. |
| D3 | Where do canonical practice items live? | **Reuse `practiceItems` with `source: "canonical_baseline"`** | The discriminated union on `source` already exists in the schema. Adding a third literal ("canonical_baseline") is a 5-line schema delta. No new table. The user-topic loop's `startLessonPractice` continues to write `source: "user_lesson"`. |
| D4 | Where do formula sheets / vocabulary decks live? | **New table `topicResources` (one row per topic per resource kind)** | A topic can carry zero or one formula sheet and zero or one vocabulary list. Two rows, no fan-out. Joining by `(topicId, kind)` is a single index read. |
| D5 | Authoring format | **TS seed object (the existing pattern in `convex/seed.ts`)** | Type-safe, diffable, single file per subject, no build pipeline. Markdown files would be 60+ files for full coverage and harder to keep in sync. |
| D6 | Localization for language subjects | **Author in the target language directly** | French subject content in French, German subject in German, English subject in English. STEM subjects stay in German (Gymnasium convention). The existing `language` field on tutor chat handles the rest. |
| D7 | Depth differentiation | **Structural, not just length** (see §5.2) | Simple = concept + analogy + a one-liner. Standard = definition + rule + worked example + common mistake. Rigorous = formal statement + proof/derivation + edge case + connection to another topic. Length follows structure, not the other way around. |
| D8 | Authoring split per phase | **One subject per phase (§10.5–§10.10)** | Each phase lands one subject end-to-end (chapters, topics, lessons, examples, mistakes, formula sheets/vocabulary, practice items) before moving on. Smaller PRs, easier review, content authors can batch by domain knowledge. |
| D9 | Practice-item types | **Extend the discriminated union with `mcq` already covered; add `worked_walkthrough` (multi-line answer) for STEM** | German Gymnasium exams are not multiple-choice. The current types (`mcq`, `short_answer`, `step_problem`, `fill_blank`) cover most exam surfaces. A new `worked_walkthrough` type (3–6 line answer with structure) handles the "show your work" pattern. |
| D10 | Common mistake provenance | **Pre-seeded in `lessonBlocks.commonMistakes` + user-history from `mistakeEntries` merged at read time** | The `CommonMistakesPanel` already reads from `mistakeEntries` per topic. We extend it to prepend the pre-seeded list so every topic shows the typical mistakes immediately, before the user has any history. |
| D11 | Schema migration | **All new fields are `v.optional(...)`; existing rows continue to validate** | No migration script. Reading code applies the new fields when present, falls back to existing UX otherwise. |
| D12 | Naming consistency | `LessonBlock`, `Topic`, `PracticeItem`, `PracticeAttempt`, `MistakeEntry`, `AiGeneration`, `TopicResource`. No new concept names. |

---

## 4. Data model changes

All edits go into **`convex/schema.ts`**. Run `npx convex dev` after this
step to validate.

### 4.1 Extend `lessonBlocks` with structured content fields

```ts
lessonBlocks: defineTable({
  topicId: v.id("topics"),
  title: v.string(),
  content: v.string(),
  depth: v.union(v.literal("simple"), v.literal("standard"), v.literal("rigorous")),
  order: v.number(),
  // NEW (all optional, all default to absent for existing rows):
  // 2–5 worked examples per block. Each walks through a real
  // problem, the setup + the solution. The renderer shows
  // these as a "Worked examples" panel below the prose.
  workedExamples: v.optional(
    v.array(
      v.object({
        setup: v.string(),         // the problem statement
        solution: v.string(),      // the walkthrough, in the
                                   // mini-markdown format (§5.3)
        skill: v.string(),         // 1–40 chars
      })
    )
  ),
  // 1–4 common mistakes per block. Pre-seeded from the
  // canonical curriculum, merged with the user's
  // `mistakeEntries` history at read time.
  commonMistakes: v.optional(
    v.array(
      v.object({
        mistake: v.string(),       // what the student does
        correction: v.string(),    // the right way
        cause: v.string(),         // conceptual reason
      })
    )
  ),
  // 1–6 formulas per block. The renderer renders these as
  // a `Formula` component (KaTeX-style). Optional for
  // language subjects.
  formulas: v.optional(
    v.array(
      v.object({
        name: v.string(),          // "Change of base", "Binomial"
        expression: v.string(),    // LaTeX-style: "log_b(x) = \\frac{\\ln x}{\\ln b}"
        when: v.string(),          // "Use when the calculator only knows ln or log_10"
      })
    )
  ),
  // 1–30 vocabulary terms per block. For language subjects
  // primarily. Each term is the foreign-language word
  // paired with the German (or English, in the English
  // subject) definition.
  vocabulary: v.optional(
    v.array(
      v.object({
        term: v.string(),
        definition: v.string(),
        // Optional gender for German / French:
        gender: v.optional(v.union(
          v.literal("m"), v.literal("f"), v.literal("n")
        )),
      })
    )
  ),
})
  .index("by_topic_depth", ["topicId", "depth"])
```

### 4.2 Extend `practiceItems` with the canonical-baseline source

```ts
practiceItems: defineTable({
  // ... existing fields ...
  // NEW: third source literal.
  source: v.optional(
    v.union(
      v.literal("canonical"),
      v.literal("user_lesson"),
      v.literal("canonical_baseline"), // NEW
    )
  ),
  // NEW: type discriminator for the multi-line worked walkthrough.
  // Existing union:
  type: v.union(
    v.literal("mcq"),
    v.literal("short_answer"),
    v.literal("step_problem"),
    v.literal("fill_blank"),
    v.literal("user_text_answer"),
    v.literal("worked_walkthrough"), // NEW
  ),
})
  .index("by_practice_set", ["practiceSetId"])
  .index("by_source_lesson", ["sourceLessonId"])
  // NEW: lookup canonical practice items by topic for the
  // "Start baseline practice" CTA on the topic page.
  .index("by_topic", ["topicId"])
```

Add the `topicId` field to the `practiceItems` table directly so
canonical items can be queried by topic without joining through
`practiceSets`. This is a forward-only migration; existing rows
have `topicId: undefined`.

Wait — re-think. `practiceItems` is keyed on `practiceSetId`, not
`topicId`. Adding `topicId` to every row requires either a backfill
or a denormalized field. Cleaner approach: query canonical practice
items through the `practiceSets` table (one canonical
`practiceSets` row per topic, all items under it).

```ts
// Reuse, no schema change to practiceItems.
practiceSets: defineTable({
  // ... existing fields ...
  // NEW: marker for the canonical-baseline practice set
  // (one per topic, source = "canonical_baseline").
  // Existing rows have source = undefined, read as "canonical".
  source: v.optional(
    v.union(
      v.literal("canonical"),
      v.literal("user_lesson"),
      v.literal("canonical_baseline"),
    )
  ),
})
  .index("by_topic", ["topicId"])
  // NEW: compound lookup — find the canonical_baseline
  // practice set for a given topic in O(log n).
  .index("by_topic_source", ["topicId", "source"])
```

Canonical practice items live under a `practiceSets` row of
`source: "canonical_baseline"`. The query path is:

```
api.practiceItems.listByTopic(topicId) →
  find practiceSets row WHERE topicId = X AND source = "canonical_baseline"
  → list practiceItems WHERE practiceSetId = that row
```

Two indexed reads. Fast.

### 4.3 New `topicResources` table

```ts
/**
 * Per-topic resources that are not depth-scoped. Each
 * topic has zero or one of each `kind`; uniqueness is
 * enforced by the (topicId, kind) compound index.
 *
 * `kind` is the discriminator. Today: "formula_sheet" and
 * "vocabulary_deck". Future kinds (e.g. "cheat_sheet",
 * "exam_archive") extend the union.
 */
topicResources: defineTable({
  topicId: v.id("topics"),
  kind: v.union(
    v.literal("formula_sheet"),
    v.literal("vocabulary_deck"),
  ),
  // For formula_sheet: array of named expressions.
  // For vocabulary_deck: array of (term, definition) pairs.
  // The contents shape is keyed by `kind`; readers narrow.
  contents: v.array(
    v.union(
      v.object({
        // formula_sheet shape
        name: v.string(),
        expression: v.string(),
        when: v.string(),
      }),
      v.object({
        // vocabulary_deck shape
        term: v.string(),
        definition: v.string(),
        gender: v.optional(v.union(
          v.literal("m"), v.literal("f"), v.literal("n")
        )),
        example: v.optional(v.string()),
      }),
    )
  ),
  language: v.optional(v.string()),  // "de" | "fr" | "en" | etc.
  updatedAt: v.number(),
})
  .index("by_topic", ["topicId"])
  .index("by_topic_kind", ["topicId", "kind"])  // uniqueness
```

`by_topic_kind` enforces "at most one formula sheet per topic, at most
one vocabulary deck per topic" via the application (no unique index
in Convex; we enforce in the seed/upsert path).

### 4.4 Extend `flashcardDecks` and `flashcards`

The schema already has both tables. We add a `kind` discriminator to
`flashcardDecks` to distinguish the canonical-baseline deck
(`source: "canonical_baseline"`) from user-generated decks.

```ts
flashcardDecks: defineTable({
  // ... existing fields ...
  // NEW: source discriminator.
  source: v.optional(
    v.union(
      v.literal("canonical"),
      v.literal("user"),
      v.literal("canonical_baseline"), // NEW
    )
  ),
  // NEW: optional link back to the topic whose content
  // produced the deck.
  topicId: v.optional(v.id("topics")),
})
  .index("by_topic", ["topicId"])
  .index("by_topic_source", ["topicId", "source"]) // NEW
```

The `flashcards` table needs no changes — its `deckId` link is
sufficient.

---

## 5. Content model (the "what does a topic look like" contract)

### 5.1 Topic surface — what ships per topic

Every topic carries the following. Each one is optional, but a
"complete" topic ships all of them.

| Resource | Carrier | Per-depth? | Subject applies to |
|----------|---------|------------|--------------------|
| Lesson blocks | `lessonBlocks` (3 rows) | yes (3) | all |
| Worked examples | `lessonBlocks.workedExamples` | yes | STEM primarily |
| Common mistakes | `lessonBlocks.commonMistakes` | yes | all |
| Formulas (inline) | `lessonBlocks.formulas` | yes | STEM |
| Vocabulary (inline) | `lessonBlocks.vocabulary` | yes | languages primarily |
| Formula sheet | `topicResources` (`formula_sheet`) | no (1) | STEM |
| Vocabulary deck | `topicResources` (`vocabulary_deck`) | no (1) | languages |
| Canonical practice set | `practiceSets` + `practiceItems` | no (1) | all |
| Flashcard deck | `flashcardDecks` + `flashcards` | no (1) | all |

### 5.2 Depth contract — what each depth actually means

Three depths. Structural, not length-based.

**`simple`** — first encounter. Target: a 10th-grader on a first read.

- One concept per block.
- Every term defined on first use.
- No symbols that require prior knowledge.
- An everyday analogy when one helps (e.g. "log is the question
  'what exponent do I need?'").
- One-sentence summary at the end.
- 200–400 words.
- 0–1 formula per block (none for language subjects).
- 0–2 worked examples (a tiny one if any).
- 1–3 common mistakes (the kind a first-time student makes).

**`standard`** — exam-grade walkthrough. Target: a student preparing
for a Klausur.

- Definition + rule + worked example + common mistake.
- 1–3 formulas per block (STEM).
- Symbols match what a German teacher writes on the board.
- 1–2 worked examples per block, each with a real setup and a
  full solution in the mini-markdown format.
- 1–3 common mistakes.
- 400–700 words.

**`rigorous`** — proof + edge cases + connections. Target: a student
who already has 70% mastery and wants the model's edge.

- Formal statement (theorem / law / rule) with conditions.
- Proof or derivation, when one is short enough to fit.
- 1–2 edge cases the standard depth glossed.
- Connection to at least one related topic in the same subject
  ("Vieta's formulas let you solve x_1 + x_2 = 5 in one line
  without finding the roots individually — see §Quadratic
  equations in the Algebra chapter").
- 1–3 formulas, plus the conditions under which each holds.
- 0–1 worked example, but unusually clean (the kind an Olympiad
  problem starts from).
- 600–900 words.

### 5.3 Mini-markdown format for `solution` and `content`

The `content` field (existing) and the new `solution` field (inside
`workedExamples`) use a tiny mini-markdown format. The renderer is
a 200-line typed parser; no external dependency.

Supported syntax (whitelist — anything else renders as literal text):

| Syntax | Renders as | Example |
|--------|-----------|---------|
| `$x$` | inline math (KaTeX-style) | `$\frac{1}{2}$` |
| `$$...$$` | block math, centered | `$$\int_0^1 x^2 dx = \frac{1}{3}$$` |
| `` `code` `` | inline code | `` `f(x) = 2x + 1` `` |
| ```` ```code``` ```` | code block | formula derivations |
| `**bold**` | bold | `**important**` |
| `*italic*` | italic | `*Hinweis*` |
| `> [!example] title\n  body` | callout (info color) | worked example inline |
| `> [!mistake] title\n  body` | callout (warn color) | common mistake inline |
| `> [!note] title\n  body` | callout (neutral) | asides |
| `- item` | bullet list | vocabulary list |
| `1. item` | numbered list | steps in a derivation |
| `\| col \| col \|` + `\|---\|` | table | comparison tables |
| blank line | paragraph break | — |

**Validation:** the seed author is responsible for matching the
bracket. We add a `validateMiniMarkdown(content: string)` helper in
`src/lib/content/miniMarkdown.ts` that the seed runs in CI (via
`npm run lint:content`) to flag unmatched delimiters and unbalanced
math.

### 5.4 Formula rendering

`$x$` and `$$x$$` use KaTeX-style LaTeX. The renderer picks the right
parser:

- For simple expressions (≤ 3 levels of nesting, no `\frac`, no
  `\sum`, no `\int`): a tiny hand-written renderer that handles
  subscripts, superscripts, fractions (one level), and Greek
  letters. ~80 lines.
- For complex expressions: render via `katex` library, ~200 kB,
  only loaded on the topic page (`next/dynamic` with `ssr: false`).

The split is invisible to the seed author — they write LaTeX either
way; the renderer picks. This keeps the marketing/landing pages
zero-KaTeX while letting the topic page handle `\int_0^1 x^2 dx`.

**Decision (default for the implementing agent):** ship the
hand-written renderer first for V1, defer the `katex` lazy-load to
V2 if a topic needs a `\frac` or `\sum`. The vast majority of
Gymnasium formulas (quadratic, log, derivative, atomic weight)
fit the hand-written renderer's subset.

### 5.5 Worked-example surface

Each `workedExamples` entry renders as a card below the prose with:

- A "Worked example" eyebrow.
- The setup text.
- The solution (mini-markdown), inside a `details` element that
  defaults to open.
- A "Hide" / "Show" toggle for the student to test themselves
  before reading the solution.

The renderer lives in `components/dashboard/LessonWorkedExamples.tsx`
(per-depth panel).

### 5.6 Common-mistake surface

`CommonMistakesPanel` already exists. Per decision D10, the panel
will read both the new pre-seeded `lessonBlocks.commonMistakes`
fields and the user's `mistakeEntries` for the topic, and merge
them. Pre-seeded mistakes render first (with an eyebrow that
distinguishes them from the user's history).

A pre-seeded mistake carries `mistake`, `correction`, `cause`. A
user mistake carries `userAnswer` + `correctAnswer` + `cause`. The
merge keeps the two shapes distinct in the UI.

### 5.7 Formula-sheet surface (per topic)

A `topicResources` row of `kind: "formula_sheet"` renders as a
collapsible "Formula sheet" card at the bottom of the topic page,
below the lesson blocks and above the practice CTA. Each formula
shows name, expression (KaTeX-style, full block), and "when to use"
in three lines. Click a formula to copy the expression to clipboard.

### 5.8 Vocabulary-deck surface (per topic, language subjects)

A `topicResources` row of `kind: "vocabulary_deck"` renders as a
collapsible "Vocabulary" card. Each term shows the foreign-language
word, its gender (if applicable), the German/English definition, and
an example sentence (when supplied). The deck is also the source
for a flashcard deck — the renderer registers a "Add to review
queue" button per term that auto-creates a `flashcards` row from
the vocabulary entry.

### 5.9 Canonical practice set surface

A `practiceSets` row of `source: "canonical_baseline"` per topic
ships 5–8 practice items. The topic page exposes a "Start baseline
practice" CTA in addition to the existing on-demand AI practice
launcher. The baseline set is identical for every user — same
questions, same expected answers, same rubrics. The AI-generated
practice is still available for variation.

### 5.10 Flashcard deck surface

A `flashcardDecks` row of `source: "canonical_baseline"` per topic
ships 8–20 cards (vocab for languages, formulas for STEM). The
deck appears on the topic page below the practice CTA. The
existing flashcard review page picks it up automatically via the
`by_user_due` review query.

---

## 6. Authoring format (what the seed looks like)

### 6.1 The existing shape

`convex/seed.ts` already has a typed `CANONICAL_SUBJECTS` array of
`SubjectSeed` objects. Each subject has chapters; each chapter has
topics; each topic has lesson blocks. We extend the type.

### 6.2 New `TopicSeed` shape

```ts
type TopicSeed = {
  // ... existing fields ...
  lessonBlocks: readonly LessonSeed[];

  // NEW: optional per-topic resources.
  formulaSheet?: readonly FormulaEntry[];
  vocabularyDeck?: readonly VocabularyEntry[];
  workedExamples?: readonly WorkedExampleEntry[]; // shared across depths
  commonMistakes?: readonly CommonMistakeEntry[];  // shared across depths

  // NEW: the canonical-baseline practice set for this topic.
  // 5–8 items; the seed upserts a `practiceSets` row of
  // `source: "canonical_baseline"` and one `practiceItems`
  // row per item.
  practiceSet?: readonly PracticeItemSeed[];

  // NEW: the canonical-baseline flashcard deck for this topic.
  flashcardDeck?: readonly FlashcardSeed[];
};
```

`workedExamples` and `commonMistakes` are per-depth on
`lessonBlocks`, but a topic can also carry shared examples and
mistakes (the simple and standard depths both reference the same
worked example). The seed resolves shared → per-depth at insert
time: a topic-level `workedExamples` populates all three depth
blocks unless any one depth overrides.

### 6.3 The renderer contract for each field

| Field | Format | Validation |
|-------|--------|------------|
| `content` | mini-markdown (see §5.3) | `validateMiniMarkdown` |
| `workedExamples[].setup` | plain prose | ≤ 400 chars |
| `workedExamples[].solution` | mini-markdown | ≤ 2000 chars, `validateMiniMarkdown` |
| `commonMistakes[].mistake` | plain prose | ≤ 200 chars |
| `commonMistakes[].correction` | plain prose | ≤ 200 chars |
| `commonMistakes[].cause` | plain prose | ≤ 200 chars |
| `formulas[].name` | plain text | ≤ 60 chars |
| `formulas[].expression` | LaTeX-style | ≤ 200 chars, balanced delimiters |
| `formulas[].when` | plain prose | ≤ 200 chars |
| `vocabulary[].term` | foreign language | ≤ 40 chars |
| `vocabulary[].definition` | German or English | ≤ 300 chars |
| `formulaSheet[*]` | same as `formulas[]` | same |
| `vocabularyDeck[*]` | same as `vocabulary[]` | same |
| `practiceSet[*].question` | plain prose or mini-markdown | ≤ 600 chars |
| `practiceSet[*].answer` | mini-markdown | ≤ 2000 chars, `validateMiniMarkdown` |
| `flashcardDeck[*].front` | plain text | ≤ 200 chars |
| `flashcardDeck[*].back` | plain prose or mini-markdown | ≤ 600 chars |

### 6.4 The content lint

`npm run lint:content` runs `scripts/lint-content.ts` over
`convex/seed.ts`. It validates every field per the table above
and fails the build on:

- Unbalanced `$...$` or `$$...$$` in any `content` or `solution`
  field.
- Any `workedExample.solution` longer than 2000 chars.
- Any `practiceSet` with fewer than 5 or more than 8 items.
- Any `flashcardDeck` with fewer than 8 or more than 20 items.
- Any subject with fewer than 4 chapters or any chapter with
  fewer than 3 topics.

The lint is wired into `package.json` and runs on `pre-commit` via
a Husky hook (or `npm run lint`, if Husky is not in the project).

---

## 7. Per-subject content specs

The implementing agent writes **one subject per phase** (D8). Each
subject ends the phase with: a complete chapter/topic tree, every
topic fully authored across all three depths, every topic's
worked examples, common mistakes, formulas (STEM) or vocabulary
(languages), the canonical practice set, and the flashcard deck.

### 7.1 Mathematics (Phase B, §10.5)

**Curriculum map (target).** Math is the largest subject. Six
chapters, 24 topics total.

| Chapter | Topics |
|---------|--------|
| Algebra | Quadratic equations · Logarithms · Linear systems (2×2, 3×3) · Polynomial division · Rational expressions |
| Functions | Linear & affine · Quadratic & parabola · Exponential · Logarithmic · Trigonometric (sin, cos, tan) |
| Geometry (Euclidean) | Triangle congruence · Circle theorems · Vectors in the plane · Similarity |
| Calculus (intro) | Limits · Derivatives (rules + chain) · Integrals (Riemann, fundamental theorem) |
| Analytic geometry | Lines in the plane · Conic sections (circle, ellipse, hyperbola) · Parametric curves |
| Stochastics (intro) | Counting · Conditional probability · Random variables · Binomial & normal distribution |

**Per topic** (24 total):

- 3 lesson blocks (simple, standard, rigorous) — 800–2000 words combined.
- 1–2 worked examples per depth.
- 1–3 common mistakes per depth.
- 1–3 formulas per depth (in `lessonBlocks.formulas`).
- 1 formula sheet (in `topicResources`).
- 5–8 practice items in the canonical-baseline set.
- 8–15 flashcards (formula + definition + small proof cards).

**Quality bar:** every formula in the lesson must appear in the
formula sheet. Every worked example must be solvable from the
preceding lesson alone (no implicit prerequisites beyond what the
chapter order ensures).

### 7.2 Physics (Phase C, §10.6)

**Curriculum map (target).** Five chapters, 20 topics.

| Chapter | Topics |
|---------|--------|
| Mechanics | Newton's laws · Work & energy · Momentum & collisions · Circular motion · Oscillations (SHM) |
| Thermodynamics | Temperature & heat · Ideal gas law · First law · Heat engines (Carnot) · Entropy (intro) |
| Electromagnetism | Coulomb's law · Electric field & potential · Capacitance · Current & resistance · Magnetic field & force on a charge |
| Waves & optics | Wave equation · Refraction & Snell's law · Lenses & mirrors · Interference & diffraction |
| Modern (intro) | Photoelectric effect · de Broglie · Atomic models (Bohr) · Radioactivity · Nuclear reactions |

**Per topic** (20 total): same shape as Math, with one extra
convention: every physics worked example must include the units at
each step (the German Gymnasium standard), and the `when` field on
formulas must state the SI unit of every variable.

### 7.3 Chemistry (Phase D, §10.7)

**Curriculum map (target).** Four chapters, 16 topics.

| Chapter | Topics |
|---------|--------|
| General chemistry | Atomic structure · Periodic table · Chemical bonds · Stoichiometry |
| States of matter | Gases (ideal gas law) · Liquids & intermolecular forces · Solids (crystal types) · Solutions & concentration |
| Reactions | Balancing reactions · Acids & bases · Redox · Equilibrium (Le Chatelier) |
| Organic | Hydrocarbons · Functional groups · Isomerism · Reaction mechanisms (intro) |

**Per topic** (16 total): same shape. Formulas are chemical
formulas (subscripted, not LaTeX); the hand-written renderer in
§5.4 supports `H_2SO_4` style. Worked examples include a
balanced-equation derivation per redox/acid-base topic.

### 7.4 French (Phase E, §10.8)

**Curriculum map (target).** Five chapters, 20 topics.

| Chapter | Topics |
|---------|--------|
| Grammar core | Present tense · Passé composé · Imparfait · Subjonctif · Conditionnel |
| Grammar advanced | Relative pronouns · Indirect speech · Passive voice · Agreement of past participle |
| Vocabulary (thematic) | Maison & quotidien · Voyage & transport · École & études · Travail & carrières · Société & actualité |
| Text analysis | Compréhension écrite · Analyse de texte (poésie) · Argumentation (essai) |
| Oral & composition | Expression écrite (essai argumentatif) · Expression orale (exposé) · Phonetics (liaison, enchaînement) |

**Localization:** every `content`, `workedExamples[].setup`,
`workedExamples[].solution`, and `practiceSet[*].question` is
written **in French**. `vocabulary[].term` is the French word;
`vocabulary[].definition` is the German translation. The
`language` field on `topicResources` is `"fr"`.

**Per topic** (20 total): same shape, but no `formulas` and
`formulaSheet` is omitted. `vocabularyDeck` carries 15–25 terms
per topic. Common mistakes target the typical German-speaker
confusion (false friends, gender, tense mapping).

### 7.5 German (Phase F, §10.9)

**Curriculum map (target).** Five chapters, 20 topics.

| Chapter | Topics |
|---------|--------|
| Textanalyse (Prosa) | Erzählperspektive · Figurencharakterisierung · Sprachliche Bilder · Argumentstruktur |
| Textanalyse (Lyrik) · Drama | Metrum & Reim · Gedichtinterpretation · Dramenanalyse (Schiller, Brecht) |
| Grammatik (Oberstufe) | Nebensätze · Konjunktiv I & II · Passiv · Modalpartikeln |
| Erörterung & Essay | Lineare Erörterung · Dialektische Erörterung · Essay (essayistisches Schreiben) |
| Literaturexkurs | Epochen (Sturm und Drang, Klassik, Romantik) · Kafka & Moderne · Gegenwartsliteratur |

**Localization:** content is **in German** (this is the student's
native language; meta-discussion uses German throughout). Worked
examples are German texts. Practice items are German prompts.
Vocabulary (where it exists) targets literary terms.

**Per topic** (20 total): same shape. No `formulas` / `formulaSheet`
(grammar topics have grammatical-pattern "rules" instead, stored in
the `formulas[].when` field with `expression: ""`). Vocabulary deck
carries 10–20 terms per topic.

### 7.6 English (Phase G, §10.10)

**Curriculum map (target).** Four chapters, 16 topics.

| Chapter | Topics |
|---------|--------|
| Literary analysis | Close reading · Poetry (meter, form, imagery) · Prose (point of view) · Drama |
| Essay & rhetoric | Argumentative essay · Comparative analysis · Rhetorical devices (ethos, pathos, logos) |
| Grammar (advanced) | Conditional sentences · Subjunctive mood · Relative clauses · Reported speech |
| Vocabulary & usage | Academic register · Idiomatic usage · False friends (DE↔EN) · Phrasal verbs |

**Localization:** content is **in English**. `vocabulary[].term`
is the English word; `vocabulary[].definition` is the German
translation. `language` on `topicResources` is `"en"`.

**Per topic** (16 total): same shape. No `formulaSheet`. Vocabulary
deck carries 12–20 terms per topic.

### 7.7 Total content surface (after all phases)

- **6 subjects** · **27 chapters** · **116 topics** · **348 lesson
  blocks** (3 depths × 116) · **232–464 worked examples** · **232–464
  common mistakes** · **232–464 formula/vocabulary entries** · **27
  formula sheets** · **20 vocabulary decks** · **580–928 practice
  items** · **928–2320 flashcards**.

This is large but realistic for a real Gymnasium study OS. The
content authors (or, in the implementing agent's case, the LLM
generating the seed) should aim for **density over volume** — every
example must be useful, every mistake must be one a real student
makes, every formula must show up in the formula sheet.

---

## 8. AI plumbing

The existing AI layer (`src/lib/ai/prompts/lesson.ts`,
`practice.ts`, `grading.ts`, `invoke.ts`) covers the user-topic
loop. The canonical content does not use the AI layer — the seed
is hand-authored, validated, and committed. This section
documents the supporting AI helpers for *content authoring*, not
for runtime use.

### 8.1 Content-authoring helper (offline use)

When the implementing agent authors a new topic's lesson blocks,
they can use a small helper to draft the standard-depth block
faster. The helper is **never called at runtime** — it exists to
make the seed author's job easier.

```ts
// src/lib/content/draftLessonBlock.ts (offline-only)
//
// Not exported from the production build (excluded by
// `tsconfig` "exclude"). The seed author imports it via a
// dev-only alias.
```

This file is out of scope for the implementing agent's runtime
work; it is referenced here only to flag that content authoring
can be partially LLM-assisted, with all output passing through
the same `validateMiniMarkdown` lint as hand-authored content.

### 8.2 No runtime AI changes

The canonical content does not call the AI at runtime. The lesson
page reads the seeded `lessonBlocks` rows; the practice page reads
the canonical-baseline `practiceItems`. The AI layer remains
exactly as it is today (per `USER-TOPIC-LESSON-PLAN.md`) for
user-generated topics and tutor chat.

---

## 9. UI surface (where the new content shows up)

The implementing agent adds three new components per topic page
and wires them into `TopicDetailClient`:

### 9.1 New components

| Component | File | Source data |
|-----------|------|-------------|
| `LessonWorkedExamples` | `components/dashboard/LessonWorkedExamples.tsx` | `lessonBlocks.workedExamples` (per depth) |
| `TopicFormulaSheet` | `components/dashboard/TopicFormulaSheet.tsx` | `topicResources` (`formula_sheet`) |
| `TopicVocabularyDeck` | `components/dashboard/TopicVocabularyDeck.tsx` | `topicResources` (`vocabulary_deck`) |
| `CanonicalPracticeLauncher` | `components/dashboard/CanonicalPracticeLauncher.tsx` | `practiceSets` (`canonical_baseline`) |
| `CanonicalFlashcardDeck` | `components/dashboard/CanonicalFlashcardDeck.tsx` | `flashcardDecks` (`canonical_baseline`) |

### 9.2 Component composition

`TopicDetailClient` already lays out (top → bottom):

1. TopicHeader
2. TopicObjectiveList
3. TopicDepthTabs
4. PrerequisiteStrip + CommonMistakesPanel + NextBestTopicCard + AskTutorCta

After this plan, the layout becomes:

1. TopicHeader
2. TopicObjectiveList
3. TopicDepthTabs (now shows `LessonWorkedExamples` per depth)
4. CommonMistakesPanel (now merges pre-seeded + user history)
5. (new) TopicFormulaSheet *or* TopicVocabularyDeck (one or the other,
   depending on subject kind — see §5.7 / §5.8)
6. (new) CanonicalPracticeLauncher + CanonicalFlashcardDeck
7. PrerequisiteStrip + NextBestTopicCard + AskTutorCta (unchanged)

The §5 components slot into the existing grid; the
right-column (lg:col-span-1) holds PrerequisiteStrip +
NextBestTopicCard + AskTutorCta. The new §5.7/§5.8/§5.9/§5.10
components live in the left column (lg:col-span-2) under the
CommonMistakesPanel.

### 9.3 Mobile layout

The new components inherit the existing card stack. On mobile
(`< lg`), they render full-width. The §5.7 formula sheet collapses
by default (open-on-click); the §5.8 vocabulary deck renders
un-collapsed (scannable).

### 9.4 No new design tokens

The new components use the existing palette (the per-subject hue
+ the global accent). No new colors, no new shadows.

---

## 10. Phased implementation (numbered, sequential)

Each step ends with the §11 validation gates passing without
errors. Steps 10.1–10.4 land the architecture. Steps 10.5–10.10
land one subject each. Steps 10.11–10.13 land the integration UI
and the final quality pass.

The implementing agent must follow this order. Land only after
all gates for that step are green.

### 10.1 Schema deltas (§4)

Write `convex/schema.ts`. Run `npx convex dev` — must show
"Schema valid". Run `npm run typecheck` + `npm run lint`. New
optional fields, two new tables (`topicResources`,
`flashcardDecks.topicId` extension), one new practice-items
source literal.

### 10.2 Mini-markdown parser + validator (§5.3, §5.4)

Create `src/lib/content/miniMarkdown.ts` — the typed parser, the
`validateMiniMarkdown` helper, the hand-written math renderer
(§5.4 V1), the callout renderer, the table renderer, the code
block renderer. ~200 lines. Add `scripts/lint-content.ts` and
wire `npm run lint:content`. The lint reads `convex/seed.ts`,
parses every `content`, `workedExamples[*].solution`, and
`practiceSet[*].answer`, and fails on any unmatched delimiter
or oversize field. Add `vitest` unit tests in
`src/lib/content/__tests__/miniMarkdown.test.ts`. Run all tests.

### 10.3 TopicResources Convex surface (§5.7, §5.8)

Create `convex/topicResources.ts` with `getFormulaSheet`,
`getVocabularyDeck`, and `listTopicResourceKinds` queries. The
`getBySlug` query (in `convex/subjects.ts`) extends its return
shape to include `formulaSheet: ... | null` and
`vocabularyDeck: ... | null` for the topics it returns. Validate
(typecheck, lint, schema-valid).

### 10.4 Canonical practice set + flashcard deck surface (§5.9, §5.10)

Extend `convex/practice.ts` (the user-topic practice module) to
add `getCanonicalPracticeSet` and `startCanonicalPractice` — the
latter is the equivalent of `startLessonPractice` for the
canonical-baseline set, but with `source: "canonical_baseline"`.
Extend `convex/flashcards.ts` (a new file if not yet present)
with `getCanonicalDeck` and `listByTopic` queries. Validate.

### 10.5 Phase B — Mathematics content

Author all 6 chapters, 24 topics, 72 lesson blocks, worked
examples, common mistakes, formulas, 24 formula sheets, 24
canonical practice sets, 24 flashcard decks. The lint
(`npm run lint:content`) must pass. Typecheck, lint, all
schema-valid. Add a small dev-only dashboard
(`/dev/curriculum?subject=math`) that visualizes the tree and
flags any topic missing one of the §5.1 resources — the dev
dashboard is removed in a follow-up commit after all six
subjects land.

### 10.6 Phase C — Physics content

Same as §10.5, physics: 5 chapters, 20 topics, 60 lesson blocks,
formula sheets, practice sets, decks.

### 10.7 Phase D — Chemistry content

Same: 4 chapters, 16 topics, 48 lesson blocks.

### 10.8 Phase E — French content (in French)

Same: 5 chapters, 20 topics, 60 lesson blocks, vocabulary
decks, no formula sheets.

### 10.9 Phase F — German content (in German)

Same: 5 chapters, 20 topics, 60 lesson blocks.

### 10.10 Phase G — English content (in English)

Same: 4 chapters, 16 topics, 48 lesson blocks.

### 10.11 UI components + topic-page integration (§9)

Add `LessonWorkedExamples`, `TopicFormulaSheet`,
`TopicVocabularyDeck`, `CanonicalPracticeLauncher`,
`CanonicalFlashcardDeck`. Wire into `TopicDetailClient`. The
existing `CommonMistakesPanel` is updated to merge pre-seeded +
user history per decision D10. Validate in browser
(smoke: each subject's first topic renders all five new
components without console errors).

### 10.12 Practice UI for canonical baseline

`/my-topics` already has the user-topic practice runner. Add
the canonical-baseline runner at `/subjects/[slug]/[chapterSlug]/[topicSlug]/practice`.
The runner is a thin fork of the existing one — same grading
flow, but the source-of-questions is `canonical_baseline`
instead of `user_lesson`. The results page is shared.

### 10.13 Content quality pass

The dev dashboard (added in §10.5) is removed. The
`lint:content` script gains three more checks:

- Every formula in `lessonBlocks.formulas` appears in the
  `topicResources.formulaSheet` (or a clear "deliberately
  omitted" marker in the seed).
- Every vocabulary term in `lessonBlocks.vocabulary` appears
  in the `topicResources.vocabularyDeck`.
- Every worked example references at least one formula
  (STEM) or one vocabulary term (languages).

`npm run typecheck` + `npm run lint` + `npm run lint:content`
+ `npm run test` must all pass. The implementing agent
deletes the dev-only dashboard file and any seed-time
debugging code.

### 10.14 Final smoke + cleanup

Run the full §11 gate suite from a clean clone. Delete any
dead code, unused imports, and `console.log` calls in
production paths. Update `AGENTS.md` with the new
content-model contract and a link to this plan.

---

## 11. Validation gates (run after each numbered step in §10)

- **TypeScript:** `npm run typecheck` (project-wide).
- **ESLint:** `npm run lint` (project-wide).
- **Convex schema:** `npx convex dev` after every schema change —
  must show "Schema valid".
- **Vitest units:**
  - `src/lib/content/__tests__/miniMarkdown.test.ts` — parser
    fixtures, callout fixtures, table fixtures, math delimiter
    balance, code-block balance.
  - `src/lib/content/__tests__/miniMarkdown.math.test.ts` —
    hand-written math renderer fixtures (subscript, superscript,
    Greek letters, one-level fraction).
  - `src/lib/content/__tests__/validateMiniMarkdown.test.ts` —
    accepts/rejects every field type.
  - `convex/practice.test.ts` (existing) — still passes.
- **Content lint:** `npm run lint:content` — every chapter
  has 3+ topics, every topic has all 5 resource kinds
  (lessonBlocks × 3, formulaSheet OR vocabularyDeck,
  practiceSet, flashcardDeck), every field within size.
- **Manual smoke (per phase):** load the dev dashboard, confirm
  the per-subject tree renders every topic with every resource
  present. Open three random topics per subject in the topic
  page; confirm the worked examples, common mistakes, formula
  sheet, and canonical practice launcher all render without
  console errors.
- **French / German / English localization smoke:** for each
  language subject, confirm a topic's `content` field actually
  contains the target language (no English slipped into French,
  no French slipped into German, etc.).

If any gate fails, **stop, fix, re-run from the failing item
down**.

---

## 12. Edge cases (decision log)

| Case | Behavior |
|------|----------|
| Topic ships only `simple` depth, not `standard` or `rigorous` | The depth tab shows a "Not yet authored" panel for the missing depth (already in the existing `LessonBlockList` empty state). The curriculum-quality gate (per `lint:content`) flags this in dev. |
| Worked example references a formula that is in the formula sheet but not in the block's `formulas` field | The renderer renders the example verbatim. The lint (§10.13) flags the inconsistency. The seed author is expected to add the formula to the block (or to a "shared" topic-level field). |
| Common mistake duplicates a `mistakeEntries` row from the user's history | The merge in `CommonMistakesPanel` de-duplicates by `cause` text. The user's history remains visible below. |
| Canonical practice set has fewer than 5 items | The lint fails. The seed author is expected to author 5+. There is no runtime fallback. |
| KaTeX (V2) load fails on the client | The renderer falls back to the hand-written renderer and a console warning. The student still sees the formula (in a less-pretty subset of expressions). |
| A user-generated topic's `topicResources` is empty | The topic page renders the lesson page without the formula sheet / vocabulary deck section. The user-topic loop does not require resources. |
| The seed author writes a content field that fails the lint | The `npm run lint:content` step fails the build. The author is expected to fix the field before commit. |
| Vocabulary term exceeds 40 chars | Lint fails. The author shortens the term or splits it. |
| Worked example `solution` is mini-markdown with a mis-nested math block (`$x = y$))` ) | Lint fails on the unbalanced delimiter. The author fixes the nesting. |
| Flashcard deck is empty | Lint fails (minimum 8 cards). The author authors 8+. |
| Two topics in the same subject have the same `slug` | The seed's existing slug-uniqueness logic catches this and refuses to insert. The author renames one. |
| The `subject` for a topic is `null` (orphan canonical row) | The `aggregate` query (`convex/subjects.ts`) already guards against this; the topic simply does not appear in any subject's chapter list. The lint (per §10.13) flags the orphan. |

---

## 13. Open questions for the user (if the implementing agent hits them)

These are explicit *only* if the agent cannot proceed without user
input. Otherwise the agent goes with the recommendation in §7 and
documents the choice in the PR.

1. **Coverage scope.** §7 specifies 6 subjects × ~116 topics. That
   is ~25% of the full German Gymnasium Oberstufe curriculum.
   Should the agent author all 116 (large effort, multi-week),
   or should the agent author a smaller MVP (e.g. 2 chapters
   per subject, ~12 topics per subject) and ship the rest
   incrementally?
   **Recommendation:** all 116 in the plan as written, but the
   agent may scope down to 60–80 in V1 if the content effort
   exceeds the agent's time budget.
2. **Formula rendering V1 vs V2.** §5.4 ships the hand-written
   renderer first. Should the agent skip V1 and ship KaTeX
   directly (adds ~200 kB to the topic page bundle)?
   **Recommendation:** ship the hand-written renderer first.
   The vast majority of Gymnasium formulas are covered. V2 is
   a follow-up if a topic needs `\frac` / `\sum` / `\int` beyond
   the hand-written subset.
3. **Canonical flashcard deck authoring.** Should the
   implementing agent author cards by hand (high quality, low
   volume) or generate them from the vocabulary list (high
   volume, lower signal)?
   **Recommendation:** hand-author 8–12 cards per topic, with
   a "Generate more" CTA that calls the AI to fill out the
   remaining slots. This stays within the AGENTS.md "no
   hand-rolled fetch" rule and uses the existing AI layer.
4. **Whether the canonical practice set is exam-grade or
   diagnostic-grade.** Exam-grade matches the Klausur style;
   diagnostic-grade surfaces the student's gaps faster.
   **Recommendation:** exam-grade. The student can always
   request AI-generated diagnostic items on top.
5. **Authoring tooling.** Should the agent use a content
   management UI (overkill for the seed), a CLI script (e.g.
   `pnpm tsx scripts/author.ts`), or just edit `convex/seed.ts`
   by hand?
   **Recommendation:** edit `convex/seed.ts` by hand. The
   existing pattern is type-safe, diffable, and
   review-friendly. No new tooling.

---

## 14. Files this plan touches (cheat-sheet for the implementing agent)

**New files:**

- `src/lib/content/miniMarkdown.ts` (parser + validator)
- `src/lib/content/mathRenderer.ts` (hand-written KaTeX subset)
- `src/lib/content/__tests__/miniMarkdown.test.ts`
- `src/lib/content/__tests__/miniMarkdown.math.test.ts`
- `src/lib/content/__tests__/validateMiniMarkdown.test.ts`
- `scripts/lint-content.ts`
- `convex/topicResources.ts`
- `convex/flashcards.ts` (if not yet present)
- `components/dashboard/LessonWorkedExamples.tsx`
- `components/dashboard/TopicFormulaSheet.tsx`
- `components/dashboard/TopicVocabularyDeck.tsx`
- `components/dashboard/CanonicalPracticeLauncher.tsx`
- `components/dashboard/CanonicalFlashcardDeck.tsx`
- `app/(app)/subjects/[slug]/[chapterSlug]/[topicSlug]/practice/page.tsx`
  (canonical-baseline practice runner)
- `app/(app)/subjects/[slug]/[chapterSlug]/[topicSlug]/practice/PracticeClient.tsx`
- `app/(app)/subjects/[slug]/[chapterSlug]/[topicSlug]/practice/results/page.tsx`
- `app/(app)/subjects/[slug]/[chapterSlug]/[topicSlug]/practice/results/ResultsClient.tsx`

**Modified files:**

- `convex/schema.ts` (§4)
- `convex/seed.ts` (extended `TopicSeed` shape, all 6 subjects
  re-authored per §7)
- `convex/subjects.ts` (`getBySlug` returns `formulaSheet` /
  `vocabularyDeck` for each topic; `getTopicDetailBySlug` returns
  the same per depth)
- `convex/practice.ts` (add `getCanonicalPracticeSet` and
  `startCanonicalPractice`)
- `app/(app)/subjects/[slug]/[chapterSlug]/[topicSlug]/TopicDetailClient.tsx`
  (wire in the five new components per §9.2)
- `components/dashboard/CommonMistakesPanel.tsx` (merge pre-seeded
  + user history per D10)
- `package.json` (add `lint:content` script)

**Unchanged files (per scope):** every other file in the project.
This plan does not touch the tutor chat, the dashboard cockpit,
the subject-detail header, the onboarding flow, the marketing
landing, or the per-subject UX from `SUBJECT-IMPROVEMENT-PLAN.md`.

---

## 15. Why this plan respects AGENTS.md

- **DDD:** New per-feature Convex files (`topicResources.ts`,
  `flashcards.ts`). Components stay presentational; content
  authoring lives in `convex/seed.ts` and the lint lives in
  `scripts/lint-content.ts`.
- **Business logic in Convex / `src/lib/`:** The new
  `topicResources.ts` and `flashcards.ts` queries are server-side.
  The mini-markdown parser + validator + math renderer are
  pure `src/lib/` utilities with no React dependency.
- **Caching:** No new cache tags. The topic page already
  invalidates on per-user practice / mastery writes; the new
  per-topic resources are read by topic-id and re-fetched
  reactively.
- **Streaming:** No streaming in the new content surface — the
  seeded content is static and small. The existing
  lesson-streaming surface (for user-generated topics,
  per `USER-TOPIC-LESSON-PLAN.md`) is untouched.
- **Strict separation:** Canonical curriculum rows
  (`subjects`, `chapters`, `topics`, `lessonBlocks`,
  `topicResources`) are separated from per-user progress
  (`userTopicProgress`, `practiceAttempts`, `mistakeEntries`).
  Pre-seeded common mistakes live in the canonical table;
  user mistakes live in the per-user table; the panel merges
  at read time.
- **Naming consistency:** `TopicResource`,
  `PracticeItem` (the existing union's third source literal),
  `FlashcardDeck`, `LessonBlock`. No new concept names.
- **Traceability:** The seed content is hand-authored; no
  `aiGenerations` rows are written for it. AI is used only
  in the user-topic loop and the tutor chat (unchanged).
- **Soft deletes:** No new soft-delete surface; the existing
  `mistakeEntries` soft-delete applies to user mistakes only.
  Pre-seeded mistakes are static canonical rows.
- **Context grounding:** The new lesson content is
  context-grounded by construction (the seed author writes
  to the topic title + chapter + subject). The tutor chat
  context-grounding is unchanged.
- **Structured outputs:** The mini-markdown parser validates
  every field at seed time via `validateMiniMarkdown` and at
  render time via the parser's own type guards. The
  canonical practice items are not LLM-generated, so no
  Zod schema is needed; the TypeScript types are the
  contract.
- **Telemetry:** No new AI calls. The existing
  `src/lib/ai/telemetry.ts` continues to log only
  AI generations, which the canonical content does not
  produce.
- **No hand-rolled fetch:** No new HTTP code. The renderer
  is React; the parser is pure; the lint is a Node script.
- **Auth:** Every new Convex query (`getFormulaSheet`,
  `getVocabularyDeck`, `getCanonicalPracticeSet`,
  `startCanonicalPractice`, `getCanonicalDeck`,
  `listByTopic`) calls `resolveUserReadOnly` (or the existing
  `ctx.auth.getUserIdentity()` pattern) where read/write
  scoping matters. The canonical practice set's
  `startCanonicalPractice` writes a `practiceAttempts` row
  and a `userTopicProgress` upsert; both are auth-scoped.

---

## 16. How long this takes

Realistic effort estimate for the implementing agent:

- §10.1–§10.4 (architecture): 1–2 days
- §10.5 (Math): 4–6 days of authoring + 1 day of integration
- §10.6 (Physics): 3–4 days of authoring + 0.5 day
- §10.7 (Chemistry): 2–3 days of authoring + 0.5 day
- §10.8 (French, in French): 3–4 days of authoring + 0.5 day
- §10.9 (German, in German): 3–4 days of authoring + 0.5 day
- §10.10 (English, in English): 2–3 days of authoring + 0.5 day
- §10.11 (UI components + topic-page integration): 2 days
- §10.12 (canonical practice UI): 1 day
- §10.13 (content quality pass): 1 day
- §10.14 (final smoke + cleanup): 0.5 day

**Total: ~25–35 days** of focused agent work. The content
authoring dominates. If the agent's time budget is shorter, the
plan's §13.1 open question applies — scope to 60–80 topics
across the six subjects and ship the rest incrementally.

---

## 17. Done definition

The plan is "done" when:

1. `npm run typecheck` passes with zero errors.
2. `npm run lint` passes with zero errors.
3. `npm run lint:content` passes with zero errors.
4. `npm run test` passes with all tests green.
5. The dev dashboard (added in §10.5) shows every canonical
   topic with every §5.1 resource present and within size.
6. A random sample of 3 topics per subject, opened in the
   topic page, renders all five new components without
   console errors.
7. A random sample of 2 worked examples per subject, opened
   in the topic page, shows the correct setup and solution.
8. The canonical-baseline practice runner works for at least
   one topic per subject, with grading and the German 1–6
   letter grade (existing flow).
9. A random sample of 1 flashcard deck per subject can be
   reviewed in the existing flashcard review page.
10. AGENTS.md is updated with the new content-model contract
    and a link to this plan.
11. The seed author has signed off on every formula in every
    formula sheet (no copy-paste errors, every formula is
    typeset correctly, every `when` field is meaningful).
12. For French / German / English subjects, a native speaker
    (or a sufficiently proficient reviewer) has confirmed
    that the content is in the target language and free of
    mechanical translation artifacts.

The implementing agent should not declare the plan "done"
without running the full §11 validation gate suite from a
clean clone and the full §17 done-definition checklist.
