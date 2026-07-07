import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { preloadQuery } from "convex/nextjs";
import { Preloaded } from "convex/react";

import { api } from "@/convex/_generated/api";
import { PracticeArenaClient } from "./PracticeArenaClient";

export default async function PracticeArenaPage() {
  const { userId, getToken } = await auth();
  if (!userId) redirect("/sign-in");

  const token = await getToken({ template: "convex" }).catch(() => null);
  let subjectsPreloaded: Preloaded<typeof api.subjects.list> | null = null;

  try {
    subjectsPreloaded = await preloadQuery(api.subjects.list, {}, token ? { token } : {});
  } catch {
    return <OfflineFallback />;
  }

  if (!subjectsPreloaded) {
    return <OfflineFallback />;
  }

  return (
    <PracticeArenaClientWrapper subjectsPreloaded={subjectsPreloaded} />
  );
}

function PracticeArenaClientWrapper({
  subjectsPreloaded,
}: {
  readonly subjectsPreloaded: Preloaded<typeof api.subjects.list>;
}) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PracticeArenaClient subjectsPreloaded={subjectsPreloaded} />
    </Suspense>
  );
}

function LoadingFallback() {
  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <div className="rounded-xl border border-border bg-background p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_0_0_rgb(255_255_255_/_0.05),0_8px_24px_-12px_rgba(0,0,0,0.45)] sm:p-7">
        <div className="h-5 w-40 animate-pulse rounded bg-muted/30" />
        <div className="mt-4 space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-muted/20" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted/20" />
        </div>
      </div>
    </div>
  );
}

function OfflineFallback() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-xl border border-border bg-background p-7 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_0_0_rgb(255_255_255_/_0.05),0_8px_24px_-12px_rgba(0,0,0,0.45)] sm:p-8">
        <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
          Could not load practice
        </h2>
        <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted-foreground">
          The practice arena needs Convex to load your enrolled subjects.
          Start the dev server and try again.
        </p>
      </div>
    </div>
  );
}
