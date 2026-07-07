import Link from "next/link";

import { CockpitCard, CockpitCardHeader } from "./CockpitCard";
import { ArrowRight, Sparkle } from "@/components/landing/icons";
import { resolveColorVar } from "@/lib/utils/subjectColor";
import { cn } from "@/lib/utils/cn";

/**
 * UpNextBanner.
 *
 * Plan §1.2: a full-width banner variant of the
 * `NextBestTopicCard` that takes the "Up next" pill out of
 * the `SubjectHeader` and elevates it to a hero CTA. When
 * the system knows what to do next, the next action should
 * be the loudest thing on the screen.
 *
 * Per `docs/SYNEDRIX-FRONTEND-STYLE.md`:
 *
 *   - **No icon container.** The Sparkle glyph renders at
 *     native size in the per-subject hue (§8).
 *
 *   - **No pill chip.** "High yield" is plain uppercase
 *     muted text. "Up next" is the section header (§1).
 *
 *   - **No bouncy CTA.** Buttons don't bounce.
 *
 *   - **Per-subject hue CTAs.** The "Start here" button uses
 *     `style={{ backgroundColor: fillVar }}` so the per-subject
 *     hue reads as the recommendation's identity. The
 *     `hover:opacity-90` is replaced with `hover:brightness-95`
 *     (Tailwind-native filter) so the darken-on-hover reads as
 *     a controlled shade shift, not a generic opacity dip.
 *     `hover:bg-accent/90` does not apply because the button
 *     is not on the global accent.
 *
 * The empty case renders a quiet "you finished every topic
 * in this subject" card with a link to /subjects. Empty +
 * non-enrolled states do not show the banner (parent page is
 * responsible for hiding it when `nextBest` is null AND
 * `enrolled` is false).
 */
export function UpNextBanner({
  nextBest,
  enrolled,
}: {
  readonly nextBest: {
    readonly subject: { readonly slug: string; readonly title: string; readonly color?: string };
    readonly chapter: { readonly slug: string; readonly title: string };
    readonly topic: {
      readonly slug: string;
      readonly title: string;
      readonly examRelevance: number;
      readonly mastery: number;
    };
    readonly reason: string;
  } | null;
  readonly enrolled: boolean;
}) {
  if (!enrolled) return null;

  if (!nextBest) {
    return (
      <CockpitCard>
        <div className="flex flex-col items-center gap-1.5 py-2 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="text-[13.5px] font-semibold tracking-tight text-foreground">
              You finished every topic in this subject.
            </p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Pick another subject to keep the loop going.
            </p>
          </div>
          <Link
            href="/subjects"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-3.5 text-[12px] font-medium text-background transition-colors hover:bg-foreground/90"
          >
            Browse subjects
            <ArrowRight className="h-3.5 w-3.5" weight="bold" />
          </Link>
        </div>
      </CockpitCard>
    );
  }

  const fillVar = resolveColorVar(nextBest.subject.color);
  const masteryPct = Math.round(nextBest.topic.mastery * 100);
  const yieldPill = nextBest.topic.examRelevance >= 4;
  const href = `/subjects/${nextBest.subject.slug}/${nextBest.chapter.slug}/${nextBest.topic.slug}`;

  return (
    <CockpitCard className="relative overflow-hidden">
      {/* Subject color side-band. The only place the
          per-subject color appears on the banner — a
          single hairline left edge. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: fillVar }}
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          {/* Sparkle at native size, in the per-subject hue.
              No container. */}
          <span
            className="mt-0.5 shrink-0"
            style={{ color: fillVar }}
            aria-hidden
          >
            <Sparkle className="h-6 w-6" weight="duotone" />
          </span>
          <div className="min-w-0 flex-1">
            <CockpitCardHeader
              label="Up next"
              trailing={
                <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
                  Recommended
                </span>
              }
            />
            <div className="-mt-3 flex flex-wrap items-center gap-1.5">
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
            <h2 className="mt-1 text-balance text-[clamp(1.05rem,1.2vw+0.5rem,1.25rem)] font-semibold leading-[1.12] tracking-[-0.02em] text-foreground">
              {nextBest.topic.title}
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              {nextBest.reason}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full transition-[width] duration-500 ease-out"
                  style={{
                    width: `${Math.max(nextBest.topic.mastery > 0 ? 6 : 0, masteryPct)}%`,
                    backgroundColor: fillVar,
                  }}
                />
              </div>
              <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                {masteryPct}% today
              </span>
            </div>
          </div>
        </div>
        <Link
          href={href}
          className={cn(
            "inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-5 text-[13.5px] font-medium text-background transition-all hover:brightness-95",
          )}
          style={{ backgroundColor: fillVar }}
        >
          Start here
          <ArrowRight className="h-4 w-4" weight="bold" />
        </Link>
      </div>
    </CockpitCard>
  );
}
