import Link from "next/link";

import { CockpitCard, CockpitCardHeader } from "./CockpitCard";
import { MasteryRing } from "./MasteryRing";
import {
  ArrowRight,
  GitFork,
  LockSimple,
} from "@/components/landing/icons";
import { resolveColorVar } from "@/lib/utils/subjectColor";

export interface FoundationGap {
  readonly topic: {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly chapterSlug: string;
    readonly chapterTitle: string;
    readonly mastery: number;
  };
  readonly weakPrerequisites: readonly WeakPrerequisite[];
}

export interface WeakPrerequisite {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly chapterSlug: string;
  readonly subjectSlug: string;
  readonly mastery: number;
  readonly isStudied: boolean;
}

export function FoundationsToFix({
  gaps,
  subjectSlug,
  subjectColor,
}: {
  readonly gaps: readonly FoundationGap[];
  readonly subjectSlug: string;
  readonly subjectColor?: string;
}) {
  if (gaps.length === 0) return null;

  const fillVar = resolveColorVar(subjectColor);

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Foundations to fix"
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            Prerequisite gaps
          </span>
        }
      />

      <p className="mb-5 text-[12.5px] leading-relaxed text-muted-foreground">
        These topics have prerequisite concepts you haven&rsquo;t mastered yet.
        Fixing the foundation first makes the topic click.
      </p>

      <div className="flex flex-col gap-4">
        {gaps.map((gap) => (
          <FoundationGapRow
            key={gap.topic.id}
            gap={gap}
            subjectSlug={subjectSlug}
            fillVar={fillVar}
          />
        ))}
      </div>
    </CockpitCard>
  );
}

function FoundationGapRow({
  gap,
  subjectSlug,
  fillVar,
}: {
  readonly gap: FoundationGap;
  readonly subjectSlug: string;
  readonly fillVar: string;
}) {
  const topicHref = `/subjects/${subjectSlug}/${gap.topic.chapterSlug}/${gap.topic.slug}`;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <Link
              href={topicHref}
              className="text-[13px] font-semibold tracking-tight text-foreground hover:text-accent"
            >
              {gap.topic.title}
            </Link>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {gap.topic.chapterTitle}
            </span>
          </div>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            Blocked by {gap.weakPrerequisites.length} prerequisite
            {gap.weakPrerequisites.length !== 1 ? "s" : ""} below 50% mastery
          </p>
        </div>
        <MasteryRing
          value={gap.topic.mastery}
          size={32}
          strokeWidth={3}
          label={`${Math.round(gap.topic.mastery * 100)}%`}
          ariaLabel={`Topic mastery ${Math.round(gap.topic.mastery * 100)} percent`}
          colorVar={fillVar}
        />
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {gap.weakPrerequisites.map((wp) => (
          <li key={wp.id} className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 hover:bg-surface-elevated">
            <LockSimple
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              weight="bold"
            />
            <Link
              href={`/subjects/${wp.subjectSlug}/${wp.chapterSlug}/${wp.slug}`}
              className="min-w-0 flex-1 text-[12px] font-medium text-foreground hover:text-accent"
            >
              {wp.title}
            </Link>
            <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
              {Math.round(wp.mastery * 100)}%
            </span>
            <div className="h-1 w-12 overflow-hidden rounded-full bg-surface-sunken">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(2, Math.round(wp.mastery * 100))}%`,
                  backgroundColor: "var(--subject-french)",
                }}
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center gap-3">
        <Link
          href={topicHref}
          className="inline-flex items-center gap-1 text-[11.5px] font-medium text-accent hover:underline"
        >
          Go to topic
          <ArrowRight className="h-3 w-3" weight="bold" />
        </Link>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <GitFork className="h-3 w-3" weight="duotone" />
          Fix the {gap.weakPrerequisites.length === 1 ? "prerequisite" : "weakest prerequisite"} first
        </span>
      </div>
    </div>
  );
}
