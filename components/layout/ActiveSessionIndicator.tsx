"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { Pulse } from "@/components/landing/icons";

/**
 * ActiveSessionIndicator.
 *
 * A small pulsing dot + "Resume" link in the desktop
 * top bar and the mobile bottom bar. Render is
 * suppressed when the user is already on /tutor —
 * the composer there is the resume surface, so an
 * extra chip would be a parallel CTA for the same
 * intent. The pathname uses next/navigation, which
 * is safe on the React client tree without forcing a
 * full re-render of the surrounding layout.
 */
export function ActiveSessionIndicator({
  variant = "desktop",
}: {
  readonly variant?: "desktop" | "mobile";
}) {
  const pathname = usePathname();
  const data = useQuery(
    api.studySessions.getActiveForCurrentUser,
    pathname === "/tutor" ? "skip" : {}
  );
  if (pathname === "/tutor") return null;

  if (!data) return null;
  const target = data.practice ?? data.session;
  if (!target) return null;

  const label = data.practice ? "Resume practice" : "Resume session";

  if (variant === "mobile") {
    return (
      <Link
        href={target.href}
        className="group flex min-w-[64px] flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10.5px] font-medium text-accent transition-colors focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="relative">
          <Pulse className="h-5 w-5" weight="duotone" />
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-accent"
          />
        </span>
        <span>Resume</span>
      </Link>
    );
  }

  return (
    <Link
      href={target.href}
      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-accent-border/50 bg-accent-subtle/60 px-3 text-[12px] font-medium text-accent transition-colors hover:border-accent-border hover:bg-accent-subtle"
    >
      <span className="relative flex h-4 w-4 items-center justify-center">
        <Pulse className="h-3.5 w-3.5" weight="duotone" />
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
        />
      </span>
      {label}
    </Link>
  );
}
