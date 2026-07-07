"use client";

import Link from "next/link";

import { CockpitCard, CockpitCardHeader } from "./CockpitCard";
import {
  ChatCircleText,
  Pulse,
  Timer,
} from "@/components/landing/icons";
import { resolveColorVar } from "@/lib/utils/subjectColor";
import { formatRelativeDate } from "@/lib/format/relativeDate";
import { cn } from "@/lib/utils/cn";

/**
 * RecentActivityStrip.
 *
 * Plan §3.2: a clickable row strip rendered below the
 * `SubjectMasteryStrip` on the dashboard. Each row is
 * a deep link to the source action's surface
 * (practice run → topic page; tutor → /tutor; session
 * → subject detail). The strip is hidden when the
 * user has no activity yet — handled by the parent
 * (`DashboardOverviewClient`) which only renders the
 * component when `data.length > 0`.
 */
export function RecentActivityStrip({
  data,
}: {
  readonly data: ReadonlyArray<{
    readonly kind: "session" | "practice" | "tutor";
    readonly at: number;
    readonly title: string;
    readonly subtitle: string;
    readonly href: string;
    readonly tone?: string;
  }>;
}) {
  if (data.length === 0) return null;

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Recent activity"
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            Last {data.length}
          </span>
        }
      />
      <ul className="flex flex-col divide-y divide-border/60">
        {data.map((row, i) => {
          const fillVar = resolveColorVar(row.tone);
          const Icon =
            row.kind === "practice"
              ? Pulse
              : row.kind === "tutor"
                ? ChatCircleText
                : Timer;
          return (
            <li key={`${row.kind}-${row.at}-${i}`} className="py-2.5 first:pt-0 last:pb-0">
              <Link
                href={row.href}
                className="group flex items-center gap-3 rounded-lg px-1 py-1 outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${fillVar} 14%, transparent)`,
                    borderColor: `color-mix(in srgb, ${fillVar} 28%, transparent)`,
                    color: fillVar,
                  }}
                  aria-hidden
                >
                  <Icon className="h-3.5 w-3.5" weight="duotone" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold tracking-tight text-foreground">
                    {row.title}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {row.subtitle}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground transition-colors group-hover:text-foreground"
                  )}
                >
                  {formatRelativeDate(row.at)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </CockpitCard>
  );
}
