# User-Topic → Lesson → Practice → Grading → Tutor-Context
## Implementation plan for Synedrix

**Status:** Plan only — no code in this doc. The implementing agent should follow the
ordered step list in §10 exactly and re-validate after each numbered step.

**Owner of decisions when ambiguous:** see §2 (Architecture Decisions).

---

## 1. Feature overview (from the user)

The student can:

1. **Add a new topic** (currently the catalog is the 9 canonical topics in
   `convex/seed.ts` — students cannot create their own).
2. Have the tutor AI **generate a whole-topic text** — informational prose about
   the new topic.
3. From that generated text, have the tutor AI **create text-only practice
   questions**.
4. **Write their answers in prose**.
5. Have the tutor AI **evaluate every answer, give a per-question grade + a
   per-run overall grade, and provide a "better answer" / correction**.
6. **Optionally, use the lesson + their answers + mistakes + corrections as
   context** when opening the tutor chat to discuss the lesson.

End state: a closed learning loop the student can run on **any** topic — even
ones the canonical curriculum does not cover.

---

## 2. Architecture decisions (locked)

| # | Decision | Choice | Why |
|---|---|---|---|
| D1 | Where do user-owned topics live? | **Extend `topics` with a discriminator + ownership**, not a parallel `userTopics` table. | AGENTS.md: "exactly one name per concept everywhere." `Topic` is `Topic`. A separate `userTopic` table would force every read to union canonical + user rows and would lose primary-key locality on the canonical index. |
| D2 | Lesson storage | **New table `topicLessons`** parallel to `lessonBlocks`. | `lessonBlocks` is the canonical multi-block curriculum text (`{title, content, order}` indexed by `(topicId, depth)`). The user-generated lesson is a single coherent prose document with optional sections, not a curriculum-arc of blocks. Don't shoehorn into `lessonBlocks`. |
| D3 | Practice item storage | **Reuse `practiceItems`** with a discriminator + a new `sourceLessonId` op-ref. | Concept name stays `PracticeItem`. Adds the `type: "user_text_answer"` variant to the existing discriminated union. |
| D4 | Practice run storage | **New table `topicLessonPractice`** (one row per *run*, not per item). | A run is a bankable unit that tracks `status`, `overallScore`, letter grade. `practiceItems` are per-question; `topicLessonPractice` is per-attempt-set. Distinct concept name. |
| D5 | Answer storage | **Reuse `practiceAttempts`**. | Already models `userAnswer`, `verdict`, `score`, `feedback`. Schema-complete. |
| D6 | Correction storage | **Reuse `mistakeEntries`**. | Already models `mistakeType`, `cause`, `recoveryAction`, plus the `practiceAttemptId` link. |
| D7 | Telemetry | All three AI tasks go through `src/lib/ai/telemetry.ts` with task identifiers `generateCourseLesson`, `generatePracticeFromLesson`, `gradeAnswer` (singular). | AGENTS.md: "every AI generation must be logged to AiGeneration with usage metrics, model info, and schema validation results." |
| D8 | Lesson generation UX | **Stream (`streamObject`)** the lesson text back to the client as it is generated. | Lessons are large (~1–3 k words). The student benefits from seeing prose fill in live. The structured sections array is the validation surface. |
| D9 | Practice generation UX | **`generateObject` (non-streaming)** for practice items. | Small structured output (5 items). Validation is atomic — we never want to "stream-partially" a practice set and then fail Zod, leaving the user retrying on a half-delivered set. |
| D10 | Grading UX | **`generateObject` per answer**, called when the student submits an answer. | Small structured output per answer. Latency should be sub-3 s; a streaming UI here adds no value and complicates error handling. |
| D11 | Grading aggregation | **Per-run letter grade 1–6 (German Gymnasium convention)**. | Target user is a German Gymnasium student (per AGENTS.md and `app/(app)/layout.tsx` German-first UI). The German school grades are: 1 = sehr gut (≥ 92 %), 2 = gut (≥ 81 %), 3 = befriedigend (≥ 67 %), 4 = ausreichend (≥ 50 %), 5 = mangelhaft (≥ 30 %), 6 = ungenügend (< 30 %). Show in the UI as both letter `1–6` and the matching label. |
| D12 | Tutor-context surface | **Extend `?subject=&topic=&lesson=<runId>` on `/tutor`**, not a new dedicated route. | The tutor is already a chat page with optional context. Add one optional query param and one extra Convex read. Avoids a parallel UI surface. The thread resolves the same way `getThread({subjectId, topicId})` does today. |
| D13 | Naming consistency | One name per concept everywhere: `Topic`, `Lesson` (`topicLessons`), `PracticeItem`, `PracticeAttempt`, `MistakeEntry`, `AiGeneration`. No `userLesson`/`userTopic`/`userMistake`. |

---

## 3. Data model changes

All edits go into **`convex/schema.ts`**. Run `npx convex dev` after this step to validate.

### 3.1 Extend `topics`

Add two columns. Both default to canonical values so existing rows migrate without a script.

```ts
topics: defineTable({
  chapterId: v.id("chapters"),
  title: v.string(),
  slug: v.string(),
  objectives: v.array(v.string()),
  examRelevance: v.number(),
  difficulty: v.union(v.literal("EASY"), v.literal("MEDIUM"), v.literal("HARD")),
  estimatedMinutes: v.optional(v.number()),
  gradeLevel: v.optional(v.string()),
  // NEW:
  source: v.union(v.literal("canonical"), v.literal("user")), // default = "canonical" on insert if missing
  ownerId: v.optional(v.id("users")), // only set when source = "user"
})
  .index("by_chapter", ["chapterId"])
  .index("by_slug", ["slug"])
  // NEW:
  .index("by_owner", ["ownerId"])
  .index("by_owner_source", ["ownerId", "source"]),
```

Add a new index specifically for the chapter page so user-added topics show up there
(they should — the `${subject}/${chapter}/${topic}` drilldown flow is the natural place):

```ts
// In the chapter detail query, return both canonical and user-owned topics
// for a chapter, sorted by source then examRelevance desc. See §4.2.
```

Migration note: existing rows have `source = undefined` after deploy. The Convex
client treats undefined as "missing"; queries must treat undefined as
`"canonical"`. Code that reads `row.source ?? "canonical"` is the correctness
fix here. Documented in `convex/subjects.ts` docblocks.

### 3.2 New `topicLessons`

```ts
/**
 * The AI-generated whole-topic text for a user-created topic.
 *
 * One row per (topicId, depth, version). Canonical topics never
 * have rows here — their lesson text lives in `lessonBlocks`.
 *
 * IMUTABLE: each regenerate bumps `version`. Old versions are
 * retained so practice items remain linked to the lesson version
 * the student saw.
 */
topicLessons: defineTable({
  topicId: v.id("topics"),
  depth: v.union(v.literal("simple"), v.literal("standard"), v.literal("rigorous")),
  // The full prose, joined sections. Source of truth.
  content: v.string(),
  // The structured per-section view the UI renders and the
  // practice-generator downstream consumes.
  sections: v.array(
    v.object({
      heading: v.string(),
      body: v.string(),
    })
  ),
  wordCount: v.number(),
  // Free-text glossary the AI produced for the topic.
  glossary: v.array(
    v.object({ term: v.string(), definition: v.string() })
  ),
  generatedBy: v.id("users"),
  generatedAt: v.number(),
  version: v.number(), // starts at 1; regenerates bump to 2, 3, ...
  // The model that produced this lesson, for telemetry/debugging.
  model: v.string(),
  schemaValid: v.boolean(),
})
  .index("by_topic", ["topicId"])
  .index("by_topic_version", ["topicId", "version"]),
```

### 3.3 Extend `practiceItems`

Add a new type variant, a source discriminator, and the source-lesson link.
Add a new index.

```ts
practiceItems: defineTable({
  practiceSetId: v.id("practiceSets"),
  type: v.union(
    v.literal("mcq"),
    v.literal("short_answer"),
    v.literal("step_problem"),
    v.literal("fill_blank"),
    v.literal("user_text_answer"), // NEW: open-prose answer for user-generated lessons
  ),
  question: v.string(),
  options: v.optional(v.array(v.string())),
  answer: v.string(),                  // model-authored "expected" answer
  explanation: v.string(),             // additional rationale for the student on review
  skills: v.array(v.string()),
  order: v.number(),
  // NEW:
  source: v.union(
    v.literal("canonical"),     // generated by the canonical pipeline (mcq/step_problem)
    v.literal("user_lesson"),   // generated from a user-created topic's lesson
  ),
  sourceLessonId: v.optional(v.id("topicLessons")),
  rubric: v.optional(v.array(v.string())), // optional grading rubric for user_lesson items
})
  .index("by_practice_set", ["practiceSetId"])
  .index("by_source_lesson", ["sourceLessonId"]),
```

### 3.4 Reuse `practiceSets`

Add a new link to a lesson run if needed:

```ts
practiceSets: defineTable({
  topicId: v.id("topics"),
  title: v.string(),
  difficulty: v.union(v.literal("EASY"), v.literal("MEDIUM"), v.literal("HARD")),
  generatedById: v.optional(v.id("users")),
  createdAt: v.number(),
  // NEW:
  source: v.union(
    v.literal("canonical"),
    v.literal("user_lesson"),
  ),
  sourceLessonId: v.optional(v.id("topicLessons")),
}),
```

`createUserTopicTopicSet` will create a `practiceSet` of `source: "user_lesson"`
each time the student starts a new practice run.

### 3.5 New `topicLessonPractice` (one row per practice *run*)

```ts
/**
 * One row per practice run the student takes against a
 * user-generated lesson. Tracks run-level state (status, score,
 * grade). The individual answers live in `practiceAttempts`,
 * joined through `practiceItems` (via `practiceSets`).
 */
topicLessonPractice: defineTable({
  userId: v.id("users"),
  topicId: v.id("topics"),
  lessonId: v.id("topicLessons"),     // exact lesson version practiced against
  practiceSetId: v.id("practiceSets"),
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
  status: v.union(
    v.literal("in_progress"),
    v.literal("graded"),
    v.literal("abandoned"),
  ),
  itemCount: v.number(),
  answeredCount: v.number(),
  overallScore: v.optional(v.number()),        // 0..1
  grade: v.optional(v.union(
    v.literal("1"), v.literal("2"), v.literal("3"),
    v.literal("4"), v.literal("5"), v.literal("6"),
  )),
})
  .index("by_user", ["userId"])
  .index("by_user_topic", ["userId", "topicId"])
  .index("by_lesson", ["lessonId"]),
```

`overallScore` and `grade` are computed at finish time by
`finishLessonPractice` (§4.5).

### 3.6 `mistakeEntries` — no change

Already has all the fields we need:
`practiceAttemptId`, `cause`, `mistakeType` discriminator (six options already —
matches the kinds of prose-answer mistakes the grader will produce), `recoveryAction`
for the "next step" hint.

### 3.7 `aiGenerations` — no change

Already has `task: v.string()`, `relatedId: v.optional(v.string())`. We set
`task` to one of `generateCourseLesson` / `generatePracticeFromLesson` /
`gradeAnswer` and `relatedId` to the produced row's `_id`.

---

## 4. Convex surface (new + changed)

All function files live under **`convex/`**.

### 4.1 NEW: `convex/topics.ts` (user-topic mutations + queries)

```ts
// create the user-owned topic AND its first lesson in one mutation.
// First writes the `topics` row, then calls the AI lesson generator,
// then writes the `topicLessons` row. Returns `{ topicId, lessonId }`.

createUserTopic(args: {
  chapterId: v.id("chapters"),
  title: v.string(),
  brief: v.string(),
  difficulty: v.union(v.literal("EASY"), v.literal("MEDIUM"), v.literal("HARD")),
  depth: v.union(v.literal("simple"), v.literal("standard"), v.literal("rigorous")),
  objectives: v.optional(v.array(v.string())),
  gradeLevel: v.optional(v.string()),
}): v.object({ topicId: v.id("topics"), lessonId: v.id("topicLessons") })

// Slug uniqueness. Same logic as the canonical seeder
// (kebab-case the title; if collision, append -2, -3, …).

// regenerateTopicLesson rolls a new version (only fetches state from
// the previous lesson — never overwrites). Returns the new lessonId.

regenerateTopicLesson(args: {
  topicId: v.id("topics"),
  depth: v.union(v.literal("simple"), v.literal("standard"), v.literal("rigorous")),
}): v.object({ lessonId: v.id("topicLessons") })

// query — read a single lesson version
getTopicLesson(args: {
  topicId: v.id("topics"),
  version: v.optional(v.number()), // default = latest
}): v.union(v.object({...read shape...}), v.null())

// query — list user's owned topics
listUserTopicsByOwner(args: { ownerId: v.id("users") }): v.array(...)
```

### 4.2 CHANGED: `convex/subjects.ts`

`getChapterBySlug` already returns `topics` per chapter. Extend it to **also
return user-owned topics** under the same chapter, with a discriminator on
each row:

```ts
topics: v.array(
  v.object({
    id: v.id("topics"),
    slug: v.string(),
    title: v.string(),
    objectives: v.array(v.string()),
    examRelevance: v.number(),
    difficulty: v.union(...),
    estimatedMinutes: v.union(v.number(), v.null()),
    mastery: v.number(),
    lastStudiedAt: v.union(v.number(), v.null()),
    isStudied: v.boolean(),
    // NEW:
    source: v.union(v.literal("canonical"), v.literal("user")),
    ownerId: v.union(v.id("users"), v.null()),
  })
)
```

`getBySlug` and `getTopicBySlug` unchanged (canonical read path).

### 4.3 NEW: `convex/practice.ts` (lesson-scoped practice runs + grading)

```ts
// Mutation: creates a `topicLessonPractice` row + a `practiceSets`
// row of source "user_lesson" + N `practiceItems` rows by calling
// the practice-generator AI. Returns the new run + the itemIds.
// Sets status = "in_progress".

startLessonPractice(args: {
  lessonId: v.id("topicLessons"),
  itemCount: v.optional(v.number()), // default 5
}): v.object({
  runId: v.id("topicLessonPractice"),
  itemIds: v.array(v.id("practiceItems")),
})

// Mutation: persist the student's answer, call the grading AI,
// write a `practiceAttempts` row + (if verdict !== "correct") a
// `mistakeEntries` row, increment answeredCount on the run.
// Returns the grade + the new mistakeEntryId if any.

submitAnswerAndGrade(args: {
  runId: v.id("topicLessonPractice"),
  itemId: v.id("practiceItems"),
  userAnswer: v.string(),
}): v.object({
  attemptId: v.id("practiceAttempts"),
  verdict: v.union(
    v.literal("correct"), v.literal("partially_correct"), v.literal("incorrect"),
  ),
  score: v.number(),
  feedback: v.string(),
  betterAnswer: v.string(),
  mistakeEntryId: v.union(v.id("mistakeEntries"), v.null()),
})

// Mutation: mark the run graded/finalised, compute overallScore
// and the German 1–6 grade from per-item scores. Snake-eye:
// if no answeredCount > 0, throw.

finishLessonPractice(args: {
  runId: v.id("topicLessonPractice"),
}): v.object({
  runId: v.id("topicLessonPractice"),
  overallScore: v.number(),
  grade: v.union(...1..6),
})

// abandonment: same status write, does not compute grade.
abandonLessonPractice(args: { runId: v.id("topicLessonPractice") }): v.null()

// Queries
getLessonPracticeRun(args: { runId: v.id("topicLessonPractice") })
getLessonPracticeRunItems(args: { runId: v.id("topicLessonPractice") })
  // returns joined rows: item prompt, expectedAnswer, the student's
  // attempt (if any), verdict, score, feedback, betterAnswer, mistakeEntry
listLessonPracticeRunsByUser(args: { userId: v.id("users") })
```

The "join" surface (`getLessonPracticeRunItems`) returns a denormalized array
suitable for the results page — one row per item with everything needed for
display. Acceptable for small N (default 5 items).

### 4.4 NEW: `convex/tutorContext.ts`

```ts
/**
 * Returns the tutor system-prompt context block for a
 * completed lesson run. Called by /tutor when `?lesson=` is
 * present. Bundles the lesson summary, the per-item Q/A,
 * the better answers, and the mistake entries into a single
 * structured payload the chat prompt builder (§5.3) consumes.
 *
 * Returns null if the run does not exist or is not graded.
 */
getContextForLessonRun(args: {
  runId: v.id("topicLessonPractice"),
}): v.union(rich-object, v.null())
```

### 4.5 CHANGED: existing helpers

- `convex/users.ts` — `resolveUserReadOnly` + `requireUser` already
  present. New mutations call `requireUser(ctx)` and gate writes to
  `ownerId === user._id`.
- `convex/telemetry.ts` — unchanged; new AI calls use `task` to differentiate.

---

## 5. AI plumbing

### 5.1 NEW: `src/lib/ai/prompts/lesson.ts`

```ts
// Zod-shape the model must return. Streaming output.
export const lessonSchema = z.object({
  sections: z.array(
    z.object({
      heading: z.string().min(1).max(80),
      body: z.string().min(20).max(4000), // ~one paragraph
    })
  ).min(3).max(12),
  glossary: z.array(z.object({
    term: z.string().min(1).max(40),
    definition: z.string().min(5).max(300),
  })).max(30),
});

// System prompt builder.
export function buildCourseLessonPrompt(g: {
  subjectTitle: string;
  subjectSlug: string;
  topicTitle: string;
  brief: string;
  objectives: readonly string[];
  gradeLevel: string | null;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  depth: "simple" | "standard" | "rigorous";
  language: string; // "de"
}): string;
// Prompt shape: German Gymnasium student, X grade, in subject Y.
// Topic: Z. Brief: Q. Output a structured lesson in 4–8 sections
// plus a short glossary. Stay grounded; do not invent citations.
```

### 5.2 NEW: `src/lib/ai/prompts/practice.ts`

```ts
export const practiceItemSchema = z.object({
  prompt: z.string().min(10).max(400),
  expectedAnswer: z.string().min(10).max(800),
  skill: z.string().min(1).max(40),
  rubric: z.array(z.string().min(2).max(120)).min(1).max(4),
});

export const practiceItemsSchema = z.object({
  items: z.array(practiceItemSchema).min(3).max(8),
});

// Build the prompt with the full lesson content, the topic title,
// the student's grade level, and the requested item count.
export function buildPracticeFromLessonPrompt(g: {
  lessonContent: string;       // joined sections, tokens trimmed if huge
  lessonSections: { heading: string; body: string }[];
  topicTitle: string;
  count: number;
  gradeLevel: string | null;
  language: string;
}): string;
// Prompt shape: from the lesson above, write N open-prose questions
// that test understanding at depth X. Each question has prompt +
// expected answer + skill tag + grading rubric (1–4 bullets).
```

### 5.3 NEW: `src/lib/ai/prompts/grading.ts`

```ts
export const gradingSchema = z.object({
  verdict: z.union([
    z.literal("correct"),
    z.literal("partially_correct"),
    z.literal("incorrect"),
  ]),
  score: z.number().min(0).max(1),
  feedback: z.string().min(5).max(800),     // shown to the student
  betterAnswer: z.string().min(10).max(800),  // model-authored "what a strong answer would say"
  mistakeType: z.union([
    z.literal("CONCEPT_MISUNDERSTANDING"),
    z.literal("CALCULATION_MISTAKE"),
    z.literal("CARELESS_ERROR"),
    z.literal("FORMULA_RECALL_FAILURE"),
    z.literal("MISREAD_QUESTION"),
    z.literal("LANGUAGE_EXPRESSION_ISSUE"),
  ]).nullable(),
  cause: z.string().min(5).max(400).nullable(),
});

export function buildGradingPrompt(g: {
  lessonExcerpt: string;     // the section the question covers
  prompt: string;
  expectedAnswer: string;
  rubric: readonly string[];
  userAnswer: string;
  language: string;
}): string;
```

### 5.4 NEW: `src/lib/ai/invoke.ts` (one place for AI invocation per task)

A small abstraction over `getGenerateLesson`, `getGeneratePractice`,
`getGrader`. Each function:

- opens an authenticated `ConvexHttpClient` (mirrors the chat route).
- calls `streamObject` (lesson) or `generateObject` (practice/grading).
- validates Zod schema; on Zod fail, returns a typed error to the caller
  (no silent fallbacks; the caller decides whether to surface a degraded
  fallback per task).
- wraps the call in `logAiGeneration` with `task`, `model`, `latencyMs`,
  `inputTokens`, `outputTokens`, `schemaValid`, `relatedId: lessonId|practiceId|attemptId`.

This centralizes the "wrap-with-telemetry, validate Zod" rule so the
Convex mutations stay free of AI plumbing noise. Per AGENTS.md the
prompt builders are the *only* place prompts are constructed.

### 5.5 Route handlers — only **one** new route handler is needed

`POST /api/topics/lesson/stream` — a streaming endpoint that calls
`streamObject({ …, schema: lessonSchema })` and returns a text/event-stream
the lesson page subscribes to with `useObject`. The Convex mutation
`createUserTopic` runs AFTER the stream completes to commit the canonical row.

This pattern keeps the lesson "live types in" UX while still making the
final row a normal Convex document.

(The practice generation and grading run **inside** the Convex mutations
themselves through `src/lib/ai/invoke.ts` — they are small structured
outputs and don't need stream-out.)

### 5.6 Tutor-context prompt extension

Extend `src/lib/ai/prompts/chat.ts`:

```ts
export interface ChatGrounding {
  // existing fields …
  // NEW (all optional):
  lessonContext?: {
    topicTitle: string;
    lessonSummary: string;
    grade: "1" | "2" | "3" | "4" | "5" | "6";
    items: ReadonlyArray<{
      prompt: string;
      userAnswer: string;
      verdict: "correct" | "partially_correct" | "incorrect";
      score: number;
      feedback: string;
      betterAnswer: string;
    }>;
    mistakes: ReadonlyArray<{
      type: string; // mistakeType
      cause: string;
    }>;
  };
}
```

When `lessonContext` is present, the system prompt appends a clearly
delimited block:

```
== Lesson the student just completed ==
Topic: <title>
Overall grade: <1..6>
Items:
  - [score 0.85 · correct] <prompt>
      Student answered: <userAnswer>
      Feedback: <feedback>
      Stronger answer: <betterAnswer>
  - [score 0.40 · incorrect] <prompt>
      ...
Student's mistakes (use these to focus):
  - CONCEPT_MISUNDERSTANDING — <cause>
  - ...
== End of lesson context ==
```

Without this block, the existing prompt is unchanged. AGENTS.md
"context grounding" requirement is met by either path.

---

## 6. Routes / pages

### 6.1 NEW: `app/(app)/my-topics/layout.tsx` + children

A route group for user-owned topics only. Nested to keep the per-chapter
canonical drilldown untouched. Layout mirrors the chapter detail layout.

### 6.2 CHANGED: `app/(app)/subjects/[slug]/[chapterSlug]/ChapterDetailClient.tsx`

Append a "+ Add topic" button inside the `CockpitCard` at the end of the
`TopicList`'s `<ol>`. On click:

- opens an inline form (title, brief, difficulty, depth, optional objectives)
  in-place. No modal — modal would be a heavier UX cost than needed.
- shows an inline 3-state button: idle → "Generating…" with a live
  stream display of the lesson section headings as they fill in
  → done/error.
- on success, navigates to `/my-topics/[topicSlug]/lesson` (where
  `topicSlug` = the slug derived from the title at creation time).

### 6.3 NEW: `app/(app)/my-topics/[topicSlug]/lesson/page.tsx`

Server shell, preload the topic + lesson. Delegates to client island.

```tsx
// page.tsx — server
const topic = await fetchQuery(api.topics.getBySlugAndOwner, {
  slug: topicSlug, ownerId: userId,
});
const lesson = await fetchQuery(api.topics.getTopicLesson, {
  topicId: topic.id, version: latest,
});
```

Renders the lesson in `CockpitCard` chrome. CTAs:
- "Regenerate lesson" (bumps version)
- "Start practice" (button: starts a practice run, navigates to `/practice`)

### 6.4 NEW: `app/(app)/my-topics/[topicSlug]/practice/page.tsx`

One prompt at a time. Top of the page: progress (`2 of 5 answered`),
an "Abandon" link. Body: the prompt, the lesson-section link it
covers, a `<textarea>` for the answer, "Submit" + "Skip" buttons.
On submit:
- the textarea locks (spinner)
- returns the grade card: verdict pill, score, feedback, better answer
- "Next question" advances; on the last question, "Finish & view results".

State machine:
```
idle → submit-pending → grade-shown → (next | finish)
```

### 6.5 NEW: `app/(app)/my-topics/[topicSlug]/practice/results/page.tsx`

Server shell. Renders:
- the overall grade (a large `1`–`6` chip with the matching German label)
- the per-item list with verdict/score/feedback/better answer
- a "Discuss with tutor" CTA that routes to
  `/tutor?subject=<slug>&topic=<slug>&lesson=<runId>` — this is the
  extension to the existing `/tutor` surface (§7).

### 6.6 NEW: `app/(app)/my-topics/page.tsx`

Optional. Lists all the student's user-owned topics with per-topic
latest-grade + last-practiced timestamp. A simple dashboard tile. Not
required for v1 — deferred to §10.

---

## 7. Tutor page extension

`app/(app)/tutor/page.tsx`:

- Add `lesson` to the `searchParams` Promise type.
- If `lesson` is present AND `getContextForLessonRun({ runId })` returns a shape:
  - build a `lessonContext` object (§5.6) and pass it to `TutorClient`
    via a new optional prop.
- If `lesson` is set but `getContextForLessonRun` returns `null` (run not
  graded / doesn't exist), log a warning and continue without `lessonContext`
  — never block the tutor.

`app/(app)/tutor/TutorClient.tsx`:

- Optional `lessonContext` prop. Render a small banner above the
  `MessageList`: "Discussing your last lesson on *<topic title>*, grade
  **<1–6>**". The banner is visible until the user finishes the lesson
  context (not persistently dismissed — light enough to keep).
- `app/api/tutor/chat/route.ts` — accept a new optional `lessonContext`
  in the request body. If present, fold it into the `ChatGrounding` so
  the system prompt includes the lesson block (§5.6).

The existing thread/unread/sidebar semantics are unchanged. The lesson
context is per-thread: a thread with the same `(subjectId, topicId)` pair
is reused, regardless of whether it had a previous lesson context. The
fresh system prompt rebuilds on each /api/tutor/chat call with whatever
context is in the URL params — which is the existing behavior for
`?subject=&topic=` context anyway.

---

## 8. Telemetry

- All three new AI tasks: `generateCourseLesson`, `generatePracticeFromLesson`, `gradeAnswer`.
- Each call writes one `aiGenerations` row via `src/lib/ai/telemetry.ts:logAiGeneration`.
- `schemaValid` is `false` when Zod parses-but-fails or the model
  refuses; in those cases the call is *still* logged (so we can monitor
  the failure rate) but the structured output is discarded and the
  caller returns a typed error to the user.
- `relatedId` is the canonical row id the generation is intended to
  produce (`lessonId`, `practiceSetId`, `attemptId`).

---

## 9. Validation gates (run after each numbered step in §10)

- **TypeScript:** `npm run typecheck` (project-wide).
- **ESLint:** `npm run lint` (project-wide).
- **Convex schema:** `npx convex dev` after every schema change — must
  show "Schema valid".
- **Vitest units (new):** under `src/lib/ai/prompts/__tests__/`
  - `lesson.test.ts` — build prompt, assert contains subject/topic/brief/gradeLevel; Zod schema positive + negative fixtures; hard-cap on `body` length.
  - `practice.test.ts` — build prompt, assert contains lesson sections + count; Zod schema fixtures.
  - `grading.test.ts` — build prompt, assert contains prompt/userAnswer/rubric; Zod schema fixtures including `mistakeType: null`.
- **Vitest unit (logic):** `convex/practice.test.ts` (small) — grade boundary tests for the 1..6 computation from per-item scores.
- **Manual smoke:** dev user: create topic → see lesson stream → click Start practice → answer 3 items → see results grade → click Discuss with tutor → confirm banner + first AI reply references the lesson.

If any gate fails, **stop, fix, re-run from the failing item down**.

---

## 10. Implementation order (numbered, sequential)

The implementing agent must follow this order. Each step ends with the §9
validation gates passing without errors.

1. **Schema deltas** (§3) — write `convex/schema.ts`, run `npx convex dev`, run
   `npm run typecheck` + `npm run lint`.
2. **AI prompt modules + Zod schemas + invoke helper** (§5.1–§5.4) — write
   `src/lib/ai/prompts/lesson.ts`, `practice.ts`, `grading.ts`, `invoke.ts`.
   Add Vitest unit tests under `src/lib/ai/prompts/__tests__/`. Run tests.
3. **Topic mutations + queries** (§4.1) — `convex/topics.ts`. Includes the
   slugify-uniqueness helper. Validate.
4. **`getChapterBySlug` extension** (§4.2) — extend the topics array shape
   to include `source` + `ownerId`. Update `components/dashboard/TopicList.tsx`
   to add a "MY TOPIC" badge on user-source rows. No new CTA yet. Validate.
5. **Practice mutations + grading** (§4.3) — `convex/practice.ts`. Validate.
6. **Tutor context query** (§4.4) + **chat prompt builder extension** (§5.6).
   Validate.
7. **Lesson stream route handler** (§5.5) — `app/api/topics/lesson/stream/route.ts`.
   Validate (typecheck + lint).
8. **Chapter page "+ Add topic"** form (§6.2) — wire it through to the
   stream endpoint, then commit the row via a small Convex mutation
   on stream-complete. Validate in browser.
9. **Lesson page** (§6.3) — read mode + Regenerate + Start practice CTAs.
   Validate.
10. **Practice page** (§6.4) — one-prompt-at-a-time flow. Validate.
11. **Results page** (§6.5) + grade computation. Validate.
12. **Tutor page extension** (§7) — wire `?lesson=<runId>`. Validate.
13. **`my-topics` listing page** (§6.6) — optional dashboard tile, skip if
    out of budget for the implementing agent's slot; not blocking.
14. **Final smoke + cleanup** — run all §9 gates from scratch; remove
    any dead code from the implementing agent's branch.

Each step is a logical commit boundary. The implementing agent should
land only after all gates for that step are green.

---

## 11. Edge cases (decision log)

| Case | Behavior |
|---|---|
| Zod fails on lesson generation | The `topics` row is still written; `topicLessons` row is written with `schemaValid: false` so the user sees a degraded lesson read view ("The lesson couldn't be structured; here is the raw prose only"). A "Regenerate" CTA is offered. |
| Zod fails on practice generation | `topicLessonPractice.status` stays `"in_progress"` with `itemCount: 0`. User can retry from the lesson page. The system does *not* invent practice items. |
| Zod fails on grading | Save the attempt with `verdict: "partially_correct"`, `score: 0.5`, `feedback: "I couldn't grade this one — please ask the tutor or retry."`, `betterAnswer: ""`, `mistakeType: null`. Always show a clear path forward to the tutor. |
| Student abandons mid-practice | `topicLessonPractice.status = "abandoned"`. UI shows a "Resume" CTA on /my-topics/[topicSlug]/practice; resume reads unchanged context (same item set). |
| Topic regen | New `topicLessons.version` row. Practice runs already linked to the previous version retain the link (immutable history). Latest lesson is what `/my-topics/[topicSlug]/lesson` reads by default. |
| Two parallel `createUserTopic` calls with the same title | Slug uniqueness on insert (the helper appends `-2`, `-3`, ...). No collision in the canonical `topics` index. |
| Tutor page served with `?lesson=<runId>` that does not exist | The page logs and continues without `lessonContext`. The thread resolves normally. |
| Long lesson streams | Client uses `useObject` from `@ai-sdk/react` with a capped token budget. The model-side cap is `maxOutputTokens: 5000` for lesson generation, 1500 for practice, 800 for grading. |
| Privacy | `practiceAttempts` and `mistakeEntries` for these runs are scoped by `userId` (existing compound indexes already enforce this — verified in `convex/tutor.ts: getContextForChat`). |
| Naming consistency | Covered in D13 — no new concept names. |

---

## 12. Open questions for the user (if the implementing agent hits them)

These are explicit *only* if the agent cannot proceed without user input.
Otherwise the agent goes with the decision in §2 and documents the choice
in the PR.

1. **Should user-created topics appear in the dashboard's subject mastery
   strip?** Recommended: **yes**, with a small "YOURS" chip.
2. **Should the topic-creation form accept a free-form `brief` only, or
   also per-objective lines?** Recommended: accept brief + an
   `objectives` textarea (one per line). Brief alone is underspecified for
   high-quality lessons.
3. **Should the topic-creation form pre-select `difficulty` and `depth`?**
   Recommended: pre-select `difficulty = MEDIUM`, `depth = "standard"`,
   let the user override.
4. **Max lesson length cap?** Recommended: 5 000 words / 10 sections.
   Anything beyond that and the student absorbs less.

If the implementing agent is uncertain about one of these, it should default
to the recommendation in this doc and call it out in the PR summary so the
user can override post-merge.

---

## 13. Files this plan touches (cheat-sheet for the implementing agent)

**New files:**
- `convex/topics.ts`
- `convex/practice.ts`
- `convex/tutorContext.ts`
- `src/lib/ai/prompts/lesson.ts`
- `src/lib/ai/prompts/practice.ts`
- `src/lib/ai/prompts/grading.ts`
- `src/lib/ai/invoke.ts`
- `src/lib/ai/prompts/__tests__/lesson.test.ts`
- `src/lib/ai/prompts/__tests__/practice.test.ts`
- `src/lib/ai/prompts/__tests__/grading.test.ts`
- `app/api/topics/lesson/stream/route.ts`
- `app/(app)/my-topics/layout.tsx`
- `app/(app)/my-topics/page.tsx`
- `app/(app)/my-topics/[topicSlug]/lesson/page.tsx`
- `app/(app)/my-topics/[topicSlug]/lesson/LessonClient.tsx`
- `app/(app)/my-topics/[topicSlug]/practice/page.tsx`
- `app/(app)/my-topics/[topicSlug]/practice/PracticeClient.tsx`
- `app/(app)/my-topics/[topicSlug]/practice/results/page.tsx`
- `app/(app)/my-topics/[topicSlug]/practice/results/ResultsClient.tsx`

**Changed files:**
- `convex/schema.ts` (§3)
- `convex/subjects.ts` — extend `getChapterBySlug` topics return shape (§4.2)
- `app/(app)/subjects/[slug]/[chapterSlug]/ChapterDetailClient.tsx` (§6.2)
- `components/dashboard/TopicList.tsx` — "MY TOPIC" badge + per-row link
  fix for user-source topics
- `app/(app)/tutor/page.tsx` — read `lesson` param (§7)
- `app/(app)/tutor/TutorClient.tsx` — new `lessonContext` prop + banner (§7)
- `app/api/tutor/chat/route.ts` — accept `lessonContext` in body (§7)
- `src/lib/ai/prompts/chat.ts` — `ChatGrounding.lessonContext` (§5.6)

---

## 14. Why this plan respects AGENTS.md

- **DDD:** Per-feature Convex files (`topics.ts`, `practice.ts`, `tutorContext.ts`).
- **Business logic in Convex / `src/lib/`:** All AI gen, grading, run aggregation, slug uniqueness are server-side. Components stay presentational.
- **Caching:** This feature doesn't add or invalidate cache tags — the existing `cacheTag` strategy is unaffected (practice/run writes are new tables, not subject/chapter widgets).
- **Streaming:** Lesson is streamed (`streamObject`); practice + grade are atomic (`generateObject`).
- **Strict separation:** Canonical curriculum data (`Subject`, `Chapter`, `Topic`, `LessonBlock`) is untouched. User-owned content lives in `topics` rows with `source: "user"`, plus new tables `topicLessons` and `topicLessonPractice`. User progress data (`practiceAttempts`, `mistakeEntries`) is reused, not duplicated.
- **Naming consistency:** `Topic`, `Lesson` (`topicLessons`), `PracticeItem`, `PracticeAttempt`, `MistakeEntry`, `AiGeneration`. Verified.
- **Traceability:** Every AI call writes `aiGenerations` with `task` discriminator + `schemaValid` + `relatedId`.
- **Soft deletes:** Not needed for new tables — `topicLessons` is immutable-by-versioning; `topicLessonPractice` uses a `status` enum including `"abandoned"`.
- **Context grounding:** Letter-grade 1–6 in German; full lesson/userAnswer/betterAnswer/mistake folded into the chat prompt when `?lesson=` is set.
- **Structured outputs:** Three new Zod schemas covering lesson / practice / grading.
- **Telemetry:** Wrapped via `src/lib/ai/telemetry.ts` with explicit task names.
- **No hand-rolled fetch:** All AI lives in `src/lib/ai/invoke.ts` over the Vercel AI SDK.
- **Auth:** Every mutation calls `requireUser(ctx)` and gates writes by `userId === ownerId`.
