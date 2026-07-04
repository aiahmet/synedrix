# Study OS — Product and Engineering Specification

> **Stack:** Next.js 16 (App Router) · TypeScript · Convex · Tailwind CSS v4 · OpenRouter via the Vercel AI SDK · Clerk
> **Scope:** Single-user v1, built for one Gymnasium student preparing for grade 12 (Oberstufe)

*The whole point: one tab, five hours, everything you need to go from "I don't get this" to "I can solve this alone."*

---

## Contents

- [1. Vision](#1-vision)
- [2. Goals and Non-Goals](#2-goals-and-non-goals)
- [3. Experience Principles](#3-experience-principles)
- [4. The Core Learning Loop](#4-the-core-learning-loop)
- [5. A Day Inside Study OS](#5-a-day-inside-study-os)
- [6. Product Architecture](#6-product-architecture)
- [7. Surfaces and Capabilities](#7-surfaces-and-capabilities)
- [8. Information Architecture](#8-information-architecture)
- [9. Tech Stack](#9-tech-stack)
- [10. Data Model](#10-data-model)
- [11. Frontend Architecture](#11-frontend-architecture)
- [12. AI System](#12-ai-system)
- [13. Design System](#13-design-system)
- [14. Search, Commands, and Notifications](#14-search-commands-and-notifications)
- [15. Non-Functional Requirements](#15-non-functional-requirements)
- [16. Security and Auth](#16-security-and-auth)
- [17. Engineering Standards](#17-engineering-standards)
- [18. Repository and Deployment](#18-repository-and-deployment)
- [19. Roadmap](#19-roadmap)
- [What Makes This Different](#what-makes-this-different)
- [Appendix: Reference Code](#appendix-reference-code)

---

## 1. Vision

Study OS is a personal learning operating system, not a notes app with a chatbot bolted on. It's built for one student who wants a single place to learn a topic, question it, drill it, track it, and come back to it later — without tabbing away to a PDF, a separate flashcard app, or a generic chat window. The target user is a German Gymnasium student spending the summer preparing for grade 12: strong in STEM, comfortable with software, optimizing for speed and measurable progress over social features or content marketplaces.

**The product thesis:** five systems, sharing one state, not five separate tools.

1. A curriculum map that shows what to learn next.
2. A knowledge workspace that explains topics clearly.
3. An AI tutor that teaches, quizzes, adapts, and reviews.
4. A practice engine for exercises, flashcards, and exam-style drills.
5. A planning and analytics layer that keeps sessions focused and visible.

What makes this a *system* rather than a bundle of features is that all five share the same context — mastery, confidence, recent mistakes, current goal — so the tutor already knows what the practice engine just tested, and the planner already knows what the review queue is about to demand.

## 2. Goals and Non-Goals

**Goals**
- Prepare the student for grade 12 topics before school starts.
- Recover weak grade-11 foundations without shame or overload.
- Turn every topic into a repeatable workflow: learn → question → practice → test → review.
- Make "I don't understand this" become "I can solve this alone" as fast as possible.
- Centralize subject-specific study — math, physics, chemistry, French, German, English — in one interface.
- Keep the codebase maintainable enough that one person can extend it indefinitely.

**Non-goals for v1**
- Multi-tenant classroom platform.
- Social learning network.
- Marketplace for user-generated content.
- Native mobile app.
- Full LMS complexity — teachers, grading, institutional billing.

## 3. Experience Principles

- One app, many study modes — never a reason to open another tab.
- Minimal friction to start a focused session.
- AI is embedded in the workflow, not a chat window bolted to the side.
- Every screen answers one question: what should I do next?
- Data should drive action, not decorate a dashboard.
- The interface rewards consistency; it doesn't punish an off day.
- Subject workflows feel tailored — math's hint ladder isn't French's writing rubric.

## 4. The Core Learning Loop

Every topic runs the same loop. This loop *is* the product — the surfaces in Section 7 are just the different rooms where parts of it happen.

1. Diagnose current understanding.
2. Study the explanation.
3. Ask the AI tutor targeted questions.
4. Solve guided tasks.
5. Solve independent tasks.
6. Log mistakes.
7. Generate review items from those mistakes.
8. Re-test later, spaced out.

The Topic Page (7.4) runs this loop end-to-end for one topic. The Dashboard (7.1) shows where the student stands in the loop across every topic at once. The Review Center (7.7) is steps 7–8 running at scale, across every subject, on a schedule.

## 5. A Day Inside Study OS

A student opens Study OS in the morning and sees weak topics, today's goals, and a suggested session on the dashboard. He opens mathematics, studies logarithms through a structured lesson, asks the tutor targeted questions, solves generated problems, checks step-by-step feedback, saves a mistake to the error log, and closes with a short mastery check. Later he switches to French: reviews vocabulary, generates an explication outline, and finishes with active-recall flashcards. The whole day stays inside one system — no PDF, no separate flashcard app, no second chat window.

## 6. Product Architecture

The product is organized into seven domains:

| Domain | Purpose |
|---|---|
| Learning map | Subjects, chapters, topics, prerequisites, readiness |
| Study workspace | Lessons, notes, resources, AI tutoring |
| Practice engine | Quizzes, exercises, flashcards, writing prompts, oral drills |
| Revision system | Spaced repetition, review queues, weak-topic recovery |
| Planning system | Goals, sessions, time blocks, focus mode, streaks |
| Analytics | Progress, confidence, mastery, error patterns |
| Platform layer | Auth, settings, AI routing, storage, observability |

## 7. Surfaces and Capabilities

Each surface below is the **single source of truth** for what it does. There's no separate "feature breakdown" elsewhere that could drift out of sync with this list.

### 7.1 Dashboard
The home cockpit. Answers "what do I do right now?" in under a second.
- Today's focus session / daily mission card.
- Subject mastery overview (progress per subject).
- Weak-topic alerts.
- Review due today.
- Recent mistakes worth revisiting.
- Recent session summaries.
- AI-generated "best next topic."
- Weekly consistency graph.
- Goal completion snapshot.

### 7.2 Subject Hub
Each subject — mathematics, physics, chemistry, French, German, English, and optional extras like computer science — gets its own hub with a shared structure but subject-specific content:
- **Roadmap** — subject tree with topic dependencies, locked/unlocked readiness states, and a "you are here" marker relative to the grade-12 target.
- Current chapter.
- Foundations to fix (grade-11 gaps).
- Practice modes for this subject.
- Saved notes.
- Error log, filtered to this subject.
- Tests and mocks — mini-tests by chapter now, full mock exams later, results reviewed by skill rather than a single score, with confidence-vs-actual comparison.

### 7.3 Subject-Specific Behavior
The app should not treat every subject the same.

**Mathematics** — step-by-step solving workspace, formula sheets, error classification by concept, a hint ladder instead of instant full solutions, multiple variants of the same problem, symbol-friendly answer input.

**Physics** — concepts paired with formulas, unit-aware problems, decomposition into knowns/unknowns/laws/substitutions, diagram support later.

**Chemistry** — reaction balancing drills, organic chemistry pattern learning, definitions and process chains, equation and terminology practice.

**French and other languages** — vocabulary decks, grammar drills, a text-analysis helper, writing feedback against a rubric, oral prompts and speaking rehearsal, "explain this in simpler French."

**German and essay-heavy subjects** — argument-structure support, text annotation, characterization and analysis templates, thesis-to-outline generation.

### 7.4 Topic Page
The atomic learning screen — explanation, examples, active practice, and AI support in one place.
- Header: mastery indicator, confidence slider, time spent, prerequisite status.
- Explanation in three depths — simple, standard, rigorous — as tabs on the same page, not separate pages.
- Worked-example bank.
- Common mistakes / pitfalls panel.
- Notes, inline: save any block, highlight and annotate, pin key formulas or concepts, and let AI summarize the page into notes directly.
- Ask-tutor side panel, aware of subject, topic, and recent mistakes; can quote a block straight into a question.
- Generate a practice set for this topic without leaving the page.
- Flashcards auto-derived from the topic content.
- Mini mastery check to close the loop.
- Linked topics: what this depends on, what depends on this.

### 7.5 AI Tutor Workspace
A dedicated conversational workspace, not a generic chat — it always knows the current subject, topic, target difficulty, study mode, and recent mistakes.

**Modes:** explain simply, explain rigorously, hints only, quiz me, Socratic tutor, check my answer, turn this into flashcards, summarize for revision, create exam-style tasks, compare similar concepts.

**Workspace mechanics:** memory scoped to the current session by default, not a standing profile the AI reasons over indefinitely; quote any selected text to ask about it directly; turn any answer into a summary or a flashcard deck in one action.

### 7.6 Practice Arena
Where the student drills. Choose subject, topic, mode, difficulty, and length; receive generated or stored exercises.

**Question types:** multiple choice, free response, step-by-step problem solving, fill in the blank, flashcards, timed mini-tests, oral recall prompts, essay or analysis prompts, translation drills, formula derivation checks.

**Session mechanics:** generate a fresh problem set on demand, retry only what was wrong, get the solution path explained afterward, mix topics for exam simulation, run in timed mode, review every mistake right after finishing.

### 7.7 Review Center
Spaced repetition and weak-topic reinforcement, in one queue instead of scattered decks.
- Due today / overdue — driven by the spaced-repetition engine.
- Weak-foundations queue, pulling in grade-11 gaps.
- Error-log replay, pulling directly from the mistake journal.
- Formula and definition packs.
- Vocabulary decks for language subjects.
- AI-curated "rescue plan" — one recap session when several things are overdue at once, instead of dumping the whole backlog on the student.

### 7.8 Planner and Focus Mode
Connects goals to actual sessions, and turns the app into a single-task environment when it's time to work.
- Daily and weekly goals, plus subject-level time targets.
- Session timer with a deep-work mode.
- Session intention set before starting, reflection captured after.
- Session templates for recurring routines.
- Auto-generated next step at the end of a session.
- Recovery plan after missed days — reschedule, don't guilt-trip.

**Focus mode specifically:** hide non-essential navigation, full-screen session panel, a timer that's visible but calm, the current goal pinned, quick access to tutor and notes only, and a short session summary at the end.

### 7.9 Personalization Engine
**Signals in:** topic mastery, confidence self-rating, error frequency, time spent, recent inactivity, preferred study modes, subject difficulty trend, upcoming deadlines.

**Outcomes out:** best next topic, recommended session type, suggested revision timing, difficulty adjustment, AI response-style selection.

### 7.10 Analytics and Insights
Metrics that drive action, not vanity: hours studied this week, sessions completed, review completion rate, mastery changes, confidence accuracy, mistake recurrence rate, subject consistency.

The payoff is a derived insight, not a raw number — "you overestimate this topic," "chemistry decays after three days without review," "short math sessions land better than long ones."

### 7.11 Gamification, Kept Restrained
The app should motivate without feeling childish.

**Use:** study streaks, session completion, mastery progress bars, a weekly consistency score, "recovered weak topic" wins, time invested by subject.

**Avoid:** badges everywhere, cartoon rewards, a celebration animation after every single click.

## 8. Information Architecture

Next.js 16 App Router with route groups:

```txt
app/
  (marketing)/
    page.tsx
    pricing/page.tsx
  (app)/
    layout.tsx
    dashboard/page.tsx
    planner/page.tsx
    review/page.tsx
    settings/page.tsx
    subjects/
      page.tsx
      [subjectSlug]/
        page.tsx
        roadmap/page.tsx
        practice/page.tsx
        notes/page.tsx
        tests/page.tsx
        topics/
          [topicSlug]/
            page.tsx
            practice/page.tsx
            review/page.tsx
    tutor/
      page.tsx
      [threadId]/page.tsx
  api/
    ai/
      chat/route.ts
      explain/route.ts
      evaluate/route.ts
      flashcards/route.ts
      plan/route.ts
      quiz/route.ts
    webhooks/
      clerk/route.ts        # Clerk webhook for user sync
```

## 9. Tech Stack

### Core
- **Next.js 16**, App Router. Turbopack is the default bundler for both `dev` and `build` now — no flag needed. Plan caching around the newer explicit model (`"use cache"`, `cacheLife`, `cacheTag`) rather than the old implicit fetch-cache mental model. `middleware.ts` is now `proxy.ts`; keep using it for routing concerns, but see Section 16 for why it shouldn't be the only thing gating access to a page.
- **TypeScript**, strict mode.
- **React Server Components** by default; **Server Actions** for mutations where they simplify the code.
- **Tailwind CSS v4** — CSS-first config through `@theme` in your CSS file, no `tailwind.config.js` to maintain.
- **shadcn/ui** as a starting point for primitives, restyled to the design system in Section 13.
- **Lucide** for icons.
- **TanStack Query** for server state; **Zustand** for local UI state.
- **React Hook Form + Zod** for forms.
- **Convex** as the primary datastore and backend platform. Convex provides a realtime database with built-in TypeScript schema validation, reactive queries, server functions (queries, mutations, actions), file storage, text/vector search, function scheduling, and automatic end-to-end type safety — all without managing a separate database server. Data is defined via `convex/schema.ts` using the `convex/server` schema builder. See Section 10 for the schema.
- **Clerk** for authentication. Clerk provides a managed auth UI, session management, user storage, social OAuth, MFA, passkeys, and webhooks — all integrated with Convex's auth provider system via `convex/auth.config.ts`. Use `@clerk/nextjs` for the Next.js SDK and `convex/react-clerk` for the Convex bridge (`ConvexProviderWithClerk`). For Next.js 16, auth middleware goes in `proxy.ts` using `clerkMiddleware()`.
- **Vercel Blob** or an S3-compatible bucket for attachments.
- **OpenRouter**, called through the **Vercel AI SDK** (`ai`) with the **`@openrouter/ai-sdk-provider`** community provider — not a hand-rolled `fetch` client. This buys streaming, retries, and typed structured output (`generateObject` / `streamObject` against a Zod schema) instead of you reimplementing them. See Section 12.

### Content and editing
- MDX for authored lessons and explanations.
- TipTap or Lexical for the notes editor.
- KaTeX or MathJax for math rendering.
- Mermaid support later, for diagrams.

### Analytics and observability
- PostHog for product analytics.
- Sentry for error tracking.
- OpenTelemetry-friendly logging.
- The AI SDK returns token usage and finish-reason on every call — hang task-level telemetry off that instead of building separate instrumentation.

## 10. Data Model

### Curriculum shape
Curriculum data is canonical and shared; progress data is per-user. Keep those two categories in separate tables from day one — cheap now, expensive to untangle later. The hierarchy is Subject → Chapter → Topic → optional Subtopic, and each topic carries learning objectives, common mistakes, prerequisites, and typical exam patterns. For Germany specifically: tag topics with grade level, exam relevance, difficulty, and estimated study time, and leave room for federal-state or school-profile variation later, even if v1 only supports one.

### Entities
One name per concept, used consistently everywhere. The biggest failure mode in a spec like this is the tutor's code calling something `MistakeLog` while the practice engine calls it `MistakeEntry`.

| Entity | Represents |
|---|---|
| `User` | The account. Single-user for v1, but not hardcoded that way. |
| `Subject`, `Chapter`, `Topic` | Curriculum hierarchy. |
| `TopicPrerequisite` | Directed edge: topic → prerequisite topic. |
| `LessonBlock` | Canonical, curated explanation content for a topic. |
| `UserTopicProgress` | Mastery, confidence, time spent, last-studied date — one row per user per topic. |
| `Note` | Rich-text note, optionally linked to a topic. |
| `StudySession` | A study block: intention, duration, subject/topic focus, reflection. |
| `Goal` | Daily or weekly objective, optionally scoped to a subject. |
| `PracticeSet` | A generated or curated group of exercises. |
| `PracticeItem` | One question inside a `PracticeSet`. |
| `PracticeAttempt` | A user's submission for one `PracticeItem`, with verdict and feedback. |
| `FlashcardDeck`, `Flashcard` | Deck and card content. |
| `FlashcardReview` | Spaced-repetition state for one card for one user — ease, interval, due date, last result. |
| `MistakeEntry` | The mistake journal — subject, topic, question, user answer, correct answer, mistake type, cause, recovery action, scheduled review date. This is meant to be a standout feature, not an afterthought log. |
| `TutorThread`, `TutorMessage` | AI tutor conversations and their messages. |
| `AiGeneration` | Telemetry for every AI call — task type, model, tokens, latency, schema-validation result, linked entity IDs. |
| `Attachment` | Uploaded files, linked to notes or topics. |

### Relations
- A `Subject` has many `Chapter`s; a `Chapter` has many `Topic`s.
- A `Topic` can depend on other topics through `TopicPrerequisite`.
- A `Topic` has `LessonBlock`s, `Note`s, `PracticeSet`s, `FlashcardDeck`s, and one `UserTopicProgress` row per user.
- A `PracticeSet` contains many `PracticeItem`s; each `PracticeAttempt` belongs to a user and a `PracticeItem`.
- A `MistakeEntry` can link to a topic, a `StudySession`, and a `PracticeAttempt`, but doesn't require any of them.
- A `TutorThread` belongs to a user and is optionally scoped to a subject or topic.

### Schema
Defined in `convex/schema.ts` using Convex's `defineSchema` and `defineTable` with `v` validators. Tables are defined with their fields and indexes — Convex enforces the schema at runtime and provides end-to-end TypeScript types. All tables get `_id` (auto-generated document ID) and `_creationTime` (auto-timestamp) automatically.

```txt
Tables (all in convex/schema.ts):
  subjects, chapters, topics, topicPrerequisites, lessonBlocks
  users, userTopicProgress, notes, studySessions, goals
  practiceSets, practiceItems, practiceAttempts
  flashcardDecks, flashcards, flashcardReviews
  mistakeEntries, tutorThreads, tutorMessages
  aiGenerations, attachments
```

Each table uses `v.id(...)` for foreign-key-style references. Enums are represented as `v.union(v.literal(...))`. Indexes use `.index("name", ["field"])` on table definitions. See `convex/schema.ts` for the complete definition.

### Data modeling notes
- Keep canonical curriculum content separate from user progress (see above) — the single most important modeling decision in the app.
- Every AI-generated artifact should be traceable back to the `AiGeneration` row that created it.
- Store evaluation rubrics and structured grading output, not just a pass/fail.
- Soft-delete where learning history matters; a deleted topic shouldn't erase a semester of mistake data.
- Timestamp aggressively — spaced repetition and the analytics in Section 15 both run on dates.
- **The review queue in 7.7 doesn't need its own table.** It's a query across `FlashcardReview.dueAt`, `MistakeEntry.reviewAt`, and stale `UserTopicProgress` rows. A materialized cache table is a fine v2 performance optimization; a stored "queue" table you have to keep in sync from day one is a self-inflicted bug class.

## 11. Frontend Architecture

Domain-driven structure, not one giant shared `components/` folder:

```txt
src/
  components/
    ui/
    layout/
  features/
    dashboard/
    subjects/
    topics/
    tutor/
    practice/
    review/
    planner/
    notes/
    analytics/
  lib/
    ai/
    auth/
    db/
    curriculum/
    practice/
    review/
    analytics/
    utils/
  hooks/
  stores/
  types/
```

### Component philosophy
- Shared UI components stay generic; domain behavior lives in `features/`.
- Business logic belongs in services and server modules, never in page components.
- AI prompt builders never live inside UI files.
- Validation schemas sit next to the domain logic they protect.

### State strategy
- Server state: TanStack Query.
- Local UI state: Zustand or component-local state.
- Form state: React Hook Form + Zod.
- URL state: filters, selected subject, mode, topic tabs.
- Optimistic updates for low-risk actions like marking a review item complete.

### Caching strategy
- Cache curriculum data aggressively — it changes rarely.
- Use `"use cache"` with explicit `cacheTag`s on progress summaries so a practice submission can invalidate exactly the dashboard widgets it affects, instead of a blanket revalidation.
- Stream AI responses; never block the whole page on a generation.
- Memoize expensive derived analytics on the server.
- Edge-safe caching only where no private data is involved.

## 12. AI System

Content strategy first, since it explains the shape of everything below: use a **hybrid model** — curated internal lesson content for core topics, AI-generated supplementary explanations, user notes (some AI-transformed), and practice content that's generated on demand but saved once it's good. This keeps the product adaptive without regenerating the same explanation of logarithms every time — and with exactly one student using this, a saved generation is pure savings the second time it's needed.

### AI jobs

| Job | Purpose | Model characteristics needed |
|---|---|---|
| Lesson generation | Structured explanations | Good reasoning, stable formatting |
| Question answering | In-context Q&A | Fast, affordable, reliable |
| Quiz generation | Exercises with answer keys | Strong structured output |
| Answer evaluation | Check responses, give feedback | Reasoning + rubric-following |
| Flashcard creation | Extract facts and prompts | Fast and inexpensive |
| Writing feedback | Analyze French/German/English writing | Strong language analysis |
| Study planning | Recommend next topics/sessions | Summarization and prioritization |
| Error clustering | Group mistakes into patterns | Reasoning with structured JSON |

### Design principles
- Every AI action is grounded in app context — subject, topic, grade level, language, learning goal, current mastery are always in the prompt.
- Structured outputs are schema-validated, never trusted raw.
- The student can switch between concise and detailed responses.
- The AI teaches by default; it doesn't just answer.
- Log prompt metadata for debugging without hoarding sensitive content unnecessarily.

### Integration architecture
Build a thin service layer around the AI SDK — don't call OpenRouter directly from UI components, and don't hand-roll HTTP calls the SDK already does for you.

```txt
lib/ai/provider.ts       # createOpenRouter() instance + exported model map
lib/ai/models.ts         # model routing rules by task
lib/ai/prompts/          # prompt builders, one per task
lib/ai/schemas/          # Zod output schemas
lib/ai/tasks/            # task orchestration: generateObject/streamText + prompt + schema
lib/ai/telemetry.ts      # wraps each call, writes an AiGeneration row from result.usage
```

### Model routing
- Fast tutor chat → a lower-latency general reasoning model.
- Deep explanation mode → a stronger reasoning model.
- Flashcards and summaries → a low-cost, fast model.
- Writing analysis → a language-strong model.
- Fallback chain if schema validation fails or a call times out.

Keep exact model slugs in `lib/ai/models.ts`, not scattered through prompt builders — OpenRouter's catalog and your preferred defaults will both change faster than this document does.

### Prompt architecture
Layered and explicit:
- System prompt by task type.
- Subject-specific rules.
- Grade and locale context.
- Current topic context.
- User performance context.
- Output schema instructions.
- Safety and brevity policy.

```ts
type ExplainTopicInput = {
  subject: "math" | "physics" | "chemistry" | "french" | "german";
  topicTitle: string;
  gradeLevel: string;
  targetDepth: "simple" | "standard" | "rigorous";
  priorWeaknesses: string[];
  language: "de" | "en" | "fr";
};
```

### Structured output, end to end

```ts
import { generateObject } from "ai";
import { z } from "zod";
import { openrouter } from "@/lib/ai/provider";

const QuizSchema = z.object({
  title: z.string(),
  topicId: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  items: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["mcq", "short_answer", "step_problem"]),
      question: z.string(),
      options: z.array(z.string()).optional(),
      answer: z.string(),
      explanation: z.string(),
      skills: z.array(z.string()),
    })
  ),
});

const { object, usage } = await generateObject({
  model: openrouter("<provider>/<model>"),
  schema: QuizSchema,
  prompt: buildQuizPrompt(input),
});
```

`usage` (tokens) and the schema-validation outcome are exactly what `lib/ai/telemetry.ts` writes into `AiGeneration`.

### Example task contract

```ts
export type EvaluateAnswerInput = {
  subject: string;
  topic: string;
  question: string;
  studentAnswer: string;
  expectedAnswer?: string;
  rubric?: string[];
  language: "de" | "en" | "fr";
};

export type EvaluateAnswerOutput = {
  verdict: "correct" | "partially_correct" | "incorrect";
  score: number;
  feedback: string;
  mistakes: string[];
  nextStep: string;
};
```

### AI UX rules
- Always show what context the AI is using.
- Let the student edit the request before generation when it makes sense to.
- Show generation status; allow cancellation.
- Visually distinguish generated content from saved curriculum content.
- One-click regenerate with stricter / easier / shorter / more exam-like variants.
- Save useful outputs so the student never regenerates the same thing twice.

### Safety and quality controls
- Validate every structured output with Zod; retry once, then fall back.
- Rate-limit expensive AI endpoints.
- Keep moderation minimal but present.
- Ground hallucination-prone tasks against stored curriculum data instead of trusting the model's memory of the German curriculum.
- Track AI confidence internally where the model can express it.

### API routes
Route handlers or Server Actions for every AI operation; secrets never reach the client.

```txt
app/api/ai/chat/route.ts
app/api/ai/explain/route.ts
app/api/ai/quiz/route.ts
app/api/ai/evaluate/route.ts
app/api/ai/plan/route.ts
app/api/ai/flashcards/route.ts
```

For streaming routes, return the AI SDK's stream response helper directly rather than hand-rolling a `ReadableStream` — the exact helper name has moved across SDK versions, so check the current `ai` package docs for `streamText` / `streamObject` when you wire this up.

## 13. Design System

The app should feel like a disciplined study cockpit — calm, serious, compact, fast. No generic AI gradients: neutral surfaces, one strong accent, dense but readable layouts, clear hierarchy. Aesthetic keywords: Swiss, academic, precise, calm intensity.

**Color** — neutral warm-gray or cool-slate surfaces; one accent (teal or cobalt); subject colors as small labels only, never dominating the layout; error/warning/success colors reserved for genuine feedback states.

**Typography** — a sans-serif primary UI font (Geist, Inter, or Satoshi); a monospace treatment for stats and formulas; a compact scale (page title, section title, body, label); no oversized hero type inside the app shell.

**Layout** — persistent left sidebar; a top utility bar for search, quick-add, timer, and profile; one vertical scroll region for the main area; a resizable side panel for the tutor or notes on larger screens; tabbed or drawer-based navigation on mobile.

## 14. Search, Commands, and Notifications

**Universal search** targets subjects, topics, notes, flashcards, mistakes, study sessions, and commands.

**Command palette** actions: jump to subject, start focus session, ask tutor, generate quiz, open review due, create note, toggle theme.

**In-app reminders**, kept sparse: review due today, goal at risk, a topic abandoned too long, session target reached, a suggested catch-up plan. Email notifications can wait past v1.

## 15. Non-Functional Requirements

### Accessibility
Keyboard-first navigation; high contrast in both themes; visible focus states; screen-reader labels on dense controls; respect reduced motion; clear empty/error/loading states; no interaction that depends on color alone.

### Performance
Fast initial dashboard load; stream slow AI outputs; never block the whole UI during generation; use Suspense boundaries deliberately; paginate heavy logs and histories; keep AI and analytics logic server-side so client bundles stay small.

### Testing
- **Unit** — utility functions, schema validation, spaced-repetition math, recommendation logic, prompt builders.
- **Integration** — AI route handlers, database workflows, practice-submission flow, review-queue generation.
- **E2E** — login, start session, open topic, ask tutor, generate quiz, submit answers, complete review, update goals.
- Stack: Vitest, Testing Library, Playwright.

### Observability
Track AI latency by task, token usage by task and model, schema-failure rate, drop-off between studying a topic and practicing it, review-completion rate, and frontend errors. AI-heavy apps are close to undebuggable without task-level telemetry — this is not optional polish.

## 16. Security and Auth

V1 is single-user, but the codebase shouldn't paint itself into a corner. Model roles now even though only `Student` is active:

| Role | Status |
|---|---|
| Student | Active in v1 |
| Parent observer | Modeled, unused |
| Tutor | Modeled, unused |
| Admin | Modeled, unused |

V1 practical scope: email login via Clerk (Section 9), optional OAuth (Google, GitHub, etc.), one personal workspace, account settings, data export, account deletion.

**Don't rely on `proxy.ts` alone to gate access to a page.** Network-boundary-only session checks have a real history of bypass bugs in Next.js (header-spoofing style attacks against middleware-based auth). Re-verify the session inside the server component or route handler that actually reads or writes data — treat `proxy.ts` as a fast, first-pass redirect, not the security boundary. Clerk's `clerkMiddleware()` in `proxy.ts` handles first-pass protection; use `auth()` or `currentUser()` from `@clerk/nextjs/server` inside Server Components and Route Handlers for re-verification.

## 17. Engineering Standards

- Strict TypeScript, ESLint, Prettier.
- Feature-first folders (Section 11), not a type-first dump.
- Clear server/client boundaries; no business logic in presentational components.
- Shared schemas between frontend and backend wherever reasonable.
- Every AI task has a typed input, a typed output, and telemetry — no exceptions.
- Domain names, not vague ones: `generatePracticeSet` over `handleData`, `TopicMasteryCard` over `InfoCard`, `evaluateSubmission` over `checkThing`.

Next.js 16 ships an `AGENTS.md` convention in `create-next-app` and a DevTools MCP server for AI-assisted debugging. Worth turning on given you're building this with an AI pair — it gives an agent like Claude Code real visibility into what the dev server is doing instead of guessing from stack traces.

## 18. Repository and Deployment

**Monorepo decision** — a single app repo is enough for v1. Keep internal boundaries clean so `packages/ai`, `packages/curriculum`, `packages/ui`, and `packages/config` could be extracted later without a rewrite.

**Environments** — local, preview, production.

**Deployment target** — Vercel is the easiest fit for Next.js 16 and Convex. Convex handles backend hosting; Vercel handles the frontend.

**Environment variables**

```bash
# Convex
NEXT_PUBLIC_CONVEX_URL=
CLERK_JWT_ISSUER_DOMAIN=

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# AI
OPENROUTER_API_KEY=
OPENROUTER_DEFAULT_MODEL=
OPENROUTER_FALLBACK_MODEL=
AI_TELEMETRY_ENABLED=true

# Observability & storage
POSTHOG_KEY=
SENTRY_DSN=
```

## 19. Roadmap

### Phase 1 — Foundation
Auth, app shell, dashboard skeleton, subject and topic models, basic notes, AI provider setup, tutor-chat MVP.

### Phase 2 — Core study loop
Topic pages, practice generator, answer evaluation, mistake log, flashcards, review queue.

### Phase 3 — Planning and intelligence
Planner, focus mode, recommendations, progress analytics, weak-topic detection.

### Phase 4 — Polish
Better editors, keyboard shortcuts, richer analytics, import/export, mobile refinement, caching and telemetry hardening.

## What Makes This Different

The differentiator isn't "AI for studying" — everyone's building that. It's a study operating system where curriculum structure, AI tutoring, practice generation, revision loops, planning, and personal analytics all reinforce each other because they share one state. The student should feel three things: *I always know what to study next. I can get unstuck immediately. My weak areas are turning into strengths.*

**Build order:** ship the strongest version of the core loop before anything else — dashboard → subject hub → topic page → tutor side panel → practice generator → mistake log → review queue. If those seven pieces work exceptionally well, the app is already valuable. Everything else in this document should strengthen that loop, not distract from it.

---

## Appendix: Reference Code

**Internal modules**
```txt
convex/schema.ts                       # Database schema (Convex tables + indexes)
convex/auth.config.ts                  # Clerk JWT auth provider config
convex/curriculum/                     # Curriculum queries & mutations
convex/practice/                       # Practice engine functions
convex/review/                         # Spaced repetition functions
convex/analytics/                      # Progress & insights functions
convex/users.ts                        # User management functions
src/lib/ai/provider.ts
src/lib/ai/tasks/generate-quiz.ts
src/lib/ai/tasks/explain-topic.ts
src/lib/ai/tasks/evaluate-answer.ts
src/lib/curriculum/get-topic-graph.ts
src/lib/review/schedule-review.ts
src/lib/analytics/get-dashboard-insights.ts
src/features/topics/components/topic-header.tsx
src/features/practice/components/practice-runner.tsx
src/features/tutor/components/tutor-panel.tsx
```

**Dashboard composition**
```txt
DashboardPage
  AppShell
    Sidebar
    TopBar
    MainScrollArea
      DailyMissionCard
      SubjectProgressGrid
      WeakTopicsPanel
      ReviewDueList
      AiRecommendationCard
      WeeklyConsistencyChart
```

**Topic page composition**
```txt
TopicPage
  TopicHeader
  TopicOverviewTabs
    ExplanationPanel
    ExamplePanel
    CommonMistakesPanel
  ContextToolbar
  PracticeLauncher
  FlashcardPreview
  MistakeHistory
  LinkedTopics
  TutorSidePanel
```
