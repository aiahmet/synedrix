import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { currentUser } from "@clerk/nextjs/server";
import { preloadQuery } from "convex/nextjs";
import { Preloaded } from "convex/react";
import Link from "next/link";

import { api } from "@/convex/_generated/api";
import { SubjectsClient } from "./SubjectsClient";
import { CockpitCard } from "@/components/dashboard/CockpitCard";
import { ArrowLeft, Books, Sparkle } from "@/components/landing/icons";


/**
 * /subjects.
 *
 * The canonical subject picker. Lists every subject in the
 * curriculum with the user's enrollment state, and lets the
 * user enroll or leave with one click.
 *
 * The page is auth-gated and pre-loads the Convex list query
 * server-side. A small client island (SubjectsClient) consumes
 * the preloaded query and renders the grid with its filter
 * state and per-card actions.
 */
export default async function SubjectsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  const firstName = user?.firstName ?? "Student";

  let preloaded: Preloaded<typeof api.subjects.list> | null = null;
  let isConvexConfigured = true;

  try {
    preloaded = await preloadQuery(api.subjects.list, {});
  } catch (err) {
    // The most common failure here is a missing
    // NEXT_PUBLIC_CONVEX_URL or a Convex deployment that has
    // not been pushed yet (`npx convex dev` not running).
    // Log so the dev sees it in the server console but do
    // not break the render — the offline fallback below
    // tells the user the same thing in the UI.
    console.warn("preloadQuery(api.subjects.list) failed:", err);
    isConvexConfigured = false;
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:gap-7">
      <header className="flex flex-col gap-1.5 pt-1">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
          / subjects
        </span>
        <h1 className="text-balance text-[clamp(1.6rem,2.2vw+0.5rem,2rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
          Choose what to master, {firstName}.
        </h1>
        <p className="max-w-xl text-pretty text-[13.5px] leading-relaxed text-muted-foreground">
          Every subject here unlocks the same five systems: the
          curriculum map, AI tutor, practice engine, review queue,
          and planner. Enroll once and the cockpit tracks the rest.
        </p>
        <div className="mt-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" weight="bold" />
            Back to cockpit
          </Link>
        </div>
      </header>

      {preloaded ? (
        <SubjectsClient preloaded={preloaded} />
      ) : (
        <OfflineFallback />
      )}

      {!isConvexConfigured && (
        <p className="mt-2 text-center font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
          Convex offline. Subject picker is read-only. Run{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 text-foreground">
            npx convex dev
          </code>{" "}
          to wire it.
        </p>
      )}
    </div>
  );
}

/**
 * Offline fallback for /subjects.
 *
 * Shows a small, honest "we can't reach the catalog" message
 * inside the cockpit card language, with a CTA back to the
 * cockpit. Avoids pretending to render subject cards against
 * fake data.
 */
function OfflineFallback() {
  return (
    <CockpitCard>
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--subject-physics) 14%, transparent)",
            color: "var(--subject-physics)",
          }}
          aria-hidden
        >
          <Books className="h-6 w-6" weight="duotone" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
            Subject catalog is unreachable
          </h2>
          <p className="max-w-sm text-[12.5px] text-muted-foreground">
            The picker needs Convex to load the curriculum. Start the dev
            server and the catalog will appear here.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 text-[12.5px] font-medium text-background transition-colors hover:bg-foreground/90"
        >
          <Sparkle className="h-3.5 w-3.5" weight="duotone" />
          Open the cockpit
        </Link>
      </div>
    </CockpitCard>
  );
}
