import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { preloadQuery } from "convex/nextjs";
import { Preloaded } from "convex/react";
import Link from "next/link";

import { api } from "@/convex/_generated/api";
import { SubjectHubClient } from "./SubjectHubClient";
import { CockpitCard } from "@/components/dashboard/CockpitCard";
import { ArrowLeft, Books } from "@/components/landing/icons";

export default async function SubjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { userId, getToken } = await auth();
  if (!userId) redirect("/sign-in");

  const token = await getToken({ template: "convex" }).catch(() => null);
  const { slug } = await params;

  let preloaded: Preloaded<typeof api.subjects.getHub> | null = null;
  let isConvexConfigured = true;

  try {
    preloaded = await preloadQuery(api.subjects.getHub, { slug }, token ? { token } : {});
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
      <CockpitCard>
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Books className="h-6 w-6" style={{ color: "var(--subject-physics)" }} weight="duotone" />
          <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
            Could not load &ldquo;{slug}&rdquo;
          </h2>
          <p className="mx-auto max-w-sm text-[12.5px] text-muted-foreground">
            The Subject Hub needs Convex to load the curriculum.
            Start the dev server and the hub will appear.
          </p>
          <Link
            href="/subjects"
            className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-4 text-[12.5px] font-medium text-background transition-colors hover:bg-foreground/90"
          >
            <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
            Back to subjects
          </Link>
        </div>
      </CockpitCard>
    </div>
  );
}
