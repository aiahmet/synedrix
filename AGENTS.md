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

## Frontend & UI/UX Improvements

**Whenever you ask to analyze, audit, or improve a Synedrix frontend surface, this protocol runs. It exists because polish is not improvement.**

### Protocol

1. **Read the rulebook first.** `docs/SYNEDRIX-FRONTEND-STYLE.md` is the source of truth for typography, surfaces, buttons, inputs, focus states, two-room layouts, banned anti-patterns, and the ready-to-ship checklist. The rulebook wins over an UI hunch.
2. **Audit before editing.** Inventory which anti-patterns ship on the target surface: halo backgrounds, radial dot grids, pill/track eyebrow chips, triple-nested cards, carded list rows, `active:scale-[0.X]` toy-feel CTAs, generic Tableau-style product previews, brand-abstract H1 ("X systems, one state."), hardcoded `rgba(13,148,136,0.X)` accent shadows, fake-precise stat strips in marketing, mirrored checkmark trust lists, "Welcome to the future of Y." boilerplate copy.
3. **Distinguish polish from structure — and default to structure.**
   - **Polish** (avoid unless asked explicitly): tighten tracking, swap pill chip for plain text, drop a bouncy scale, refine focus-ring opacity, rebalance padding. The premise is unchanged.
   - **Structure** (do this): remove a fake product preview entirely, replace a generic H1 with a concrete user moment, collapse two equal CTAs to one primary + one ghost link, replace a stat strip with honest product proof, change a 12-column split to a single editorial column, delete a whole component, rewrite a copy layer.
   Make the structural fix first. Polish follows only if it is itself structural.
4. **Audit related surfaces.** Fixing one surface is a system update. When the hero CTA changes, audit the NavBar CTA, the auth CTAs, the dashboard cards. The product must read as one design system across `components/auth/`, `components/landing/`, `components/dashboard/`, `components/tutor/`, `components/onboarding/`.
5. **Run typecheck and code reviewer in parallel after every code change.** `npm run typecheck` and `code-reviewer-minimax-m3` must both pass before the work ships.
6. **Name what you didn't change.** If a related surface still ships anti-pattern chrome, call it out so the maintainer decides whether to extend the work or leave it for a future pass.

### Working with the rulebook

For typography, spacing, color, anti-pattern, button, input, divider, iconography, and ready-to-ship rules, see `docs/SYNEDRIX-FRONTEND-STYLE.md`. That document is the surgical reference; this section is the protocol.

### Reflection rule — when the user calls a fix "polish"

The user may say *"you just polished instead of fixed."* Take that as a signal: a structural premise of the surface was wrong, and the fix should attack that premise (remove a component, rewrite a layout, replace copy). Pure polish never satisfies a "make it actually better" request — escalate to structure.

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
- **No comments in code**: Never write comments in any source file. Code should be self-documenting through clear naming, small functions, and explicit types. If logic needs explanation, refactor it until the code speaks for itself. JSDoc on exported symbols and `// eslint-disable-next-line` are the only exceptions.