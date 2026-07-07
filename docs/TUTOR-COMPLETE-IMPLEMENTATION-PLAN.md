# Synedrix Tutor — Complete Implementation Plan

**Date:** July 2026  
**Status:** Design document for implementation  
**Stack:** Next.js 16, AI SDK 7 (`@ai-sdk/react`), Convex, DeepSeek v4  

---

## 0. Where We Are Now

The Tutor is **architecturally excellent but experientially generic.** The 3-pane layout, streaming pipeline, thread persistence, memory snapshot, session lifecycle, lesson-context grounding, personalization from the 11-question onboarding profile, block widget system (steps/choice/formula/mistake/diagrams), scroll restoration, mobile sheet/tabs, and A11Y live regions all ship and work. Every phase of the previous `TUTOR-UX-IMPROVEMENT-PLAN.md` has been implemented.

**The gap is not in what the Tutor *can do* — it's in what the Tutor *chooses to do* and how it *feels* to use.** The UX philosophy describes a personal teacher that understands context, guides rather than answers, structures every response, progressively discloses capabilities, keeps learning active, remembers across sessions, adapts to confidence, stays visually minimal, embeds rich educational content, and continuously feeds the rest of Synedrix. The current Tutor checks the *data* boxes for most of these but none of the *experience* boxes.

The plan below bridges that gap. It is structured in **8 phases**, each independently shippable, ordered by leverage (how much better the experience gets per unit of effort).

---

## 1. Gap Analysis — UX Philosophy vs. Current Implementation

| UX Principle | Status | What's Missing |
|---|---|---|
| **Zero Context Setup** | ⚠️ Partial | Welcomes exist but are templated strings. No proactive diagnosis. No "you were here yesterday, continue?" |
| **Conversation Feels Like Teaching** | ⚠️ Partial | Prompt instructs teaching behavior but model can ignore it. No enforcement of Socratic questioning. No tracking of what strategy is working. |
| **Every Response Has Structure** | ⚠️ Partial | Block markers exist. Model is prompted to use 80-180 word prose + 1-3 widgets. But no enforcement of 5-part rhythm (explain → visualize → insight → check → next). |
| **Progressive Disclosure** | ❌ Missing | Capabilities (flashcards, practice, notes) are always visible in composer chips and MessageActions. No "during explanation" vs "after explanation" distinction. No "generate practice" from within tutor. |
| **Learning Is Active** | ⚠️ Partial | ChoiceMenu widget + SuggestionDock chips allow active participation. But model isn't forced to ask "what do you think?" or "try solving it yourself." |
| **Natural Memory** | ❌ Missing | Recent mistakes per topic are in the prompt. But no cross-session memory ("yesterday you..."), no cross-topic pattern detection, no progress narrative. |
| **Confidence-Aware Teaching** | ⚠️ Partial | Mastery + confidence are in the prompt with instructions. But no within-session confidence tracking, no dynamic difficulty adjustment. |
| **Minimal Interface** | ✅ Good | The 3-pane layout is clean. Action chips could be more progressive. |
| **Rich Educational Content** | ⚠️ Partial | KaTeX + block widgets ship. But graph/code/vocabulary widgets are placeholders, and there's no actual interactive plotting/editing. |
| **Continuous Learning Loop** | ⚠️ Partial | Mastery updates on session end, mistakes recorded. But no automatic review scheduling, no proactive "ready for assessment" detection, no flashcard generation from conversations. |
| **Emotional Experience** | ❌ Missing | No active design for "understood, focused, curious, capable, independent." The experience is data-correct but emotionally flat. |

---

## 2. Phase Overview

```
Phase 1 — Teaching Engine Overhaul        (5-7 days)  ★ HIGHEST LEVERAGE
Phase 2 — Cross-Session Memory            (4-6 days)  ★ HIGH
Phase 3 — Progressive Capability Layer    (4-5 days)  ★ HIGH
Phase 4 — Active Learning Enforcement     (3-4 days)  ★ MEDIUM
Phase 5 — Rich Content Widgets v2         (5-7 days)  ★ MEDIUM
Phase 6 — Continuous Loop Integration     (4-5 days)  ★ MEDIUM
Phase 7 — Emotional Design Layer          (3-4 days)  ★ LOWER
Phase 8 — Power-User & Polish             (2-3 days)  ★ LOWER
```

**Total estimated scope: 30–41 days.** Each phase is independently demoable.

---

## 3. Phase 1 — Teaching Engine Overhaul

**Goal:** The AI stops being a helpful chatbot and starts being a teacher. Every response follows a structured teaching rhythm. The model's behavior is constrained, not just prompted.

### 3.1 Structured Response Enforcer

**Problem:** The current system prompt *asks* the model to teach well, but the model can ignore it. Long walls of prose still happen. The 5-part rhythm (explain → visualize → insight → check → next) is aspirational, not enforced.

**Solution:** Use AI SDK 7's `generateObject` / `streamObject` to enforce structured output. Instead of free-form text, every tutor response is a Zod-validated object with required sections.

```typescript
// New: convex/tutorResponseSchema.ts
const TutorResponse = z.object({
  // 1. Short explanation (2-4 sentences, 40-80 words)
  explanation: z.string().min(1).max(500),
  
  // 2. Visual element (one widget marker)
  visual: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("formula"), name: z.string(), expression: z.string(), when: z.string() }),
    z.object({ kind: z.literal("diagram"), subkind: z.enum(["tree","numberline","barchart","graph"]), spec: z.string() }),
    z.object({ kind: z.literal("steps"), steps: z.array(z.string()).min(2).max(5) }),
    z.object({ kind: z.literal("none") }), // for non-STEM topics
  ]),
  
  // 3. Key insight (1 sentence, the "aha" moment)
  keyInsight: z.string().min(1).max(200),
  
  // 4. Interactive check (always a choice question)
  check: z.object({
    prompt: z.string().min(1),
    options: z.array(z.object({ label: z.string(), text: z.string() })).min(2).max(4),
    correctLabel: z.string(),
    explanation: z.string(), // shown after answer
  }),
  
  // 5. Next step suggestion
  next: z.object({
    suggestion: z.string(), // "Ask me to quiz you" / "Try a harder example" / "Let's move to practice"
    actionPrompt: z.string(), // pre-baked prompt if user clicks
  }),

  // Optional: extra widgets between insight and check
  extraWidgets: z.array(z.object({
    kind: z.enum(["formula", "mistake", "concept", "diagram"]),
    payload: z.string(), // raw marker payload
  })).max(2).optional(),
});
```

**How it works:**

1. The route handler calls `streamObject` instead of `streamText`.
2. The structured output is rendered by a new `StructuredResponse` component that composes each section with the appropriate widget.
3. The model MUST fill every section — Zod validation rejects incomplete responses.
4. The streaming experience shows each section emerging in sequence (explanation first, then visual, then insight, then check).
5. The raw object is also persisted as JSON in `tutorMessages` (new `structuredContent` column) so history re-renders identically.

**Trade-off:** Structured output is ~20% slower than free-text and uses more tokens. This is acceptable: the product is teaching quality, not raw speed. The streaming UX (sections emerge in order) masks the latency.

**Files:**
- `src/lib/ai/prompts/chat.ts` — rewrite prompt for structured output instructions
- `src/lib/ai/schemas/tutorResponse.ts` — **NEW** Zod schema
- `app/api/tutor/chat/route.ts` — swap `streamText` for `streamObject`
- `components/tutor/StructuredResponse.tsx` — **NEW** section-by-section renderer
- `convex/schema.ts` — add `structuredContent` optional field to `tutorMessages`
- `components/tutor/MessageList.tsx` — route structured messages to new renderer

### 3.2 Adaptive Teaching Strategy Tracker

**Problem:** The model doesn't know if its teaching strategy is working. It can't adapt within a session.

**Solution:** Track a "teaching strategy state" per session in Convex. After each user message, analyze whether the strategy is working and adjust.

```typescript
// New table in convex/schema.ts
teachingStrategyState: defineTable({
  sessionId: v.id("studySessions"),
  // Current strategy
  currentStrategy: v.union(
    v.literal("explaining"),     // giving direct explanations
    v.literal("socratic"),       // asking guiding questions
    v.literal("example_driven"), // walking through examples
    v.literal("quiz_mode"),      // rapid-fire quizzing
    v.literal("simplifying"),    // breaking down to fundamentals
  ),
  // Signals that caused the last strategy change
  lastSwitchReason: v.optional(v.string()),
  // Per-turn engagement signals
  userEngagementScore: v.number(), // 0-1, derived from response length, time, question depth
  turnsInCurrentStrategy: v.number(),
  strategyHistory: v.array(v.object({
    strategy: v.string(),
    turns: v.number(),
    switchedAt: v.number(),
  })),
}).index("by_session", ["sessionId"]),
```

**The strategy adjusts based on:**
- User response length (short = confused, long = engaged)
- Question depth (surface-level "what is X?" vs deep "how does X relate to Y?")
- Time between messages
- Whether the user clicked "Easier explanation" or "Harder example" in SuggestionDock
- Whether the user got the `[[choice]]` question right or wrong

**Files:**
- `convex/schema.ts` — new table
- `convex/tutorStrategy.ts` — **NEW** strategy tracking queries + mutations
- `app/api/tutor/chat/route.ts` — inject strategy state into system prompt
- `components/tutor/StrategyIndicator.tsx` — **NEW** subtle indicator in SessionHeader

### 3.3 Proactive Session Start

**Problem:** The "Zero Context Setup" principle says the first screen should feel alive. Currently, the welcome message is templated — it doesn't diagnose, recommend, or suggest based on the full context.

**Solution:** On thread creation (`ensureThread`), run a lightweight AI call to generate the first message. This is NOT the main chat model — it's a fast classifier that produces an opening intent.

The opening message should:
1. Name exactly where the user is in their curriculum
2. Surface the most recent mistake or gap
3. Propose one concrete next action
4. End with a question that invites participation

Example output (not a template, AI-generated):
> "You're on Quadratic Functions — 34% mastery, last practiced 3 days ago. Your most recent slip was sign errors when completing the square. Want to walk through a sign-error example together, or shall we pick up where the lesson left off?"

**Files:**
- `convex/tutor.ts` — `ensureThread` calls `api.ai.generateOpeningMessage`
- `convex/tutorOpening.ts` — **NEW** mutation that calls a fast model for the opening
- `app/api/tutor/opening/route.ts` — **NEW** lightweight API route

---

## 4. Phase 2 — Cross-Session Memory

**Goal:** The Tutor remembers what happened yesterday, last week, and across topics. It builds a narrative of the student's progress.

### 4.1 Memory Chronicle

**Problem:** The system prompt has `recentMistakes` per topic, but there's no cross-session narrative. The UX wants: "Yesterday you understood derivatives but struggled with chain rule" and "This mistake is similar to one you made last week."

**Solution:** A new Convex query `getMemoryChronicle` that builds a time-ordered narrative of the user's learning:

```typescript
// New query: convex/tutorMemory.ts
export const getMemoryChronicle = query({
  args: { subjectId: v.id("subjects"), topicId: v.optional(v.id("topics")) },
  handler: async (ctx, { subjectId, topicId }) => {
    // Returns:
    // 1. Last 3 sessions on this topic (date, duration, mastery delta, key takeaway)
    // 2. Recurring mistake patterns across topics (e.g., "sign errors in 3 topics")
    // 3. Progress milestones ("first reached 50% mastery on X days ago")
    // 4. Related topics the user studied recently
    // 5. A one-paragraph narrative summary for the system prompt
  }
});
```

This chronicle is injected into the system prompt as a "What the student has been doing" block. The model can reference it naturally: "This sign error is the same pattern you had in linear equations last month — let's break that habit."

**Files:**
- `convex/tutorMemory.ts` — add `getMemoryChronicle` query
- `app/api/tutor/chat/route.ts` — inject chronicle into `buildChatSystemPrompt`
- `src/lib/ai/prompts/chat.ts` — add `memoryChronicle` to `ChatGrounding`

### 4.2 Mistake Pattern Detection

**Problem:** The Memory panel shows individual mistakes. It doesn't detect *patterns* across them.

**Solution:** A lightweight pattern classifier that runs on `endSession` and tags cross-mistake patterns:

```typescript
// Patterns detected:
// - "sign_error_chain" — same sign error across 3+ topics
// - "formula_confusion" — mixing up two related formulas
// - "unit_conversion_gap" — struggling with units across physics + chemistry
// - "reading_comprehension" — misreading questions in language + math word problems
```

Detected patterns are stored in a new `mistakePatterns` table and surfaced in the Memory panel and system prompt.

**Files:**
- `convex/schema.ts` — new `mistakePatterns` table
- `convex/tutorPatterns.ts` — **NEW** pattern detection
- `components/tutor/MemoryPanel.tsx` — render pattern cards
- `src/lib/ai/prompts/chat.ts` — inject patterns into prompt

### 4.3 Progress Narrative in SessionHeader

Add a small narrative line to the SessionHeader that changes based on context:

- "Back after 3 days — your mastery held at 72%"
- "Third session this week on Quadratics — 18% gain since Monday"
- "First time on this topic — let's build from zero"

**Files:**
- `components/tutor/SessionHeader.tsx` — add narrative line
- `convex/tutorMemory.ts` — add `getProgressNarrative` query

---

## 5. Phase 3 — Progressive Capability Layer

**Goal:** Capabilities appear only when useful, not all at once. The interface follows the "during explanation" vs "after explanation" distinction from the UX philosophy.

### 5.1 Two-Phase Composer Chips

**Current state:** Equation, Flashcards, and Practice chips are always visible above the textarea.

**New behavior:**
- **While the AI is explaining (streaming or just finished):** Only "Ask for clarification" and "Easier please" chips.
- **After the AI has finished and the user has read the response (5s after streaming ends):** Full chip set appears — Quiz me, Flashcards, Practice, Save notes.
- **After the user has asked 3+ questions in a session:** "Summarize this thread" and "Generate practice from this conversation" chips appear.

**Files:**
- `components/tutor/Composer.tsx` — phase-aware chip rendering
- `components/tutor/ComposerChips.tsx` — **NEW** extracted chip logic

### 5.2 Inline Practice Generation

**Problem:** The UX philosophy says "Ready for assessment → Launch Practice Arena." Currently, practice is a link to a separate page.

**Solution:** Add a "Generate 3 quick questions" button that appears after substantial conversation. This calls a new API route that generates 3 practice questions based on the conversation context, renders them inline in the chat as an interactive practice mini-session, and grades them on the spot without leaving the tutor.

```typescript
// app/api/tutor/practice/route.ts — NEW
// POST — accepts threadId, generates 3 questions from conversation context
// Returns structured practice items that render inline in MessageList
```

**Files:**
- `app/api/tutor/practice/route.ts` — **NEW**
- `components/tutor/InlinePractice.tsx` — **NEW** inline practice widget
- `convex/tutorPractice.ts` — **NEW** persistence for inline practice results

### 5.3 Capability Shelf

Replace the always-visible SuggestionDock below each message with a "Capability Shelf" that slides in after a short delay:

1. **t=0 (streaming ends):** No shelf. Just the message.
2. **t=1.5s:** "Ask a follow-up" single chip appears.
3. **t=4s:** Full shelf with 3-4 contextual chips appears.

This creates a rhythm: read → think → ask, rather than read → see 6 buttons → get distracted.

**Files:**
- `components/tutor/SuggestionDock.tsx` — staggered reveal animation
- `components/tutor/MessageList.tsx` — pass timing signals

---

## 6. Phase 4 — Active Learning Enforcement

**Goal:** The student is constantly participating, not passively reading.

### 6.1 Mandatory Check Questions

After Phase 1's structured response enforcer, every AI response ends with a `[[choice:...]]` widget. This is non-negotiable — the model MUST include a check question. The student cannot continue the conversation without engaging.

But passive dismissal ("just click any answer") is tracked. If the user clicks without reading (sub-2-second response time), the next response from the tutor includes a gentle nudge: "Take your time with these — the goal is understanding, not speed."

### 6.2 "Try It Yourself" Blocks

When the user asks "how do I solve X?", the tutor's first response is NOT the solution. It's a `[[steps:Try identifying what's given|Set up the equation|Solve one step]]` block that asks the user to attempt first. The solution only comes after the user types their attempt.

This is enforced in the system prompt and structured response schema: when `mastery < 0.7`, the `explanation` field must end with "What do you think the first step should be?" and the `visual` must be a `[[steps:...]]` block.

### 6.3 Socratic Mode Toggle

Add a toggle in the SessionHeader: "Socratic mode" — when on, the tutor NEVER gives direct answers. It only asks guiding questions. This is stored per-session in `teachingStrategyState`.

**Files:**
- `components/tutor/SessionHeader.tsx` — Socratic toggle
- `convex/tutorStrategy.ts` — persist preference
- `src/lib/ai/prompts/chat.ts` — Socratic mode prompt block

---

## 7. Phase 5 — Rich Content Widgets v2

**Goal:** The educational content embedded in conversations goes beyond text + math. Real interactive widgets.

### 7.1 Interactive Graph Plotter

Replace the current `GraphDiagram` placeholder ("rough sketch") with an actual interactive function plotter using a lightweight canvas-based approach. The widget:

- Renders the function on a canvas with labeled axes
- Supports zoom (pinch on mobile, scroll on desktop)
- Shows the point under the cursor/finger
- Highlights roots, extrema, and intercepts

**Tech:** Use a small `<canvas>` component (no charting library — keep the bundle small). The `[[diagram:graph|formula:y=x^2|xmin:-2|xmax:2]]` marker contract stays the same.

**Files:**
- `components/tutor/widgets/GraphPlotter.tsx` — **NEW**
- `src/lib/content/tutorWidgets.tsx` — wire new GraphDiagram to GraphPlotter

### 7.2 Vocabulary Flip Cards

For language topics, the `[[concept:der Tisch]]` marker renders as a flip card instead of a chip. Tap to reveal gender, definition, and an example sentence.

**Files:**
- `components/tutor/widgets/VocabularyCard.tsx` — **NEW**
- `src/lib/content/tutorWidgets.tsx` — route language concepts to VocabularyCard

### 7.3 Code Editor Widget

For CS/math topics, a `[[code:python|print("hello")]]` marker renders as a syntax-highlighted code block with a "Run" button (using a sandboxed eval — or just syntax highlighting for safety in v1).

**Files:**
- `components/tutor/widgets/CodeBlock.tsx` — **NEW**
- `src/lib/content/tutorWidgets.tsx` — add `code` marker kind

### 7.4 Chemistry Structure Renderer

For chemistry topics, a `[[diagram:molecule|H2O]]` marker renders a simple ball-and-stick diagram using SVG or canvas.

**Files:**
- `components/tutor/widgets/MoleculeDiagram.tsx` — **NEW**

---

## 8. Phase 6 — Continuous Loop Integration

**Goal:** Every tutor interaction feeds the rest of Synedrix automatically.

### 8.1 Automatic Review Scheduling

When the tutor detects a weakness (via the structured response's `extraWidgets` containing a `[[mistake:...]]` marker), it automatically:
1. Creates a `mistakeEntry` row
2. Sets `reviewAt = Date.now() + 24h` for spaced repetition
3. Surfaces it in the dashboard's "Due for review" section

**Files:**
- `convex/tutor.ts` — `recordAssistantMessage` triggers auto-review
- `convex/tutorAutoReview.ts` — **NEW** scheduling logic

### 8.2 Flashcard Generation from Conversations

When the user clicks "Generate flashcards" on a message, instead of writing to localStorage:
1. Call a new mutation `api.flashcards.generateFromMessage`
2. The AI extracts key term/definition pairs from the message
3. Creates a `flashcardDeck` + `flashcards` rows
4. The user sees a confirmation chip: "6 flashcards saved to your deck"

**Files:**
- `convex/flashcards.ts` — add `generateFromMessage` mutation
- `components/tutor/MessageActions.tsx` — wire to real mutation
- `app/api/tutor/flashcards/route.ts` — **NEW** AI generation route

### 8.3 Practice Readiness Detection

After 5+ turns in a session, the teaching strategy tracker evaluates whether the user is ready for practice:

```typescript
// Heuristic in convex/tutorStrategy.ts
function isReadyForPractice(state: TeachingStrategyState): boolean {
  return (
    state.userEngagementScore > 0.6 &&
    state.turnsInCurrentStrategy >= 3 &&
    state.recentChoiceAccuracy > 0.7 // from [[choice]] widgets
  );
}
```

When ready, the SessionHeader shows a subtle "Ready to practice?" chip. Clicking it generates a practice set from the conversation context and opens it (slide-over or new tab).

**Files:**
- `convex/tutorStrategy.ts` — readiness detection
- `components/tutor/SessionHeader.tsx` — readiness chip
- `app/api/tutor/practice/route.ts` — generate practice from conversation

---

## 9. Phase 7 — Emotional Design Layer

**Goal:** The student feels understood, focused, curious, capable, and independent — not just data-processed.

### 9.1 Context-Aware Greeting Tone

The opening message's tone adapts to the student's state:

- **Returning after a good session:** Warm, encouraging — "Great to see you back. Your mastery held strong."
- **Returning after a struggling session:** Gentle, reassuring — "No rush. Let's pick one thing and nail it today."
- **First time ever:** Curious, inviting — "I've read your profile. Ready to find the best way you learn?"
- **Before an exam (if goal = exam_panic):** Calm, structured — "Three weeks to go. Let's build the exam-day rhythm starting now."

**Files:**
- `convex/tutorOpening.ts` — tone selection logic
- `src/lib/ai/prompts/chat.ts` — tone instructions

### 9.2 Progress Affirmations

The tutor occasionally (not every turn, ~every 5 turns) drops a genuine, specific affirmation:

- "That's the third time you've spotted a sign error before I pointed it out — that reflex is building."
- "You just explained completing the square in your own words. That's the clearest sign of real understanding."

Not flattery. Not padding. Specific, observed, true.

Implemented as an optional `affirmation` field in the structured response schema. If the model detects a genuine milestone, it fills it. Otherwise `null`. The renderer shows it as a quiet, single-line chip.

**Files:**
- `src/lib/ai/schemas/tutorResponse.ts` — optional `affirmation` field
- `components/tutor/StructuredResponse.tsx` — render affirmation chip

### 9.3 "You're in Control" Signals

Small UI touches that communicate the student owns the pace:

- After 3 rapid messages: "I'm here as long as you need. No rush."
- When the student types a long question: "Taking time to frame your question well — that's already half the learning."
- The "End session" button label changes to "Wrap up for now" (softer, less final).

**Files:**
- `components/tutor/SessionHeader.tsx` — button copy
- `components/tutor/Composer.tsx` — long-input detection

---

## 10. Phase 8 — Power-User & Polish

### 10.1 Keyboard Shortcuts
- `/` — focus composer
- `Esc` — stop streaming / dismiss panels
- `Ctrl+Enter` — send message (alternative to Enter)
- `Ctrl+K` — open thread switcher (quick-jump between threads)

### 10.2 Thread Export
- "Copy thread as Markdown" button in SessionHeader
- Exports the full conversation with proper formatting

### 10.3 Streaming Resilience
- If a stream fails mid-reply, show a "The response was interrupted. Retry?" chip instead of a partially-rendered message
- Auto-retry once before showing the error

### 10.4 Model Selection Indicator
- Show which model is responding (DeepSeek V4 Flash by default)
- Add a subtle model badge in the StreamingIndicator

---

## 11. Architectural Decisions

### D1: Structured Output vs. Free Text

**Decision:** Use `streamObject` with Zod schema for Phase 1+.  
**Rationale:** Free-text prompting cannot enforce the 5-part teaching rhythm. Structured output guarantees every response has explanation → visual → insight → check → next. The ~20% latency cost is acceptable because the streaming UX shows sections progressively, and teaching quality is the product.

**Risk:** Structured output is less "creative" — responses may feel formulaic over many turns. Mitigation: allow the model to skip the `visual` section (use `kind: "none"`) for turns where it doesn't apply, and vary the `extraWidgets` to add variety.

### D2: Strategy Tracking in Convex vs. In-Prompt

**Decision:** Track strategy state in a Convex table, not just in the prompt.  
**Rationale:** Strategy needs to persist across turns, survive page refreshes, and accumulate signals. The prompt alone has no memory. The strategy state table is cheap (one row per session, updated per turn).

### D3: Inline Practice vs. New Tab

**Decision:** Inline practice (Phase 3.2 + Phase 6.3) renders in the tutor, not a new tab.  
**Rationale:** The UX philosophy says the tutor is the intellectual center. Bouncing to another page for practice breaks concentration. Inline practice keeps the student in flow. Results from inline practice still persist to Convex so they feed the mastery curve.

### D4: One Structured Response Schema vs. Multiple

**Decision:** One schema (`TutorResponse`) for all tutor responses.  
**Rationale:** Multiple schemas (one for explaining, one for quizzing, etc.) would require the route handler to decide which schema to use before calling the model — a classification problem that adds latency and complexity. One unified schema with optional fields (e.g., `extraWidgets`, `affirmation`) gives the model freedom within structure.

### D5: AI SDK 7 Features to Use

| Feature | Use |
|---|---|
| `streamObject` | Phase 1 structured responses |
| `generateObject` | Phase 1 opening message, Phase 6 flashcard generation |
| `toUIMessageStream` | Already in use for streaming |
| `DefaultChatTransport` | Already in use |
| Reasoning parts (`ReasoningUIPart`) | Already rendered by ReasoningPart |
| Tool calling (`toolCallStreaming`) | Phase 6 — practice generation, flashcard creation as tool calls |

---

## 12. File-by-File Change Map

### New Files (16)

| File | Phase | Purpose |
|---|---|---|
| `src/lib/ai/schemas/tutorResponse.ts` | 1 | Zod schema for structured tutor responses |
| `components/tutor/StructuredResponse.tsx` | 1 | Section-by-section response renderer |
| `convex/tutorStrategy.ts` | 1 | Teaching strategy state tracking |
| `convex/tutorOpening.ts` | 1 | AI-generated opening messages |
| `app/api/tutor/opening/route.ts` | 1 | Opening message API |
| `convex/tutorPatterns.ts` | 2 | Cross-mistake pattern detection |
| `components/tutor/ComposerChips.tsx` | 3 | Phase-aware chip rendering |
| `app/api/tutor/practice/route.ts` | 3, 6 | Inline practice generation |
| `components/tutor/InlinePractice.tsx` | 3 | Inline practice widget |
| `convex/tutorPractice.ts` | 3 | Inline practice persistence |
| `components/tutor/widgets/GraphPlotter.tsx` | 5 | Interactive function plotter |
| `components/tutor/widgets/VocabularyCard.tsx` | 5 | Flip-card vocabulary widget |
| `components/tutor/widgets/CodeBlock.tsx` | 5 | Syntax-highlighted code widget |
| `components/tutor/widgets/MoleculeDiagram.tsx` | 5 | Chemistry structure renderer |
| `convex/tutorAutoReview.ts` | 6 | Automatic review scheduling |
| `app/api/tutor/flashcards/route.ts` | 6 | Flashcard generation from messages |

### Modified Files (18)

| File | Phases | Changes |
|---|---|---|
| `src/lib/ai/prompts/chat.ts` | 1, 2, 4, 7 | Structured output instructions, memory chronicle, Socratic mode, tone directives |
| `app/api/tutor/chat/route.ts` | 1, 2 | `streamObject` instead of `streamText`, inject chronicle, inject strategy state |
| `convex/schema.ts` | 1, 2, 6 | `structuredContent` on `tutorMessages`, `teachingStrategyState` table, `mistakePatterns` table |
| `convex/tutor.ts` | 1, 6 | `ensureThread` calls opening AI, `recordAssistantMessage` triggers auto-review |
| `convex/tutorMemory.ts` | 2 | Add `getMemoryChronicle`, `getProgressNarrative` queries |
| `convex/flashcards.ts` | 6 | Add `generateFromMessage` mutation |
| `components/tutor/MessageList.tsx` | 1, 3 | Route structured messages, staggered SuggestionDock |
| `components/tutor/Composer.tsx` | 3, 7 | Phase-aware chips, long-input detection |
| `components/tutor/SuggestionDock.tsx` | 3 | Staggered reveal animation |
| `components/tutor/SessionHeader.tsx` | 2, 4, 6, 7 | Progress narrative, Socratic toggle, readiness chip, softer copy |
| `components/tutor/MemoryPanel.tsx` | 2 | Pattern cards, chronicle integration |
| `components/tutor/MessageActions.tsx` | 6 | Wire to real flashcard mutation |
| `components/tutor/StreamingIndicator.tsx` | 8 | Model badge |
| `components/tutor/EmptyStateCapabilities.tsx` | 1 | Updated for structured response awareness |
| `src/lib/content/tutorWidgets.tsx` | 5 | New widget kinds (graph v2, vocabulary, code, molecule) |
| `components/tutor/TutorClient.tsx` | 3 | Inline practice state management |
| `app/(app)/tutor/TutorClient.tsx` | 1, 3 | Strategy state, inline practice, structured response routing |
| `app/(app)/tutor/page.tsx` | 1 | Pass additional context for opening message |

---

## 13. Testing Strategy

### Per-Phase Validation

| Phase | Typecheck | Unit Tests | Integration Test |
|---|---|---|---|
| 1 | `npm run typecheck` | `src/lib/ai/schemas/__tests__/tutorResponse.test.ts` — Zod schema validation | Manual: structured response renders all 5 sections |
| 2 | `npm run typecheck` | `convex/tutorMemory.test.ts` — chronicle query shape | Manual: cross-session memory appears in prompt |
| 3 | `npm run typecheck` | — | Manual: chips appear/disappear at right times |
| 4 | `npm run typecheck` | — | Manual: Socratic mode never gives direct answers |
| 5 | `npm run typecheck` | `components/tutor/widgets/__tests__/GraphPlotter.test.tsx` | Manual: widgets render correctly |
| 6 | `npm run typecheck` | — | Manual: flashcards appear in deck after generation |
| 7 | `npm run typecheck` | — | Manual: affirmations are specific and non-repetitive |
| 8 | `npm run typecheck` | — | Manual: keyboard shortcuts work |

### Regression Testing

After each phase:
- `npm run typecheck` — must pass
- `npm run lint` — must pass
- `npm run test` — existing tests must pass
- `npm run lint:content` — seed contract must be valid
- Manual smoke test: open tutor from dashboard, subject page, topic page, practice results — all entry points still work

---

## 14. Success Metrics

| Metric | Source | Target |
|---|---|---|
| % of tutor responses with all 5 structured sections | `tutorMessages.structuredContent` validation | >95% |
| Average turns per session | `tutorMessages` per `studySessions` | +40% (current ~3, target ~5) |
| % of sessions where user clicks a `[[choice]]` answer | Widget interaction events | >70% |
| % of users who return to tutor within 48h | `tutorThreads` revisit rate | +25% |
| % of sessions with cross-topic memory references | `memoryChronicle` usage in prompt | >50% of sessions after 2nd session |
| Inline practice completion rate | `topicLessonPractice` rows from inline route | >60% |
| Flashcard generation rate | `flashcardDecks` from `generateFromMessage` | >10% of sessions |
| "Easier explanation" chip click rate | SuggestionDock events | Should decrease over time as AI adapts (strategy tracker working) |

---

## 15. Out of Scope

These are real features but intentionally deferred:

- **Voice input/output.** The disabled "Speak" chip was removed. Full voice requires STT + TTS infrastructure and is a separate product decision.
- **Camera-based homework scanning.** Same as voice.
- **Multi-user or shared tutor threads.** Synedrix is single-user.
- **Real-time collaborative whiteboard.** Out of scope for the chat-based tutor.
- **Tutor A/B testing framework.** Phase 5 of the master observability plan.
- **Offline tutor mode.** Requires local model inference — a major infrastructure decision.
- **Tutor embedding in the topic page** (the Phase 1.4 slide-over from the old plan). Deferred — the current AskTutorCta + new-tab pattern works well enough.

---

## 16. Sequencing Rationale

**Phase 1 first** because it fundamentally changes what the tutor *is* — from a chatbot to a teacher. Everything else builds on the structured response format. If you ship nothing else, Phase 1 alone transforms the experience.

**Phase 2 second** because memory is the #1 thing that makes a tutor feel personal. The structured responses from Phase 1 give the memory system clean data to work with.

**Phase 3 third** because progressive disclosure makes the interface feel lighter and more intentional, but it's cosmetic compared to the teaching quality improvements of Phases 1-2.

**Phases 4-6** deepen the teaching experience. They can be shipped in any order after Phase 2.

**Phases 7-8** are polish. They matter for the emotional experience but don't block the core teaching loop.
