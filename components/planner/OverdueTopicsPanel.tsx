import Link from "next/link";

import type { Id } from "@/convex/_generated/dataModel";
import { CockpitCard } from "@/components/dashboard/CockpitCard";
import { ClockCounterClockwise, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { resolveColorVar } from "@/lib/utils/subjectColor";

export function OverdueTopicsPanel({
  topics,
}: {
  readonly topics: ReadonlyArray<{
    readonly id: Id<"topics">;
    readonly slug: string;
    readonly title: string;
    readonly subjectTitle: string;
    readonly subjectSlug: string;
    readonly subjectColor: string | null;
    readonly chapterSlug: string;
    readonly mastery: number;
    readonly lastStudied: number | null;
    readonly daysSinceStudy: number | null;
  }>;
}) {
  if (topics.length === 0) {
    return (
      <CockpitCard>
        <div className="flex flex-col items-center gap-2 p-4 text-center">
          <ClockCounterClockwise className="h-5 w-5 text-muted-foreground" weight="duotone" />
          <p className="text-[12px] text-muted-foreground">Keine überfälligen Themen. Bleib am Ball!</p>
        </div>
      </CockpitCard>
    );
  }

  return (
    <CockpitCard>
      <div className="flex flex-col gap-3 p-4">
        <span className="flex items-center gap-2">
          <ClockCounterClockwise className="h-4 w-4 text-accent" weight="duotone" />
          <span className="text-[13px] font-semibold text-foreground">Überfällige Themen</span>
          <span className="rounded-full bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent">
            {topics.length}
          </span>
        </span>
        <div className="flex flex-col gap-1">
          {topics.map((t) => (
            <Link
              key={`${t.subjectSlug}-${t.slug}`}
              href={`/subjects/${t.subjectSlug}/${t.chapterSlug}/${t.slug}`}
              className="group flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 transition-colors hover:border-foreground/30"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: resolveColorVar(t.subjectColor) ?? "var(--accent)" }}
                />
                <span className="text-[12px] font-medium text-foreground group-hover:text-accent">{t.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10.5px] text-muted-foreground">{t.subjectTitle}</span>
                {t.daysSinceStudy != null && (
                  <span className="rounded-full bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {t.daysSinceStudy} T.
                  </span>
                )}
                <ArrowRight className="h-3 w-3 text-muted-foreground/40" weight="bold" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </CockpitCard>
  );
}
