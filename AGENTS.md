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
- **Business Logic**: Keep logic in Convex functions (`convex/[domain].ts`) or `src/lib/` services. Never put business logic, data fetching, or AI prompt builders in presentational React components. The original "Domain-Driven Design (`src/features/[domain]/`)" rule is deliberately retired: the working split is `convex/` for persistent state + schema + queries/mutations, `src/lib/ai/` for AI plumbing + prompt builders + telemetry, `src/lib/content/` for shared content utilities, `src/lib/server/` for server-only helpers, and `src/components/` for visual primitives. New domains add a `convex/[domain].ts` module; the rest of these directories are framework-level plumbing.
- **Realtime over caching**: Reactivity flows from Convex real-time subscriptions (`preloadQuery` + `usePreloadedQuery` on the client, Convex mutations on the server). We do NOT use Next.js's `"use cache"` / `cacheTag` directives on any data the dashboard reads — the data is already realtime, so layering Next.js's fetch cache on top only adds reconciliation bugs. Next.js 16's `"use cache"` is not used anywhere in this codebase today; if a future feature needs to cache a static asset, prefer the explicit directive over hand-rolled caches.
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
- **Content lint**: `npm run lint:content` (validates `convex/seed.ts` against the contract).
- **Convex postdeploy seed**: `npm run seed` (calls `npx convex run seed:seedIfEmpty`). Run once per fresh Convex deploy. The dashboard and `/tutor` pages also bootstrap the seed lazily on first request, so dev environments without the step still work.

## Important Next.js 16 Gotchas
- `middleware.ts` is now `proxy.ts`. Use it for routing concerns, but do not rely on it as the sole security boundary.
- Do not wrap server-component reads in `"use cache"` if any of the data is realtime — see "Realtime over caching" above. The mental model is "if it's static, cache; if it's live, subscribe."

## Code Standards
- **Write elite-level code**: No shortcuts, no stubs, no placeholder logic. Every line must be intentional and production-grade. If you catch yourself being lazy, stop and do it properly.