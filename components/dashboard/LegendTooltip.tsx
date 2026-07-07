"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Info } from "@/components/landing/icons";

/**
 * LegendTooltip.
 *
 * Plan §4.2: a small `i` icon that, on hover/focus,
 * reveals a 3-line legend explaining the difficulty
 * (EASY / MEDIUM / HARD) and exam-relevance
 * (High yield / Core / Optional) labels used
 * throughout the subject surface.
 *
 * Renders a pure-CSS tooltip on focus/hover. No
 * floating UI library; the tooltip is positioned
 * absolutely and visibility-toggled via a peer
 * class so it stays in the React tree and respects
 * `prefers-reduced-motion`.
 */
export function LegendTooltip() {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="Legend"
        className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Info className="h-3 w-3" weight="bold" />
      </button>
      <span
        role="tooltip"
        className={cn(
          "absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-border bg-surface-elevated p-3 text-[11.5px] leading-relaxed text-muted-foreground shadow-[var(--shadow-pop)] transition-opacity",
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        )}
      >
        <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-foreground">
          Legend
        </p>
        <ul className="mt-2 flex flex-col gap-1.5">
          <li>
            <span className="font-semibold text-foreground">Difficulty:</span>{" "}
            EASY (foundational), MEDIUM (intermediate), HARD (advanced).
          </li>
          <li>
            <span className="font-semibold text-foreground">High yield:</span>{" "}
            exam-relevance ≥ 4. Worth prioritizing before exams.
          </li>
          <li>
            <span className="font-semibold text-foreground">Core:</span>{" "}
            exam-relevance 2-3. Standard curriculum coverage.
          </li>
          <li>
            <span className="font-semibold text-foreground">Optional:</span>{" "}
            exam-relevance &lt; 2. Stretch material.
          </li>
        </ul>
      </span>
    </span>
  );
}
