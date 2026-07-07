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
    readonly source: "canonical" | "user";
    readonly ownerId: string | null;
  };
  readonly reason: string;
}

/**
 * NextBestTopicCard.
 *
 * Highlight card pointing to the learner's next-best topic —
 * the highest-scoring unmastered topic across their enrolled
 * subjects, computed by
 * `api.subjects.getTopicDetailBySlug`. The card gives the topic
 * title, the chapter it lives in, the subject, and a one-line
 * reason.
 *
 * Per `docs/SYNEDRIX-FRONTEND-STYLE.md`:
 *
 *   - **No icon container.** The Sparkle glyph renders at
 *     native size in the per-subject hue (§8).
 *
 *   - **No pill chip.** "High yield" / "Recommended" is plain
 *     uppercase muted text (§1).
 *
 *   - **No bouncy CTA.** Buttons don't bounce.
 *
 *   - **`hover:bg-foreground/90`** on the small arrow chip
 *     and `hover:brightness-95` on the per-subject hue CTA
 *     (post-lesson variant).
 *
 *   - **No carded inner list row.** The card body is one flat
 *     link, not a `border bg-background` mini-card (§1:
 *     "Carded list rows. Lists are typography.").
 *
 * Server-renderable. The CTA is a Next <Link>, so no client
 * state exists on the card itself.
 */
export function NextBestTopicCard({
  nextBest,
  variant = "default",
}: {
  readonly nextBest: NextBestEntry | null;
  /**
   * Visual variants:
   *   - "default": right-column card (used on the
   *     topic page right sidebar).
   *   - "post-lesson": full-width card with an
   *     "After this topic" eyebrow. Used at the end
   *     of the topic page main column.
   */
  readonly variant?: "default" | "post-lesson";
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
  const userOwned =
    nextBest.topic.source === "user" && nextBest.topic.ownerId !== null;
  const canonicalHref = `/subjects/${nextBest.subject.slug}/${nextBest.chapter.slug}/${nextBest.topic.slug}`;
  const userHref = `/my-topics/${nextBest.topic.slug}/lesson`;
  const href = userOwned ? userHref : canonicalHref;

  if (variant === "post-lesson") {
    return (
      <CockpitCard className="relative overflow-hidden">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-1"
          style={{ backgroundColor: fillVar }}
        />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <span
              className="mt-0.5 shrink-0"
              style={{ color: fillVar }}
              aria-hidden
            >
              <Sparkle className="h-6 w-6" weight="duotone" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
                After this topic
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
                  {nextBest.subject.title} · {nextBest.chapter.title}
                </p>
                {yieldPill && (
                  <span
                    className="font-mono text-[10.5px] uppercase tracking-[0.16em]"
                    style={{ color: "var(--accent)" }}
                  >
                    High yield
                  </span>
                )}
              </div>
              <h3 className="mt-1 text-balance text-[clamp(1.05rem,1.2vw+0.5rem,1.25rem)] font-semibold leading-[1.12] tracking-[-0.02em] text-foreground">
                {nextBest.topic.title}
              </h3>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                {nextBest.reason}
              </p>
            </div>
          </div>
          {/* Per-subject hue CTA. `hover:brightness-95` darkens
              the per-subject color in a controlled way without
              falling back to `hover:opacity-90`. */}
          <Link
            href={href}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-5 text-[13.5px] font-medium text-background transition-all hover:brightness-95"
            style={{ backgroundColor: fillVar }}
          >
            Continue next
            <ArrowRight className="h-4 w-4" weight="bold" />
          </Link>
        </div>
      </CockpitCard>
    );
  }

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
        href={href}
        className="group block rounded-md px-1 py-1 outline-none transition-colors hover:bg-surface focus-visible:bg-surface"
      >
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 shrink-0"
            style={{ color: fillVar }}
            aria-hidden
          >
            <Sparkle className="h-5 w-5" weight="duotone" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-[10.5px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
                {nextBest.subject.title} · {nextBest.chapter.title}
              </p>
              {yieldPill && (
                <span
                  className="font-mono text-[10.5px] uppercase tracking-[0.16em]"
                  style={{ color: "var(--accent)" }}
                >
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
                      masteryPct,
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
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-foreground text-background transition-colors group-hover:bg-foreground/90"
            aria-hidden
          >
            <ArrowRight className="h-3.5 w-3.5" weight="bold" />
          </span>
        </div>
      </Link>
    </CockpitCard>
  );
}
