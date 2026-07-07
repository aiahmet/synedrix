"use client";

import { useCallback, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Gauge } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils/cn";

export function ConfidenceSlider({
  topicId,
  confidence: initialConfidence,
}: {
  readonly topicId: Id<"topics">;
  readonly confidence: number;
}) {
  const updateConfidence = useMutation(api.progress.updateConfidence);
  const [localValue, setLocalValue] = useState(initialConfidence);
  const [committed, setCommitted] = useState(initialConfidence);
  const pct = Math.round(committed * 100);

  const onCommit = useCallback(
    (value: number) => {
      setCommitted(value);
      void updateConfidence({ topicId, confidence: value });
    },
    [updateConfidence, topicId]
  );

  const label =
    committed < 0.2
      ? "Not confident"
      : committed < 0.45
        ? "Unsure"
        : committed < 0.65
          ? "Moderate"
          : committed < 0.85
            ? "Confident"
            : "Very confident";

  const fillColor =
    committed < 0.2
      ? "var(--subject-french)"
      : committed < 0.5
        ? "var(--subject-german)"
        : "var(--accent)";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
          <Gauge className="h-3.5 w-3.5" weight="duotone" />
          Confidence: {label}
        </span>
        <span className="font-mono text-[12px] tabular-nums text-foreground">
          {pct}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={localValue}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          setLocalValue(v);
        }}
        onMouseUp={(e) => onCommit(parseFloat((e.target as HTMLInputElement).value))}
        onTouchEnd={(e) => onCommit(parseFloat((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            onCommit(localValue);
          }
        }}
        aria-label="Adjust your confidence in this topic"
        className={cn(
          "h-1.5 w-full appearance-none rounded-full bg-surface",
          "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:shadow-[0_0_0_1px_var(--border)] [&::-webkit-slider-thumb]:transition-shadow [&::-webkit-slider-thumb]:hover:shadow-[0_0_0_2px_var(--accent-border)]",
          "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-foreground [&::-moz-range-thumb]:shadow-[0_0_0_1px_var(--border)]"
        )}
        style={{
          background: `linear-gradient(to right, ${fillColor} ${pct}%, var(--surface) ${pct}%)`,
        }}
      />
    </div>
  );
}
