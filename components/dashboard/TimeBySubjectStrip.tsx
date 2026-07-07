"use client";

import Link from "next/link";
import { CockpitCard, CockpitCardHeader } from "./CockpitCard";
import { ArrowUpRight } from "@/components/landing/icons";
import { resolveColorVar } from "@/lib/utils/subjectColor";

export interface TimeBySubjectEntry {
  readonly subjectId: string;
  readonly subjectSlug: string;
  readonly subjectTitle: string;
  readonly subjectColor?: string;
  readonly totalMinutes: number;
  readonly sessionCount: number;
  readonly percentageOfTotal: number;
}

function hoursAndMin(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function TimeBySubjectStrip({
  data,
}: {
  readonly data: readonly TimeBySubjectEntry[];
}) {
  if (data.length === 0) return null;

  const maxMinutes = Math.max(1, ...data.map((d) => d.totalMinutes));

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Time invested by subject"
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            {data.reduce((s, d) => s + d.totalMinutes, 0)} min total
          </span>
        }
      />
      <div className="flex flex-col gap-3">
        {data.map((item) => (
          <Link
            key={item.subjectId}
            href={`/subjects/${item.subjectSlug}`}
            className="group flex items-center gap-3 rounded-md p-1 -mx-1 transition-colors hover:bg-surface-elevated"
          >
            <span className="w-24 shrink-0 text-[12px] font-medium truncate text-muted-foreground group-hover:text-foreground">
              {item.subjectTitle}
            </span>
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-border"
              role="progressbar"
              aria-valuenow={item.totalMinutes}
              aria-valuemin={0}
              aria-valuemax={maxMinutes}
              aria-label={`${item.totalMinutes} minutes on ${item.subjectTitle}`}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(item.totalMinutes / maxMinutes) * 100}%`,
                  backgroundColor: item.subjectColor
                    ? resolveColorVar(item.subjectColor)
                    : "var(--accent)",
                }}
              />
            </div>
            <span className="w-14 shrink-0 text-right font-mono text-[11px] tabular-nums text-foreground">
              {hoursAndMin(item.totalMinutes)}
            </span>
            <span className="w-10 shrink-0 text-right font-mono text-[10.5px] tabular-nums text-muted-foreground">
              {item.percentageOfTotal}%
            </span>
            <ArrowUpRight
              className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
              weight="bold"
            />
          </Link>
        ))}
      </div>
    </CockpitCard>
  );
}
