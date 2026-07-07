"use client";

import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

export default function PlannerError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-[13px] font-medium text-foreground">Could not load planner</p>
      <p className="mt-1 text-[11.5px] text-muted-foreground">
        {error.message || "An unexpected error occurred while loading your planner data."}
      </p>
      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-8 items-center rounded-md bg-foreground px-3 text-[11.5px] font-medium text-background transition-colors hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-[11.5px] font-medium text-foreground transition-colors hover:bg-surface"
        >
          <ArrowLeft className="h-3 w-3" weight="bold" />
          Dashboard
        </Link>
      </div>
    </div>
  );
}
