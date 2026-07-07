"use client";

import { CockpitCard, CockpitCardHeader } from "@/components/dashboard/CockpitCard";
import { CheckCircle, Sparkle, Target } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils/cn";

export function MiniMasteryCheck({
  mastery,
  confidence,
  isStudied,
}: {
  readonly mastery: number;
  readonly confidence: number;
  readonly isStudied: boolean;
}) {
  if (!isStudied) {
    return (
      <CockpitCard>
        <CockpitCardHeader label="Mastery check" />
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          Start studying this topic to see your mastery and confidence scores.
        </p>
      </CockpitCard>
    );
  }

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Mastery check"
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            Close the loop
          </span>
        }
      />
      <div className="flex flex-col gap-5">
        <MasteryGauge label="Mastery" value={mastery} />
        <MasteryGauge label="Confidence" value={confidence} />

        <div className="rounded-lg border border-border bg-surface-elevated p-4">
          <div className="flex items-start gap-3">
            <Target className="mt-0.5 h-4 w-4 shrink-0 text-accent" weight="duotone" />
            <div>
              <p className="text-[12.5px] font-medium text-foreground">
                {mastery >= 0.85 && confidence >= 0.7
                  ? "You're ready to move on."
                  : mastery >= 0.6
                    ? "Good progress — keep practicing to lock in confidence."
                    : "Keep working through the lesson blocks and practice questions."}
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                {mastery >= 0.85
                  ? "This topic is well understood. Try the next one in the chapter."
                  : mastery >= 0.6
                    ? "Your understanding is solid. Confidence will grow with more practice."
                    : "Spend more time with the lesson content before attempting the practice set again."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium",
              mastery >= 0.85
                ? "border-subject-chemistry/40 bg-subject-chemistry/10 text-subject-chemistry"
                : "border-border text-muted-foreground"
            )}
          >
            <CheckCircle className="h-3 w-3" weight={mastery >= 0.85 ? "fill" : "duotone"} />
            Mastery &gt; 85%
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium",
              confidence >= 0.7
                ? "border-subject-chemistry/40 bg-subject-chemistry/10 text-subject-chemistry"
                : "border-border text-muted-foreground"
            )}
          >
            <Sparkle className="h-3 w-3" weight={confidence >= 0.7 ? "fill" : "duotone"} />
            Confidence &gt; 70%
          </span>
        </div>
      </div>
    </CockpitCard>
  );
}

function MasteryGauge({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}) {
  const pct = Math.round(value * 100);
  const width = Math.max(4, pct);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-foreground">{label}</span>
        <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
          {pct}%
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${width}%`,
            backgroundColor: "var(--accent)",
          }}
        />
      </div>
    </div>
  );
}
