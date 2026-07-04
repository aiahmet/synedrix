/**
 * Single source of truth for marketing-page content.
 *
 * Refactor goals:
 *   1. Eliminate ad-hoc inline arrays scattered across section files.
 *   2. Type every shape so refactors that miss an entry will not compile.
 *   3. Pull substantive detail from README + study-os-spec so the page
 *      reads as a real product, not three glossy cards and a CTA.
 *   4. Sentence case. No em-dashes anywhere on the page.
 *   5. No fake-precise numbers (47, 24, etc are real word counts and
 *      page counts from the spec, not invented SLA numbers).
 */

import type { PhosphorIcon } from "@/components/landing/icons";
import {
  Books,
  Brain,
  ChatCircleText,
  ClockCounterClockwise,
  Code,
  Compass,
  Crosshair,
  Cube,
  Database,
  Fingerprint,
  Flask,
  FlowArrow,
  GitFork,
  GraduationCap,
  Infinity,
  Key,
  Lightning,
  ListChecks,
  LockSimple,
  MathOperations,
  Notebook,
  Notepad,
  Palette,
  PencilLine,
  Pulse,
  Quotes,
  Repeat,
  Rocket,
  ShieldCheck,
  Sparkle,
  Stack,
  Target,
  Timer,
} from "@/components/landing/icons";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NavLink {
  readonly href: string;
  readonly label: string;
}

export interface LogoEntry {
  readonly id: string;
  readonly label: string;
}

export interface ProblemPillar {
  readonly title: string;
  readonly description: string;
}

export interface Surface {
  readonly title: string;
  readonly summary: string;
  readonly description: string;
  readonly highlight: string;
  readonly icon: PhosphorIcon;
  readonly span: string;
  readonly imageQuery?: string;
  readonly isHero?: boolean;
}

export interface LoopStep {
  readonly title: string;
  readonly tagline: string;
  readonly detail: string;
  readonly icon: PhosphorIcon;
}

export interface Subject {
  readonly id: string;
  readonly name: string;
  readonly blurb: string;
  readonly tailwindColor: string; // mapped from tokens in components
  readonly surfaceHex: string; // lightweight tint for mock chip backgrounds
  readonly workflow: readonly string[];
  readonly tutorMode: string;
  readonly icon: PhosphorIcon;
}

export interface ArchitectureCard {
  readonly tag: string;
  readonly title: string;
  readonly description: string;
  readonly entities: readonly string[];
  readonly code: string;
  readonly icon: PhosphorIcon;
  readonly span: string;
}

export interface EngineeringPillar {
  readonly title: string;
  readonly description: string;
  readonly icon: PhosphorIcon;
  readonly span: string;
}

export interface DesignPrinciple {
  readonly title: string;
  readonly description: string;
  readonly icon: PhosphorIcon;
}

export interface TechStackItem {
  readonly category: string;
  readonly description: string;
  readonly capability: string;
}

export interface InstallStep {
  readonly title: string;
  readonly verb: string;
  readonly description: string;
  readonly commands: readonly string[];
  readonly icon: PhosphorIcon;
}

export interface RoadmapPhase {
  readonly label: string;
  readonly status: "complete" | "in-progress" | "planned";
  readonly title: string;
  readonly description: string;
  readonly milestones: readonly string[];
}

export interface DataEntity {
  readonly name: string;
  readonly purpose: string;
  readonly tier: "canonical" | "progress" | "telemetry";
}

export interface FaqItem {
  readonly question: string;
  readonly answer: string;
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

export const navLinks: readonly NavLink[] = [
  { href: "#surfaces", label: "Surfaces" },
  { href: "#loop", label: "Loop" },
  { href: "#subjects", label: "Subjects" },
  { href: "#architecture", label: "Architecture" },
  { href: "#stack", label: "Stack" },
  { href: "#roadmap", label: "Roadmap" },
] as const;

// ---------------------------------------------------------------------------
// Trusted bar / Stack
// ---------------------------------------------------------------------------

/**
 * Trusted-bar stack entries. Surface render (mark letter) is resolved
 * in the TrustedBar component, so this stays purely presentational.
 */
export const heroLogos: readonly LogoEntry[] = [
  { id: "convex", label: "Convex" },
  { id: "clerk", label: "Clerk" },
  { id: "next", label: "Next.js" },
  { id: "vercel", label: "Vercel AI SDK" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "tanstack", label: "TanStack Query" },
  { id: "zustand", label: "Zustand" },
  { id: "tailwind", label: "Tailwind v4" },
] as const;

// ---------------------------------------------------------------------------
// Problem section
// ---------------------------------------------------------------------------

export const problemPillars: readonly ProblemPillar[] = [
  {
    title: "One tab, seven surfaces",
    description:
      "Notes, flashcards, AI tutor, mock tests, mistake logs, and analytics usually live in five separate apps that do not know each other exist. Synedrix keeps them in one state, so moving from study to drill to review never reloads context.",
  },
  {
    title: "Five systems, one state",
    description:
      "Curriculum map, knowledge workspace, AI tutor, practice engine, and review queue all read from the same data. The tutor already knows what the practice engine just tested, and the planner already knows what the review queue is about to demand.",
  },
  {
    title: "Insight, not vanity metrics",
    description:
      "Hours studied, sessions completed, and review completion are inputs. Payoffs are derived observations: this topic decays after three days, you overestimate your chemistry mastery, short math sessions beat long ones. Signals you can act on.",
  },
] as const;

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export const surfaces: readonly Surface[] = [
  {
    title: "The Cockpit",
    summary: "Dashboard",
    description:
      "Answers the only question that matters each morning: what do I do right now. Daily mission, weak topics, AI curation, review queue, recent mistakes, and the weekly consistency graph in under a second.",
    highlight: "Command center",
    icon: Compass,
    span: "md:col-span-2 md:row-span-2",
    imageQuery: "cockpit",
    isHero: true,
  },
  {
    title: "Subject Hubs",
    summary: "Math, Physics, Languages",
    description:
      "Tailored workflows per subject. Math ships a hint ladder. Physics decomposes units. French runs rubric-based writing drills. One layout trunk, six subject-tuned branches.",
    highlight: "6 subjects",
    icon: Books,
    span: "md:col-span-2",
  },
  {
    title: "Topic Pages",
    summary: "Atomic learning screen",
    description:
      "Three depths of explanation on one page. Inline annotation, worked examples, a common-mistakes panel, and an AI sidecar that already knows the topic, your mastery, and your recent mistakes.",
    highlight: "Learn",
    icon: GraduationCap,
    span: "md:col-span-2",
  },
  {
    title: "Tutor Workspace",
    summary: "Context-aware AI",
    description:
      "Modes ship preconfigured: explain simply, hint only, quiz me, Socratic, check my answer, summarize for revision. Quote any block into a prompt. Session memory scoped to the topic, not a global profile.",
    highlight: "Ask",
    icon: ChatCircleText,
    span: "md:col-span-2",
  },
  {
    title: "Practice Arena",
    summary: "On-demand drills",
    description:
      "MCQ, step-by-step problems, fill-in-the-blank, formulas, oral recall, translations, essay drills. Generate a fresh set, retry only what was wrong, mix topics for exam simulation, run timed.",
    highlight: "Drill",
    icon: Target,
    span: "md:col-span-2",
  },
  {
    title: "Review Center",
    summary: "Spaced repetition",
    description:
      "One unified queue: due today, weak-foundations recovery, mistake-log replay, formula packs, language decks. An AI rescue plan when many things are overdue at once. No scattered decks.",
    highlight: "Retain",
    icon: ClockCounterClockwise,
    span: "md:col-span-2",
  },
  {
    title: "Focus Mode",
    summary: "Deep work",
    description:
      "Hides navigation, pins the current goal, surfaces a calm timer, and captures a one-line reflection at the end. The interface disappears while you work.",
    highlight: "Distraction-free",
    icon: Crosshair,
    span: "md:col-span-2",
  },
  {
    title: "Mistake Journal",
    summary: "The standout feature",
    description:
      "Every mistake is classified by concept and cause, linked to the topic and the practice attempt, and scheduled for review. Recurring patterns become the inputs that retrain the tutor.",
    highlight: "Recover",
    icon: Notepad,
    span: "md:col-span-2",
  },
  {
    title: "Planner",
    summary: "Goals + sessions",
    description:
      "Daily and weekly goals, subject-level time targets, session templates for Monday-style routines. Recovery plans after missed days, not guilt trips. Auto-generated next step at the close of every session.",
    highlight: "Plan",
    icon: Timer,
    span: "md:col-span-2",
  },
] as const;

// ---------------------------------------------------------------------------
// Learning loop
// ---------------------------------------------------------------------------

export const loopSteps: readonly LoopStep[] = [
  {
    title: "Diagnose",
    tagline: "What do I already know?",
    detail:
      "Mastery is estimated from prior attempts and self-rated confidence, so the session opens at the right depth, not at yesterday's level.",
    icon: Pulse,
  },
  {
    title: "Study",
    tagline: "Simple, standard, or rigorous",
    detail:
      "Three depths on one page with inline annotation, worked examples, a common-mistakes panel, and pinned formulas. Switch depths without reloading context.",
    icon: ListChecks,
  },
  {
    title: "Question",
    tagline: "Ask the AI tutor",
    detail:
      "The tutor knows the subject, topic, current mastery, and recent mistakes. Pin a quote to the prompt. No wasted context-setting, no starting over.",
    icon: ChatCircleText,
  },
  {
    title: "Solve",
    tagline: "Guided then independent",
    detail:
      "Guided tasks build the method. Independent problems test it. Every answer receives step-by-step feedback and the full solution path, not just a verdict.",
    icon: PencilLine,
  },
  {
    title: "Log",
    tagline: "Save mistakes to the journal",
    detail:
      "Every mistake is tagged by concept and cause, linked to the topic, and scheduled for revisit. The journal becomes a personal map of what actually needs attention.",
    icon: Notepad,
  },
  {
    title: "Generate",
    tagline: "Create review items from mistakes",
    detail:
      "Flashcards and review prompts are derived from your specific mistakes, not from generic decks. Save any explanation as a card with one action.",
    icon: Sparkle,
  },
  {
    title: "Re-test",
    tagline: "Come back via spaced repetition",
    detail:
      "Items surface at optimal intervals. Struggled items come back tomorrow. Mastered items fade into maintenance rotation. Mistake replay pulls from the journal directly.",
    icon: Repeat,
  },
] as const;

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

export const subjects: readonly Subject[] = [
  {
    id: "math",
    name: "Mathematics",
    blurb:
      "Step-by-step solving workspace, hint ladder, formula sheet, error classification by concept. Multiple variants per problem. Symbol-friendly answer input.",
    tailwindColor: "subject-math",
    surfaceHex: "#eef2ff",
    workflow: ["Read proof", "Hint ladder", "Solve guided", "Solve independent", "Tag mistake", "Generate card"],
    tutorMode: "Socratic until you solve",
    icon: MathOperations,
  },
  {
    id: "physics",
    name: "Physics",
    blurb:
      "Concepts paired with formulas, unit-aware problems, decomposition into knowns, unknowns, laws, substitutions. Diagram support arriving after Phase 2.",
    tailwindColor: "subject-physics",
    surfaceHex: "#ecfeff",
    workflow: ["Identify knowns", "Pick law", "Solve units", "Check magnitude", "Diagram later"],
    tutorMode: "Units-first exposition",
    icon: Infinity,
  },
  {
    id: "chemistry",
    name: "Chemistry",
    blurb:
      "Reaction balancing drills, organic chemistry pattern learning, definitions and process chains, equation and terminology practice. Equation-first input.",
    tailwindColor: "subject-chemistry",
    surfaceHex: "#f7fee7",
    workflow: ["Balance", "Mechanism", "Definition", "Reaction chain"],
    tutorMode: "Process-chain worksheets",
    icon: Flask,
  },
  {
    id: "french",
    name: "French",
    blurb:
      "Vocabulary decks, grammar drills, text-analysis helper, rubric scoring on writing, oral prompts and speaking rehearsal, explain-this-in-simpler-French standby.",
    tailwindColor: "subject-french",
    surfaceHex: "#fff7ed",
    workflow: ["Vocab deck", "Grammar drill", "Writing rubric", "Oral rehearsal", "Explain simpler"],
    tutorMode: "Rubric-driven feedback",
    icon: Quotes,
  },
  {
    id: "german",
    name: "Deutsch",
    blurb:
      "Argument-structure support, text annotation, characterization and analysis templates, thesis-to-outline generation. Built for the German Oberstufe register.",
    tailwindColor: "subject-german",
    surfaceHex: "#fef3c7",
    workflow: ["Analyze text", "Characterization", "Thesis to outline", "Argument structure"],
    tutorMode: "Thesis feedback",
    icon: Notebook,
  },
  {
    id: "english",
    name: "English",
    blurb:
      "Reading comprehension, literary analysis, essay structure, vocabulary expansion. Reader-friendly essay feedback with plain-language notes.",
    tailwindColor: "subject-english",
    surfaceHex: "#f1f5f9",
    workflow: ["Read", "Annotate", "Thesis", "Draft", "Revise"],
    tutorMode: "Plain-language essay notes",
    icon: Brain,
  },
] as const;

// ---------------------------------------------------------------------------
// Architecture
// ---------------------------------------------------------------------------

export const architectureCards: readonly ArchitectureCard[] = [
  {
    tag: "Data modeling",
    title: "Canonical data stays separate from per-user progress",
    description:
      "Subject, Chapter, Topic, and LessonBlock are canonical, read-heavy, and aggressively cached. UserTopicProgress, PracticeAttempt, and MistakeEntry are per-user, write-heavy, and realtime. The two never share a table.",
    entities: [
      "Subject",
      "Chapter",
      "Topic",
      "LessonBlock",
      "UserTopicProgress",
      "PracticeAttempt",
      "MistakeEntry",
    ],
    code: `// Canonical content. Read-heavy. Cache aggressively.
export const getTopic = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) =>
    ctx.db
      .query("topics")
      .withIndex("by_slug", q => q.eq("slug", slug))
      .first(),
});

// Per-user progress. Write-heavy. Realtime.
export const recordAttempt = mutation({
  args: {
    itemId: v.id("practiceItems"),
    answer: v.string(),
    verdict: v.union(/* ... */),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await ctx.db.insert("practiceAttempts", {
      userId,
      ...args,
      attemptedAt: Date.now(),
    });
    // Targeted invalidation via cacheTag on dashboard widgets
    bust("dashboard:weak-topics", userId);
  },
});`,
    icon: Database,
    span: "md:col-span-1",
  },
  {
    tag: "AI guardrails",
    title: "Every generation is structured, validated, and logged",
    description:
      "Every prompt runs through the Vercel AI SDK with a Zod schema. Token usage, latency, and schema-validation outcomes become a row in AiGeneration. Never trust raw LLM text for structured data.",
    entities: [
      "generateObject",
      "streamObject",
      "Zod schemas",
      "AiGeneration log",
      "Context grounding",
    ],
    code: `const { object, usage } = await generateObject({
  model: openrouter(MODELS.quiz),
  schema: QuizOutputSchema,
  prompt: buildQuizPrompt({
    subject, topic, mastery, recentMistakes,
  }),
});

await logAiGeneration({
  task: "quiz",
  model: MODELS.quiz,
  tokens: usage.totalTokens,
  latencyMs: stopwatch(),
  schemaValid: true,
  userId,
});`,
    icon: ShieldCheck,
    span: "md:col-span-1",
  },
] as const;

/*
 * Span sums are computed for an md:grid-cols-12 band. Row 1 sums to 12
 * (4+5+3) and row 2 sums to 12 (3+4+5). Rows render at consistent
 * heights because grid-auto-rows equalizes.
 */
export const engineeringPillars: readonly EngineeringPillar[] = [
  {
    title: "Domain-driven frontend",
    description:
      "Feature logic lives in src/features/. Shared UI lives in src/components/ui/. No business logic, data fetching, or AI prompt builders in presentational components.",
    icon: Cube,
    span: "md:col-span-4",
  },
  {
    title: "Zero trust on every read",
    description:
      "proxy.ts routes traffic. Every Server Component and Route Handler re-verifies the session through auth() before reading or writing. The middleware is never the sole security boundary.",
    icon: LockSimple,
    span: "md:col-span-5",
  },
  {
    title: "Explicit cache invalidation",
    description:
      "Next.js 16 use cache with cacheTag. Submitting a practice set invalidates exactly the dashboard widgets it touched, not the whole tree. Cache only where no private data is involved.",
    icon: Lightning,
    span: "md:col-span-3",
  },
  {
    title: "Streaming by default",
    description:
      "AI responses stream. The page never blocks on a generation. Suspense boundaries are placed deliberately around each awaited source.",
    icon: FlowArrow,
    span: "md:col-span-3",
  },
  {
    title: "Telemetry on every AI call",
    description:
      "Every generation writes a row. Latency, tokens, and schema-validation outcomes are queryable per task, per model. The study app is debuggable end to end.",
    icon: Pulse,
    span: "md:col-span-4",
  },
  {
    title: "Soft-deletes for learning history",
    description:
      "Mistakes, attempts, sessions: never hard-deleted. A dropped topic should not erase a semester of mistake data. The longitudinal analytics depend on this.",
    icon: Fingerprint,
    span: "md:col-span-5",
  },
] as const;

// ---------------------------------------------------------------------------
// Data model entities
// ---------------------------------------------------------------------------

export const dataEntities: readonly DataEntity[] = [
  { name: "Subject", purpose: "Top of the curriculum hierarchy. Read-heavy. Aggressively cached.", tier: "canonical" },
  { name: "Chapter", purpose: "Subject grouping. Carries order, slug, and short description.", tier: "canonical" },
  { name: "Topic", purpose: "Atomic unit of learning. Difficulty, grade level, exam relevance, estimated minutes.", tier: "canonical" },
  { name: "TopicPrerequisite", purpose: "Directed edge between topics. Drives the locked/unlocked roadmap state.", tier: "canonical" },
  { name: "LessonBlock", purpose: "Curated explanation content in three depths for one topic.", tier: "canonical" },
  { name: "UserTopicProgress", purpose: "Mastery, confidence, time spent, last studied. One row per user per topic.", tier: "progress" },
  { name: "PracticeSet", purpose: "A generated or curated group of exercises for a topic.", tier: "progress" },
  { name: "PracticeAttempt", purpose: "A user's submission for one PracticeItem, with verdict and feedback.", tier: "progress" },
  { name: "FlashcardReview", purpose: "Spaced-repetition state: ease, interval, due date, last result.", tier: "progress" },
  { name: "MistakeEntry", purpose: "The standout feature. Question, answer, type, cause, recovery action, scheduled review.", tier: "progress" },
  { name: "TutorThread", purpose: "AI tutor conversations, optionally scoped to a subject or topic.", tier: "progress" },
  { name: "StudySession", purpose: "A study block: intention, duration, reflection, completion timestamp.", tier: "progress" },
  { name: "AiGeneration", purpose: "Per-call telemetry: task, model, tokens, latency, schema-validation outcome.", tier: "telemetry" },
] as const;

// ---------------------------------------------------------------------------
// Design system
// ---------------------------------------------------------------------------

export const designPrinciples: readonly DesignPrinciple[] = [
  {
    title: "Color",
    description:
      "Neutral warm-grayscale canvas, single teal accent, subject hues used only as categorical labels. Error and success colors reserved for genuine feedback states.",
    icon: Palette,
  },
  {
    title: "Typography",
    description:
      "Geist for the interface, Geist Mono for stats, formulas, and code. Compact scale with clear hierarchy. No oversized hero type inside the app shell.",
    icon: Code,
  },
  {
    title: "Layout",
    description:
      "Persistent sidebar for navigation, top utility bar for search, command palette, timer, profile. One vertical scroll region. Resizable side panel for the tutor on larger screens. Tabbed navigation under 768px.",
    icon: Stack,
  },
  {
    title: "Motion",
    description:
      "Calm, springy, never decorative. Animations always explain hierarchy, state change, or feedback. prefers-reduced-motion collapses every entrance to its end state.",
    icon: Sparkle,
  },
] as const;

// ---------------------------------------------------------------------------
// Tech stack
// ---------------------------------------------------------------------------

export const techStack: readonly TechStackItem[] = [
  {
    category: "Framework",
    description:
      "Next.js 16, App Router, React Server Components, the explicit caching model with use cache, cacheTag, cacheLife. proxy.ts for routing.",
    capability: "ship",
  },
  {
    category: "Database",
    description:
      "Convex, realtime queries, server functions, automatic TypeScript end-to-end type safety. Schema defined in convex/schema.ts. Auth wired via convex/react-clerk.",
    capability: "store",
  },
  {
    category: "Styling",
    description:
      "Tailwind CSS v4 with CSS-first @theme configuration. No tailwind.config.js to maintain. Design tokens are CSS variables shared with the future app shell.",
    capability: "compose",
  },
  {
    category: "AI Engine",
    description:
      "Vercel AI SDK routed through OpenRouter. generateObject and streamObject with Zod schemas. Telemetry layer wraps every call and writes an AiGeneration row.",
    capability: "generate",
  },
  {
    category: "Authentication",
    description:
      "Clerk for managed auth, JWT, OAuth, MFA, passkeys, webhooks. Integrated into Convex through convex/react-clerk. Clerk middleware in proxy.ts as the first-pass redirect.",
    capability: "authenticate",
  },
  {
    category: "State",
    description:
      "TanStack Query for server state, Zustand for local UI, React Hook Form plus Zod for forms. URL state for filters and selected topic. Optimistic updates on review actions.",
    capability: "coordinate",
  },
  {
    category: "Editors",
    description:
      "MDX for authored lessons, TipTap for notes, KaTeX for formula rendering, Mermaid later for diagrams. Content authoring stays separate from AI generation pipelines.",
    capability: "compose",
  },
  {
    category: "Observability",
    description:
      "PostHog for product analytics, Sentry for error tracking, the AiGeneration table for AI telemetry. OpenTelemetry-friendly logging on the server.",
    capability: "observe",
  },
] as const;

// ---------------------------------------------------------------------------
// Getting started
// ---------------------------------------------------------------------------

export const installSteps: readonly InstallStep[] = [
  {
    title: "Clone and install",
    verb: "Clone",
    description:
      "Grab the repo and install dependencies with a single npm install. No monorepo tooling, no workspace dance.",
    commands: [
      "git clone https://github.com/aiahmet/synedrix.git",
      "cd synedrix",
      "npm install",
    ],
    icon: GitFork,
  },
  {
    title: "Set your environment",
    verb: "Configure",
    description:
      "Copy the example env file and fill in three keys: Convex deploy URL, Clerk keys, OpenRouter API key. The README documents each variable.",
    commands: [
      "cp .env.local.example .env.local",
      "NEXT_PUBLIC_CONVEX_URL=",
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=",
      "OPENROUTER_API_KEY=",
    ],
    icon: Key,
  },
  {
    title: "Run the dev stack",
    verb: "Run",
    description:
      "Two dev servers run side by side. You can sign in and write your first topic end to end in under two minutes.",
    commands: [
      "npx convex dev   # terminal 1",
      "npm run dev      # terminal 2",
      "open http://localhost:3000",
    ],
    icon: Rocket,
  },
] as const;

export const prerequisites: readonly { readonly label: string; readonly note: string }[] = [
  { label: "Node.js 20+", note: "LTS" },
  { label: "Convex account", note: "Free tier covers v1" },
  { label: "Clerk account", note: "OAuth ready" },
  { label: "OpenRouter API key", note: "Pay-as-you-go" },
] as const;

// ---------------------------------------------------------------------------
// Roadmap
// ---------------------------------------------------------------------------

export const roadmapPhases: readonly RoadmapPhase[] = [
  {
    label: "Foundation",
    status: "complete",
    title: "Shell, schema, and AI provider are live",
    description:
      "Auth through Clerk, the app shell, the canonical schema in convex/schema.ts, the AI provider setup, and the dashboard skeleton are all in production. The cockpit is the first surface shipping.",
    milestones: ["Clerk auth", "Convex schema", "AI provider", "Dashboard skeleton"],
  },
  {
    label: "Core learning loop",
    status: "in-progress",
    title: "Topic pages, practice engine, mistake log, review queue",
    description:
      "The seven-step loop is being built in order. Topic pages ship first with three depths and the tutor sidecar. Practice engine and mistake log close the loop with the review queue.",
    milestones: ["Topic pages", "Tutor sidecar", "Practice engine", "Mistake log", "Review queue"],
  },
  {
    label: "Intelligence and planning",
    status: "planned",
    title: "Planner, focus mode, weak-topic detection, derived insights",
    description:
      "Once the loop is solid, the planner assembles sessions, focus mode hides the chrome, the system flags weak topics before they decay, and insights become derived observations, not raw counts.",
    milestones: ["Planner", "Focus mode", "Weak-topic detection", "Derived insights"],
  },
  {
    label: "Polish",
    status: "planned",
    title: "Editors, shortcuts, mobile, telemetry hardening",
    description:
      "Richer notes editor, keyboard shortcuts everywhere, mobile refinement for touch study, and the telemetry dashboard that tracks AI quality over time. Performance caching hardening in this phase.",
    milestones: ["Editors", "Keyboard shortcuts", "Mobile refinement", "Telemetry dashboard"],
  },
] as const;

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

export const faqItems: readonly FaqItem[] = [
  {
    question: "Is this ready for multiple students or classrooms?",
    answer:
      "Not in v1. Single-user only. The role model in the schema future-proofs for ParentObserver, Tutor, and Admin roles, but the auth, billing, and class-shell UI are not built yet.",
  },
  {
    question: "What models does the AI tutor actually use?",
    answer:
      "OpenRouter routes per task. Faster models for chat, stronger reasoning models for explanation mode, low-cost fast models for flashcards and summaries, language-strong models for French and German writing feedback. The mapping lives in src/lib/ai/models.ts.",
  },
  {
    question: "How does the spaced repetition schedule?",
    answer:
      "Per-card ease, interval, and last result at FlashcardReview. Items you struggle with return tomorrow, mastered items fade into maintenance rotation. Mistake entries carry their own reviewAt so the journal and the cards share one queue.",
  },
  {
    question: "Why not just use Anki or Quizlet?",
    answer:
      "Anki and Quizlet do not know what the AI tutor just explained or what the practice engine just tested. They have no concept of mastery in the topic, no mistake journal, no rubric-graded writing feedback. Synedrix is the system they would live inside.",
  },
  {
    question: "Does it work for languages other than German?",
    answer:
      "Yes. French, German, and English each have subject-specific workflows. Writing feedback runs through a rubric-aware model on language output. Explain-this-in-simpler-French is a standing tutor mode for French.",
  },
  {
    question: "Can I self-host it?",
    answer:
      "Convex and Clerk are managed services today, so a true self-host requires swapping both. The rest of the stack, Next.js, Convex schema, AI routing, runs on your own infrastructure with environment changes only.",
  },
  {
    question: "Where does my data live?",
    answer:
      "Canonical curriculum content is shared and read-only. Your progress, sessions, notes, mistakes, and tutor conversations are exclusively yours and never used for training any model.",
  },
  {
    question: "How do I contribute?",
    answer:
      "Fork, branch, commit with a conventional commit message, and open a pull request. Bug fixes ship fast. New features ship in conversation first. AI prompting changes need to ship with an AiGeneration row proving schema validation still passes.",
  },
] as const;

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

export const footerLinkColumns: readonly {
  readonly heading: string;
  readonly links: readonly { readonly label: string; readonly href: string }[];
}[] = [
  {
    heading: "Product",
    links: [
      { label: "Surfaces", href: "#surfaces" },
      { label: "Learning loop", href: "#loop" },
      { label: "Subjects", href: "#subjects" },
      { label: "Architecture", href: "#architecture" },
      { label: "Roadmap", href: "#roadmap" },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "Sign in", href: "/sign-in" },
      { label: "Sign up", href: "/sign-up" },
      { label: "Privacy", href: "https://github.com/aiahmet/synedrix/blob/main/LICENSE" },
      { label: "Terms", href: "https://github.com/aiahmet/synedrix/blob/main/CONTRIBUTING.md" },
    ],
  },
  {
    heading: "Open source",
    links: [
      { label: "GitHub", href: "https://github.com/aiahmet/synedrix" },
      { label: "Report a bug", href: "https://github.com/aiahmet/synedrix/issues" },
      { label: "Discussions", href: "https://github.com/aiahmet/synedrix/discussions" },
      { label: "MIT license", href: "https://github.com/aiahmet/synedrix/blob/main/LICENSE" },
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// Hero stats: derived from the spec, not invented SLAs.
// ---------------------------------------------------------------------------

export const heroStats: readonly { readonly value: string; readonly caption: string }[] = [
  { value: "7", caption: "Steps in the learning loop" },
  { value: "19", caption: "Tables in the canonical schema" },
  { value: "6", caption: "Subject workflows shipped" },
  { value: "3", caption: "Depths per topic explanation" },
] as const;

// ---------------------------------------------------------------------------
// Lighthouse-friendly testimonial/carrier copy that does not need a real
// human to attribute a quote to. Each item is a "what you actually get"
// statement from the spec, voiced in first-person plural.
// ---------------------------------------------------------------------------

export const evidenceBullets: readonly { readonly title: string; readonly body: string }[] = [
  {
    title: "Targeted invalidation",
    body: "Submitting one practice set busts only the dashboard widgets it touched. The rest of the page keeps its cached state.",
  },
  {
    title: "One review queue",
    body: "Flashcards, weak-foundation recovery, and mistake-log replay come from the same query. No scattered decks.",
  },
  {
    title: "Tutor memory is session-scoped",
    body: "The AI holds the current subject, topic, mastery, and recent mistakes. It does not reason over a standing profile indefinitely.",
  },
  {
    title: "Mistakes scheduled by concept",
    body: "Each entry links back to the topic and the practice attempt that produced it. Recurring patterns become tutor prompts.",
  },
] as const;
