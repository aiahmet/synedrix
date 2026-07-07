"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils/cn";

/**
 * NavTutorBadge.
 *
 * Small badge mounted next to the Tutor icon in the
 * main app nav. Surfaces the unread-tutor-message
 * total across all threads for the calling user (a
 * single indexed scan over `tutorThreads`).
 *
 * The badge uses the high-contrast inverse pair
 * (background: foreground; text: background) instead
 * of the accent color. The accent is reserved for
 * primary CTAs; using it on a passive unread chip
 * would fight the active page accents. The ring-
 * surface-elevated outline keeps the chip legible
 * when the surrounding nav row is in its hover
 * state.
 *
 * Returns null when total is 0, so "no chip" reads
 * as "no signal" rather than "0 unread".
 */
export function NavTutorBadge({
  className,
  variant = "desktop",
}: {
  readonly className?: string;
  readonly variant?: "desktop" | "mobile";
}) {
  const total = useQuery(api.tutorComposer.getTutorUnreadTotal, {});
  if (total === undefined || total === null || total <= 0) return null;
  return (
    <span
      aria-label={`${total} unread tutor message${total === 1 ? "" : "s"}`}
      className={cn(
        "pointer-events-none absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-foreground px-1 font-mono font-semibold text-background ring-2 ring-surface-elevated",
        variant === "mobile" ? "h-3.5 text-[8.5px]" : "h-4 text-[9.5px]",
        className
      )}
    >
      {total > 9 ? "9+" : total}
    </span>
  );
}
