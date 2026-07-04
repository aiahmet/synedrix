# Phase 2: Core Learning Loop

> **Scope:** Topic pages, practice generator, answer evaluation, mistake log, flashcards, review queue, AI tutor workspace, dashboard.
>
> **Prerequisite:** Phase 1 complete (auth, schema, proxy, providers in place).
>
> **Build Order:** Stages must be built sequentially — each stage depends on the previous one.
>
> **Status on `main`:** Stages **2.1, 2.2, 2.5 (partial), 2.6, 2.7 (partial), 2.8, 2.12** are implemented. **2.9 (Practice engine), 2.10 (Mistake journal UI), 2.11 (Flashcards & review queue)** are not yet built. The Practice, Mistake, and Flashcard route handlers, schemas, and UI components listed below are aspirational — do not assume they exist. When implementing a stage, cross-reference the current `convex/` and `app/` trees first.

---

## Table of Contents

- [Stage 2.1: Install Dependencies & Update Config](#stage-21-install-dependencies--update-config)
- [Stage 2.2: AI Foundation](#stage-22-ai-foundation)
- [Stage 2.3: Utility Library](#stage-23-utility-library)
- [Stage 2.4: UI Primitives](#stage-24-ui-primitives)
- [Stage 2.5: App Shell & Auth Pages](#stage-25-app-shell--auth-pages)
- [Stage 2.6: Curriculum Convex Functions](#stage-26-curriculum-convex-functions)
- [Stage 2.7: Subject Hubs & Topic Page](#stage-27-subject-hubs--topic-page)
- [Stage 2.8: AI Tutor Workspace](#stage-28-ai-tutor-workspace)
- [Stage 2.9: Practice Engine](#stage-29-practice-engine)
- [Stage 2.10: Mistake Journal](#stage-210-mistake-journal)
- [Stage 2.11: Flashcards & Review Queue](#stage-211-flashcards--review-queue)
- [Stage 2.12: Dashboard](#stage-212-dashboard)

---

## Stage 2.1: Install Dependencies & Update Config

### What to Do

1. Install all missing npm packages.
2. Create the `src/` directory structure.
3. Add the `@tailwindcss/typography` plugin for rich text.

### Files to Create

```
src/
  components/
    ui/          (empty for now — populated in Stage 2.4)
    layout/      (empty for now — populated in Stage 2.5)
  features/      (empty for now — populated per feature stage)
  lib/
    ai/
      prompts/   (empty — populated in Stage 2.2)
      schemas/   (empty — populated in Stage 2.2)
      tasks/     (empty — populated in Stage 2.2)
    curriculum/  (empty)
    review/      (empty)
    analytics/   (empty)
    auth/        (empty)
    utils/       (empty — populated in Stage 2.3)
  hooks/         (empty)
  stores/        (empty)
  types/         (empty)
```

### Commands to Run

```bash
npm install ai@latest @openrouter/ai-sdk-provider@latest zod@latest
npm install @tanstack/react-query@latest zustand@latest
npm install react-hook-form@latest @hookform/resolvers@latest
npm install lucide-react@latest date-fns@latest recharts@latest
npm install -D vitest@latest @testing-library/react@latest @testing-library/jest-dom@latest
npm install -D @tailwindcss/typography@latest
```

### Config Updates

**`postcss.config.mjs`** — No change needed, `@tailwindcss/postcss` is already configured.

**`app/globals.css`** — Add Tailwind typography plugin and expand the theme:

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --color-accent: #0d9488;          /* teal-600 */
  --color-accent-light: #14b8a6;    /* teal-500 */
  --color-surface: #fafafa;         /* zinc-50 */
  --color-surface-alt: #f4f4f5;     /* zinc-100 */
  --color-border: #e4e4e7;          /* zinc-200 */
  --color-muted: #71717a;           /* zinc-500 */
  --color-subject-math: #3b82f6;    /* blue */
  --color-subject-physics: #a855f7; /* purple */
  --color-subject-chemistry: #22c55e; /* green */
  --color-subject-french: #ef4444;  /* red */
  --color-subject-german: #f59e0b;  /* amber */
  --color-subject-english: #ec4899; /* pink */
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
}
```

---

## Stage 2.2: AI Foundation

> Build the AI service layer. This is used by every AI-powered feature in the app.

### Files to Create

#### `src/lib/ai/provider.ts`

Create a single `openrouter` instance and export it. Also export a `getModel` helper.

```ts
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
});

export function getModel(slug: string) {
  return openrouter(slug);
}
```

#### `src/lib/ai/models.ts`

Map task types to model slugs. Keep all model routing in one file.

```ts
export const modelConfig = {
  chat: process.env.OPENROUTER_CHAT_MODEL ?? "openai/gpt-4o-mini",
  explain: process.env.OPENROUTER_EXPLAIN_MODEL ?? "openai/gpt-4o",
  quiz: process.env.OPENROUTER_QUIZ_MODEL ?? "openai/gpt-4o-mini",
  evaluate: process.env.OPENROUTER_EVALUATE_MODEL ?? "openai/gpt-4o",
  flashcards: process.env.OPENROUTER_FLASHCARD_MODEL ?? "openai/gpt-4o-mini",
  plan: process.env.OPENROUTER_PLAN_MODEL ?? "openai/gpt-4o",
  fallback: process.env.OPENROUTER_FALLBACK_MODEL ?? "anthropic/claude-sonnet-4",
} as const;

export type AiTask = keyof typeof modelConfig;
```

#### `src/lib/ai/telemetry.ts`

Wrap every AI call. Writes an `AiGeneration` record. Must be used by every task.

```ts
import { api } from "@/convex/_generated/api";
import { fetchMutation } from "convex/nextjs";
import { auth } from "@clerk/nextjs/server";
import type { AiTask } from "./models";

interface TelemetryResult<T> {
  data: T;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export async function withTelemetry<T>(
  task: AiTask,
  model: string,
  fn: () => Promise<TelemetryResult<T>>
): Promise<T> {
  const start = Date.now();
  const result = await fn();
  const latencyMs = Date.now() - start;

  try {
    const { userId } = await auth();
    if (userId) {
      await fetchMutation(api.curriculum.recordAiGeneration, {
        task,
        model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        latencyMs,
        schemaValid: true,
      });
    }
  } catch {
    // Telemetry should never crash the calling code
    console.warn("AI telemetry write failed", task);
  }

  return result.data;
}
```

**Note:** The `recordAiGeneration` mutation doesn't exist yet. You'll create it in Stage 2.6. For now, wrap telemetry in a try/catch, or just stub it until you have the Convex function.

#### `src/lib/ai/prompts/chat.ts`

```ts
import type { ChatInput } from "@/types/ai";

export function buildChatPrompt(input: ChatInput): string {
  return `
You are an AI tutor for a German Gymnasium student (Grade 11-12).

Subject: ${input.subject}
Topic: ${input.topic}
Grade Level: ${input.gradeLevel}
Language: ${input.language}
Mode: ${input.mode}

Student's Question: ${input.question}

Recent mistakes relevant to this topic:
${input.recentMistakes?.join("\n") ?? "None"}

Current mastery level: ${input.mastery ?? "Not yet assessed"}

Rules:
- Teach, don't just answer.
- If the student asks for an explanation, start from what they likely know.
- If the student asks a practice question, guide them step by step.
- Keep answers concise unless the student asks for detail.
- Use ${input.language} for explanations.
- Refer to the subject-specific context when relevant.
`.trim();
}
```

#### `src/lib/ai/prompts/explain.ts`

```ts
import type { ExplainInput } from "@/types/ai";

export function buildExplainPrompt(input: ExplainInput): string {
  const depthDescriptions = {
    simple: "Explain this like I'm new to the topic. Use simple language, analogies, and avoid jargon.",
    standard: "Explain this at a normal textbook level. Cover the main concepts, definitions, and one example.",
    rigorous: "Explain this rigorously. Include formal definitions, edge cases, proofs where applicable, and advanced insights.",
  };

  return `
You are an expert tutor creating a lesson for a German Gymnasium student.

Subject: ${input.subject}
Topic: ${input.topicTitle}
Grade Level: ${input.gradeLevel}
Language: ${input.language}
Target Depth: ${input.targetDepth}

${depthDescriptions[input.targetDepth]}

Prior weaknesses to address: ${input.priorWeaknesses?.join(", ") ?? "None"}

Structure your response with:
1. A short opening that hooks into existing knowledge
2. The core explanation
3. A concrete example
4. Key takeaways

Write in ${input.language}.
`.trim();
}
```

#### `src/lib/ai/prompts/quiz.ts`

```ts
import type { GenerateQuizInput } from "@/types/ai";

export function buildQuizPrompt(input: GenerateQuizInput): string {
  return `
You are generating a practice quiz for a German Gymnasium student.

Subject: ${input.subject}
Topic: ${input.topicTitle}
Grade Level: ${input.gradeLevel}
Difficulty: ${input.difficulty}
Number of questions: ${input.count ?? 5}
Language: ${input.language}
Question types: ${input.types?.join(", ") ?? "mixed"}

Common mistakes on this topic:
${input.commonMistakes?.join("\n") ?? "Not specified"}

Generate a quiz that:
- Tests understanding, not memorization
- Includes a mix of difficulty levels
- Has clear, unambiguous questions
- Provides a thorough answer key with explanations
- Avoids repeating the exact same mistake patterns listed above

Respond in ${input.language}.
`.trim();
}
```

#### `src/lib/ai/prompts/evaluate.ts`

```ts
import type { EvaluateAnswerInput } from "@/types/ai";

export function buildEvaluatePrompt(input: EvaluateAnswerInput): string {
  return `
You are evaluating a student's answer for a German Gymnasium student.

Subject: ${input.subject}
Topic: ${input.topic}
Language: ${input.language}

Question: ${input.question}

Student's Answer: ${input.studentAnswer}

Expected Answer: ${input.expectedAnswer ?? "Not provided"}
Rubric: ${input.rubric?.join("\n") ?? "Not provided"}

Evaluate the answer and provide:
1. Verdict (correct / partially_correct / incorrect)
2. A score from 0-100
3. Specific, actionable feedback
4. What mistakes were made (if any)
5. What the student should do next

Be constructive. Highlight what was right before what was wrong.
Respond in ${input.language}.
`.trim();
}
```

#### `src/lib/ai/prompts/flashcards.ts`

```ts
import type { GenerateFlashcardsInput } from "@/types/ai";

export function buildFlashcardsPrompt(input: GenerateFlashcardsInput): string {
  return `
Generate flashcards for a German Gymnasium student studying:

Subject: ${input.subject}
Topic: ${input.topicTitle}
Grade Level: ${input.gradeLevel}
Language: ${input.language}
Number of cards: ${input.count ?? 10}
Style: ${input.style ?? "fact-and-prompt"}

Source material:
${input.sourceContent ?? "Generate from general knowledge of the topic"}

Each flashcard should have:
- A clear, concise front (question/prompt)
- A precise back (answer/explanation)
- Follow the active recall principle

Respond in ${input.language}.
`.trim();
}
```

#### `src/lib/ai/prompts/plan.ts`

```ts
import type { GeneratePlanInput } from "@/types/ai";

export function buildPlanPrompt(input: GeneratePlanInput): string {
  return `
You are a study planner for a German Gymnasium student.

Current date: ${input.currentDate ?? new Date().toISOString().split("T")[0]}
Available study time: ${input.availableMinutes ?? 120} minutes
Upcoming exams: ${input.upcomingExams?.join(", ") ?? "None"}
Weak topics: ${input.weakTopics?.join(", ") ?? "None identified"}

Recent activity (last 7 days):
${input.recentActivity ?? "No recent activity recorded"}

Generate a study plan that:
- Prioritizes weak topics
- Distributes review across subjects
- Allocates time proportionally to exam proximity
- Includes short breaks
- Is realistic for the available time

Respond in ${input.language ?? "en"}.
`.trim();
}
```

#### `src/lib/ai/schemas/explain.ts`

```ts
import { z } from "zod";

export const ExplainSchema = z.object({
  sections: z.array(
    z.object({
      title: z.string(),
      content: z.string(),
      type: z.enum(["hook", "explanation", "example", "takeaway"]),
    })
  ),
  keyTerms: z.array(
    z.object({
      term: z.string(),
      definition: z.string(),
    })
  ),
  summary: z.string(),
});
```

#### `src/lib/ai/schemas/quiz.ts`

```ts
import { z } from "zod";

export const QuizItemSchema = z.object({
  id: z.string(),
  type: z.enum(["mcq", "short_answer", "step_problem", "fill_blank"]),
  question: z.string(),
  options: z.array(z.string()).optional(),
  answer: z.string(),
  explanation: z.string(),
  skills: z.array(z.string()),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

export const QuizSchema = z.object({
  title: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  items: z.array(QuizItemSchema).min(1).max(20),
});
```

#### `src/lib/ai/schemas/evaluate.ts`

```ts
import { z } from "zod";

export const EvaluateSchema = z.object({
  verdict: z.enum(["correct", "partially_correct", "incorrect"]),
  score: z.number().min(0).max(100),
  feedback: z.string(),
  mistakes: z.array(z.string()),
  nextStep: z.string(),
});
```

#### `src/lib/ai/schemas/flashcards.ts`

```ts
import { z } from "zod";

export const FlashcardItemSchema = z.object({
  front: z.string(),
  back: z.string(),
});

export const FlashcardSetSchema = z.object({
  title: z.string(),
  cards: z.array(FlashcardItemSchema).min(1).max(30),
});
```

#### `src/lib/ai/schemas/plan.ts`

```ts
import { z } from "zod";

export const PlanSessionSchema = z.object({
  subject: z.string(),
  topic: z.string(),
  durationMinutes: z.number(),
  type: z.enum(["study", "practice", "review", "quiz"]),
});

export const PlanSchema = z.object({
  title: z.string(),
  sessions: z.array(PlanSessionSchema),
  totalMinutes: z.number(),
  notes: z.string().optional(),
});
```

#### `src/lib/ai/tasks/generateQuiz.ts`

```ts
import { generateObject } from "ai";
import { openrouter } from "@/lib/ai/provider";
import { QuizSchema } from "@/lib/ai/schemas/quiz";
import { buildQuizPrompt } from "@/lib/ai/prompts/quiz";
import { withTelemetry } from "@/lib/ai/telemetry";
import { modelConfig } from "@/lib/ai/models";
import type { GenerateQuizInput } from "@/types/ai";

export async function generateQuiz(input: GenerateQuizInput) {
  const model = modelConfig.quiz;

  return withTelemetry("quiz", model, async () => {
    const { object, usage } = await generateObject({
      model: openrouter(model),
      schema: QuizSchema,
      prompt: buildQuizPrompt(input),
    });

    return {
      data: object,
      usage: {
        inputTokens: usage.promptTokens,
        outputTokens: usage.completionTokens,
      },
    };
  });
}
```

#### `src/lib/ai/tasks/explainTopic.ts`

```ts
import { generateObject } from "ai";
import { openrouter } from "@/lib/ai/provider";
import { ExplainSchema } from "@/lib/ai/schemas/explain";
import { buildExplainPrompt } from "@/lib/ai/prompts/explain";
import { withTelemetry } from "@/lib/ai/telemetry";
import { modelConfig } from "@/lib/ai/models";
import type { ExplainInput } from "@/types/ai";

export async function explainTopic(input: ExplainInput) {
  const model = modelConfig.explain;

  return withTelemetry("explain", model, async () => {
    const { object, usage } = await generateObject({
      model: openrouter(model),
      schema: ExplainSchema,
      prompt: buildExplainPrompt(input),
    });

    return {
      data: object,
      usage: {
        inputTokens: usage.promptTokens,
        outputTokens: usage.completionTokens,
      },
    };
  });
}
```

#### `src/lib/ai/tasks/evaluateAnswer.ts`

```ts
import { generateObject } from "ai";
import { openrouter } from "@/lib/ai/provider";
import { EvaluateSchema } from "@/lib/ai/schemas/evaluate";
import { buildEvaluatePrompt } from "@/lib/ai/prompts/evaluate";
import { withTelemetry } from "@/lib/ai/telemetry";
import { modelConfig } from "@/lib/ai/models";
import type { EvaluateAnswerInput } from "@/types/ai";

export async function evaluateAnswer(input: EvaluateAnswerInput) {
  const model = modelConfig.evaluate;

  return withTelemetry("evaluate", model, async () => {
    const { object, usage } = await generateObject({
      model: openrouter(model),
      schema: EvaluateSchema,
      prompt: buildEvaluatePrompt(input),
    });

    return {
      data: object,
      usage: {
        inputTokens: usage.promptTokens,
        outputTokens: usage.completionTokens,
      },
    };
  });
}
```

#### `src/lib/ai/tasks/generateFlashcards.ts`

```ts
import { generateObject } from "ai";
import { openrouter } from "@/lib/ai/provider";
import { FlashcardSetSchema } from "@/lib/ai/schemas/flashcards";
import { buildFlashcardsPrompt } from "@/lib/ai/prompts/flashcards";
import { withTelemetry } from "@/lib/ai/telemetry";
import { modelConfig } from "@/lib/ai/models";
import type { GenerateFlashcardsInput } from "@/types/ai";

export async function generateFlashcards(input: GenerateFlashcardsInput) {
  const model = modelConfig.flashcards;

  return withTelemetry("flashcards", model, async () => {
    const { object, usage } = await generateObject({
      model: openrouter(model),
      schema: FlashcardSetSchema,
      prompt: buildFlashcardsPrompt(input),
    });

    return {
      data: object,
      usage: {
        inputTokens: usage.promptTokens,
        outputTokens: usage.completionTokens,
      },
    };
  });
}
```

#### `src/lib/ai/tasks/chat.ts`

```ts
import { streamText } from "ai";
import { openrouter } from "@/lib/ai/provider";
import { buildChatPrompt } from "@/lib/ai/prompts/chat";
import { modelConfig } from "@/lib/ai/models";
import type { ChatInput } from "@/types/ai";

export function tutorChat(input: ChatInput) {
  const model = modelConfig.chat;

  return streamText({
    model: openrouter(model),
    prompt: buildChatPrompt(input),
  });
}
```

#### `src/lib/ai/tasks/generatePlan.ts`

```ts
import { generateObject } from "ai";
import { openrouter } from "@/lib/ai/provider";
import { PlanSchema } from "@/lib/ai/schemas/plan";
import { buildPlanPrompt } from "@/lib/ai/prompts/plan";
import { withTelemetry } from "@/lib/ai/telemetry";
import { modelConfig } from "@/lib/ai/models";
import type { GeneratePlanInput } from "@/types/ai";

export async function generatePlan(input: GeneratePlanInput) {
  const model = modelConfig.plan;

  return withTelemetry("plan", model, async () => {
    const { object, usage } = await generateObject({
      model: openrouter(model),
      schema: PlanSchema,
      prompt: buildPlanPrompt(input),
    });

    return {
      data: object,
      usage: {
        inputTokens: usage.promptTokens,
        outputTokens: usage.completionTokens,
      },
    };
  });
}
```

#### `src/types/ai.ts`

Centralized type definitions for all AI inputs and outputs.

```ts
export interface ChatInput {
  subject: string;
  topic: string;
  gradeLevel: string;
  language: string;
  mode: string;
  question: string;
  recentMistakes?: string[];
  mastery?: number;
}

export interface ExplainInput {
  subject: string;
  topicTitle: string;
  gradeLevel: string;
  language: string;
  targetDepth: "simple" | "standard" | "rigorous";
  priorWeaknesses?: string[];
}

export interface GenerateQuizInput {
  subject: string;
  topicTitle: string;
  gradeLevel: string;
  difficulty: "easy" | "medium" | "hard";
  language: string;
  count?: number;
  types?: string[];
  commonMistakes?: string[];
}

export interface EvaluateAnswerInput {
  subject: string;
  topic: string;
  question: string;
  studentAnswer: string;
  expectedAnswer?: string;
  rubric?: string[];
  language: string;
}

export interface GenerateFlashcardsInput {
  subject: string;
  topicTitle: string;
  gradeLevel: string;
  language: string;
  count?: number;
  style?: string;
  sourceContent?: string;
}

export interface GeneratePlanInput {
  currentDate?: string;
  availableMinutes?: number;
  upcomingExams?: string[];
  weakTopics?: string[];
  recentActivity?: string;
  language?: string;
}
```

### What NOT to Build in Stage 2.2

- Do NOT create a generic `ai.ts` service file that wraps all tasks — each task is its own file.
- Do NOT add logging beyond the telemetry wrapper.
- Do NOT add fallback logic beyond the model config (retry logic is handled by the AI SDK).
- Do NOT build a prompt template engine — prompt builders are plain functions.

---

## Stage 2.3: Utility Library

### Files to Create

#### `src/lib/utils/cn.ts`

```ts
import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return inputs.filter(Boolean).join(" ");
}
```

Note: We use a simple join instead of `tailwind-merge` to avoid an extra dependency. If class conflicts arise, add `tailwind-merge` later.

#### `src/lib/utils/format.ts`

```ts
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatDate(date: number | Date): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
```

#### `src/lib/utils/errors.ts`

```ts
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

### What NOT to Build in Stage 2.3

- Do NOT create barrel exports (`index.ts`) for utils — import directly.
- Do NOT create a generic `helpers.ts` or `utils.ts` — split into focused files.
- Do NOT create API client utilities (Convex handles that).

---

## Stage 2.4: UI Primitives

> Build minimal, generic UI components. These must NOT contain any domain logic.

### Files to Create

#### `src/components/ui/Button.tsx`

```tsx
import { cn } from "@/src/lib/utils/cn";
import { forwardRef, type ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
          {
            "bg-accent text-white hover:bg-accent-light": variant === "primary",
            "bg-surface-alt text-foreground hover:bg-border": variant === "secondary",
            "text-muted hover:text-foreground hover:bg-surface-alt": variant === "ghost",
            "bg-red-600 text-white hover:bg-red-700": variant === "danger",
          },
          {
            "h-8 px-3 text-sm": size === "sm",
            "h-10 px-4 text-sm": size === "md",
            "h-12 px-6 text-base": size === "lg",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
```

#### `src/components/ui/Card.tsx`

```tsx
import { cn } from "@/src/lib/utils/cn";
import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export function Card({ className, hover = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-background p-4 shadow-sm",
        hover && "hover:shadow-md transition-shadow",
        className
      )}
      {...props}
    />
  );
}
```

#### `src/components/ui/Badge.tsx`

```tsx
import { cn } from "@/src/lib/utils/cn";
import type { HTMLAttributes } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "error" | "info";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        {
          "bg-zinc-100 text-zinc-800": variant === "default",
          "bg-green-100 text-green-800": variant === "success",
          "bg-amber-100 text-amber-800": variant === "warning",
          "bg-red-100 text-red-800": variant === "error",
          "bg-blue-100 text-blue-800": variant === "info",
        },
        className
      )}
      {...props}
    />
  );
}
```

#### `src/components/ui/Input.tsx`

```tsx
import { cn } from "@/src/lib/utils/cn";
import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label className="text-sm font-medium text-foreground">{label}</label>
        )}
        <input
          ref={ref}
          className={cn(
            "h-10 rounded-lg border border-border bg-background px-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1",
            error && "border-red-500 focus:ring-red-500",
            className
          )}
          {...props}
        />
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    );
  }
);
Input.displayName = "Input";
```

#### `src/components/ui/Skeleton.tsx`

```tsx
import { cn } from "@/src/lib/utils/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800",
        className
      )}
    />
  );
}
```

#### `src/components/ui/ProgressBar.tsx`

```tsx
import { cn } from "@/src/lib/utils/cn";

interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  size?: "sm" | "md";
}

export function ProgressBar({ value, max = 100, className, size = "md" }: ProgressBarProps) {
  const pct = Math.min(Math.round((value / max) * 100), 100);

  return (
    <div
      className={cn(
        "w-full rounded-full bg-zinc-200 dark:bg-zinc-800",
        size === "sm" ? "h-1.5" : "h-2.5",
        className
      )}
    >
      <div
        className="h-full rounded-full bg-accent transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
```

#### `src/components/ui/Tabs.tsx`

```tsx
"use client";

import { cn } from "@/src/lib/utils/cn";
import { useState, type ReactNode } from "react";

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  className?: string;
}

export function Tabs({ tabs, defaultTab, className }: TabsProps) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
              active === tab.id
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="pt-4">
        {tabs.find((t) => t.id === active)?.content}
      </div>
    </div>
  );
}
```

#### `src/components/ui/Dialog.tsx`

```tsx
"use client";

import { cn } from "@/src/lib/utils/cn";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className={cn(
          "relative z-10 w-full max-w-lg rounded-xl bg-background p-6 shadow-xl",
          className
        )}
      >
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
```

#### `src/components/ui/Tooltip.tsx`

```tsx
"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/src/lib/utils/cn";

interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: "top" | "bottom";
}

export function Tooltip({ content, children, side = "top" }: TooltipProps) {
  const [show, setShow] = useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          className={cn(
            "absolute z-50 px-2 py-1 text-xs rounded bg-zinc-900 text-white whitespace-nowrap",
            "pointer-events-none",
            side === "top" ? "bottom-full mb-1" : "top-full mt-1"
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}
```

### What NOT to Build in Stage 2.4

- Do NOT build a full design system with variants for every prop — only build what's listed.
- Do NOT add dropdown menus, select inputs, or complex form controls — build them when needed.
- Do NOT import shadcn/ui components — build custom minimal primitives.
- Do NOT create a `index.ts` barrel export for UI components.

---

## Stage 2.5: App Shell & Auth Pages

### Files to Create

#### `app/(app)/layout.tsx`

Creates the authenticated app shell with sidebar and topbar.

```tsx
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Sidebar } from "@/src/components/layout/Sidebar";
import { TopBar } from "@/src/components/layout/TopBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

#### `src/components/layout/Sidebar.tsx`

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/src/lib/utils/cn";
import {
  LayoutDashboard,
  BookOpen,
  Brain,
  Sword,
  Clock,
  Calendar,
  Settings,
  ChevronLeft,
} from "lucide-react";
import { useUIStore } from "@/src/stores/uiStore";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/subjects", label: "Subjects", icon: BookOpen },
  { href: "/tutor", label: "AI Tutor", icon: Brain },
  { href: "/review", label: "Review", icon: Clock },
  { href: "/planner", label: "Planner", icon: Calendar },
];

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggle = useUIStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-background transition-all duration-200",
        collapsed ? "w-16" : "w-56"
      )}
    >
      <div className="flex items-center justify-between p-4">
        {!collapsed && (
          <Link href="/dashboard" className="font-bold text-lg">
            Study OS
          </Link>
        )}
        <button onClick={toggle} className="text-muted hover:text-foreground">
          <ChevronLeft size={20} className={cn("transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent/10 text-accent"
                  : "text-muted hover:text-foreground hover:bg-surface-alt",
                collapsed && "justify-center px-2"
              )}
            >
              <Icon size={20} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground",
            collapsed && "justify-center"
          )}
        >
          <Settings size={20} />
          {!collapsed && <span>Settings</span>}
        </Link>
      </div>
    </aside>
  );
}
```

#### `src/components/layout/TopBar.tsx`

```tsx
import { UserButton } from "@clerk/nextjs";
import { Search } from "lucide-react";

export function TopBar() {
  return (
    <header className="flex items-center justify-between border-b border-border bg-background px-6 py-3">
      <div className="flex items-center gap-2 text-muted">
        <Search size={18} />
        <span className="text-sm text-muted">Search topics, notes, commands... (Cmd+K)</span>
      </div>
      <UserButton afterSignOutUrl="/" />
    </header>
  );
}
```

#### `src/stores/uiStore.ts`

```ts
import { create } from "zustand";

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
}));
```

#### `app/sign-in/[[...sign-in]]/page.tsx`

```tsx
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <SignIn />
    </div>
  );
}
```

#### `app/sign-up/[[...sign-up]]/page.tsx`

```tsx
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <SignUp />
    </div>
  );
}
```

#### Update `app/page.tsx`

Replace the CNA landing page with a simple marketing page:

```tsx
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          Study OS
        </h1>
        <p className="mt-4 text-lg text-muted">
          Five systems, one state. From "I don't get this" to "I can solve this alone."
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <Link
            href="/sign-in"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-accent px-8 text-sm font-medium text-white hover:bg-accent-light"
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex h-12 items-center justify-center rounded-lg border border-border px-8 text-sm font-medium hover:bg-surface-alt"
          >
            Get Started
          </Link>
        </div>
      </div>
    </div>
  );
}
```

### What NOT to Build in Stage 2.5

- Do NOT add mobile responsiveness yet (Phase 4).
- Do NOT add a theme toggle (Phase 4).
- Do NOT add search functionality — the TopBar search is a visual placeholder only.
- Do NOT create `(marketing)/` route group — the landing page is at `app/page.tsx`.

---

## Stage 2.6: Curriculum Convex Functions

### Files to Create

#### `convex/users.ts`

```ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Called by Clerk webhook to create a user on sign-up
export const createUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) return existing._id;

    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      role: "Student",
    });
  },
});

export const getCurrentUser = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
  },
});
```

#### `convex/curriculum.ts`

```ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// --- Subjects ---

export const listSubjects = query({
  handler: async (ctx) => {
    return await ctx.db.query("subjects").collect();
  },
});

export const getSubjectBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subjects")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});

// --- Chapters ---

export const listChaptersBySubject = query({
  args: { subjectId: v.id("subjects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chapters")
      .withIndex("by_subject_order", (q) => q.eq("subjectId", args.subjectId))
      .collect();
  },
});

// --- Topics ---

export const listTopicsByChapter = query({
  args: { chapterId: v.id("chapters") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("topics")
      .withIndex("by_chapter", (q) => q.eq("chapterId", args.chapterId))
      .collect();
  },
});

export const getTopicBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("topics")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});

export const getTopic = query({
  args: { topicId: v.id("topics") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.topicId);
  },
});

// --- Prerequisites ---

export const getTopicPrerequisites = query({
  args: { topicId: v.id("topics") },
  handler: async (ctx, args) => {
    const prereqs = await ctx.db
      .query("topicPrerequisites")
      .withIndex("by_topic", (q) => q.eq("topicId", args.topicId))
      .collect();

    const topics = await Promise.all(
      prereqs.map((p) => ctx.db.get(p.prerequisiteTopicId))
    );

    return topics.filter(Boolean);
  },
});

// --- Lesson Blocks ---

export const getLessonBlocks = query({
  args: { topicId: v.id("topics"), depth: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("lessonBlocks")
      .withIndex("by_topic_depth", (q) => q.eq("topicId", args.topicId));

    if (args.depth) {
      query = query.filter((q) => q.eq(q.field("depth"), args.depth));
    }

    return await query.collect();
  },
});

// --- User Progress ---

export const getUserTopicProgress = query({
  args: { topicId: v.id("topics") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return null;

    return await ctx.db
      .query("userTopicProgress")
      .withIndex("by_user_topic", (q) =>
        q.eq("userId", user._id).eq("topicId", args.topicId)
      )
      .unique();
  },
});

export const updateTopicProgress = mutation({
  args: {
    topicId: v.id("topics"),
    mastery: v.optional(v.number()),
    confidence: v.optional(v.number()),
    timeSpentSec: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const existing = await ctx.db
      .query("userTopicProgress")
      .withIndex("by_user_topic", (q) =>
        q.eq("userId", user._id).eq("topicId", args.topicId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        lastStudied: Date.now(),
      });
    } else {
      await ctx.db.insert("userTopicProgress", {
        userId: user._id,
        topicId: args.topicId,
        mastery: args.mastery ?? 0,
        confidence: args.confidence ?? 0,
        timeSpentSec: args.timeSpentSec ?? 0,
        lastStudied: Date.now(),
      });
    }
  },
});

export const listUserTopicsBySubject = query({
  args: { subjectId: v.id("subjects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_subject", (q) => q.eq("subjectId", args.subjectId))
      .collect();

    const allTopics = [];
    for (const chapter of chapters) {
      const topics = await ctx.db
        .query("topics")
        .withIndex("by_chapter", (q) => q.eq("chapterId", chapter._id))
        .collect();
      allTopics.push(...topics);
    }

    const progress = await ctx.db
      .query("userTopicProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const progressMap = new Map(progress.map((p) => [p.topicId, p]));

    return allTopics.map((topic) => ({
      ...topic,
      progress: progressMap.get(topic._id) ?? null,
    }));
  },
});

// --- AI Generation Telemetry ---

export const recordAiGeneration = mutation({
  args: {
    task: v.string(),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    latencyMs: v.number(),
    schemaValid: v.boolean(),
    relatedId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    await ctx.db.insert("aiGenerations", {
      userId: user._id,
      ...args,
    });
  },
});
```

### What NOT to Build in Stage 2.6

- Do NOT add practice or review Convex functions yet — they come in later stages.
- Do NOT add analytics queries — Phase 3.
- Do NOT add bulk operations — phase-scoped queries only.

---

## Stage 2.7: Subject Hubs & Topic Page

### Files to Create

#### `app/(app)/subjects/page.tsx`

Subject listing grid, composed from `SubjectCard`.

#### `src/features/subjects/SubjectCard.tsx`

A card showing subject name, icon, progress, and color. Links to `subjects/[slug]`.

#### `app/(app)/subjects/[subjectSlug]/page.tsx`

Subject hub — the main landing page for a subject. Shows chapters, progress, quick actions.

#### `src/features/subjects/SubjectHubHeader.tsx`

Subject name, color badge, overall mastery, action buttons.

#### `src/features/subjects/SubjectProgressRing.tsx`

Circular SVG progress indicator showing mastery percentage.

#### `app/(app)/subjects/[subjectSlug]/topics/[topicSlug]/page.tsx`

The atomic topic page. This is the most important page in the app.

Layout:
```
TopicHeader (mastery, confidence, time spent)
  └─ Tabs
       ├─ ExplanationPanel (3 depths: simple/standard/rigorous)
       ├─ ExamplePanel
       └─ CommonMistakesPanel
PracticeLauncher
FlashcardPreview
MistakeHistory
LinkedTopics
TutorSidePanel (floating, resizable)
```

#### `src/features/topics/TopicHeader.tsx`

Shows topic title, mastery indicator, confidence slider, prerequisite status.

#### `src/features/topics/ExplanationPanel.tsx`

Fetches lesson blocks for the topic. Displays content at the selected depth (simple/standard/rigorous). If no lesson block exists for the selected depth, shows a "Generate AI explanation" button that calls the AI.

#### `src/features/topics/ExamplePanel.tsx`

Shows worked examples. Maps to lesson blocks with type "example".

#### `src/features/topics/CommonMistakesPanel.tsx`

Shows mistake entries for this topic, aggregated across all users (or just the current user for v1).

#### `src/features/topics/PracticeLauncher.tsx`

Button/dropdown to start a practice session for this topic. Options: quick practice (5 questions), timed mini-test, full exam simulation. Opens PracticeRunner.

#### `src/features/topics/FlashcardPreview.tsx`

Shows first 3-5 flashcards from the topic's default deck. "View all" link opens review page.

#### `src/features/topics/MistakeHistory.tsx`

Recent mistake entries for this topic, with quick actions to re-attempt.

#### `src/features/topics/LinkedTopics.tsx`

Prerequisites and dependent topics as linked cards.

#### `app/(app)/subjects/[subjectSlug]/roadmap/page.tsx`

Visual topic tree showing progress, dependencies, and readiness state.

#### `src/features/subjects/SubjectRoadmap.tsx`

Interactive roadmap with topic nodes, prerequisite arrows, and mastery coloring.

### What NOT to Build in Stage 2.7

- Do NOT build the full Notes editor (rich text) — Phase 4.
- Do NOT build the AI explanation generation into the UI yet — wire the AI route handlers in Stage 2.8.
- Do NOT build practice functionality — PracticeLauncher is just a button that navigates.

---

## Stage 2.8: AI Tutor Workspace

### Files to Create

#### `app/(app)/tutor/page.tsx`

AI tutor landing page — shows recent threads and a "New Conversation" button.

#### `app/(app)/tutor/[threadId]/page.tsx`

Single thread view with message list and input.

#### `src/features/tutor/TutorPanel.tsx`

The main tutor interface — collapsible side panel on topic pages, full page in tutor routes.

#### `src/features/tutor/TutorMessage.tsx`

A single message bubble (user or assistant).

#### `src/features/tutor/ModeSelector.tsx`

Dropdown to select tutor mode: explain, quiz, Socratic, hints, etc.

#### `app/api/ai/chat/route.ts`

```ts
import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { tutorChat } from "@/lib/ai/tasks/chat";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const result = tutorChat(body);

  return result.toDataStreamResponse();
}
```

#### `app/api/ai/explain/route.ts`

```ts
import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { explainTopic } from "@/lib/ai/tasks/explainTopic";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const result = await explainTopic(body);

  return Response.json(result);
}
```

#### `convex/tutor.ts`

```ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const listThreads = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    return await ctx.db
      .query("tutorThreads")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

export const getThread = query({
  args: { threadId: v.id("tutorThreads") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.threadId);
  },
});

export const getMessages = query({
  args: { threadId: v.id("tutorThreads") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tutorMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .collect();
  },
});

export const createThread = mutation({
  args: {
    subjectId: v.optional(v.id("subjects")),
    topicId: v.optional(v.id("topics")),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    return await ctx.db.insert("tutorThreads", {
      userId: user._id,
      ...args,
    });
  },
});

export const addMessage = mutation({
  args: {
    threadId: v.id("tutorThreads"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    quotedBlock: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("tutorMessages", args);
  },
});
```

### What NOT to Build in Stage 2.8

- Do NOT build streaming UI state management in the frontend yet — use simple fetch for now.
- Do NOT build conversation memory management — keep it stateless per session.
- Do NOT build the tutor side panel as a separate page — it's embedded in the topic page.

---

## Stage 2.9: Practice Engine

### Files to Create

#### `convex/practice.ts`

```ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const createPracticeSet = mutation({
  args: {
    topicId: v.id("topics"),
    title: v.string(),
    difficulty: v.union(v.literal("EASY"), v.literal("MEDIUM"), v.literal("HARD")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    return await ctx.db.insert("practiceSets", {
      ...args,
      generatedById: user._id,
      createdAt: Date.now(),
    });
  },
});

export const getPracticeSet = query({
  args: { practiceSetId: v.id("practiceSets") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.practiceSetId);
  },
});

export const listPracticeItems = query({
  args: { practiceSetId: v.id("practiceSets") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("practiceItems")
      .withIndex("by_practice_set", (q) => q.eq("practiceSetId", args.practiceSetId))
      .order("asc")
      .collect();
  },
});

export const addPracticeItems = mutation({
  args: {
    practiceSetId: v.id("practiceSets"),
    items: v.array(
      v.object({
        type: v.union(
          v.literal("mcq"),
          v.literal("short_answer"),
          v.literal("step_problem"),
          v.literal("fill_blank")
        ),
        question: v.string(),
        options: v.optional(v.array(v.string())),
        answer: v.string(),
        explanation: v.string(),
        skills: v.array(v.string()),
        order: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const item of args.items) {
      await ctx.db.insert("practiceItems", {
        practiceSetId: args.practiceSetId,
        ...item,
      });
    }
  },
});

export const submitAttempt = mutation({
  args: {
    practiceItemId: v.id("practiceItems"),
    userAnswer: v.string(),
    verdict: v.union(
      v.literal("correct"),
      v.literal("partially_correct"),
      v.literal("incorrect")
    ),
    score: v.number(),
    feedback: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    return await ctx.db.insert("practiceAttempts", {
      userId: user._id,
      ...args,
      attemptedAt: Date.now(),
    });
  },
});

export const getAttemptsByPracticeSet = query({
  args: { practiceSetId: v.id("practiceSets") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    const items = await ctx.db
      .query("practiceItems")
      .withIndex("by_practice_set", (q) => q.eq("practiceSetId", args.practiceSetId))
      .collect();

    const itemIds = items.map((i) => i._id);
    const allAttempts = [];

    for (const itemId of itemIds) {
      const attempts = await ctx.db
        .query("practiceAttempts")
        .withIndex("by_practice_item", (q) => q.eq("practiceItemId", itemId))
        .filter((q) => q.eq(q.field("userId"), user._id))
        .collect();
      allAttempts.push(...attempts);
    }

    return allAttempts;
  },
});

export const getLastAttemptForItem = query({
  args: { practiceItemId: v.id("practiceItems") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return null;

    return await ctx.db
      .query("practiceAttempts")
      .withIndex("by_practice_item", (q) => q.eq("practiceItemId", args.practiceItemId))
      .filter((q) => q.eq(q.field("userId"), user._id))
      .order("desc")
      .first();
  },
});
```

#### `app/api/ai/quiz/route.ts`

```ts
import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { generateQuiz } from "@/lib/ai/tasks/generateQuiz";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const quiz = await generateQuiz(body);

  return Response.json(quiz);
}
```

#### `app/api/ai/evaluate/route.ts`

```ts
import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { evaluateAnswer } from "@/lib/ai/tasks/evaluateAnswer";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const result = await evaluateAnswer(body);

  return Response.json(result);
}
```

#### `src/features/practice/PracticeRunner.tsx`

The main practice session component. Manages state: current question index, answers, timer.

```tsx
"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { QuestionCard } from "./QuestionCard";
import { ResultsSummary } from "./ResultsSummary";

interface PracticeRunnerProps {
  topicId: Id<"topics">;
  difficulty: "EASY" | "MEDIUM" | "HARD";
}

type Phase = "generating" | "answering" | "reviewing" | "done";

export function PracticeRunner({ topicId, difficulty }: PracticeRunnerProps) {
  const [phase, setPhase] = useState<Phase>("generating");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // ... practice flow logic
}
```

#### `src/features/practice/QuestionCard.tsx`

Renders a single question. Handles MCQ (radio buttons), short answer (text input), fill-blank (text input), step-problem (multi-line text).

#### `src/features/practice/AnswerInput.tsx`

Renders the appropriate input for the question type.

#### `src/features/practice/ResultsSummary.tsx`

Shows results after completing a practice set: score, correct/incorrect breakdown, option to retry wrong answers.

### What NOT to Build in Stage 2.9

- Do NOT build the timer feature — just display question count.
- Do NOT build exam simulation mode — just single-topic practice.
- Do NOT build evaluation feedback display yet — just show correct/incorrect.
- Do NOT hardcode practice content — all content is generated by AI.

---

## Stage 2.10: Mistake Journal

### Files to Create

#### `convex/mistakes.ts`

```ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const listMistakes = query({
  args: {
    topicId: v.optional(v.id("topics")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    let query = ctx.db
      .query("mistakeEntries")
      .withIndex("by_user", (q) => q.eq("userId", user._id));

    if (args.topicId) {
      query = query.filter((q) => q.eq(q.field("topicId"), args.topicId));
    }

    const results = await query.order("desc").take(args.limit ?? 50);
    return results;
  },
});

export const createMistakeEntry = mutation({
  args: {
    topicId: v.optional(v.id("topics")),
    practiceAttemptId: v.optional(v.id("practiceAttempts")),
    question: v.string(),
    userAnswer: v.string(),
    correctAnswer: v.string(),
    mistakeType: v.union(
      v.literal("CONCEPT_MISUNDERSTANDING"),
      v.literal("CALCULATION_MISTAKE"),
      v.literal("CARELESS_ERROR"),
      v.literal("FORMULA_RECALL_FAILURE"),
      v.literal("MISREAD_QUESTION"),
      v.literal("LANGUAGE_EXPRESSION_ISSUE")
    ),
    cause: v.optional(v.string()),
    recoveryAction: v.optional(v.string()),
    reviewAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    return await ctx.db.insert("mistakeEntries", {
      userId: user._id,
      ...args,
    });
  },
});

export const deleteMistakeEntry = mutation({
  args: { mistakeId: v.id("mistakeEntries") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const entry = await ctx.db.get(args.mistakeId);
    if (!entry) throw new Error("Mistake entry not found");

    await ctx.db.delete(args.mistakeId);
  },
});

export const getMistakesDueForReview = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    const now = Date.now();
    return await ctx.db
      .query("mistakeEntries")
      .withIndex("by_user_review", (q) => q.eq("userId", user._id))
      .filter((q) => q.lte(q.field("reviewAt"), now))
      .collect();
  },
});
```

### What NOT to Build in Stage 2.10

- Do NOT build mistake pattern analysis (Phase 3).
- Do NOT build a separate "mistake journal page" — mistakes are viewed within topics and on the dashboard.
- Do NOT add bulk mistake deletion.

---

## Stage 2.11: Flashcards & Review Queue

### Files to Create

#### `convex/review.ts`

```ts
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const listDecksByTopic = query({
  args: { topicId: v.id("topics") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("flashcardDecks")
      .withIndex("by_topic", (q) => q.eq("topicId", args.topicId))
      .collect();
  },
});

export const getFlashcards = query({
  args: { deckId: v.id("flashcardDecks") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("flashcards")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .order("asc")
      .collect();
  },
});

export const createDeck = mutation({
  args: {
    topicId: v.id("topics"),
    title: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    return await ctx.db.insert("flashcardDecks", {
      ...args,
      generatedById: user._id,
    });
  },
});

export const addFlashcards = mutation({
  args: {
    deckId: v.id("flashcardDecks"),
    cards: v.array(
      v.object({
        front: v.string(),
        back: v.string(),
        order: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const card of args.cards) {
      await ctx.db.insert("flashcards", {
        deckId: args.deckId,
        ...card,
      });
    }
  },
});

export const getReviewQueue = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    const now = Date.now();

    // Due flashcards
    const dueCards = await ctx.db
      .query("flashcardReviews")
      .withIndex("by_user_due", (q) => q.eq("userId", user._id))
      .filter((q) => q.lte(q.field("dueAt"), now))
      .collect();

    // Resolve flashcard details
    const cards = await Promise.all(
      dueCards.map(async (r) => {
        const card = await ctx.db.get(r.flashcardId);
        return card ? { review: r, card } : null;
      })
    );

    return cards.filter(Boolean);
  },
});

export const submitFlashcardReview = mutation({
  args: {
    flashcardId: v.id("flashcards"),
    result: v.union(
      v.literal("AGAIN"),
      v.literal("HARD"),
      v.literal("GOOD"),
      v.literal("EASY")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const existing = await ctx.db
      .query("flashcardReviews")
      .withIndex("by_user_flashcard", (q) =>
        q.eq("userId", user._id).eq("flashcardId", args.flashcardId)
      )
      .unique();

    // SM-2 algorithm defaults
    const intervals = { AGAIN: 0, HARD: 1, GOOD: 3, EASY: 7 };
    const easeFactors = { AGAIN: 1.3, HARD: 1.5, GOOD: 2.5, EASY: 3.0 };

    const newEase = existing
      ? Math.max(1.3, existing.ease * (easeFactors[args.result] / 2.5))
      : easeFactors[args.result];

    const newInterval = existing
      ? args.result === "AGAIN"
        ? 0
        : Math.round(existing.intervalDays * newEase)
      : intervals[args.result];

    const dueAt = Date.now() + newInterval * 86400000;

    if (existing) {
      await ctx.db.patch(existing._id, {
        ease: newEase,
        intervalDays: newInterval,
        dueAt,
        lastResult: args.result,
      });
    } else {
      await ctx.db.insert("flashcardReviews", {
        userId: user._id,
        flashcardId: args.flashcardId,
        ease: newEase,
        intervalDays: newInterval,
        dueAt,
        lastResult: args.result,
      });
    }
  },
});
```

#### `app/api/ai/flashcards/route.ts`

```ts
import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { generateFlashcards } from "@/lib/ai/tasks/generateFlashcards";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const cards = await generateFlashcards(body);

  return Response.json(cards);
}
```

#### `src/lib/review/scheduleReview.ts`

SM-2 spaced repetition algorithm helper.

```ts
export interface SM2Input {
  quality: 0 | 1 | 2 | 3 | 4 | 5;
  repetition: number;
  previousInterval: number;
  previousEase: number;
}

export interface SM2Output {
  repetition: number;
  interval: number;
  ease: number;
  dueAt: number;
}

export function calculateSM2(input: SM2Input): SM2Output {
  const { quality, repetition, previousInterval, previousEase } = input;

  let ease = previousEase;
  let newRepetition: number;
  let interval: number;

  if (quality < 3) {
    newRepetition = 0;
    interval = 0;
  } else {
    newRepetition = repetition + 1;
    if (newRepetition === 1) {
      interval = 1;
    } else if (newRepetition === 2) {
      interval = 6;
    } else {
      interval = Math.round(previousInterval * ease);
    }
  }

  ease = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  return {
    repetition: newRepetition,
    interval,
    ease: Math.round(ease * 100) / 100,
    dueAt: Date.now() + interval * 86400000,
  };
}
```

#### `src/features/review/ReviewQueue.tsx`

Main review center component. Shows due flashcards, due mistake reviews, and weak topics needing review.

#### `src/features/review/FlashcardReview.tsx`

Single flashcard review component. Shows front, flips to back on click, has rating buttons (Again/Hard/Good/Easy).

#### `app/(app)/review/page.tsx`

Review center page — composes ReviewQueue.

### What NOT to Build in Stage 2.11

- Do NOT build the "weak foundations" queue — that needs analytics from Phase 3.
- Do NOT build mistake replay — just display due mistakes with a link to the topic.
- Do NOT build a separate spaced-repetition settings page.

---

## Stage 2.12: Dashboard

### Files to Create

#### `app/(app)/dashboard/page.tsx`

```tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DailyMissionCard } from "@/src/features/dashboard/DailyMissionCard";
import { SubjectProgressGrid } from "@/src/features/dashboard/SubjectProgressGrid";
import { WeakTopicsPanel } from "@/src/features/dashboard/WeakTopicsPanel";
import { ReviewDueList } from "@/src/features/dashboard/ReviewDueList";
import { AiRecommendationCard } from "@/src/features/dashboard/AiRecommendationCard";
import { WeeklyConsistencyChart } from "@/src/features/dashboard/WeeklyConsistencyChart";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <DailyMissionCard />
          <SubjectProgressGrid />
          <WeeklyConsistencyChart />
        </div>
        <div className="space-y-6">
          <WeakTopicsPanel />
          <ReviewDueList />
          <AiRecommendationCard />
        </div>
      </div>
    </div>
  );
}
```

#### `src/features/dashboard/DailyMissionCard.tsx`

Shows today's suggested focus. Pulls from goals, due reviews, and weakest topics.

#### `src/features/dashboard/SubjectProgressGrid.tsx`

Grid of subject cards showing name, color, and overall mastery progress.

#### `src/features/dashboard/WeakTopicsPanel.tsx`

Lists topics with lowest mastery or longest time since last study.

#### `src/features/dashboard/ReviewDueList.tsx`

Shows count of flashcards and mistakes due for review today.

#### `src/features/dashboard/AiRecommendationCard.tsx`

AI-generated "best next topic" suggestion. Calls the plan route handler.

#### `src/features/dashboard/WeeklyConsistencyChart.tsx`

Simple bar chart of study time per day over the last 7 days. Uses `recharts`.

#### `app/api/ai/plan/route.ts`

```ts
import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { generatePlan } from "@/lib/ai/tasks/generatePlan";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const plan = await generatePlan(body);

  return Response.json(plan);
}
```

### What NOT to Build in Stage 2.12

- Do NOT build analytics charts beyond the weekly bar chart — Phase 3.
- Do NOT build session tracking on the dashboard — Phase 3.
- Do NOT add PostHog or Sentry — Phase 4.

---

## Verification

After completing Phase 2, verify:

1. `npm run typecheck` passes with zero errors
2. `npm run lint` passes with zero errors
3. App loads and redirects unauthenticated users to `/sign-in`
4. Dashboard renders with all 6 widget slots (even if empty)
5. Subject pages render with curriculum data
6. Topic page shows explanation tabs
7. AI chat route handler responds to POST requests
8. Practice quiz generation returns structured output
9. Mistake entries can be created and viewed
10. Flashcards can be reviewed with SM-2 scheduling
11. Review queue shows due items
