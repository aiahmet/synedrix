<p align="center">
  <a href="https://github.com/aiahmet/synedrix">
    <!-- Replace with your actual logo/banner -->
    <img src="/public/synedrix-github-banner.png" alt="Synedrix Github Banner" width="100%" />
  </a>
</p>

<h1 align="center">Synedrix</h1>

<p align="center">
  <b>A personal learning operating system. Five systems, one state.</b><br>
  <i>One tab, five hours, everything you need to go from "I don't get this" to "I can solve this alone."</i>
</p>

<p align="center">
  <a href="#tech-stack"><img src="https://img.shields.io/badge/Next.js_16-000000?style=flat-square&logo=next.js&logoColor=white" alt="Next.js 16" /></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/Convex-Realtime_DB-FF9E00?style=flat-square&logo=convex&logoColor=white" alt="Convex" /></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?style=flat-square&logo=tailwind-css&logoColor=white" alt="Tailwind v4" /></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/Vercel_AI_SDK-000000?style=flat-square&logo=vercel&logoColor=white" alt="Vercel AI SDK" /></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License" /></a>
  <a href="https://github.com/aiahmet/synedrix/stargazers"><img src="https://img.shields.io/github/stars/aiahmet/synedrix?style=flat-square&logo=github" alt="GitHub Stars" /></a>
  <a href="https://github.com/aiahmet/synedrix/forks"><img src="https://img.shields.io/github/forks/aiahmet/synedrix?style=flat-square&logo=github" alt="GitHub Forks" /></a>
</p>

---

## 📖 Overview

**Synedrix** is not a notes app with a chatbot bolted on. It is a unified, state-driven learning environment built specifically for a German Gymnasium student preparing for the *Oberstufe* (grade 12). 

Most study tools fragment the learning process across PDFs, generic LLM chat windows, and isolated flashcard apps. Study OS unifies the curriculum map, knowledge workspace, AI tutor, practice engine, and spaced-repetition system into a single cohesive loop. Because all five systems share the exact same context—mastery, confidence, recent mistakes, and current goals—the AI tutor already knows what the practice engine just tested, and the planner already knows what the review queue is about to demand.

### The Core Learning Loop
Every topic in Study OS runs the same atomic loop:
1. **Diagnose** current understanding.
2. **Study** the explanation (Simple / Standard / Rigorous).
3. **Question** the context-aware AI Tutor.
4. **Solve** guided and independent tasks.
5. **Log** mistakes to the Error Journal.
6. **Generate** review items from those exact mistakes.
7. **Re-test** later via the spaced-repetition engine.

---

## ✨ Key Surfaces

| Surface | Purpose |
| :--- | :--- |
| **The Cockpit (Dashboard)** | Answers *"What do I do right now?"* in under a second. Surfaces weak topics, daily missions, and AI-curated rescue plans. |
| **Subject Hubs** | Tailored environments for Math (step-by-step solving), Physics (unit-aware decomposition), and Languages (rubric-based writing/oral drills). |
| **Topic Pages** | The atomic learning screen. Features 3-depth explanations, inline annotation, and a context-aware AI sidecar. |
| **Practice Arena** | On-demand generated drills, timed mini-tests, and exam simulations. |
| **Review Center** | A unified queue combining spaced-repetition flashcards, weak-foundation recovery, and mistake-log replay. |
| **Focus Mode** | A single-task environment that hides navigation, pins the current goal, and captures session reflections. |

---

## 🏗️ Architecture & Engineering Standards

Study OS is built with a focus on strict boundaries, type safety, and modern Next.js 16 paradigms.

### Domain-Driven Frontend
Business logic and domain behavior live in `src/features/`, keeping shared UI components generic and presentational.
```text
src/
 ├── features/        # Domain logic (dashboard, subjects, topics, tutor, practice)
 ├── components/ui/   # Generic, shared design system primitives
 ├── lib/             # Core services (AI routing, DB helpers, curriculum graph)
 └── stores/          # Zustand local state
```

### The Data Model: Canonical vs. Progress
The single most important architectural decision in Study OS is the strict separation of data:
*   **Canonical Curriculum:** `Subject` → `Chapter` → `Topic` → `LessonBlock`. (Shared, rarely changes, aggressively cached).
*   **User Progress:** `UserTopicProgress`, `PracticeAttempt`, `MistakeEntry`. (Per-user, highly volatile, realtime).

### AI Guardrails & Telemetry
*   **No Raw Trust:** Every AI generation uses the Vercel AI SDK's `generateObject` / `streamObject` and is strictly validated against **Zod schemas**.
*   **Context Grounding:** Prompts are dynamically injected with the user's current mastery, recent mistakes, and subject-specific rules.
*   **Telemetry:** Every AI call is wrapped in a telemetry layer that logs token usage, latency, and schema-validation outcomes to the `AiGeneration` table for continuous prompt optimization.

### Next.js 16 & Security
*   **Explicit Caching:** Utilizes the modern `"use cache"`, `cacheLife`, and `cacheTag` directives for granular invalidation (e.g., submitting a practice set invalidates only the specific dashboard widgets it affects).
*   **Zero-Trust Auth:** While `proxy.ts` (Clerk middleware) handles first-pass routing, **every** Server Component and Route Handler re-verifies the session via `auth()` before reading or writing data.

---

## 🧰 Tech Stack

| Category | Technology |
| :--- | :--- |
| **Framework** | Next.js 16 (App Router, Turbopack, React Server Components) |
| **Backend & DB** | Convex (Realtime DB, Server Functions, End-to-End Type Safety) |
| **Styling** | Tailwind CSS v4 (CSS-first `@theme` configuration) |
| **AI Engine** | Vercel AI SDK + OpenRouter (Structured Outputs, Streaming) |
| **Authentication** | Clerk (Integrated via `convex/react-clerk`) |
| **State Management** | TanStack Query (Server), Zustand (Local), React Hook Form + Zod |
| **Observability** | PostHog (Product), Sentry (Errors), Custom AI Telemetry |

---

## 🚀 Getting Started

### Prerequisites
*   Node.js 20+
*   A [Convex](https://www.convex.dev/) account
*   A [Clerk](https://clerk.com/) account
*   An [OpenRouter](https://openrouter.ai/) API key

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/aiahmet/synedrix.git
   cd synedrix
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Copy `.env.local.example` to `.env.local` and fill in your keys:
   ```env
   # Convex
   NEXT_PUBLIC_CONVEX_URL=
   CLERK_JWT_ISSUER_DOMAIN=
   
   # Clerk
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
   CLERK_SECRET_KEY=
   
   # AI
   OPENROUTER_API_KEY=
   OPENROUTER_DEFAULT_MODEL=
   ```

4. **Start the development servers:**
   ```bash
   # Terminal 1: Convex Backend
   npx convex dev
   
   # Terminal 2: Next.js Frontend
   npm run dev
   ```

### Available Scripts
*   `npm run dev` - Start the Next.js development server (Turbopack).
*   `npm run typecheck` - Run strict TypeScript checking across the monorepo.
*   `npm run lint` - Run ESLint.
*   `npm run test` - Run unit and integration tests via Vitest.

---

## 🎨 Design System

The aesthetic is a **"disciplined study cockpit"**—calm, serious, compact, and fast. 
*   **No generic AI gradients.** 
*   Neutral warm-gray and cool-slate surfaces.
*   A single strong accent color (Teal/Cobalt) for primary actions.
*   Subject colors are used strictly as subtle categorical labels, never dominating the layout.
*   Typography relies on precise sans-serifs (Geist/Inter) with monospace treatments for stats, formulas, and code.

---

## 🗺️ Roadmap

- [x] **Phase 1: Foundation** - Auth, app shell, Convex schema, basic AI provider setup.
- [ ] **Phase 2: Core Loop** - Topic pages, practice generator, answer evaluation, mistake log, review queue.
- [ ] **Phase 3: Intelligence** - Planner, focus mode, weak-topic detection, progress analytics.
- [ ] **Phase 4: Polish** - Richer editors, keyboard shortcuts, caching hardening, mobile refinement.

---

## 🤝 Contributing

Contributions are welcome! Whether it's bug fixes, feature suggestions, or improvements to the AI tutoring pipelines:

1. Fork the repository.
2. Create a feature branch (`git checkout -b feat/your-feature`).
3. Commit your changes (`git commit -m 'feat: add some feature'`).
4. Push to the branch (`git push origin feat/your-feature`).
5. Open a Pull Request.

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for our coding standards and commit conventions.

---

## 📄 License

This project is open source under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <a href="https://github.com/aiahmet/synedrix/issues">Report Bug</a> ·
  <a href="https://github.com/aiahmet/synedrix/issues">Request Feature</a> ·
  <a href="https://github.com/aiahmet/synedrix/discussions">Discussions</a>
</p>

<p align="center">
  <i>Built with obsession for the perfect study session.</i>
</p>
