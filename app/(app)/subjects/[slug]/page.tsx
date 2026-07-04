import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { preloadQuery } from "convex/nextjs";
import { Preloaded } from "convex/react";
import Link from "next/link";

import { api } from "@/convex/_generated/api";
import { SubjectDetailClient } from "./SubjectDetailClient";
import { ArrowLeft, Books } from "@/components/landing/icons";

/**
 * /subjects/[slug].
 *
 * Subject detail page. Server shell that preloads the Convex
 * query and delegates rendering to a small client island. The
 * client island is responsible for the not-found state (it can
 * see the resolved value of the query, which the page cannot
 * because Convex's `Preloaded` is opaque on the server).
 *
 * Auth-gated at the layout level and re-verified here. If
 * Convex is offline, we render a small honest fallback inside
 * the cockpit card language.
 */
export default async function SubjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { slug } = await params;

  let preloaded: Preloaded<typeof api.subjects.getBySlug> | null = null;
  let isConvexConfigured = true;

  try {
    preloaded = await preloadQuery(api.subjects.getBySlug, { slug });
  } catch (err) {
    // The most common failure here is a missing
    // NEXT_PUBLIC_CONVEX_URL or a Convex deployment that has
    // not been pushed yet (`npx convex dev` not running).
    // Log so the dev sees it in the server console but do
    // not break the render — the offline fallback below
    // tells the user the same thing in the UI.
    console.warn("preloadQuery(api.subjects.getBySlug) failed:", err);
    isConvexConfigured = false;
  }

  if (!preloaded) {
    return <OfflineFallback slug={slug} />;
  }

  return (
    <>
      <SubjectDetailClient preloaded={preloaded} fallbackSlug={slug} />
      {!isConvexConfigured && (
        <p className="mx-auto mt-2 max-w-5xl text-center font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
          Convex offline. Run{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 text-foreground">
            npx convex dev
          </code>{" "}
          to wire the detail view.
        </p>
      )}
    </>
  );
}

/**
 * Offline fallback when Convex is unreachable.
 */
function OfflineFallback({ slug }: { readonly slug: string }) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-border bg-surface-elevated p-1.5 shadow-[var(--shadow-soft)]">
        <div className="rounded-xl bg-background p-7 text-center sm:p-8">
          <span
            className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--subject-physics) 14%, transparent)",
              color: "var(--subject-physics)",
            }}
            aria-hidden
          >
            <Books className="h-5 w-5" weight="duotone" />
          </span>
          <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
            Could not load &ldquo;{slug}&rdquo;
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted-foreground">
            The detail view needs Convex to load the curriculum.
            Start the dev server and the chapter list will appear.
          </p>
          <Link
            href="/subjects"
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 text-[12.5px] font-medium text-background transition-all hover:opacity-90 active:scale-[0.98]"
          >
            <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
            Back to subjects
          </Link>
        </div>
      </div>
    </div>
  );
}
