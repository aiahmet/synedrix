# Contributing to Synedrix

## Development Setup

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your API keys:
   - Convex project URL and deployment token
   - Clerk publishable and secret keys
   - OpenRouter API key

3. Start the development servers:
   ```bash
   npx convex dev     # Terminal 1: Convex backend
   npm run dev        # Terminal 2: Next.js frontend
   ```

## Code Standards

- **TypeScript strict mode** is enabled — no `any` or loose types.
- Business logic lives in `convex/` or `src/lib/`, never in React components.
- AI prompts are Zod-validated via `generateObject` / `streamObject` — no raw LLM text.
- Follow the existing naming conventions and file structure.

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add practice arena timer
fix: correct mistake journal pagination
docs: update README with new API routes
refactor: extract AI telemetry wrapper
chore: bump convex to 1.42.0
```

## Pull Request Process

1. Keep PRs focused — one feature or fix per PR.
2. Ensure `npm run typecheck` and `npm run lint` pass.
3. Update docs if you change public APIs or environment variables.
4. Link related issues in the PR description.

## Code of Conduct

Be respectful and constructive. This is a learning tool — help others learn too.
