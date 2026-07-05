"use client";

import { useState } from "react";
import { renderMath } from "@/lib/content/miniMarkdown";
import { CaretDown, CaretUp, Clipboard, Check } from "@/components/landing/icons";
import { CockpitCard, CockpitCardHeader } from "@/components/dashboard/CockpitCard";

interface FormulaEntry {
  readonly name: string;
  readonly expression: string;
  readonly when: string;
}

/**
 * TopicFormulaSheet.
 *
 * Collapsible card at the bottom of the topic page that
 * lists all canonical formulas for the topic. Each formula
 * shows name, expression (rendered via the math renderer),
 * and "when to use". Click a formula to copy the expression.
 */
export function TopicFormulaSheet({
  contents,
}: {
  readonly contents: readonly FormulaEntry[];
}) {
  const [open, setOpen] = useState(true);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  if (contents.length === 0) return null;

  const handleCopy = (expression: string, idx: number) => {
    navigator.clipboard.writeText(expression).catch(() => {});
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Formula sheet"
        trailing={
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {open ? "Collapse" : "Expand"}
            {open ? <CaretUp className="h-3 w-3" weight="bold" /> : <CaretDown className="h-3 w-3" weight="bold" />}
          </button>
        }
      />
      {open && (
        <div className="flex flex-col gap-2.5 mt-1">
          {contents.map((f, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleCopy(f.expression, idx)}
              className="group flex flex-col gap-0.5 rounded-lg border border-border/60 bg-background p-3 text-left transition-all hover:border-accent/40 hover:bg-surface-elevated"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold tracking-tight text-foreground">
                  {f.name}
                </span>
                <span className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  {copiedIdx === idx ? (
                    <Check className="h-3 w-3 text-accent" weight="bold" />
                  ) : (
                    <Clipboard className="h-3 w-3" weight="duotone" />
                  )}
                </span>
              </div>
              <code className="font-mono text-[13px] text-accent">
                {renderMath(f.expression)}
              </code>
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                {f.when}
              </p>
            </button>
          ))}
        </div>
      )}
    </CockpitCard>
  );
}
