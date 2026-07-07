"use client";

import Link from "next/link";
import { ClockCounterClockwise, ArrowRight } from "@phosphor-icons/react";
import { CockpitCard } from "@/components/dashboard/CockpitCard";

export function EmptyState() {
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
      <CockpitCard>
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <ClockCounterClockwise className="h-5 w-5 text-accent" weight="duotone" />
          <h2 className="text-[16px] font-semibold tracking-tight text-foreground">Nothing to review</h2>
          <p className="mx-auto max-w-sm text-[12.5px] text-muted-foreground">
            Your review queue is empty. Study a topic, complete a practice set, or review flashcards — due items appear here automatically.
          </p>
          <Link href="/subjects" className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-[13px] font-medium text-accent-foreground transition-colors hover:bg-accent/90">
            Browse subjects
            <ArrowRight className="h-3.5 w-3.5" weight="bold" />
          </Link>
        </div>
      </CockpitCard>
    </div>
  );
}
