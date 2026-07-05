import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Convex auto-generated bindings are gitignored and
    // re-emitted by `npx convex dev`; lint should walk past
    // them. Mirrors the `/convex/_generated` line in
    // `.gitignore`.
    "convex/_generated/**",
  ]),
]);

export default eslintConfig;
