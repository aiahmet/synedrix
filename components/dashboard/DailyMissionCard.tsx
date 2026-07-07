"use client";

import Link from "next/link";
import { CockpitCard, CockpitCardHeader } from "./CockpitCard";
import {
  Target,
  ArrowRight,
  CheckCircle,
  Timer,
  CalendarBlank,
  Flame,
} from "@/components/landing/icons";

export interface DailyMissionData {
  readonly nextBestTopic: {
    readonly subjectSlug: string;
    readonly subjectTitle: string;
    readonly subjectColor?: string;
    readonly chapterSlug: string;
    readonly topicSlug: string;
    readonly topicTitle: string;
    readonly mastery: number;
    readonly reason: string;
  } | null;
  readonly dueTodayCount: number;
  readonly overdueCount: number;
  readonly streakDays: number;
  readonly sessionsToday: number;
  readonly dailyGoal: {
    readonly id: string;
    readonly title: string;
    readonly targetCount: number | null;
    readonly completedCount: number;
  } | null;
}

export function DailyMissionCard({
  data,
}: {
  readonly data: DailyMissionData | null;
}) {
  if (!data) return null;

  const reviewUrgency =
    data.overdueCount > 0
      ? "overdue"
      : data.dueTodayCount > 5
        ? "busy"
        : data.dueTodayCount > 0
          ? "manageable"
          : "clear";

  const urgencyConfig = {
    overdue: {
      label: `${data.overdueCount} overdue`,
      color: "var(--subject-french)",
      icon: Timer,
    },
    busy: {
      label: `${data.dueTodayCount} due today`,
      color: "var(--subject-english)",
      icon: CalendarBlank,
    },
    manageable: {
      label: `${data.dueTodayCount} due today`,
      color: "var(--accent)",
      icon: CalendarBlank,
    },
    clear: { label: "All clear", color: "var(--accent)", icon: CheckCircle },
  };

  const config = urgencyConfig[reviewUrgency];
  const Icon = config.icon;

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Today's mission"
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            {data.sessionsToday === 0
              ? "No sessions yet"
              : `${data.sessionsToday} session${data.sessionsToday === 1 ? "" : "s"} today`}
          </span>
        }
      />

      <div className="flex flex-col gap-4">
        {data.dailyGoal && (
          <div className="rounded-lg border border-border/60 bg-surface-elevated p-3">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-accent" weight="duotone" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Daily goal
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-medium text-foreground">
                {data.dailyGoal.title}
              </p>
              <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
                {data.dailyGoal.completedCount}
                {data.dailyGoal.targetCount !== null
                  ? ` / ${data.dailyGoal.targetCount}`
                  : ""}
              </span>
            </div>
            {data.dailyGoal.targetCount !== null && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-500"
                  style={{
                    width: `${Math.min(100, Math.round((data.dailyGoal.completedCount / Math.max(1, data.dailyGoal.targetCount)) * 100))}%`,
                  }}
                />
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div
            className="flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5"
            style={{
              borderColor: `color-mix(in srgb, ${config.color} 30%, var(--border))`,
              backgroundColor: `color-mix(in srgb, ${config.color} 6%, transparent)`,
            }}
          >
            <Icon
              className="h-4 w-4"
              weight="duotone"
              style={{ color: config.color }}
            />
            <span
              className="font-mono text-[16px] font-semibold tabular-nums"
              style={{ color: config.color }}
            >
              {reviewUrgency === "overdue"
                ? data.overdueCount
                : data.dueTodayCount}
            </span>
            <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              Review
            </span>
          </div>

          <div className="flex flex-col items-center gap-1 rounded-lg border border-border/60 bg-surface-elevated px-2 py-2.5">
            <Flame
              className="h-4 w-4"
              weight={data.streakDays >= 3 ? "fill" : "duotone"}
              style={{
                color:
                  data.streakDays >= 3
                    ? "var(--accent)"
                    : "var(--muted-foreground)",
              }}
            />
            <span className="font-mono text-[16px] font-semibold tabular-nums text-foreground">
              {data.streakDays}
            </span>
            <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              Streak
            </span>
          </div>

          <div className="flex flex-col items-center gap-1 rounded-lg border border-border/60 bg-surface-elevated px-2 py-2.5">
            <Target className="h-4 w-4 text-muted-foreground" weight="duotone" />
            <span className="font-mono text-[16px] font-semibold tabular-nums text-foreground">
              {data.sessionsToday}
            </span>
            <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              Sessions
            </span>
          </div>
        </div>

        {data.nextBestTopic && (
          <Link
            href={`/subjects/${data.nextBestTopic.subjectSlug}/${data.nextBestTopic.chapterSlug}/${data.nextBestTopic.topicSlug}`}
            className="flex items-center gap-3 rounded-lg border border-accent-border/30 bg-accent-subtle/20 p-3 transition-colors hover:border-accent-border/60 hover:bg-accent-subtle/30"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{
                backgroundColor: `color-mix(in srgb, var(--accent) 16%, transparent)`,
                color: "var(--accent)",
              }}
            >
              <ArrowRight className="h-4 w-4" weight="bold" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent">
                Next up
              </p>
              <p className="truncate text-[13px] font-medium text-foreground">
                {data.nextBestTopic.subjectTitle} ·{" "}
                {data.nextBestTopic.topicTitle}
              </p>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                {data.nextBestTopic.reason}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-accent-foreground">
              {Math.round(data.nextBestTopic.mastery * 100)}%
            </span>
          </Link>
        )}

        {!data.nextBestTopic && (
          <div className="rounded-lg border border-border/60 bg-surface-elevated p-3 text-center">
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              {data.dueTodayCount > 0
                ? `Tackle your ${data.dueTodayCount} review items to get back on track.`
                : "All caught up. Pick a subject to study something new."}
            </p>
            <Link
              href="/subjects"
              className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-accent"
            >
              Browse subjects
              <ArrowRight className="h-3 w-3" weight="bold" />
            </Link>
          </div>
        )}
      </div>
    </CockpitCard>
  );
}
