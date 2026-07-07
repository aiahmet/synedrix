import Link from "next/link";

import type { api } from "@/convex/_generated/api";
import type { usePreloadedQuery } from "convex/react";
import { CockpitCard } from "@/components/dashboard/CockpitCard";
import { CaretRight, Warning } from "@phosphor-icons/react/dist/ssr";
import { resolveColorVar } from "@/lib/utils/subjectColor";

export function RecoveryPlanCard({
  plan,
}: {
  readonly plan: NonNullable<ReturnType<typeof usePreloadedQuery<typeof api.planner.getRecoveryPlan>>["plan"]>;
  readonly missedDays?: number;
}) {
  return (
    <CockpitCard>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <Warning className="h-4 w-4 text-accent" weight="duotone" />
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-foreground">Wiederherstellungsplan</span>
            <p className="text-[12px] text-muted-foreground">{plan.narrative}</p>
          </div>
        </div>
        {plan.priorityTopics.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Priorisierte Themen ({plan.priorityTopics.length})
            </span>
            <div className="flex flex-col gap-1">
              {plan.priorityTopics.slice(0, 4).map((t) => (
                <Link
                  key={`${t.subjectSlug}-${t.slug}`}
                  href={`/subjects/${t.subjectSlug}/${t.chapterSlug}/${t.slug}`}
                  className="group flex items-center justify-between rounded-md border border-border bg-surface-elevated px-3 py-2 transition-colors hover:border-foreground/30"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: resolveColorVar(t.subjectColor) ?? "var(--accent)" }}
                    />
                    <span className="text-[12px] font-medium text-foreground group-hover:text-accent">{t.title}</span>
                    <span className="text-[10.5px] text-muted-foreground">{t.subjectTitle}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{t.reason}</span>
                    <CaretRight className="h-3 w-3 text-muted-foreground/50" weight="bold" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
        <p className="text-[10.5px] text-muted-foreground">
          Empfohlene Sitzung: ~{plan.suggestedSessionMinutes} Minuten. {plan.overdueCount} von {plan.totalTopics} Themen sind
          überfällig.
        </p>
      </div>
    </CockpitCard>
  );
}
