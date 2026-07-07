import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { preloadQuery } from "convex/nextjs";
import { Preloaded } from "convex/react";
import Link from "next/link";

import { api } from "@/convex/_generated/api";
import { SubjectHubClient } from "./SubjectHubClient";
import { ArrowLeft, Books } from "@/components/landing/icons";

export default async function SubjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { slug } = await params;

  let preloaded: Preloaded<typeof api.subjects.getHub> | null = null;
  let isConvexConfigured = true;

  try {
    preloaded = await preloadQuery(api.subjects.getHub, { slug });
  } catch (err) {
    console.warn("preloadQuery(api.subjects.getHub) failed:", err);
    isConvexConfigured = false;
  }

  if (!preloaded) {
    return <OfflineFallback slug={slug} />;
  }

  return (
    <>
      <SubjectHubClient preloaded={preloaded} fallbackSlug={slug} />
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
            The Subject Hub needs Convex to load the curriculum.
            Start the dev server and the hub will appear.
          </p>
          <Link
            href="/subjects"
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 text-[12.5px] font-medium text-background transition-colors hover:bg-foreground/90"
          >
            <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
            Back to subjects
          </Link>
        </div>
      </div>
    </div>
  );
}
