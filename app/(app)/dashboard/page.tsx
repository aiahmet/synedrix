import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { currentUser } from "@clerk/nextjs/server";
import { fetchQuery, preloadQuery } from "convex/nextjs";

import { api } from "@/convex/_generated/api";
import { EmptySubjectsState } from "@/components/dashboard/EmptySubjectsState";
import { ensureSeedBootstrapped } from "@/lib/server/bootstrapSeed";
import { DashboardOverviewClient } from "./DashboardOverviewClient";
import type { Tier0Preloads, Tier1Preloads, Tier2Preloads } from "./_lib/types";

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
  const { userId, getToken } = await auth();
  if (!userId) redirect("/sign-in");

  const token = await getToken({ template: "convex" }).catch(() => null);
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

  let tier0: Tier0Preloads | null = null;
  let tier1: Tier1Preloads | null = null;
  let tier2: Tier2Preloads | null = null;
  let isConvexConfigured = true;

  try {
    const dashboardTimeZone =
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "UTC";
    try {
      const [overview, subjects] = await Promise.all([
        preloadQuery(
          api.dashboard.getOverview,
          { timeZone: dashboardTimeZone },
          token ? { token } : {}
        ),
        preloadQuery(api.subjects.list, {}, token ? { token } : {}),
      ]);
      tier0 = { overview, subjects };
    } catch {
      isConvexConfigured = false;
    }
    if (tier0 !== null) {
      try {
        const overview = await fetchQuery(
          api.dashboard.getOverview,
          { timeZone: dashboardTimeZone },
          token ? { token } : {}
        );
        if (!overview.isEmpty) {
          const [
            continueStudying,
            recentActivity,
            whatsNew,
            ownedTopics,
            dailyMission,
            mistakesRevisit,
            weeklyConsistency,
            goalsSnapshot,
            recoveredTopics,
            timeBySubject,
          ] = await Promise.all([
            preloadQuery(api.dashboard.getContinueStudying, {}, token ? { token } : {}),
            preloadQuery(api.dashboard.getRecentActivity, { limit: 5 }, token ? { token } : {}),
            preloadQuery(api.telemetry.getRecentSystemUpdates, { limit: 3 }, token ? { token } : {}),
            preloadQuery(api.dashboard.listOwnedTopicsForCurrentUser, {}, token ? { token } : {}),
            preloadQuery(api.dashboard.getDailyMission, {}, token ? { token } : {}),
            preloadQuery(api.dashboard.getMistakesToRevisit, {}, token ? { token } : {}),
            preloadQuery(api.dashboard.getWeeklyConsistency, {}, token ? { token } : {}),
            preloadQuery(api.goals.getSnapshot, {}, token ? { token } : {}),
            preloadQuery(api.dashboard.getRecoveredTopics, {}, token ? { token } : {}),
            preloadQuery(api.dashboard.getTimeBySubject, {}, token ? { token } : {}),
          ]);
          tier1 = {
            continueStudying,
            recentActivity,
            whatsNew,
            ownedTopics,
            dailyMission,
            weeklyConsistency,
          };
          tier2 = {
            mistakesRevisit,
            goalsSnapshot,
            recoveredTopics,
            timeBySubject,
          };
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
          / cockpit
        </span>
        <h1 className="text-balance text-[clamp(1.6rem,2.2vw+0.5rem,2rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
          Willkommen zurück, {firstName}.
        </h1>
        <p className="max-w-xl text-pretty text-[13.5px] leading-relaxed text-muted-foreground">
          Eine Reihe für deinen Lernstand, drei Signale für den Lernkreislauf und ein
          zentraler Ort zum Starten. Dein Zustand aus der letzten Sitzung ist bereits geladen.
        </p>
      </header>

      {tier0 && tier1 ? (
        <DashboardOverviewClient
          tier0={tier0}
          tier1={tier1}
          tier2={tier2 ?? {
            mistakesRevisit: null,
            goalsSnapshot: null,
            recoveredTopics: null,
            timeBySubject: null,
          }}
          fallbackName={firstName}
        />
      ) : (
        <EmptySubjectsState userName={firstName} />
      )}

      {!isConvexConfigured && (
        <p className="mt-2 text-center font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
          Convex offline. Zeige leeren Zustand. Führe{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 text-foreground">
            npx convex dev
          </code>{" "}
          aus, um das Cockpit zu verbinden.
        </p>
      )}
    </div>
  );
}
