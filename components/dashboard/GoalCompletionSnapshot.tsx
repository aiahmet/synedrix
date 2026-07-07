"use client";

import { CockpitCard, CockpitCardHeader } from "./CockpitCard";
import { Target, Plus, Check, X } from "@/components/landing/icons";
import { resolveColorVar } from "@/lib/utils/subjectColor";
import { useState } from "react";

export interface GoalSnapshotData {
  readonly daily: readonly {
    readonly id: string;
    readonly title: string;
    readonly targetCount: number | null;
    readonly completedCount: number;
    readonly subjectTitle: string | null;
    readonly subjectColor: string | null;
  }[];
  readonly weekly: readonly {
    readonly id: string;
    readonly title: string;
    readonly targetCount: number | null;
    readonly completedCount: number;
    readonly deadline: number | null;
    readonly subjectTitle: string | null;
    readonly subjectColor: string | null;
  }[];
}

export function GoalCompletionSnapshot({
  data,
  onCreateGoal,
  onIncrement,
  onDelete,
}: {
  readonly data: GoalSnapshotData;
  readonly onCreateGoal?: () => void;
  readonly onIncrement?: (goalId: string) => void;
  readonly onDelete?: (goalId: string) => void;
}) {
  const hasGoals = data.daily.length > 0 || data.weekly.length > 0;

  if (!hasGoals) {
    return (
      <CockpitCard>
        <CockpitCardHeader
          label="Goals"
          trailing={
            onCreateGoal && (
              <button
                type="button"
                onClick={onCreateGoal}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-elevated px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:border-accent-border hover:text-foreground"
              >
                <Plus className="h-3 w-3" weight="bold" />
                Add goal
              </button>
            )
          }
        />
        <div className="flex items-start gap-3">
          <Target
            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
            weight="duotone"
          />
          <div>
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              No goals set yet. Add a daily or weekly goal to track your
              progress against a concrete target.
            </p>
          </div>
        </div>
      </CockpitCard>
    );
  }

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Goals"
        trailing={
          onCreateGoal && (
            <button
              type="button"
              onClick={onCreateGoal}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-elevated px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:border-accent-border hover:text-foreground"
            >
              <Plus className="h-3 w-3" weight="bold" />
              Add
            </button>
          )
        }
      />

      <div className="flex flex-col gap-4">
        {data.daily.length > 0 && (
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
              Daily
            </p>
            <div className="flex flex-col gap-2">
              {data.daily.map((goal) => (
                <GoalRow
                  key={goal.id}
                  goal={goal}
                  onIncrement={onIncrement}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </div>
        )}

        {data.weekly.length > 0 && (
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
              Weekly
            </p>
            <div className="flex flex-col gap-2">
              {data.weekly.map((goal) => (
                <GoalRow
                  key={goal.id}
                  goal={goal}
                  onIncrement={onIncrement}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </CockpitCard>
  );
}

function GoalRow({
  goal,
  onIncrement,
  onDelete,
}: {
  readonly goal: GoalSnapshotData["daily"][number];
  readonly onIncrement?: (goalId: string) => void;
  readonly onDelete?: (goalId: string) => void;
}) {
  const [animating, setAnimating] = useState(false);
  const fillVar = resolveColorVar(goal.subjectColor);
  const pct =
    goal.targetCount !== null && goal.targetCount > 0
      ? Math.min(100, Math.round((goal.completedCount / goal.targetCount) * 100))
      : goal.completedCount > 0
        ? 100
        : 0;

  const isComplete =
    goal.targetCount !== null
      ? goal.completedCount >= goal.targetCount
      : goal.completedCount > 0;

  const handleIncrement = () => {
    if (onIncrement) {
      setAnimating(true);
      onIncrement(goal.id);
      setTimeout(() => setAnimating(false), 600);
    }
  };

  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-border/60 bg-surface-elevated px-3 py-2.5"
    >
      <button
        type="button"
        onClick={handleIncrement}
        disabled={isComplete || !onIncrement}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all disabled:opacity-40"
        style={{
          borderColor: isComplete
            ? "var(--accent)"
            : "var(--border)",
          backgroundColor: isComplete
            ? "var(--accent)"
            : animating
              ? `color-mix(in srgb, ${fillVar} 20%, transparent)`
              : "transparent",
        }}
      >
        <Check
          className="h-3 w-3"
          weight="bold"
          style={{
            color: isComplete
              ? "var(--accent-foreground)"
              : "var(--muted-foreground)",
          }}
        />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[12.5px] font-medium text-foreground">
            {goal.title}
          </p>
          <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
            {goal.completedCount}
            {goal.targetCount !== null ? ` / ${goal.targetCount}` : ""}
          </span>
        </div>
        {goal.targetCount !== null && (
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${pct}%`,
                backgroundColor: isComplete
                  ? "var(--accent)"
                  : fillVar,
              }}
            />
          </div>
        )}
        {goal.subjectTitle && (
          <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Target className="h-2.5 w-2.5" weight="duotone" />
            {goal.subjectTitle}
          </span>
        )}
      </div>

      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(goal.id)}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground/40 transition-colors hover:text-subject-french"
        >
          <X className="h-3 w-3" weight="bold" />
        </button>
      )}
    </div>
  );
}
