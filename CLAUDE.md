# Synedrix

Study OS is a single-user personal learning operating system for a German Gymnasium student. It unifies curriculum mapping, AI tutoring, practice generation, and spaced repetition into a single state-driven application.

## Tech Stack
- **Framework**: Next.js 16 (App Router, Turbopack).
- **Backend & Database**: Convex (Realtime DB, server functions, schema validation).
- **Styling**: Tailwind CSS v4 (CSS-first `@theme` config, NO `tailwind.config.js`).
- **Auth**: Clerk (Integrated with Convex via `convex/react-clerk`).
- **AI**: Vercel AI SDK (`ai`) + OpenRouter provider.
- **State**: TanStack Query (server), Zustand (local), React Hook Form + Zod (forms).

## Architecture & Patterns
- **Domain-Driven Design**: Feature logic lives in `src/features/[domain]/`. Shared generic UI lives in `src/components/ui/`.
- **Business Logic**: Keep logic in Convex functions or `src/lib/` services. Never put business logic, data fetching, or AI prompt builders in presentational React components.
- **Caching**: Use Next.js 16 explicit caching (`"use cache"`, `cacheLife`, `cacheTag`) rather than the old implicit fetch-cache model. Use `cacheTag` to invalidate specific dashboard widgets upon practice submission.
- **Streaming**: Always stream AI responses. Never block the main thread or full page rendering during generation.

## Data Modeling (Convex)
- **Strict Separation**: Keep canonical curriculum data (`Subject`, `Chapter`, `Topic`, `LessonBlock`) completely separate from user progress data (`UserTopicProgress`, `PracticeAttempt`, `MistakeEntry`). This is the most important modeling decision in the app.
- **Naming Consistency**: Use exactly one name per concept everywhere. (e.g., Always use `MistakeEntry`, never `MistakeLog` or `ErrorEntry`).
- **Traceability**: Every AI generation must be logged to the `AiGeneration` table with usage metrics, model info, and schema validation results.
- **Soft Deletes**: Use soft-deletes for learning history (mistakes, attempts) to preserve longitudinal analytics.

## AI System Rules
- **Context Grounding**: Every AI call must include app context (subject, topic, grade level, language, current mastery, recent mistakes).
- **Structured Outputs**: Always use `generateObject` or `streamObject` with Zod schemas. Never trust raw LLM text for structured data.
- **Telemetry**: Wrap all AI calls via `src/lib/ai/telemetry.ts` to log token usage and latency.
- **No Hand-rolled Fetch**: Always use the Vercel AI SDK to handle retries, streaming, and structured output parsing.

## Security & Auth
- **Middleware vs Server Verification**: `proxy.ts` (Clerk middleware) is only a first-pass redirect. You **MUST** re-verify the session inside Server Components and Route Handlers using `auth()` or `currentUser()` from `@clerk/nextjs/server` before reading or writing data.

## Commands
- **Dev**: `npm run dev` (Ensure Convex dev server is also running via `npx convex dev` if not bundled in the script).
- **Typecheck**: `npm run typecheck`
- **Lint**: `npm run lint`
- **Test**: `npm run test` (Vitest)

## Important Next.js 16 Gotchas
- `middleware.ts` is now `proxy.ts`. Use it for routing concerns, but do not rely on it as the sole security boundary.
- Plan caching around the newer explicit model (`"use cache"`) rather than the old implicit fetch-cache mental model.