import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

interface EyebrowProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly tone?: "accent" | "muted";
}

/**
 * `Eyebrow` is a small uppercase wide-tracking label sitting above
 * a section headline.
 *
 * Usage is rationed across the page: at most one eyebrow per three
 * sections (the hero counts as one). When in doubt, prefer the
 * section headline alone.
 */
export function Eyebrow({ children, className, tone = "muted" }: EyebrowProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.16em]",
        tone === "accent" ? "text-accent" : "text-muted-foreground",
        className
      )}
    >
      {children}
    </span>
  );
}
