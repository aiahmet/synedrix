import { ConvexError } from "convex/values";
import { ConvexHttpClient } from "convex/browser";

import { api } from "@/convex/_generated/api";

/**
 * Module-level promise cache for the in-flight seed bootstrap.
 *
 * Declared on `globalThis` rather than at module scope because
 * Next.js's dev-server HMR rebuilds server-component modules
 * frequently, and a module-scope variable would reset on each
 * rebuild. `globalThis` survives HMR within a single process and
 * resets only on a true cold start. That is exactly the lifetime
 * we want — per-process memoise, no global state pollution.
 *
 * The promise is intentionally nullable in the shape (rather
 * than a typed boolean) so the FIRST caller awaits the mutation
 * and the second caller awaits the SAME promise. If two requests
 * land in the same server instance after a cold start (the
 * common dev case: `npm run dev` immediately hits two routes),
 * they share one round-trip to Convex, not two.
 */
declare global {
   
   
  var __synedrixSeedInflight: Promise<void> | undefined;
}

/**
 * ensureSeedBootstrapped.
 *
 * Lazily runs `api.seed.seedIfEmpty` exactly once per process.
 * On a populated deployment the mutation short-circuits on the
 * per-slug dedupe (one indexed read, zero writes). On a fresh
 * deployment the seed writes the canonical curriculum into
 * `convex/seed.ts` so the dashboard renders real subjects
 * instead of an empty state on the very first navigation.
 *
 * Why this is best-effort, not always-fatal: a Convex outage
 * during bootstrap must not 500 the dashboard. The original
 * inline pattern was the same — non-fatal — and the cached
 * variant keeps that contract while eliminating the per-render
 * HTTP round-trip cost on a populated deployment.
 *
 * Call sites: `app/(app)/dashboard/page.tsx`, `app/(app)/tutor/page.tsx`.
 * Both previously inlined the mutation; this helper centralizes
 * the cache and the per-process memoisation.
 */
export async function ensureSeedBootstrapped(): Promise<void> {
  if (globalThis.__synedrixSeedInflight) {
    return globalThis.__synedrixSeedInflight;
  }

  const inflight = (async () => {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      // No Convex configured at all (local dev without `.env.local`,
      // or a static deploy target). The page render will fall through
      // to its empty-state fallback. Returning resolves the cache so
      // we don't keep retrying on every render.
      return;
    }

    try {
      const client = new ConvexHttpClient(convexUrl);
      await client.mutation(api.seed.seedIfEmpty, {});
    } catch (err) {
      // Differentiate a deterministic config error (e.g. a
      // `seed_collision` from the canonical seed tree) from a
      // transient network blip so an operator grepping
      // console output can tell the difference at a glance.
      // Both branches fail open so the page renders the
      // empty state instead of crashing.
      //
      // We branch on `err.data.startsWith("seed_collision")`
      // (NOT `err.message.includes("seed_collision")`) because
      // ConvexError stores the original payload on `.data`,
      // while `.message` is the SDK-formatted string. Any
      // future log line or model output that happens to contain
      // the literal "seed_collision" elsewhere would
      // false-positive on a substring message grep; the
      // typed-code prefix on `data` is reliable.
      const isDeterministic =
        err instanceof ConvexError &&
        typeof err.data === "string" &&
        err.data.startsWith("seed_collision");
      if (isDeterministic) {
        console.error(
          "ensureSeedBootstrapped: canonical seed collision - fix the seed file and re-run `npm run seed`:",
          err
        );
      } else {
        console.warn(
          "ensureSeedBootstrapped (non-fatal, transient). Retry on next page render:",
          err
        );
      }
    }
  })();

  globalThis.__synedrixSeedInflight = inflight;
  return inflight;
}
