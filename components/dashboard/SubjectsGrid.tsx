"use client";

import { useMemo, useState } from "react";

import { SubjectCard } from "./SubjectCard";
import { CockpitCard, CockpitCardHeader } from "./CockpitCard";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils/cn";

/**
 * SubjectsGrid.
 *
 * Responsive grid of subject cards. Owns the client-only filter
 * state (All / Enrolled / Available). The data is passed in
 * pre-resolved from the server-preloaded query, so this component
 * never needs to re-fetch.
 *
 * Sorting is done by the Convex query, not here. Filtering is a
 * pure client concern.
 */
export function SubjectsGrid({
  subjects,
}: {
  readonly subjects: ReadonlyArray<{
    readonly id: Id<"subjects">;
    readonly slug: string;
    readonly title: string;
    readonly description: string | null;
    readonly color?: string;
    readonly icon?: string;
    readonly enrolled: boolean;
    readonly enrolledAt: number | null;
    readonly chapterCount: number;
    readonly topicCount: number;
  }>;
}) {
  const [filter, setFilter] = useState<"all" | "enrolled" | "available">("all");

  const filtered = useMemo(() => {
    if (filter === "enrolled") return subjects.filter((s) => s.enrolled);
    if (filter === "available") return subjects.filter((s) => !s.enrolled);
    return subjects;
  }, [filter, subjects]);

  const enrolledCount = subjects.filter((s) => s.enrolled).length;
  const availableCount = subjects.length - enrolledCount;

  return (
    <div className="flex flex-col gap-5">
      <CockpitCard>
        <CockpitCardHeader
          label="Filter"
          trailing={
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
              {subjects.length} subjects &middot; {enrolledCount} enrolled
            </span>
          }
        />
        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label="All"
            count={subjects.length}
          />
          <FilterChip
            active={filter === "enrolled"}
            onClick={() => setFilter("enrolled")}
            label="Enrolled"
            count={enrolledCount}
          />
          <FilterChip
            active={filter === "available"}
            onClick={() => setFilter("available")}
            label="Available"
            count={availableCount}
          />
        </div>
      </CockpitCard>

      {filtered.length === 0 ? (
        <CockpitCard>
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-[13.5px] font-medium text-foreground">
              {filter === "enrolled"
                ? "You haven't enrolled in any subjects yet."
                : filter === "available"
                  ? "You're enrolled in every available subject."
                  : "No subjects indexed yet."}
            </p>
            <p className="max-w-sm text-[12.5px] text-muted-foreground">
              {filter === "enrolled"
                ? "Pick one from the available tab to start a new study loop."
                : "Add one to start tracking your progress on the cockpit."}
            </p>
          </div>
        </CockpitCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <SubjectCard key={s.id} subject={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly label: string;
  readonly count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full border px-3.5 text-[12px] font-medium transition-colors",
        active
          ? "border-accent-border/60 bg-accent-subtle/60 text-accent"
          : "border-border bg-surface-elevated text-muted-foreground hover:border-border hover:text-foreground"
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
          active ? "bg-accent/15" : "bg-surface"
        )}
      >
        {count}
      </span>
    </button>
  );
}
