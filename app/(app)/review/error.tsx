"use client";

import { ArrowsClockwise } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { House } from "@phosphor-icons/react/dist/ssr";

export default function ReviewError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  void error;
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
      <div className="rounded-xl border border-border bg-background p-7 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.08)] sm:p-8">
        <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
          Something went wrong
        </h2>
        <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted-foreground">
          Could not load your review queue. Check your connection and
          try again.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2.5">
          <button
            onClick={reset}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-[13px] font-medium text-accent-foreground transition-colors hover:bg-accent/90"
          >
            <ArrowsClockwise className="h-3.5 w-3.5" weight="bold" />
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface-elevated px-4 text-[13px] font-medium text-foreground transition-colors hover:bg-surface"
          >
            <House className="h-3.5 w-3.5" weight="duotone" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
