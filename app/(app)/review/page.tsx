import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { preloadQuery } from "convex/nextjs";
import { Preloaded } from "convex/react";

import { api } from "@/convex/_generated/api";
import { ReviewCenterClient } from "./ReviewCenterClient";

export default async function ReviewPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  let queuePreloaded: Preloaded<typeof api.reviewCenter.getReviewQueue> | null =
    null;
  let isConvexConfigured = true;

  try {
    queuePreloaded = await preloadQuery(api.reviewCenter.getReviewQueue, {});
  } catch {
    isConvexConfigured = false;
  }

  if (!isConvexConfigured || !queuePreloaded) {
    return (
      <div className="flex flex-col gap-6 sm:gap-7">
        <header className="flex flex-col gap-3">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
            / review
          </span>
          <h1 className="text-balance text-[clamp(1.5rem,2vw+0.5rem,1.8rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
            Review Center
          </h1>
        </header>
        <OfflineState />
      </div>
    );
  }

  return (
    <ReviewCenterClient
      queuePreloaded={queuePreloaded}
    />
  );
}

function OfflineState() {
  return (
    <div className="rounded-xl border border-border bg-background p-7 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.08)] sm:p-8">
      <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
        Could not load review queue
      </h2>
      <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted-foreground">
        The Review Center needs Convex to aggregate your review items.
        Start the dev server and try again.
      </p>
    </div>
  );
}
