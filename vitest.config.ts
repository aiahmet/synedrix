import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

/**
 * vitest.config.ts.
 *
 * Resolves the same `@/` path alias the runtime uses (see
 * `tsconfig.json`). The `@/lib` alias is registered first so
 * Vitest's resolver matches the more specific pattern before
 * the broader `@/` catch-all. Without this, test suites that
 * import from `@/lib/...` fail with "Failed to resolve import"
 * and never execute.
 *
 * `environment: "node"` is correct today because every test in
 * the tree targets a pure module (prompt builder, markdown
 * parser, Zod schema). When React component tests are added,
 * set `environment: "jsdom"` globally for component suites or
 * override per-file with `// @vitest-environment jsdom` to keep
 * the existing pure-module tests fast.
 */
export default defineConfig({
  test: {
    environment: "node",
    // `.{ts,tsx}` matches both pure module tests and React
    // component tests. Component tests use `renderToStaticMarkup`
    // from `react-dom/server` so they don't need jsdom — keeps
    // the suite fast. If a future test needs DOM events, add
    // a per-file `// @vitest-environment jsdom` directive.
    include: [
      "**/__tests__/**/*.test.{ts,tsx}",
      "**/*.test.{ts,tsx}",
    ],
  },
  resolve: {
    alias: [
      { find: /^@\/lib\/(.*)$/, replacement: path.resolve(projectRoot, "src/lib/$1") },
      { find: /^@\/(.*)$/, replacement: path.resolve(projectRoot, "$1") },
    ],
  },
});
