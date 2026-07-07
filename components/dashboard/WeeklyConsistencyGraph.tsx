"use client";

import { useMemo } from "react";
import { CockpitCard, CockpitCardHeader } from "./CockpitCard";
import { Timer, CalendarBlank } from "@/components/landing/icons";

export interface WeeklyConsistencyDay {
  readonly date: string;
  readonly sessions: number;
  readonly minutes: number;
}

export interface WeeklyConsistencyData {
  readonly days: readonly WeeklyConsistencyDay[];
  readonly maxSessions: number;
  readonly totalMinutes: number;
  readonly totalSessions: number;
  readonly averageMinutes: number;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayOfWeek(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T12:00:00Z");
    return DAY_LABELS[d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1] ?? "";
  } catch {
    return "";
  }
}

export function WeeklyConsistencyGraph({
  data,
}: {
  readonly data: WeeklyConsistencyData;
}) {
  const todayIdx = useMemo(() => {
    const now = new Date();
    const day = now.getUTCDay();
    return day === 0 ? 6 : day - 1;
  }, []);

  if (data.days.length === 0) {
    return (
      <CockpitCard>
        <CockpitCardHeader label="Weekly consistency" />
        <div className="flex items-start gap-3">
          <CalendarBlank
            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
            weight="duotone"
          />
          <div>
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              No sessions recorded this week yet. Start a study session to
              begin tracking your consistency.
            </p>
          </div>
        </div>
      </CockpitCard>
    );
  }

  const barMaxHeight = 64;

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Weekly consistency"
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            {data.totalSessions} sess · {data.totalMinutes} min
          </span>
        }
      />

      <div className="flex items-end justify-between gap-1.5" style={{ height: barMaxHeight + 32 }}>
        {data.days.map((day, i) => {
          const dayLabel = dayOfWeek(day.date);
          const height =
            data.maxSessions > 0
              ? Math.max(4, Math.round((day.sessions / data.maxSessions) * barMaxHeight))
              : 4;
          const isToday = i === todayIdx;
          const hasActivity = day.sessions > 0;

          return (
            <div
              key={day.date}
              className="flex flex-1 flex-col items-center justify-end gap-1.5"
            >
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {hasActivity ? day.sessions : ""}
              </span>
              <div
                className="w-full rounded-t-sm transition-all duration-500"
                style={{
                  height: `${height}px`,
                  backgroundColor: isToday
                    ? "var(--accent)"
                    : hasActivity
                      ? `color-mix(in srgb, var(--accent) ${30 + day.sessions * 25}%, var(--border))`
                      : "var(--border)",
                  opacity: hasActivity || isToday ? 1 : 0.4,
                  boxShadow: isToday
                    ? "0 1px 4px rgba(13,148,136,0.3)"
                    : "none",
                }}
              />
              <span
                className="font-mono text-[9.5px] uppercase tracking-[0.12em]"
                style={{
                  color: isToday ? "var(--accent)" : "var(--muted-foreground)",
                  fontWeight: isToday ? 600 : 400,
                }}
              >
                {dayLabel}
              </span>
            </div>
          );
        })}
      </div>

      {data.totalSessions > 0 && (
        <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5 text-muted-foreground" weight="duotone" />
              <span className="text-[11.5px] text-muted-foreground">
                {data.totalMinutes} min total
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[11.5px] text-muted-foreground">
              ~{data.averageMinutes} min / session
            </span>
          </div>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            {data.totalSessions} sessions
          </span>
        </div>
      )}
    </CockpitCard>
  );
}
