# Tutor UX Improvement Plan

**Status:** Draft for implementation
**Owner:** App team
**Goal:** Every learner who lands on the Tutor must understand what to ask, feel grounded in their own data within the first message, and see a clear next step when they leave. The Tutor should be the *one* surface that connects the lesson they just read, the practice they just finished, and the mastery curve they are climbing.

---

## TL;DR

The Tutor implementation is **architecturally rich and visually polished** — the 3-pane layout, the streaming pipeline, the lesson-context grounding, the memory snapshot, the suggestion dock, and the per-message action toolbar are all working. But the experience has **three structural gaps** that blunt the value:

1. **The Tutor is silent on first contact.** A first-time user lands in an empty thread and the AI never speaks first. The empty state copy is generic. There is no "what can the tutor actually do" hint, and the suggestion dock is a hard-coded set of six verbs that ignore the user's actual weaknesses.
2. **The Tutor is a dead end on exit.** When the user ends a session they are routed back to the topic page with no summary, no "ask the tutor about the next topic" CTA, and no "what did I just learn" surface. When the AI finishes a reply there is no "ask about this answer" inline thread-out. The Memory panel shows a beautiful readout of the user's state but never turns that readout into an action.
3. **The Tutor's entry surface is fragmented.** It is reachable from at least nine different places (AskTutorCta on topic/subject/chapter pages, ContinueStudyingCard, SubjectHeader, TopicList, TopicHeader, study-session indicators, dashboard recommendations, practice results). But the dashboard itself has no prominent "Chat with the tutor" CTA, the post-practice-results hand-off is shallow, and the disabled "Speak" and "Scan" chips in the Composer look like real features but do nothing.

This plan ships **five phases, in priority order**, each independently demoable:

1. **Proactive first touches** — the AI speaks first when context is available, the empty state explains what the tutor can do, and a slide-over is offered as a non-disruptive option.
2. **Turn the Memory panel into a launchpad** — every weakness is a one-click prompt; the SuggestionDock becomes personalised; per-item "ask about this question" chips on the practice results page.
3. **Session lifecycle polish** — a "Session Summary" screen replaces the abrupt route push on `endSession`; the chat scroll-restores to the last user message on return; the "back" affordance remembers where the user came from.
4. **Mobile redesign** — the Memory panel becomes a pull-up sheet on small viewports; the composer takes full-width focus; the history panel is a tab on mobile, not a hidden rail.
5. **Architecture cleanup** — remove dead "Speak/Scan" placeholders, add a tutor-routes-from-anywhere helper, log the tutor as a first-class subject in the layout, and add the missing A11Y live region for streaming.

The phases are sequenced so Phase 1 alone is a high-leverage UX win and is worth shipping in isolation if budget forces a stop.

---

## 1. Current State Analysis

### 1.1 Routes & components in scope

| Layer | File | Purpose |
|---|---|---|
| Server page | `app/(app)/tutor/page.tsx` | Resolves `?subject=`, `?topic=`, `?session=`, `?q=`, `?lesson=` into canonical ids; gates by auth + convex; renders the `<TutorClient>`. |
| Client island | `app/(app)/tutor/TutorClient.tsx` | The 3-pane layout (HistoryPanel | MessageList+Composer | MemoryPanel). Owns the `useChat` instance, the Convex thread, and the cross-pane state. |
| Loading | `app/(app)/tutor/loading.tsx` | Faithful 3-pane skeleton. |
| Error | `app/(app)/tutor/error.tsx` | CockpitCard with retry/back CTAs. |
| API | `app/api/tutor/chat/route.ts` | Streaming DeepSeek reply via Vercel AI SDK. Persists user/assistant messages + `aiGenerations` telemetry. Accepts optional `lessonContext`. |
| Header | `components/tutor/SessionHeader.tsx` | Breadcrumb, mastery ring, end-session CTA, status pills. Includes a "Back to lesson" link (already shipped). |
| History | `components/tutor/HistoryPanel.tsx` | Collapsible left rail with grouped-by-time threads, search, unread counts. |
| Memory | `components/tutor/MemoryPanel.tsx` | Right column: mastery, weaknesses (top 3), recent progress, focus goal, confidence. |
| Messages | `components/tutor/MessageList.tsx` | Per-message bubbles, SuggestionDock after each settled message, StreamingIndicator, MessageActions on hover. |
| Composer | `components/tutor/Composer.tsx` | Multi-line textarea, action chips (Equation/Flashcards/Practice/Speak/Scan), send/stop toggle. |
| Per-message actions | `components/tutor/MessageActions.tsx` | Copy, Helpful, Re-roll, Flashcards, Note, Practice, Share — most write to localStorage (placeholder). |
| Reasoning | `components/tutor/ReasoningPart.tsx` | Collapsible reasoning trace with streaming shimmer. |
| Suggestions | `components/tutor/SuggestionDock.tsx` | Six static chips rendered under each settled assistant message. |
| Streaming indicator | `components/tutor/StreamingIndicator.tsx` | Four-stage "reading mastery → checking mistakes → building example → rendering" label. |
| Convex | `convex/tutor.ts` | `ensureThread`, `getThread`, `listMessages`, `appendUserMessage`, `recordAssistantMessage`, `endSession`, `listThreadsForSidebar`, `markThreadRead`. |
| Convex | `convex/tutorContext.ts` | `getContextForLessonRun` — bundles a graded run for `?lesson=`. |
| Convex | `convex/tutorMemory.ts` | `getMemorySnapshot` — the right-panel payload. |
| Convex | `convex/tutorProfile.ts` | Onboarding profile. Used by the chat route handler to inject personalization into the system prompt. |

### 1.2 Entry-point graph (who routes to /tutor today)

```
┌──────────────────────────────────────────────────────────────────────┐
│                              /dashboard                              │
│  - ContinueStudyingCard → "Discuss with tutor" (secondary CTA)      │
│  - RecentActivityStrip (study session) → "Open in tutor" (planned)  │
│  - SubjectsGrid (per row) → no tutor entry                            │
│                                                                      │
│  ↑ Gap: the dashboard has no prominent tutor CTA.                    │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       /subjects/[slug] (Subject)                     │
│  - SubjectHeader → "Open tutor" CTA                                  │
│  - AskTutorCta (subject-only mode)                                   │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                /subjects/[slug]/[chapterSlug] (Chapter)              │
│  - ChapterHeader → no tutor CTA                                      │
│  - AskTutorCta (subject-only mode — chapter has no AskTutorCta!)     │
│                                                                      │
│  ↑ Gap: chapter page lacks topic-scoped tutor entry.                 │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│         /subjects/[slug]/[chapterSlug]/[topicSlug] (Topic)           │
│  - TopicHeader → "Ask tutor" → /tutor?subject=…&topic=…              │
│  - AskTutorCta (topic-scoped) — inline composer with quote capture   │
│  - PrerequisiteStrip (locked prereqs visible here)                   │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                 /tutor?subject=&topic= (the page itself)              │
│  - 3-pane layout: History | MessageList+Composer | Memory             │
│  - SessionHeader: breadcrumb + mastery ring + end-session CTA        │
│  - SuggestionDock under each assistant message                       │
│  - MemoryPanel: passive readout of mastery, weaknesses, recent       │
│  - "Back to lesson" link (in SessionHeader, only when topic=null ✗   │
│    — only renders for topic, not for subject-only)                   │
│  - LessonContextBanner when ?lesson= present                         │
└──────────────────────────────────────────────────────────────────────┘
                                  ▲
                                  │
                  (route.push("back") on endSession,
                   no summary, no "what next" UI)

┌──────────────────────────────────────────────────────────────────────┐
│    /my-topics/[topicSlug]/practice/results  (Practice Results)        │
│  - "Discuss with tutor" CTA → /tutor?…&lesson=<runId>                │
│  - Per-question row: no "ask tutor about this" inline chip           │
│                                                                      │
│  ↑ Gap: per-item tutor CTAs missing.                                 │
└──────────────────────────────────────────────────────────────────────┘
```

### 1.3 What already works well

- The 3-pane desktop layout is one of the most polished surfaces in the app. The collapse state persists via `useLocalStorage`. The shell skeleton in `loading.tsx` is layout-stable, so the first paint does not flash a spinner.
- `useChat` is wired with `experimental_throttle: 50` and `toUIMessageStream` persistence hooks. The on-mount `useEffect` in `appendUserMessage` (via dedupe by `clientId`) makes the network retry path idempotent.
- The lesson-context banner (`LessonContextBanner` in `TutorClient.tsx`) successfully grounds the AI on a per-item feedback basis. The system prompt receives the full bundle via `buildChatSystemPrompt` with the `lessonContext` opt.
- `MemoryPanel` is data-correct: it queries `getMemorySnapshot`, renders the right shape (subject-only vs topic-pinned), and falls back through `MemorySkeleton` / `MemorySignedOut` honestly.
- The `SuggestionDock` is a clean, hover-scales-on-chip pattern. The streaming shimmer in `ReasoningPart` is well-implemented.
- The Convex `endSession` mutation is race-safe (`MIN_SESSION_SEC = 60`, only one writer can flip `completedAt`).
- The `SessionHeader` already gained a "Back to lesson" link in the most recent change. Good first step.

### 1.4 What is broken or weak (UX-grade issues)

These are grounded in the current code; each points to specific file:line.

#### Critical — block the user from getting value

1. **The AI never speaks first on a fresh thread.** A user who has never used the tutor before opens it via the AskTutorCta. The thread is empty; `MessageList` renders the `<EmptyState>` ("Ready when you are") with a static one-liner. The `ensureThread` mutation in `convex/tutor.ts:341-410` *does* seed a welcome message, but the welcome is the same generic copy for every user and every topic. The first message the user sees is a UX dead end. (File: `app/(app)/tutor/TutorClient.tsx:96-105` and `components/tutor/MessageList.tsx:251-272`.)

2. **Empty state is generic, not capability-explaining.** A first-time user has no idea what the tutor *can* do. The current copy says "Drop a question below and the tutor will ground its answer in your mastery, recent mistakes, and the topic's objectives." That is too abstract. There is no example questions, no "ask me about your last mistake," no signal that it can read the lesson block if `?lesson=` is set. (File: `components/tutor/MessageList.tsx:259-272`.)

3. **The MemoryPanel is a passive readout.** Top-3 weaknesses are listed but each one is a static card. The user has to *manually type* "explain my mistake on X" instead of clicking. The same is true for "Recently mastered" topics. The "Practice" action button on each lesson item (in `MessageActions.tsx:113-124`) is wired to `/dashboard` (!) which is a hard-coded wrong-target bug, not a placeholder. (File: `components/dashboard/MemoryPanel.tsx:201-228`, `components/tutor/MessageActions.tsx:113-124`.)

4. **The SuggestionDock is hard-coded.** Six chips ("Harder example," "Easier explanation," "Visualize it," "Quiz me," "Exam-style," "Re-explain") are always the same. They do not account for: (a) the user's recent mistakes, (b) the memory panel's top weakness, (c) the `lessonContext` if present, (d) the user's `learningPreference` from the onboarding profile (Practice / Reading / Visual / Teaching / Mixed). (File: `components/tutor/SuggestionDock.tsx:102-141`.)

5. **End-of-session is an abrupt `router.push`.** When the user clicks "End session," `SessionHeader.onEnd` calls `endSession` then `router.push(back)` to either `/subjects/[slug]/[topic]` or `/subjects/[slug]`. The user gets no summary of what they just learned, no "ask the tutor about the next topic" CTA, and no "save reflection" surface. The reflection *textarea is the only thing* between the user and the route push. (File: `components/tutor/SessionHeader.tsx:104-127`.)

6. **Practice results hand-off is shallow.** `ResultsClient` has a single "Discuss with tutor" CTA that opens the tutor with `?lesson=<runId>`. The lesson context banner does appear in the tutor, but the per-question rows on the results page each lack an inline "ask the tutor about this question" chip. The user can ask the AI broadly about the run, but cannot ask "why was this specific question wrong?" without manually typing the question back. (File: `app/(app)/my-topics/[topicSlug]/practice/results/ResultsClient.tsx:155-185`.)

#### Important — cause confusion

7. **Disabled "Speak" and "Scan" chips in the Composer.** They render with `disabled` and `aria-label="Speak"` but click them and the composer inserts a `[Voice reply coming soon. Type your question for now.]` placeholder string. These look like real features but don't work. (File: `components/tutor/Composer.tsx:194-209`.)

8. **Tutor without a topic is floating.** When the user opens `/tutor?subject=math` with no topic, the SuggestionDock fills in with `topicTitle ?? "this topic"` and the Memory panel's "topic" branch falls through to `MemorySubjectOnly`. There is no "pick a topic" CTA on the tutor itself — the user has to navigate back to /subjects. (File: `components/tutor/SuggestionDock.tsx:73-79`, `components/tutor/MemoryPanel.tsx:330-377`.)

9. **The collapsed HistoryPanel is invisible to a new user.** A returning user with many threads opens the page; the History panel may be collapsed (default `false` per `useLocalStorage`). The collapsed rail only shows an "open" affordance. A first-time user with zero threads has nothing to find — the rail is the only indication that the panel exists. (File: `components/tutor/HistoryPanel.tsx:120-147`.)

10. **No "what did I just learn" surface after the AI reply.** When the AI finishes answering, the user reads the answer, sees the SuggestionDock, and... has no signal for "are you done with this thread?" or "want to take a quiz on this?" There is no "summarise this thread" command, no "save as notes" CTA that actually persists anywhere (the `MessageActions` "Note" button writes to localStorage as a placeholder).

11. **No breadcrumb-aware "back".** The "Back to lesson" link in `SessionHeader` is hard-coded to the topic or subject page. If the user arrived from the practice results page, they cannot return there from the tutor. There is no `referrer` memory. (File: `components/tutor/SessionHeader.tsx:200-213`.)

12. **The "Practice" action in `MessageActions` is broken.** It opens `/dashboard` regardless of context. A real implementation would open `/subjects/[slug]/[chapter]/[topic]/practice` or a canonical practice route. Currently it is misleading. (File: `components/tutor/MessageActions.tsx:113-124`.)

13. **Tutor is missing from the dashboard's primary cockpit.** A user on `/dashboard` has the ContinueStudyingCard, the SubjectMasteryStrip, the RecentActivityStrip, and the WhatsNewStrip, but no "Open the tutor" CTA that takes them to a general subject-agnostic thread. The tutor is reachable only via "Discuss with tutor" on the ContinueStudyingCard (which routes to a topic-scoped thread). A user who wants to "ask the tutor about everything I'm struggling with" has no entry.

#### Polish — nice to have

14. The Tutor route handler does not validate the `q` query param against XSS or extremely long inputs (a 10 KB query string in the URL would blow past safe URL length).
15. There is no keyboard shortcut to focus the composer (e.g., `/` jumps to the composer; `Esc` cancels streaming). A power-user navigating by keyboard loses the flow.
16. There is no way to copy a thread as Markdown. The "Share" button on `MessageActions` copies to clipboard but only the single message.
17. The "Flashcards" chip in the Composer inserts a placeholder prompt. The "Make flashcards" action in `MessageActions` writes to localStorage. Neither actually creates flashcards in the canonical `flashcardDecks` table.
18. The "Note" action in `MessageActions` writes to localStorage rather than the `notes` table.
19. The Tutor route's offline fallback (`OfflineFallback` in `app/(app)/tutor/page.tsx:401-453`) is honest but dead-end-y — it does not link to a static example of what a tutor conversation looks like.
20. No streaming error recovery — if a stream fails mid-reply, the user sees the `<MessageActions>` and `onRegenerate` button, but the message is partially rendered. There is no "I lost my answer" recovery.

---

## 2. Implementation Plan

The plan is sequenced so each phase ships a coherent improvement. Each phase is independently demoable.

### Phase 1 — Proactive first touches
**Goal:** The Tutor greets the user with context on first visit, and a first-time user understands what to ask.

**Estimated scope:** 3–4 days.

#### 1.1 Contextual AI first message

Today `ensureThread` in `convex/tutor.ts:341-410` always seeds a static welcome message. Make the welcome *contextual*:

- **No context** (`?subject=math`, no topic, no lesson): keep the generic welcome.
- **Subject-only** (`?subject=math`): name the subject in the welcome and tell the user they can pick any topic.
- **Topic-scoped** (`?subject=math&topic=functions`): name the topic, mention the user's mastery (if any), and reference the topic's objectives.
- **Lesson-scoped** (`?lesson=<runId>`): mention the run, the grade, and *the top weakness if any* (so the AI's first user-facing reply can address the mistake). Pass `lessonContext` (already in `TutorClient.tsx` as a prop) into `ensureThread` so the server can compose the welcome without a second round-trip.

This is server-side. The mutation already takes `(subjectId, topicId?)`. Extend to accept an optional `lessonRunId` and the read the lesson context bundle *inside* the mutation so the welcome is in the canonical `tutorMessages` table from creation. The client does not need to change — `ensureThread` is called via `useEffect` in `TutorClient.tsx:99-105` already.

**Files:** `convex/tutor.ts` (`ensureThread` signature + welcome copy), `app/(app)/tutor/page.tsx` (pass `lessonRunId` through).

#### 1.2 Rich empty state with capabilities + starter prompts

Replace the static `<EmptyState>` in `components/tutor/MessageList.tsx:251-272` with a richer one. The new empty state shows:

1. The first message in the thread is the AI's contextual welcome (now always present after 1.1).
2. **Below** the welcome, a small "What I can do" capabilities list — three capability cards:
   - "I read your mastery and mistakes" with a Brain icon.
   - "I refer back to the lesson you just finished" with a Stack icon (only when `?lesson=` is set).
   - "I can quiz you, simplify, or challenge you" with a GraduationCap icon.
3. Three to five **starter prompts** as clickable chips, personalised from `tutorProfile.learningPreference` (Practice / Reading / Visual / Teaching / Mixed) and `tutorProfile.biggestObstacle` (Procrastination → "Help me start a 5-min plan"; Exam panic → "Quiz me on the exam format"; etc.).
4. A small "Tip: select any text on the topic page and the tutor will quote it" hint, but only when `topicId` is set.

**Files:** `components/tutor/MessageList.tsx` (replace `<EmptyState>`), new `components/tutor/EmptyStateCapabilities.tsx`, new `components/tutor/StarterPrompts.tsx`.

#### 1.3 "Pick a topic" empty state for subject-only mode

When the user opens `/tutor?subject=math` with no topic, the current Memory panel renders `MemorySubjectOnly` and the SuggestionDock uses `"this topic"` as the topic title. Add a new `<SubjectOnlyEmptyState>` branch in `MessageList` that:

1. Renders the AI's subject-only welcome ("I'm your tutor for Mathematics. Pick any topic to drill in, or ask anything at this subject level and I'll route it to the right curriculum.").
2. Renders a list of the user's *uncompleted* topics in this subject (pulled from `api.subjects.list` or a new `api.tutor.getSubjectTopicsForEmptyState`).
3. Each topic is a `<Link>` to `/tutor?subject=…&topic=…` so the user can branch into a topic thread in one click.

**Files:** new `components/tutor/SubjectOnlyEmptyState.tsx`, `convex/tutor.ts` (`getSubjectTopicsForEmptyState` query).

#### 1.4 Slide-over option (non-disruptive tutor)

Many users will not want to leave the topic page to ask a question. Add a slide-over version of the Tutor that mounts over any page without a route change. The slide-over:

- Renders the Tutor 3-pane layout in a fixed right-side drawer (60% width on desktop, full-screen on mobile).
- Reuses `TutorClient` with a `variant="slide-over"` prop that swaps the layout container for `<Dialog>`-like chrome.
- Closes on `Esc` and on backdrop click. The page underneath is read-only; the tutor mounts a new thread for the slide-over context.
- Persistence: a "Pop out to full page" CTA in the slide-over header that navigates to `/tutor?subject=…&topic=…` and closes the slide-over.

This is the largest single change in the plan. If the budget is tight, **defer 1.4 to a later iteration** — Phases 1.1–1.3 alone are a meaningful UX win.

**Files:** new `components/tutor/TutorSlideOver.tsx`, updates to `components/dashboard/AskTutorCta.tsx` (add a "pop out" toggle), updates to `components/dashboard/TopicHeader.tsx` (add a "?" icon that opens the slide-over).

### Phase 2 — Memory panel as a launchpad
**Goal:** The right rail is no longer a passive readout. Every weakness and every recent progress row is a one-click launch into a tutor conversation.

**Estimated scope:** 2–3 days.

#### 2.1 Clickable weakness cards

In `components/tutor/MemoryPanel.tsx:201-228`, the weakness list renders `<li>` cards with text but no interaction. Add:

- Hover state (border + ring) and a right-arrow icon.
- `onClick` that calls an imperative ref / callback to insert a prompt into the composer: `Review my mistake: "<question>". I answered "<userAnswer>"; the right answer is "<correctAnswer>". Walk me through where I went wrong.`
- A "Discuss" CTA chip per weakness card.
- A11Y: card is a `<button>` not a `<li>`, so screen readers announce it as actionable.

**Files:** `components/tutor/MemoryPanel.tsx`, new `components/tutor/WeaknessCard.tsx` (extracted from the list), plumb a `setComposerText(text: string) => void` callback from `TutorClient` to `MemoryPanel`.

#### 2.2 Recently mastered → "Review again" CTA

Same pattern for `MemoryPanel.tsx:230-260` — the recently mastered list. Each row already has a `<Link>` to the topic page. Add a small "Ask the tutor to re-explain" chip on hover that:

- Inserts `I just re-studied <topic title>. Can you re-explain it from a different angle?` into the composer.
- Closes the memory panel on mobile to expose the composer (more on this in Phase 4).

#### 2.3 Personalised SuggestionDock

The SuggestionDock's six chips are hard-coded (`SuggestionDock.tsx:102-141`). Make them dynamic:

- Pull `memorySnapshot.weaknesses[0]` (top weakness, if any).
- If `lessonContext` is set, the first chip becomes: `Review my mistake on "<question>".`
- If the user has a `learningPreference = "practice"`, lead with "Quiz me." If `"visual"`, lead with "Visualize it." If `"teaching"`, lead with "Explain it as if you were teaching me."
- Keep the six-chip count (no overflow) but reorder based on signals.

**Files:** `components/tutor/SuggestionDock.tsx`, `app/(app)/tutor/TutorClient.tsx` (pass `tutorProfile` + `lessonContext` into SuggestionDock).

#### 2.4 Per-item "ask the tutor about this question" chip on practice results

In `app/(app)/my-topics/[topicSlug]/practice/results/ResultsClient.tsx:155-185`, each per-item row currently shows verdict, score, feedback, and "better answer." Add a small "Ask the tutor why" chip on each row that:

- Inserts the question + the user's answer + the verdict into the tutor composer (via the slide-over if Phase 1.4 is shipped, or a new `?lesson=…&focus=<itemId>` query param that scopes the tutor's first reply to that item).
- The "Discuss with tutor" CTA at the top of the results page stays as the broad-conversation entry; the per-item chip is the surgical-question entry.

**Files:** `app/(app)/my-topics/[topicSlug]/practice/results/ResultsClient.tsx`, `convex/tutor.ts` (extend `getContextForLessonRun` to accept an optional `focusItemId`).

#### 2.5 Fix the broken "Practice" action in `MessageActions`

`components/tutor/MessageActions.tsx:113-124` currently opens `/dashboard` for every topicId. Replace with a real route: `/subjects/{subject.slug}/{topic.chapter.slug}/{topic.slug}/practice` (canonical) or `/my-topics/{topicSlug}/practice` (user-owned). The component needs the subject/chapter slugs in addition to topicId. Refactor to take a `practiceHref: string` prop, computed by `MessageList` from the topic metadata.

**Files:** `components/tutor/MessageActions.tsx`, `components/tutor/MessageList.tsx`, `app/(app)/tutor/TutorClient.tsx` (pass the right `practiceHref` based on whether the topic is canonical or user-owned).

### Phase 3 — Session lifecycle polish
**Goal:** End-of-session is a real surface. The user sees what they learned, what to do next, and the chat scroll-restores on return.

**Estimated scope:** 3–4 days.

#### 3.1 Session Summary screen

Replace the abrupt `router.push(back)` in `SessionHeader.onEnd` (`components/tutor/SessionHeader.tsx:104-127`) with a `SessionSummary` view state inside `TutorClient`. After `endSession` resolves:

- Hide the MessageList + Composer.
- Show a `<SessionSummary>` with:
  - The reflection text the user typed.
  - A `MasteryDelta` chip showing the +0.1 (+0.05 reflection bonus) the mutation just applied.
  - A `NextBestTopicCard`-style card with the recommended next topic (re-using the existing `api.subjects.getBySlug` next-best data).
  - Two CTAs: "Continue with next topic" (routes to the next-best topic page) and "Back to dashboard" (routes to `/dashboard`).
- The user stays in the Tutor shell until they click one of the two CTAs. This honors the user's intent (they came to the Tutor for a reason; bouncing them immediately breaks the rhythm).

**Files:** new `components/tutor/SessionSummary.tsx`, updates to `app/(app)/tutor/TutorClient.tsx` (add a `summaryView` state).

#### 3.2 Chat scroll-restores on return

When the user navigates away from `/tutor` mid-thread and returns, the chat re-renders all messages from `listMessages`. The scroll position resets to the bottom, not the last message the user was reading. Fix by:

- Persisting the last-read message id per thread to `localStorage` (`tutor.lastRead.<threadId>`).
- On `MessageList` mount, scroll to that message instead of `scrollIntoView(block: "end")`.
- On message visible, clear the persisted last-read (the user has now seen it).

**Files:** `components/tutor/MessageList.tsx`, `app/(app)/tutor/TutorClient.tsx` (lift the localStorage read into the parent so the initial scroll lands before paint).

#### 3.3 "Back" affordance remembers the referrer

`SessionHeader.tsx:200-213` hard-codes the "Back to lesson" link to the topic or subject page. Add `?from=` to the URL when a link to /tutor is generated (from `AskTutorCta`, from `ResultsClient`, from the dashboard's `ContinueStudyingCard`, etc.). The "Back" link then reads `?from=` and routes there instead. The breadcrumb chain is the fallback when `?from=` is missing.

**Files:** every entry point that routes to /tutor adds `from=<route>`; `components/tutor/SessionHeader.tsx` reads `searchParams` via `useSearchParams`.

#### 3.4 "Summarise this thread" command

Add a thread-level CTA (in the SessionHeader) that calls a new Convex mutation `api.tutor.summariseThread`. The mutation runs the AI on the last N messages of the thread and writes a single summary assistant message. Useful when the user has had a long, meandering thread and wants to take stock.

**Files:** `convex/tutor.ts` (`summariseThread`), `app/api/tutor/summarise/route.ts`, `components/tutor/SessionHeader.tsx` (add a "Summarise" button gated on `threadMessageCount > 10`).

### Phase 4 — Mobile redesign
**Goal:** The Tutor is usable on a phone. Memory and history are reachable without losing the composer.

**Estimated scope:** 3–4 days.

#### 4.1 Memory panel as a pull-up sheet on mobile

On `md:` and below, the right Memory panel hides entirely. The user loses the "what to do next" signal. Replace with a pull-up bottom sheet:

- A small floating action button (FAB) on the bottom-right of the chat area, only on mobile. Icon: `Brain` (matches the desktop collapsed state).
- Tap FAB → bottom sheet slides up with the full Memory panel content.
- Sheet covers 50% of the viewport by default, draggable to 90% for full view.
- Tap outside or swipe down → dismiss.

**Files:** new `components/tutor/MobileMemorySheet.tsx` (use `vaul` or hand-rolled with `motion`), updates to `app/(app)/tutor/TutorClient.tsx` (conditionally render the FAB + sheet on `md:`).

#### 4.2 History as a tab on mobile

The left History panel hides on mobile. Replace with a tab that toggles between "Threads" and "Chat":

- Above the MessageList, a 2-segment control: "Chat" (default) and "Threads" (the History panel content).
- Tapping "Threads" swaps the chat surface for the thread list.
- Tapping "Chat" returns.

**Files:** `components/tutor/MobileHistoryTabs.tsx`, updates to `components/tutor/HistoryPanel.tsx` (the panel becomes a section that mounts in both desktop rail and mobile tab).

#### 4.3 Composer full-width focus on mobile

The current composer shrinks to the chat column on mobile. Pin it to the bottom of the viewport with a max-height (e.g. 40dvh) so the user can keep typing even when the keyboard is open. Add a "swipe up" gesture that grows the composer to full-screen for long questions.

**Files:** `components/tutor/Composer.tsx` (mobile breakpoint adjustments).

### Phase 5 — Architecture cleanup
**Goal:** Remove dead UI, fix placeholder actions, make the Tutor a first-class surface in the layout.

**Estimated scope:** 2–3 days.

#### 5.1 Remove disabled chips in Composer

Delete the "Speak" and "Scan" chips from `Composer.tsx:194-209`. They look like real features but do nothing. Re-add when functional.

**Files:** `components/tutor/Composer.tsx`.

#### 5.2 Wire the "Flashcards" chip to a real flow

The chip currently inserts a placeholder prompt. Wire it to `api.flashcards.generateDeck` if available, or to a "Generate flashcards on this topic" tutor call that produces a structured `[[flashcards]]` block the AI renders inline. The flashcards get saved to a `flashcardDecks` row.

**Files:** `components/tutor/Composer.tsx`, `convex/flashcards.ts` (verify the function exists; per AGENTS.md Phase 2.11 is not yet implemented — this work belongs to Phase 2.11 of the master plan and is out of scope for this UX-only plan).

**Trade-off:** if `flashcards.ts` does not exist, the chip stays a placeholder for this iteration and Phase 5.2 is deferred. The "honest" alternative is to *remove* the chip until the backend lands.

#### 5.3 Wire the "Note" action in `MessageActions` to `api.notes.create`

Same trade-off as 5.2. The `notes` table exists in the schema but no Convex functions ship against it. Until they do, either remove the chip or keep the localStorage path with a clear "Saves to your device for now" label.

#### 5.4 Tutor as a first-class surface in the layout nav

The Tutor already has a nav entry (`app/(app)/layout.tsx:30`). The current entry is `{ href: "/tutor", label: "Tutor", Icon: ChatCircleText }`. This is fine. The cleanup is to:

- Add a small "tutor" surface label to the page itself (`/tutor` instead of `/dashboard` in the breadcrumb chain).
- Add a thread-count badge to the nav icon (mirror the unread count from `HistoryPanel`'s collapsed state) so the user knows there are unread messages.

**Files:** `app/(app)/layout.tsx`, `components/tutor/HistoryPanel.tsx` (export the unread total so the layout can read it), new `components/layout/NavTutorBadge.tsx`.

#### 5.5 A11Y: live region for streaming

`ReasoningPart` already has a screen-reader announcer. `StreamingIndicator` does not. Add an `aria-live="polite"` region that announces "Tutor is preparing a response" when the stream starts and "Tutor finished" when the stream ends. This is invisible to sighted users but makes the Tutor accessible.

**Files:** `components/tutor/StreamingIndicator.tsx`, `components/tutor/MessageList.tsx`.

#### 5.6 Logout: clear tutor state

When the user signs out, the `useLocalStorage` keys (`tutor.historyCollapsed`, `tutor.memoryCollapsed`, `tutor.lastRead.<threadId>`, `v1:tutorSavedItems`) persist across sessions because Clerk is the only auth signal. Add a `ClerkProvider`-level effect (or hook into `useUser().isSignedIn` toggles) to clear these keys on sign-out.

**Files:** new `components/tutor/TutorStorageCleanup.tsx`, mounted in `app/(app)/layout.tsx`.

---

## 3. File-by-File Changes

| File | Phase | Change |
|---|---|---|
| `app/(app)/tutor/page.tsx` | 1, 3, 4 | Pass `lessonRunId` into `ensureThread`; read `?from=` for the back-link; pass `?focusItemId=` to the lesson context bundle |
| `app/(app)/tutor/TutorClient.tsx` | 1, 2, 3, 4 | Accept `variant` prop for slide-over; render `<SessionSummary>` after endSession; lift `lastRead` scroll-restoration; pass `practiceHref` into `MessageList` |
| `components/tutor/Composer.tsx` | 5 | Remove disabled "Speak" and "Scan" chips; mobile bottom-anchored layout |
| `components/tutor/HistoryPanel.tsx` | 4 | Add mobile `<MobileHistoryTabs>` integration; export `unreadTotal` for the layout nav badge |
| `components/tutor/MemoryPanel.tsx` | 2 | Convert weakness cards to `<button>`; add "Discuss" chip per weakness; add "Review again" chip on recently mastered |
| `components/tutor/MessageList.tsx` | 1, 2, 5 | Replace `<EmptyState>` with `<EmptyStateCapabilities>`; pass `tutorProfile` into `<SuggestionDock>`; add streaming A11Y announcer |
| `components/tutor/MessageActions.tsx` | 2 | Replace `/dashboard` hard-code with `practiceHref` prop |
| `components/tutor/SessionHeader.tsx` | 1, 3 | Read `?from=` for the back-link; add "Summarise this thread" CTA; add "Pop out to full page" CTA in slide-over variant |
| `components/tutor/StreamingIndicator.tsx` | 5 | Add `aria-live="polite"` announcer |
| `components/tutor/SuggestionDock.tsx` | 2 | Accept `weaknesses`, `lessonContext`, `tutorProfile` props; reorder chips |
| `components/tutor/EmptyStateCapabilities.tsx` | 1 | **NEW** |
| `components/tutor/StarterPrompts.tsx` | 1 | **NEW** |
| `components/tutor/SubjectOnlyEmptyState.tsx` | 1 | **NEW** |
| `components/tutor/SessionSummary.tsx` | 3 | **NEW** |
| `components/tutor/MobileMemorySheet.tsx` | 4 | **NEW** |
| `components/tutor/MobileHistoryTabs.tsx` | 4 | **NEW** |
| `components/tutor/TutorSlideOver.tsx` | 1 | **NEW** |
| `components/dashboard/AskTutorCta.tsx` | 1 | Add `from=<current route>` to the URL params; add a "Pop out" toggle (slide-over mode) |
| `components/dashboard/ContinueStudyingCard.tsx` | 1, 2 | Add `from=/dashboard` to the URL params |
| `components/dashboard/SubjectHeader.tsx` | 1, 2 | Same |
| `components/dashboard/TopicList.tsx` | 1 | Same |
| `components/dashboard/TopicHeader.tsx` | 1, 2 | Same + a small "?" icon that opens the slide-over |
| `app/(app)/dashboard/DashboardOverviewClient.tsx` | 1 | Add a prominent "Chat with the tutor" CTA card in the cockpit |
| `app/(app)/my-topics/[topicSlug]/practice/results/ResultsClient.tsx` | 2 | Per-item "Ask the tutor why" chip; pass `from=/my-topics/.../results` |
| `app/(app)/layout.tsx` | 5 | Mount `<TutorStorageCleanup>`; mount `<NavTutorBadge>` |
| `components/layout/NavTutorBadge.tsx` | 5 | **NEW** |
| `components/tutor/TutorStorageCleanup.tsx` | 5 | **NEW** |
| `convex/tutor.ts` | 1, 3 | Extend `ensureThread` with `lessonRunId` + `focusItemId`; add `getSubjectTopicsForEmptyState`; add `summariseThread` |
| `convex/tutorContext.ts` | 2 | Accept `focusItemId`; return the focused item with extra metadata |
| `app/api/tutor/chat/route.ts` | 1, 2 | Accept `focusItemId` in the Zod schema; inject it into the system prompt when present |
| `app/api/tutor/summarise/route.ts` | 3 | **NEW** — summarise a thread's last N messages |

No new Convex schema changes are required. The `tutorThreads` and `tutorMessages` tables are sufficient; contextual welcomes are stored in the existing `content` column; the `summariseThread` mutation writes a new `tutorMessages` row. `focusItemId` is a Convex query param, not a column.

---

## 4. Sequencing & Dependencies

```
Phase 1 (3-4 days)
  ├─ 1.1 Contextual first message  ──┐
  ├─ 1.2 Rich empty state             │  1.1 and 1.2 ship together
  ├─ 1.3 Subject-only empty state     │  1.3 ships with 1.2
  └─ 1.4 Slide-over (optional)        ─┘  Defer if budget tight

Phase 2 (2-3 days)
  ├─ 2.1 Clickable weaknesses         ──┐
  ├─ 2.2 Review again CTA               │  All independent
  ├─ 2.3 Personalised SuggestionDock    │
  ├─ 2.4 Per-item results chip          │
  └─ 2.5 Fix Practice action          ─┘

Phase 3 (3-4 days)
  ├─ 3.1 Session Summary              ──┐
  ├─ 3.2 Scroll-restores on return      │  Independent
  ├─ 3.3 Referrer-aware back           │
  └─ 3.4 Summarise this thread        ─┘

Phase 4 (3-4 days)
  ├─ 4.1 Mobile memory sheet          ──┐
  ├─ 4.2 Mobile history tabs            │  4.1 + 4.2 ship together
  └─ 4.3 Mobile composer full-width   ─┘

Phase 5 (2-3 days)
  ├─ 5.1 Remove dead chips
  ├─ 5.2 Wire Flashcards (defer if no backend)
  ├─ 5.3 Wire Note (defer if no backend)
  ├─ 5.4 Nav badge
  ├─ 5.5 A11Y live region
  └─ 5.6 Sign-out cleanup
```

**Phase 1 alone is a high-leverage UX win** — the contextual first message and rich empty state transform the first-time experience. Phase 2 turns the Tutor from a chat tool into a launchpad. Phase 3 and 4 are polish. Phase 5 is cleanup.

**Trade-off decision:** if the implementing agent has only Phase 1's budget, ship 1.1 + 1.2 + 1.3 and defer 1.4 (slide-over). The slide-over is the most expensive change and is independent of the others.

---

## 5. Success Metrics

The plan succeeds if the following move in the expected direction over a 4-week post-launch window. Each is measurable from existing Convex tables or browser-level events.

| Metric | Source | Pre-plan baseline | Target |
|---|---|---|---|
| **Tutor session start rate from dashboard** | `tutorThreads` rows where first message is within 30 s of a `dashboard.pageview` | Baseline | +60% (cockpit CTA + slide-over) |
| **% of tutor threads with ≥ 2 user messages** | `tutorMessages` per thread | Baseline | +25% (contextual welcome + starter prompts engage users past the first message) |
| **% of lesson runs that hand off to tutor** | `lessonContext` rows referenced by `getContextForLessonRun` | Baseline | +30% (per-item chip + improved `?lesson=` banner) |
| **% of practice runs that hand off to tutor** | `tutorThreads` rows where threadId was reached from `ResultsClient` | Baseline | +20% |
| **% of weakness cards clicked in MemoryPanel** | Click events on the new weakness card buttons | Baseline (0) | +40% (click-through from passive readout to active prompt) |
| **Session-end → next-topic click-through** | `SessionSummary` CTA click events | Baseline (0) | +35% (the new summary is the primary lever) |
| **Time-to-first-message on /tutor** | `tutorMessages` first user message timestamp − `tutorThreads` creation | Baseline | −20% (empty-state starter prompts + capabilities card reduce hesitation) |
| **Mobile tutor usage** | `tutorThreads` rows from mobile viewports (User-Agent heuristic) | Baseline | +50% (mobile sheet + history tabs unlock mobile usage) |
| **% of sessions ending in a reflection** | `studySessions.reflection !== undefined` | Baseline | +25% (SessionSummary encourages it) |
| **Per-message "ask the tutor about this" rate** | `MessageActions` copy/helpful/etc. interactions | Baseline | +15% (the per-message chrome is more discoverable when the chips are real actions) |

Qualitative signals (manual review):

- "I didn't know the tutor remembered my mistakes" — should drop to zero after Phase 2.1.
- "I opened the tutor and didn't know what to ask" — should drop to zero after Phase 1.2.
- "I forgot where the tutor was" — should drop to zero after Phase 3.3 (referrer-aware back).
- "I closed the tutor and lost my place" — should drop to zero after Phase 3.2 (scroll-restores).
- "I had to type the question I just got wrong on the practice results" — should drop to zero after Phase 2.4.

---

## 6. Out of scope (for this plan)

These are real improvements but are intentionally deferred. Each has its own design discussion; mixing them in would dilute the Tutor-focused intent of this plan.

- **AI tutor voice mode.** The disabled "Speak" chip in the Composer is removed in Phase 5.1. Adding real voice is a separate product question (STT + TTS + a model that supports it) that lives outside this plan.
- **Camera-based homework scan.** Same as voice — the disabled "Scan" chip is removed in Phase 5.1. Adding real scan is a separate product question.
- **Convex `flashcards` / `notes` mutations.** Per AGENTS.md, these tables exist in the schema but the Convex functions are not yet implemented (Phase 2.11 of the master plan). Until they land, the "Flashcards" and "Note" actions in `MessageActions` and the chip in `Composer` either stay as honest placeholders or are removed. Phase 5.2 / 5.3 of this plan ships only if those backends land.
- **Multi-user / shared tutor threads.** Synedrix is single-user. No collaborative tutor threads.
- **Tutor analytics / A/B testing.** Phase 5 of the master plan (observability) will pick this up; this UX plan does not add new analytics events beyond the existing `tutor.chat` `aiGenerations` row.
- **Tutor as a full Claude-style slide-over from the start.** The Phase 1.4 slide-over is non-disruptive (it mounts over the page, the underlying content is read-only). A full "embed the tutor inside the topic page" experience would require restructuring the topic page's left/right grid. Deferred.
- **Onboarding tooltip tour for the tutor.** A coach-mark tour is a separate product surface; the empty-state capabilities card in Phase 1.2 covers the same ground at the moment of need.

---

## 7. Open questions for the team

1. **Should the contextual welcome message be stored in the canonical `tutorMessages` table, or generated client-side and never persisted?** Storing it makes it part of the user's history (and shows up in shared threads, etc.), but it also "wastes" a slot in the per-thread history. Recommendation: store it; users will want to scroll back to it. This is a decision the implementing agent should default to and call out in the PR.
2. **Should the "Pop out to full page" CTA in the slide-over also be a "Pop out" from a full-page tutor session?** A user might be on `/tutor?subject=math&topic=functions` and want a "minimize" experience. Recommendation: yes, expose it in the SessionHeader. Mirrors the slide-over's affordance.
3. **Should the `?from=` referrer include a path like `/tutor?from=%2Fmy-topics%2Ffoo%2Fpractice%2Fresults`?** When the back-link routes there, should it preserve the scroll position to the per-item result row? Recommendation: defer the deep scroll-restoration; just route back. Phase 3.2's scroll-restoration is for /tutor itself, not the cross-page referrer.
4. **What does the AI do if the user types a question with `?focusItemId=` set?** The current plan keeps the focus as a *context* (the AI's system prompt knows which item the user is focused on) but does not change the AI's behavior. Recommendation: in the system prompt, prepend the focused item's question + verdict + better answer; let the AI naturally reference it. The user is asking about that specific item, so a normal conversation that addresses the focus first is the right behavior.
5. **Should the SessionSummary's "Continue with next topic" CTA use the canonical next-best-topic algorithm, or the user's "Up next" recommendation?** The next-best-topic algorithm in `convex/subjects.ts` is the canonical source. The Up next banner is a UI label that reads from the same data. Recommendation: use the same `data.nextBest` field that `SubjectDetailClient` already consumes. No new algorithm.

---

## 8. Appendix — Reading the code

Quick map of where each Tutor gap lives in the codebase:

- **Tutor page:** `app/(app)/tutor/{page,TutorClient,loading,error}.tsx`
- **Tutor components:** `components/tutor/{SessionHeader,HistoryPanel,MemoryPanel,Composer,MessageList,MessageActions,ReasoningPart,SuggestionDock,StreamingIndicator}.tsx`
- **API:** `app/api/tutor/chat/route.ts`
- **Convex:** `convex/{tutor,tutorContext,tutorMemory,tutorProfile}.ts`
- **Entry points (where the URL `/tutor?…` is built):**
  - `components/dashboard/AskTutorCta.tsx:78-92`
  - `components/dashboard/ContinueStudyingCard.tsx:60`
  - `components/dashboard/SubjectHeader.tsx:107`
  - `components/dashboard/TopicList.tsx:139`
  - `components/dashboard/TopicHeader.tsx:119`
  - `app/(app)/my-topics/[topicSlug]/practice/results/ResultsClient.tsx:169`
  - `convex/dashboard.ts:631` (Up next recommendations)
  - `convex/studySessions.ts:242` (study session indicator)
- **Layout:** `app/(app)/layout.tsx` (the Tutor nav entry at line 30)
- **Existing planning docs this plan complements:**
  - `docs/SUBJECT-UX-IMPROVEMENT-PLAN.md` — surfaces (dashboard, subjects, chapters, topics). Phase 1.1 of *that* plan adds `ContinueStudyingCard`; this plan extends the Tutor UX.
  - `docs/USER-TOPIC-LESSON-PLAN.md` — user-created topics with lesson + practice + grading. The `?lesson=<runId>` path was introduced in §5.6 of that plan; Phase 2.4 of *this* plan extends it with per-item focus.
  - `docs/PHASE-3-INTELLIGENCE.md` — AI tutor's full design (the Tutor is one of the most-shipped parts of Phase 3 already).
  - `docs/PHASE-4-POLISH.md` — keyboard shortcuts, caching, testing. Phase 5 of *this* plan adds A11Y and cleanup that fit Phase 4's polish theme.
- **AGENTS.md rules respected:**
  - "Business logic in Convex functions" — every read/write lands in a Convex query/mutation. Components stay presentational.
  - "Streaming always" — every AI call streams. The Tutor's `useChat` is the canonical pattern.
  - "Structured outputs" — the AI tutor uses Zod-validated input (`chatRequestSchema` in the route handler). The contextual welcome in Phase 1.1 is a server-side template, not a Zod output.
  - "Reactivity over caching" — every Tutor read goes through Convex. The `useLocalStorage` keys are UI collapse state, not data.
  - "Naming consistency" — Tutor / Thread / Message / Run / Attempt / Reflection. New code in this plan reuses those exact names.
