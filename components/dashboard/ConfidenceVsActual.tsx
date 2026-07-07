"use client";

import Link from "next/link";
import { CockpitCard, CockpitCardHeader } from "./CockpitCard";
import {
  Gauge,
  ArrowRight,
} from "@/components/landing/icons";
import { resolveColorVar } from "@/lib/utils/subjectColor";

export interface ConfidenceVsActualEntry {
  readonly topicId: string;
  readonly topicSlug: string;
  readonly topicTitle: string;
  readonly chapterSlug: string;
  readonly confidence: number;
  readonly actualScore: number;
  readonly lastPracticeAt: number | null;
}

export function ConfidenceVsActual({
  data,
  subjectSlug,
  subjectColor,
}: {
  readonly data: readonly ConfidenceVsActualEntry[];
  readonly subjectSlug: string;
  readonly subjectColor?: string;
}) {
  if (data.length === 0) {
    return (
      <CockpitCard>
        <CockpitCardHeader label="Confidence vs. actual" />
        <div className="flex items-start gap-3">
          <Gauge
            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
            weight="duotone"
          />
          <div>
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              Complete practice sessions to see how your confidence compares
              to your actual performance.
            </p>
          </div>
        </div>
      </CockpitCard>
    );
  }

  const fillVar = resolveColorVar(subjectColor);

  const overconfident = data.filter(
    (d) => d.confidence > d.actualScore + 0.15
  );
  const wellCalibrated = data.filter(
    (d) => Math.abs(d.confidence - d.actualScore) <= 0.15
  );
  const underconfident = data.filter(
    (d) => d.actualScore > d.confidence + 0.15
  );

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Confidence vs. actual"
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            {data.length} topic{data.length === 1 ? "" : "s"}
          </span>
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="flex flex-col items-center gap-1">
          <span
            className="font-mono text-[22px] font-semibold tabular-nums"
            style={{ color: "var(--subject-french)" }}
          >
            {overconfident.length}
          </span>
          <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground text-center leading-tight">
            Overconfident
          </span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <span
            className="font-mono text-[22px] font-semibold tabular-nums"
            style={{ color: "var(--accent)" }}
          >
            {wellCalibrated.length}
          </span>
          <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground text-center leading-tight">
            Calibrated
          </span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <span
            className="font-mono text-[22px] font-semibold tabular-nums"
            style={{ color: "var(--subject-english)" }}
          >
            {underconfident.length}
          </span>
          <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground text-center leading-tight">
            Under
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          By topic
        </p>
        {data.slice(0, 6).map((entry) => {
          const delta = entry.confidence - entry.actualScore;
          const direction =
            delta > 0.15
              ? "overconfident"
              : delta < -0.15
                ? "underconfident"
                : "calibrated";

          const deltaColor =
            direction === "overconfident"
              ? "var(--subject-french)"
              : direction === "underconfident"
                ? "var(--subject-english)"
                : "var(--accent)";

          const confidencePct = Math.round(entry.confidence * 100);
          const actualPct = Math.round(entry.actualScore * 100);

          const href = `/subjects/${subjectSlug}/${entry.chapterSlug}/${entry.topicSlug}`;

          return (
            <Link
              key={entry.topicId}
              href={href}
              className="flex items-center gap-3 px-1 py-2 transition-colors hover:bg-surface rounded-md"
            >
              <div className="flex w-full items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-foreground">
                    {entry.topicTitle}
                  </p>
                  <div className="mt-1 flex items-center gap-3">
                    <span className="text-[11px] text-muted-foreground">
                      You felt{" "}
                      <span className="font-mono tabular-nums font-medium text-foreground">
                        {confidencePct}%
                      </span>
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Scored{" "}
                      <span className="font-mono tabular-nums font-medium text-foreground">
                        {actualPct}%
                      </span>
                    </span>
                    <span
                      className="font-mono text-[10.5px] tabular-nums font-medium"
                      style={{ color: deltaColor }}
                    >
                      {delta > 0 ? "+" : ""}
                      {Math.round(delta * 100)}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-8 w-1.5 overflow-hidden rounded-full bg-surface">
                    <div
                      className="w-full rounded-full"
                      style={{
                        height: `${Math.max(4, actualPct)}%`,
                        backgroundColor: fillVar,
                      }}
                    />
                  </div>
                  <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" weight="bold" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </CockpitCard>
  );
}
