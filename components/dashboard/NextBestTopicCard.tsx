import Link from "next/link";

import {
  CockpitCard,
  CockpitCardHeader,
} from "@/components/dashboard/CockpitCard";
import {
  ArrowRight,
  Sparkle,
} from "@/components/landing/icons";
import { resolveColorVar } from "@/lib/utils/subjectColor";

/**
 * NextBestTopic recommendation entry. Mirrors the slice of
 * `api.subjects.getTopicDetailBySlug.nextBest` the page renders.
 * `null` means: user has no enrolled subjects or every enrolled
 * topic is past the mastery threshold; the card renders an empty
 * state instead.
 */
export interface NextBestEntry {
  readonly subject: {
    readonly slug: string;
    readonly title: string;
    readonly color?: string;
  };
  readonly chapter: { readonly slug: string; readonly title: string };
  readonly topic: {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly examRelevance: number;
    readonly mastery: number;
  };
  readonly reason: string;
}

/**
 * NextBestTopicCard.
 *
 * Highlight card pointing to the learner's next-best topic —
 * the highest-scoring unmastered topic across their enrolled
 * subjects, computed by
 * `api.subjects.getTopicDetailBySlug` (see the query for the
 * scoring formula). The card gives the topic title, the chapter
 * it lives in, the subject, and a one-line reason (mastery
 * percentage, exam-relevance flag, "not started yet" hint).
 *
 * Server-renderable. The CTA is a Next <Link>, so no client
 * state exists on the card itself.
 */
export function NextBestTopicCard({
  nextBest,
}: {
  readonly nextBest: NextBestEntry | null;
}) {
  if (!nextBest) {
    return (
      <CockpitCard>
        <CockpitCardHeader label="Continue next" />
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          Every enrolled topic is past 85% mastery. Start a new
          chapter from <span className="font-mono">/subjects</span>{" "}
          to keep the loop going.
        </p>
      </CockpitCard>
    );
  }

  const fillVar = resolveColorVar(nextBest.subject.color);
  const masteryPct = Math.round(nextBest.topic.mastery * 100);
  const yieldPill = nextBest.topic.examRelevance >= 4;

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Continue next"
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-accent">
            Recommended
          </span>
        }
      />
      <Link
        href={`/subjects/${nextBest.subject.slug}/${nextBest.chapter.slug}/${nextBest.topic.slug}`}
        className="group block rounded-lg border border-border bg-background p-3 outline-none transition-colors hover:border-accent-border/60 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
            style={{
              backgroundColor: `color-mix(in srgb, ${fillVar} 14%, transparent)`,
              borderColor: `color-mix(in srgb, ${fillVar} 30%, transparent)`,
              color: fillVar,
            }}
            aria-hidden
          >
            <Sparkle className="h-4 w-4" weight="duotone" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-[10.5px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
                {nextBest.subject.title} · {nextBest.chapter.title}
              </p>
              {yieldPill && (
                <span className="inline-flex items-center rounded-full bg-accent-subtle px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-accent">
                  High yield
                </span>
              )}
            </div>
            <p className="mt-1 text-[13.5px] font-semibold leading-snug tracking-tight text-foreground">
              {nextBest.topic.title}
            </p>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
              {nextBest.reason}
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <div className="h-1 w-20 overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full transition-[width] duration-500 ease-out"
                  style={{
                    width: `${Math.max(
                      nextBest.topic.mastery > 0 ? 6 : 0,
                      masteryPct
                    )}%`,
                    backgroundColor: "var(--accent)",
                  }}
                />
              </div>
              <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                {masteryPct}% today
              </span>
            </div>
          </div>
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-foreground text-background transition-transform group-hover:translate-x-0.5"
            aria-hidden
          >
            <ArrowRight className="h-3.5 w-3.5" weight="bold" />
          </span>
        </div>
      </Link>
    </CockpitCard>
  );
}
