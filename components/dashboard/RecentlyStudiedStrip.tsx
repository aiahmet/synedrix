import Link from "next/link";

import { CockpitCard, CockpitCardHeader } from "./CockpitCard";
import { MasteryRing } from "./MasteryRing";
import { ArrowRight, ClockCounterClockwise } from "@/components/landing/icons";
import { resolveColorVar } from "@/lib/utils/subjectColor";
import { formatRelativeDate } from "@/lib/format/relativeDate";
import { cn } from "@/lib/utils/cn";

/**
 * RecentlyStudiedStrip.
 *
 * Plan §3.3: a small horizontal strip of the user's last 3
 * studied topics inside the current subject. Renders on the
 * subject page between the `UpNextBanner` and the
 * `ChapterPath`. Each topic is a deep link to the topic page.
 *
 * Per `docs/SYNEDRIX-FRONTEND-STYLE.md`:
 *
 *   - **No carded inner list rows.** The previous 3-cell grid
 *     used `border border-border/60 bg-background p-3` inside
 *     a `CockpitCard`, which is exactly the "carded list
 *     rows" anti-pattern. The cells are now flat single-layer
 *     rows (a 3-column grid inside the CockpitCard, with the
 *     per-cell `border bg-background` chrome removed). Only
 *     the link's hover state shifts the background tint.
 */
export function RecentlyStudiedStrip({
  topics,
  subjectSlug,
  subjectColor,
}: {
  readonly topics: ReadonlyArray<{
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly mastery: number;
    readonly lastStudiedAt: number;
    readonly chapter: { readonly slug: string; readonly title: string };
  }>;
  readonly subjectSlug: string;
  readonly subjectColor?: string;
}) {
  if (topics.length === 0) return null;

  const fillVar = resolveColorVar(subjectColor);

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Recently studied"
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            Last {topics.length}
          </span>
        }
      />
      <ul className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
        {topics.map((t, i) => (
          <li
            key={t.id}
            className={cn(
              "flex items-center gap-3",
              // Vertical hairlines between cells on sm+, no
              // hairlines on stacked mobile.
              i > 0 && "sm:border-l sm:border-border sm:pl-6",
            )}
          >
            <MasteryRing
              value={t.mastery}
              size={40}
              strokeWidth={4}
              label={`${Math.round(t.mastery * 100)}%`}
              ariaLabel={`Mastery ${Math.round(t.mastery * 100)} percent`}
            />
            <Link
              href={`/subjects/${subjectSlug}/${t.chapter.slug}/${t.slug}`}
              className="group flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-1 py-1 outline-none transition-colors hover:bg-surface focus-visible:bg-surface"
            >
              <div className="min-w-0">
                <p className="line-clamp-1 text-[13px] font-semibold tracking-tight text-foreground">
                  {t.title}
                </p>
                <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                  {t.chapter.title} ·{" "}
                  <span className="inline-flex items-center gap-1">
                    <ClockCounterClockwise
                      className="h-2.5 w-2.5"
                      weight="duotone"
                    />
                    {formatRelativeDate(t.lastStudiedAt)}
                  </span>
                </p>
              </div>
              <ArrowRight
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                weight="bold"
              />
            </Link>
          </li>
        ))}
      </ul>
      <span
        aria-hidden
        className="mt-4 block h-px w-full"
        style={{
          background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${fillVar} 30%, transparent) 50%, transparent)`,
        }}
      />
    </CockpitCard>
  );
}
