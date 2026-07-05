"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  ArrowsClockwise,
  House,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";

import { CockpitCard } from "@/components/dashboard/CockpitCard";

/**
 * Error state for /tutor.
 *
 * Renders inside the cockpit card language and uses
 * design system color tokens (subject-french) so the
 * page never reads as a raw browser crash. The reset
 * button re-runs the same boundary's render path,
 * retrying all of the Convex subscriptions + the
 * thread lazy-creation in one shot.
 */
export default function TutorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
     
    console.error("Tutor error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-3xl">
      <CockpitCard>
        <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-[auto,1fr]">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--subject-french) 12%, transparent)",
              color: "var(--subject-french)",
            }}
            aria-hidden
          >
            <WarningCircle className="h-6 w-6" weight="duotone" />
          </span>

          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
              / tutor
            </span>
            <h2 className="text-[18px] font-semibold leading-tight tracking-[-0.015em] text-foreground">
              The tutor hit an unexpected error
            </h2>
            <p className="max-w-md text-[13px] leading-relaxed text-muted-foreground">
              Most often this is a transient Convex blip. Re-trying the
              boundary rebuilds the chat surface; your messages and
              session state are safe.
            </p>
            {error.digest && (
              <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
                Error ID: {error.digest}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2.5">
              <button
                onClick={reset}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-[12.5px] font-medium text-accent-foreground transition-all hover:opacity-90 active:scale-[0.98]"
              >
                <ArrowsClockwise className="h-3.5 w-3.5" weight="bold" />
                Try again
              </button>
              <Link
                href="/subjects"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-4 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface"
              >
                <House className="h-3.5 w-3.5" weight="duotone" />
                Back to subjects
              </Link>
            </div>
          </div>
        </div>
      </CockpitCard>
    </div>
  );
}
