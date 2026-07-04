# Synedrix AI Implementation Guide

> **Purpose:** This document is the single source of truth for AI coding agents implementing the Synedrix (Study OS) codebase. Read this first, then read the phase-specific doc for the phase you're building.
>
> **Problem this solves:** AI agents generate bloat, wrong variable names, wrong file locations, and unnecessary abstractions when they lack precise implementation specs. This guide removes all ambiguity.
>
> **Implementation status:** The phase docs in this folder describe the full intended design across four phases. The `main` branch currently ships **Phase 1 (Foundation) + a vertical slice of Phase 2** (Curriculum, Subjects, AI tutor, Dashboard, Study sessions). The Practice engine, Mistake journal UI, Flashcard review, and Phase 3/4 are not yet implemented. Treat unimplemented phases as a roadmap, not a contract — file paths, function names, and patterns in unimplemented sections may drift as the real code is built. Always re-read the current `convex/` and `app/` trees before writing new code.

---

## Table of Contents

1. [How to Use These Docs](#1-how-to-use-these-docs)
2. [Current State of the Codebase](#2-current-state-of-the-codebase)
3. [Architecture Overview (File Map)](#3-architecture-overview-file-map)
4. [Cross-Cutting Implementation Patterns](#4-cross-cutting-implementation-patterns)
5. [Anti-Patterns & Bloat Guardrails](#5-anti-patterns--bloat-guardrails)
6. [Phase Roadmap](#6-phase-roadmap)
7. [Phase References](#7-phase-references)

---

## 1. How to Use These Docs

### For AI Agents

1. **Read this guide first** — It establishes the patterns, file conventions, and guardrails you must follow.
2. **Read the phase doc** for the phase you're implementing (e.g., `docs/PHASE-2-CORE-LOOP.md`). Skip any stage that is already implemented (see the "Implementation status" note above and the actual `app/` and `convex/` trees).
3. **Read only the stage** within that phase that you're currently building. Each stage is self-contained.
4. **Never invent names** — Use the exact file paths, function names, variable names, and import paths specified here.
5. **Never add code outside scope** — Each stage explicitly lists what to build. If it's not listed, don't build it.

### For Human Developers

- Each phase doc is written so an AI agent can implement it with zero ambiguity.
- Read the spec first (`study-os-spec.md`), then phase docs for implementation details.
- Phase docs assume the previous phase is complete.

---

## 2. Current State of the Codebase

### What Exists (Phase 1 — Foundation — Complete)

```
app/
  favicon.ico
  globals.css              # Tailwind v4 + theme variables
  layout.tsx               # Root layout with ClerkProvider + ConvexClientProvider + Geist fonts
  manifest.ts              # PWA manifest
  page.tsx                 # Landing page (still CNA template - replace in Phase 2)
  robots.ts                # SEO robots
  sitemap.ts               # SEO sitemap

components/
  ConvexClientProvider.tsx # "use client" wrapper connecting Convex + Clerk auth

convex/
  auth.config.ts           # Clerk JWT auth provider configuration
  schema.ts                # All 17 tables defined with indexes

proxy.ts                   # Clerk middleware (was middleware.ts in older Next.js)

next.config.ts             # Image remote patterns for convex.cloud + img.clerk.com
tsconfig.json              # Strict TypeScript, @/* path alias
package.json               # Next.js 16, Convex, Clerk, Tailwind v4 installed
```

### What Installed

| Package | Version |
|---|---|
| `next` | 16.2.10 |
| `react` / `react-dom` | 19.2.4 |
| `convex` | ^1.42.1 |
| `@clerk/nextjs` | ^7.5.12 |
| `tailwindcss` | ^4 |
| `@tailwindcss/postcss` | ^4 |
| `typescript` | ^5 |

### What NOT Yet Installed (add in Phase 2)

These are listed in the spec but absent from `package.json`. Install them at the start of Phase 2:

```json
"dependencies": {
  "ai": "^4.x",
  "@openrouter/ai-sdk-provider": "^0.x",
  "zod": "^3.x",
  "@tanstack/react-query": "^5.x",
  "zustand": "^5.x",
  "react-hook-form": "^7.x",
  "@hookform/resolvers": "^3.x",
  "lucide-react": "^0.x",
  "date-fns": "^3.x",
  "recharts": "^2.x"
},
"devDependencies": {
  "vitest": "^3.x",
  "@testing-library/react": "^16.x",
  "@testing-library/jest-dom": "^6.x",
  "playwright": "^1.x"
}
```

### What the Schema Defines (17 tables)

| Table | Key Indexes |
|---|---|
| `subjects` | `by_slug` |
| `chapters` | `by_subject`, `by_subject_order` |
| `topics` | `by_chapter`, `by_slug` |
| `topicPrerequisites` | `by_topic`, `by_prerequisite` |
| `lessonBlocks` | `by_topic_depth` |
| `users` | `by_clerk_id`, `by_email` |
| `userTopicProgress` | `by_user_topic`, `by_user`, `by_topic` |
| `notes` | `by_user`, `by_topic` |
| `studySessions` | `by_user`, `by_user_created` |
| `goals` | `by_user_type` |
| `practiceSets` | `by_topic` |
| `practiceItems` | `by_practice_set` |
| `practiceAttempts` | `by_user`, `by_practice_item` |
| `flashcardDecks` | `by_topic` |
| `flashcards` | `by_deck` |
| `flashcardReviews` | `by_user_flashcard`, `by_user_due` |
| `mistakeEntries` | `by_user`, `by_topic`, `by_user_review` |
| `tutorThreads` | `by_user` |
| `tutorMessages` | `by_thread` |
| `aiGenerations` | `by_user`, `by_task` |
| `attachments` | `by_user` |

See `convex/schema.ts` for the full validator definitions.

---

## 3. Architecture Overview (File Map)

### What the Final File Tree Should Look Like

```
synedrix/
├── app/                              # Next.js App Router pages
│   ├── (marketing)/                  # Public marketing pages
│   │   ├── page.tsx                  # Landing page
│   │   └── pricing/page.tsx
│   ├── (app)/                        # Authenticated app shell
│   │   ├── layout.tsx                # App shell (sidebar + topbar + main area)
│   │   ├── dashboard/page.tsx
│   │   ├── subjects/
│   │   │   ├── page.tsx              # Subject listing grid
│   │   │   └── [subjectSlug]/
│   │   │       ├── page.tsx          # Subject hub
│   │   │       ├── roadmap/page.tsx
│   │   │       ├── practice/page.tsx
│   │   │       ├── notes/page.tsx
│   │   │       ├── tests/page.tsx
│   │   │       └── topics/
│   │   │           └── [topicSlug]/
│   │   │               ├── page.tsx  # Topic page (the atomic learning screen)
│   │   │               ├── practice/page.tsx
│   │   │               └── review/page.tsx
│   │   ├── planner/page.tsx
│   │   ├── review/page.tsx           # Review center
│   │   ├── tutor/
│   │   │   ├── page.tsx
│   │   │   └── [threadId]/page.tsx
│   │   └── settings/page.tsx
│   ├── api/                          # Route handlers (no Server Actions for AI)
│   │   └── ai/
│   │       ├── chat/route.ts
│   │       ├── explain/route.ts
│   │       ├── evaluate/route.ts
│   │       ├── quiz/route.ts
│   │       ├── plan/route.ts
│   │       └── flashcards/route.ts
│   ├── sign-in/[[...sign-in]]/page.tsx
│   ├── sign-up/[[...sign-up]]/page.tsx
│   ├── layout.tsx                    # Root layout (providers, fonts, metadata)
│   ├── globals.css                   # Tailwind v4 + theme
│   ├── manifest.ts
│   ├── robots.ts
│   └── sitemap.ts
├── convex/                           # Convex backend
│   ├── schema.ts                     # Complete as of Phase 1
│   ├── auth.config.ts                # Complete as of Phase 1
│   ├── curriculum.ts                 # Curriculum queries & mutations (Phase 2)
│   ├── practice.ts                   # Practice engine (Phase 2)
│   ├── review.ts                     # Spaced repetition (Phase 2)
│   ├── tutor.ts                      # AI tutor thread management (Phase 2)
│   ├── analytics.ts                  # Progress queries (Phase 3)
│   └── users.ts                      # User management (Phase 2)
├── src/                              # Client/server shared code
│   ├── components/
│   │   ├── ui/                       # Generic design system primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Dialog.tsx
│   │   │   ├── DropdownMenu.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Tabs.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   └── Tooltip.tsx
│   │   └── layout/                   # Shared layout components
│   │       ├── Sidebar.tsx
│   │       ├── TopBar.tsx
│   │       └── MainScrollArea.tsx
│   ├── features/                     # Domain feature components
│   │   ├── dashboard/
│   │   │   ├── DailyMissionCard.tsx
│   │   │   ├── SubjectProgressGrid.tsx
│   │   │   ├── WeakTopicsPanel.tsx
│   │   │   ├── ReviewDueList.tsx
│   │   │   ├── AiRecommendationCard.tsx
│   │   │   └── WeeklyConsistencyChart.tsx
│   │   ├── subjects/
│   │   │   ├── SubjectHubHeader.tsx
│   │   │   ├── SubjectRoadmap.tsx
│   │   │   ├── SubjectProgressRing.tsx
│   │   │   └── SubjectCard.tsx
│   │   ├── topics/
│   │   │   ├── TopicHeader.tsx
│   │   │   ├── ExplanationPanel.tsx
│   │   │   ├── ExamplePanel.tsx
│   │   │   ├── CommonMistakesPanel.tsx
│   │   │   ├── PracticeLauncher.tsx
│   │   │   ├── FlashcardPreview.tsx
│   │   │   ├── MistakeHistory.tsx
│   │   │   ├── LinkedTopics.tsx
│   │   │   └── NoteEditor.tsx
│   │   ├── tutor/
│   │   │   ├── TutorPanel.tsx
│   │   │   ├── TutorMessage.tsx
│   │   │   └── ModeSelector.tsx
│   │   ├── practice/
│   │   │   ├── PracticeRunner.tsx
│   │   │   ├── QuestionCard.tsx
│   │   │   ├── AnswerInput.tsx
│   │   │   └── ResultsSummary.tsx
│   │   ├── review/
│   │   │   ├── ReviewQueue.tsx
│   │   │   └── FlashcardReview.tsx
│   │   ├── planner/
│   │   │   ├── PlannerTimeline.tsx
│   │   │   ├── GoalCard.tsx
│   │   │   └── FocusMode.tsx
│   │   └── analytics/
│   │       ├── MasteryChart.tsx
│   │       ├── ConsistencyChart.tsx
│   │       └── MistakePatterns.tsx
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── provider.ts           # createOpenRouter() instance
│   │   │   ├── models.ts             # Model routing by task
│   │   │   ├── telemetry.ts          # AI call wrapper + AiGeneration logging
│   │   │   ├── prompts/              # Prompt builders, one per task
│   │   │   │   ├── explain.ts
│   │   │   │   ├── quiz.ts
│   │   │   │   ├── evaluate.ts
│   │   │   │   ├── flashcards.ts
│   │   │   │   ├── chat.ts
│   │   │   │   └── plan.ts
│   │   │   ├── schemas/              # Zod output schemas, one per task
│   │   │   │   ├── explain.ts
│   │   │   │   ├── quiz.ts
│   │   │   │   ├── evaluate.ts
│   │   │   │   ├── flashcards.ts
│   │   │   │   └── plan.ts
│   │   │   └── tasks/                # Task orchestration
│   │   │       ├── generateQuiz.ts
│   │   │       ├── explainTopic.ts
│   │   │       ├── evaluateAnswer.ts
│   │   │       ├── generateFlashcards.ts
│   │   │       ├── chat.ts
│   │   │       └── generatePlan.ts
│   │   ├── curriculum/
│   │   │   └── getTopicGraph.ts      # Topic tree + prerequisites
│   │   ├── review/
│   │   │   └── scheduleReview.ts     # SM-2 algorithm
│   │   ├── analytics/
│   │   │   └── getDashboardInsights.ts
│   │   ├── auth/
│   │   │   └── server.ts             # Server-side auth helpers
│   │   └── utils/
│   │       ├── cn.ts                 # clsx + tailwind-merge helper
│   │       ├── format.ts             # Date/number formatters
│   │       └── errors.ts             # Error classes
│   ├── hooks/                        # Shared React hooks
│   │   ├── useUserProgress.ts
│   │   ├── useTopic.ts
│   │   ├── usePractice.ts
│   │   ├── useReviewQueue.ts
│   │   └── useAiGeneration.ts
│   ├── stores/                       # Zustand stores
│   │   ├── uiStore.ts               # Sidebar state, theme, panels
│   │   └── sessionStore.ts          # Current study session state
│   └── types/                        # Shared TypeScript types
│       ├── curriculum.ts
│       ├── practice.ts
│       └── ai.ts
├── components/                       # (already exists) Provider wrappers
│   └── ConvexClientProvider.tsx
├── proxy.ts                          # Clerk middleware (exists)
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
└── eslint.config.mjs
```

---

## 4. Cross-Cutting Implementation Patterns

These patterns apply to **every file** you create. Follow them strictly.

### 4.1 Imports Pattern

```ts
// Always use @/* path alias (configured in tsconfig.json)
import { auth } from "@clerk/nextjs/server";    // Server-side auth
import { ConvexHttpClient } from "convex/browser"; // HTTP client for Route Handlers
import { generateObject } from "ai";             // AI SDK
import { openrouter } from "@/lib/ai/provider";   // Local modules via @/
import { cn } from "@/src/lib/utils/cn";          // Utility imports
```

### 4.2 File Organization Rules

```
app/layout.tsx                          # Root layout — providers, fonts, metadata ONLY
app/(app)/layout.tsx                     # App shell — sidebar, topbar, <main>
app/(app)/dashboard/page.tsx             # Page composes feature components
src/features/dashboard/DailyMissionCard.tsx  # Feature component
src/lib/ai/prompts/explain.ts           # AI prompt builders — NEVER in components
convex/curriculum.ts                    # Convex server functions
```

- `app/` contains ONLY route files (page.tsx, layout.tsx, route.ts)
- `src/features/` contains ONLY presentational and container components
- `src/lib/` contains ONLY business logic, services, and utilities
- `convex/` contains ONLY Convex server functions (queries, mutations, actions)

### 4.3 Component Template

```tsx
// src/features/topics/components/TopicHeader.tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

interface TopicHeaderProps {
  topicId: Id<"topics">;
}

export function TopicHeader({ topicId }: TopicHeaderProps) {
  const topic = useQuery(api.curriculum.getTopic, { topicId });
  const progress = useQuery(api.curriculum.getUserTopicProgress, { topicId });

  if (!topic || !progress) return <Skeleton className="h-16 w-full" />;

  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-semibold">{topic.title}</h1>
      <MasteryBadge value={progress.mastery} />
    </div>
  );
}
```

### 4.4 Convex Function Template

```ts
// convex/curriculum.ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Queries (read-only, reactive)
export const getTopic = query({
  args: { topicId: v.id("topics") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.topicId);
  },
});

// Mutations (write)
export const updateProgress = mutation({
  args: {
    topicId: v.id("topics"),
    mastery: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    // ... mutation logic
  },
});

// Actions (side effects, AI calls, third-party APIs)
export const generateTopicExplanation = action({
  args: { topicId: v.id("topics"), depth: v.string() },
  handler: async (ctx, args) => {
    // Run AI call here, write results back via ctx.runMutation
  },
});
```

### 4.5 AI Route Handler Template

```ts
// app/api/ai/chat/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  // ... AI SDK call with streaming response
}
```

### 4.6 Caching Pattern (Next.js 16)

```tsx
// app/(app)/dashboard/page.tsx
import { auth } from "@clerk/nextjs/server";
import { cacheTag } from "next/cache";

export default async function DashboardPage() {
  const { userId } = await auth();

  // Cache this specific user's dashboard data
  "use cache";
  cacheTag(`dashboard-${userId}`);

  // ... fetch and render
}
```

Invalidate from a Server Action or Route Handler:

```ts
// On practice submission, revalidate only the dashboard
import { cacheTag } from "next/cache";

export async function submitPractice(formData: FormData) {
  "use server";
  const { userId } = await auth();
  // ... save practice attempt
  cacheTag(`dashboard-${userId}`);
}
```

### 4.7 AI Task Pattern (Always)

```ts
// src/lib/ai/tasks/generateQuiz.ts
import { generateObject } from "ai";
import { openrouter } from "@/lib/ai/provider";
import { QuizSchema } from "@/lib/ai/schemas/quiz";
import { buildQuizPrompt } from "@/lib/ai/prompts/quiz";
import { withTelemetry } from "@/lib/ai/telemetry";
import type { GenerateQuizInput, GenerateQuizOutput } from "@/types/ai";

export async function generateQuiz(
  input: GenerateQuizInput
): Promise<GenerateQuizOutput> {
  return withTelemetry("quiz", async () => {
    const { object, usage } = await generateObject({
      model: openrouter(input.model ?? "openai/gpt-4o-mini"),
      schema: QuizSchema,
      prompt: buildQuizPrompt(input),
    });

    return {
      quiz: object,
      usage: {
        inputTokens: usage.promptTokens,
        outputTokens: usage.completionTokens,
      },
    };
  });
}
```

### 4.8 State Management Rules

| State Type | Tool | When |
|---|---|---|
| Convex data | `convex/react` `useQuery`/`useMutation` | All database state |
| Server state (non-Convex) | TanStack Query | External API data |
| UI state (sidebar, panels, modals) | Zustand | `src/stores/uiStore.ts` |
| Form state | React Hook Form + Zod | Forms, inputs |
| URL state | `useParams`, `useSearchParams` | Filters, selected subject, tabs |

### 4.9 Error Handling Pattern

```ts
// src/lib/utils/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class AuthError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, "NOT_FOUND", 404);
  }
}
```

---

## 5. Anti-Patterns & Bloat Guardrails

### ❌ NEVER Do These

| Anti-Pattern | Why | Instead |
|---|---|---|
| Create a `src/types/index.ts` barrel export | Creates import indirection; TypeScript resolves fine with direct paths | Import directly from each type file |
| Make a shared `apiClient.ts` or `http.ts` wrapper | Convex is the backend; you don't hand-roll fetch for AI calls (Vercel AI SDK handles it) | Use Convex directly, AI SDK directly |
| Add a CSS framework classname utility library | Tailwind v4 + `cn()` utility is sufficient | Use `@/lib/utils/cn.ts` (just clsx + twMerge) |
| Create route groups for "better organization" | The spec defines exact routes in `study-os-spec.md` §8 | Follow the spec exactly |
| Add React Query for Convex data | Convex has its own reactive query system | Use `useQuery` from `convex/react` |
| Build a generic "API client" for OpenRouter | The Vercel AI SDK is the API client | Use `generateObject`, `streamText`, etc. |
| Abstract every component into a "base" + "variant" | Premature abstraction adds bloat | Build concrete components; extract only when DRY is proven by 3+ uses |
| Create an `index.ts` barrel per feature folder | Hides imports, breaks tree-shaking | Import directly from each component file |
| Write UI components in `convex/` | Convex is only for server functions | UI lives in `src/features/` or `src/components/ui/` |
| Use `any` or `as` casts | Strict TypeScript is a project requirement | Define proper types or Zod schemas |
| Add auth checks in `proxy.ts` and skip component verification | `proxy.ts` is a first-pass redirect only | Re-verify with `auth()` in every Server Component/Route Handler |
| Install a UI library (shadcn/ui, MUI, Chakra) | The spec mentions shadcn/ui as a *starting point* — but it's not installed yet and adds dependency weight. Build custom UI primitives for v1 | Build minimal `src/components/ui/` primitives with Tailwind only |
| Build a generic "data table" or "list" component | Not needed until review center and analytics | Build specific list components for each feature |

### ✅ DO These Instead

- Write **one file per exported function/component**
- Keep AI prompt builders in `src/lib/ai/prompts/` — never in UI code
- Keep Zod schemas in `src/lib/ai/schemas/` — never inline in route handlers
- Use `"use client"` only when you need hooks, state, or browser APIs
- Default to Server Components; colocate interactive parts as client children
- Name files after their primary export: `generateQuiz.ts` exports `generateQuiz()`
- Throw errors with proper status codes from Route Handlers

---

## 6. Phase Roadmap

| Phase | What | Doc |
|---|---|---|
| **1. Foundation** | ✅ DONE — Auth, schema, proxy, providers, SEO | — |
| **2. Core Loop** | Topic pages, practice generator, answer eval, mistake log, flashcards, review queue | `docs/PHASE-2-CORE-LOOP.md` |
| **3. Intelligence** | Planner, focus mode, weak-topic detection, analytics, personalization | `docs/PHASE-3-INTELLIGENCE.md` |
| **4. Polish** | Richer editors, keyboard shortcuts, caching hardening, mobile, testing | `docs/PHASE-4-POLISH.md` |

### Stage Breakdown Per Phase

Each phase doc breaks down into **stages** that must be built in order:

**Phase 2 Stages:**
1. Install dependencies + update config
2. AI foundation (provider, models, telemetry, prompts, schemas, tasks)
3. Utility library (cn, format, errors)
4. UI primitives (Button, Card, Input, etc.)
5. App shell (Sidebar, TopBar, layout, auth pages)
6. Curriculum Convex functions (queries + mutations)
7. Subject hub pages + topic page
8. AI tutor workspace + Route Handlers
9. Practice engine (generation, attempt, evaluation)
10. Mistake journal Convex functions + UI
11. Flashcards + review queue
12. Dashboard

**Phase 3 Stages:**
1. Planner system (goals, sessions, timeline)
2. Focus mode
3. Analytics (Convex functions, charts, insights)
4. Weak-topic detection
5. Personalization engine

**Phase 4 Stages:**
1. Notes editor (rich text)
2. Keyboard shortcuts system
3. Caching strategy hardening
4. Mobile refinement
5. Import/export
6. Testing suite

---

## 7. Phase References

| Resource | Purpose |
|---|---|
| `study-os-spec.md` | Complete product spec — read for UX requirements, not implementation |
| `convex/schema.ts` | Database schema — the source of truth for all table/field names |
| `proxy.ts` | Clerk middleware — already configured |
| `.env.example` | All required environment variables |
| `AGENTS.md` | Short AI agent instructions (root level) |
| `docs/PHASE-2-CORE-LOOP.md` | Phase 2 implementation spec |
| `docs/PHASE-3-INTELLIGENCE.md` | Phase 3 implementation spec |
| `docs/PHASE-4-POLISH.md` | Phase 4 implementation spec |

---

> **Golden Rule:** If a file, function, or pattern is not explicitly named in these docs, do not create it. The spec is precise by design — every deviation from this guide is a potential bloat source.
