"use client";

import Link from "next/link";

import { CockpitCard } from "./CockpitCard";
import { MasteryRing } from "./MasteryRing";
import {
  ArrowRight,
  ChatCircleText,
  Sparkle,
} from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";
import { formatRelativeDate } from "@/lib/format/relativeDate";
import { resolveColorVar } from "@/lib/utils/subjectColor";

/**
 * ContinueStudyingCard.
 *
 * The dashboard's single most important "next action"
 * (plan §1.1). Renders the user's most recently studied
 * topic with two CTAs:
 *   - "Continue" (primary) — opens the topic page.
 *   - "Discuss with tutor" (secondary) — opens the
 *     tutor with the same subject + topic context.
 *
 * Hidden when `data` is null (fresh sign-up with no
 * progress); the parent falls through to a generic
 * "Start your first session" CTA. The card itself
 * stays server-renderable — no client state beyond the
 * two `<Link>`s and the optional router interaction.
 */
export function ContinueStudyingCard({
  data,
  className,
}: {
  readonly data: {
    readonly subject: {
      readonly id: string;
      readonly slug: string;
      readonly title: string;
      readonly color?: string;
      readonly icon?: string;
    };
    readonly chapter: { readonly slug: string; readonly title: string };
    readonly topic: {
      readonly id: string;
      readonly slug: string;
      readonly title: string;
      readonly mastery: number;
      readonly confidence: number;
      readonly difficulty: "EASY" | "MEDIUM" | "HARD";
      readonly source: "canonical" | "user";
      readonly ownerId: string | null;
    };
    readonly lastStudiedAt: number;
  };
  readonly className?: string;
}) {
  const fillVar = resolveColorVar(data.subject.color);
  const masteryPct = Math.round(data.topic.mastery * 100);
  const userOwned =
    data.topic.source === "user" && data.topic.ownerId !== null;
  const canonicalHref = `/subjects/${data.subject.slug}/${data.chapter.slug}/${data.topic.slug}`;
  const userHref = `/my-topics/${data.topic.slug}/lesson`;
  const href = userOwned ? userHref : canonicalHref;
  const tutorHref = `/tutor?subject=${encodeURIComponent(
    data.subject.slug
  )}${userOwned ? "" : `&topic=${encodeURIComponent(data.topic.slug)}`}&from=${encodeURIComponent(
    "/dashboard"
  )}`;

  return (
    <CockpitCard className={cn("relative overflow-hidden", className)}>
      {/* Soft subject hue band on the top edge so the
          card reads as "this is about THIS subject" at
          a glance, not as a generic dashboard tile. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
        style={{ backgroundColor: fillVar }}
      />
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex items-start gap-4">
          <MasteryRing
            value={data.topic.mastery}
            label={`${masteryPct}%`}
            ariaLabel={`Mastery ${masteryPct} percent`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
                Continue
              </span>
              <span
                className="rounded-full px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em]"
                style={{
                  color: fillVar,
                  backgroundColor: `color-mix(in srgb, ${fillVar} 14%, transparent)`,
                }}
              >
                {data.subject.title}
              </span>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
                · {data.chapter.title}
              </span>
            </div>
            <h2 className="mt-1.5 text-balance text-[clamp(1.1rem,1.4vw+0.6rem,1.4rem)] font-semibold leading-[1.1] tracking-[-0.02em] text-foreground">
              {data.topic.title}
            </h2>
            <p className="mt-1.5 text-[12px] text-muted-foreground">
              Last studied {formatRelativeDate(data.lastStudiedAt)} ·{" "}
              <span className="font-mono tabular-nums">
                {masteryPct}% mastery
              </span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 sm:flex-nowrap">
          <Link
            href={tutorHref}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-3.5 text-[12.5px] font-medium text-foreground transition-colors hover:border-accent-border/60 hover:bg-surface"
          >
            <ChatCircleText className="h-3.5 w-3.5" weight="duotone" />
            Discuss with tutor
          </Link>
          <Link
            href={href}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-[12.5px] font-medium text-accent-foreground transition-colors hover:bg-accent/90"
          >
            <Sparkle className="h-3.5 w-3.5" weight="duotone" />
            Continue
            <ArrowRight className="h-3.5 w-3.5" weight="bold" />
          </Link>
        </div>
      </div>
    </CockpitCard>
  );
}
