import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { currentUser } from "@clerk/nextjs/server";
import { fetchQuery, preloadQuery } from "convex/nextjs";
import { Preloaded } from "convex/react";

import { api } from "@/convex/_generated/api";
import { EmptySubjectsState } from "@/components/dashboard/EmptySubjectsState";
import { ensureSeedBootstrapped } from "@/lib/server/bootstrapSeed";
import { DashboardOverviewClient } from "./DashboardOverviewClient";

/**
 * /dashboard.
 *
 * The "cockpit" entry point. Renders a three-card stats row and
 * a per-subject mastery strip when the user has any data, or a
 * single full-bleed empty state with a primary CTA to add the
 * first subject when they do not.
 *
 * Data is loaded server-side via Convex's `preloadQuery` so the
 * first paint is real. A small client island (`DashboardOverviewClient`)
 * subscribes to the same preloaded query so the cockpit updates
 * instantly when practice submissions, reviews, or new sessions
 * land in Convex, without a router refresh.
 *
 * Bootstraps the canonical curriculum before the cockpit query
 * runs. A fresh Convex deployment has no `subjects` rows, so
 * `api.subjects.list` would return `[]` and the user would
 * land on /subjects seeing "No subjects indexed yet" with no
 * path forward. `api.seed.seedIfEmpty` is idempotent on slug
 * short-circuit, so calling it on every dashboard render costs
 * one indexed read and zero writes on a populated deployment.
 *
 * The page is auth-gated at the layout level too, but we re-verify
 * here per the project's security rule that middleware is a
 * first-pass redirect only.
 */
export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  const firstName = user?.firstName ?? "Student";

  // Run the lazy seed bootstrap before the cockpit query so the
  // first paint of any /subjects navigation has real canonical
  // data. The helper memoises on `globalThis.__synedrixSeedInflight`
  // (see `src/lib/server/bootstrapSeed.ts`), so a populated
  // deployment pays at most one cross-network round-trip per
  // server instance. Failures are non-fatal — the page still
  // renders the empty state if Convex is unreachable.
  await ensureSeedBootstrapped();

  let preloaded: Preloaded<typeof api.dashboard.getOverview> | null = null;
  let subjectsPreloaded: Preloaded<typeof api.subjects.list> | null = null;
  let continuePreloaded: Preloaded<
    typeof api.dashboard.getContinueStudying
  > | null = null;
  let recentActivityPreloaded: Preloaded<
    typeof api.dashboard.getRecentActivity
  > | null = null;
  let whatsNewPreloaded: Preloaded<
    typeof api.telemetry.getRecentSystemUpdates
  > | null = null;
  let ownedTopicsPreloaded: Preloaded<
    typeof api.dashboard.listOwnedTopicsForCurrentUser
  > | null = null;
  let isConvexConfigured = true;

  try {
    const dashboardTimeZone =
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "UTC";
    try {
      [preloaded, subjectsPreloaded] = await Promise.all([
        preloadQuery(api.dashboard.getOverview, { timeZone: dashboardTimeZone }),
        preloadQuery(api.subjects.list, {}),
      ]);
    } catch {
      isConvexConfigured = false;
    }
    if (preloaded !== null && subjectsPreloaded !== null) {
      try {
        const overview = await fetchQuery(api.dashboard.getOverview, {
          timeZone: dashboardTimeZone,
        });
        if (!overview.isEmpty) {
          [
            continuePreloaded,
            recentActivityPreloaded,
            whatsNewPreloaded,
            ownedTopicsPreloaded,
          ] = await Promise.all([
            preloadQuery(api.dashboard.getContinueStudying, {}),
            preloadQuery(api.dashboard.getRecentActivity, { limit: 5 }),
            preloadQuery(api.telemetry.getRecentSystemUpdates, { limit: 3 }),
            preloadQuery(api.dashboard.listOwnedTopicsForCurrentUser, {}),
          ]);
        }
      } catch {
        isConvexConfigured = false;
      }
    }
  } catch {
    isConvexConfigured = false;
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:gap-7">
      <header className="flex flex-col gap-1.5 pt-1">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
          / dashboard
        </span>
        <h1 className="text-balance text-[clamp(1.6rem,2.2vw+0.5rem,2rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
          Welcome back, {firstName}.
        </h1>
        <p className="max-w-xl text-pretty text-[13.5px] leading-relaxed text-muted-foreground">
          One row for your mastery, three signals for the loop, and a
          single place to start. Your state from the last session is
          already loaded.
        </p>
      </header>

      {preloaded &&
      subjectsPreloaded &&
      continuePreloaded &&
      recentActivityPreloaded &&
      whatsNewPreloaded &&
      ownedTopicsPreloaded ? (
        <DashboardOverviewClient
          preloaded={preloaded}
          subjectsPreloaded={subjectsPreloaded}
          continuePreloaded={continuePreloaded}
          recentActivityPreloaded={recentActivityPreloaded}
          whatsNewPreloaded={whatsNewPreloaded}
          ownedTopicsPreloaded={ownedTopicsPreloaded}
          fallbackName={firstName}
        />
      ) : (
        <EmptySubjectsState userName={firstName} />
      )}

      {!isConvexConfigured && (
        <p className="mt-2 text-center font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
          Convex offline. Showing empty state. Run{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 text-foreground">
            npx convex dev
          </code>{" "}
          to wire the cockpit.
        </p>
      )}
    </div>
  );
}
