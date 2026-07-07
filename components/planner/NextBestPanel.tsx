import Link from "next/link";

import type { Id } from "@/convex/_generated/dataModel";
import { CockpitCard } from "@/components/dashboard/CockpitCard";
import { Lightning, ChartBar, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { resolveColorVar } from "@/lib/utils/subjectColor";

export function NextBestPanel({
  nextBest,
}: {
  readonly nextBest: Readonly<{
    subject: { slug: string; title: string; color?: string };
    chapter: { slug: string; title: string };
    topic: { id: Id<"topics">; slug: string; title: string; examRelevance: number; mastery: number };
    reason: string;
  }> | null;
}) {
  if (!nextBest) {
    return (
      <CockpitCard>
        <div className="flex flex-col items-center gap-2 p-6 text-center">
          <ChartBar className="h-5 w-5 text-muted-foreground" weight="duotone" />
          <p className="text-[12px] text-muted-foreground">Alle Themen gemeistert! Mach eine Pause oder vertiefe dein Wissen.</p>
        </div>
      </CockpitCard>
    );
  }

  const masteryPct = Math.round(nextBest.topic.mastery * 100);

  return (
    <CockpitCard>
      <div className="flex flex-col gap-3 p-4">
        <span className="flex items-center gap-2">
          <Lightning className="h-4 w-4 text-accent" weight="duotone" />
          <span className="text-[13px] font-semibold text-foreground">Nächstes optimales Thema</span>
        </span>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: resolveColorVar(nextBest.subject.color) ?? "var(--accent)" }}
            />
            <span className="text-[12px] font-medium text-foreground">
              {nextBest.topic.title}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">{nextBest.subject.title} · {nextBest.chapter.title}</p>
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-muted/40">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${masteryPct}%` }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-muted-foreground">{masteryPct}%</span>
          </div>
          <p className="text-[11px] italic text-muted-foreground">&ldquo;{nextBest.reason}&rdquo;</p>
        </div>

        <Link
          href={`/subjects/${nextBest.subject.slug}/${nextBest.chapter.slug}/${nextBest.topic.slug}`}
          className="inline-flex h-8 items-center gap-1.5 self-start rounded-md bg-foreground px-3 text-[11.5px] font-medium text-background transition-colors hover:opacity-90"
        >
          Thema starten
          <ArrowRight className="h-3 w-3" weight="bold" />
        </Link>
      </div>
    </CockpitCard>
  );
}
