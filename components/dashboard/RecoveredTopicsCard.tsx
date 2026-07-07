"use client";

import Link from "next/link";
import { CockpitCard, CockpitCardHeader } from "./CockpitCard";
import { ArrowUpRight, Flame, CaretRight } from "@/components/landing/icons";
import { resolveColorVar } from "@/lib/utils/subjectColor";

export interface RecoveredTopic {
  readonly topicId: string;
  readonly topicSlug: string;
  readonly topicTitle: string;
  readonly chapterSlug: string;
  readonly subjectSlug: string;
  readonly subjectTitle: string;
  readonly subjectColor?: string;
  readonly previousMastery: number;
  readonly currentMastery: number;
  readonly recoveryDelta: number;
  readonly recoveredAt: number;
}

function masteryPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function RecoveredTopicsCard({
  data,
}: {
  readonly data: readonly RecoveredTopic[];
}) {
  if (data.length === 0) return null;

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Recovered weak topics"
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            {data.length} topic{data.length !== 1 ? "s" : ""}
          </span>
        }
      />
      <div className="flex flex-col gap-2.5">
        {data.map((item) => (
          <Link
            key={item.topicId}
            href={`/subjects/${item.subjectSlug}/${item.chapterSlug}/${item.topicSlug}`}
            className="group flex items-start gap-3 rounded-lg p-2.5 -mx-2.5 transition-colors hover:bg-surface-elevated"
          >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-subtle/40">
              <Flame
                className="h-3.5 w-3.5 text-accent"
                weight="duotone"
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span
                  className="truncate text-[13px] font-medium text-foreground"
                  style={{ color: item.subjectColor ? resolveColorVar(item.subjectColor) : undefined }}
                >
                  {item.topicTitle}
                </span>
                <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-muted-foreground">
                  {item.subjectTitle}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="flex items-center gap-1 text-[11.5px] text-muted-foreground">
                  <span className="tabular-nums">{masteryPct(item.previousMastery)}</span>
                  <CaretRight
                    className="h-2.5 w-2.5 text-accent"
                    weight="bold"
                  />
                  <span className="tabular-nums font-medium text-accent">
                    {masteryPct(item.currentMastery)}
                  </span>
                </span>
                <span className="text-[10px] text-muted-foreground">·</span>
                <span className="text-[11px] text-accent font-medium tabular-nums">
                  +{Math.round(item.recoveryDelta * 100)}%
                </span>
              </div>
            </div>
            <ArrowUpRight
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
              weight="bold"
            />
          </Link>
        ))}
      </div>
    </CockpitCard>
  );
}
