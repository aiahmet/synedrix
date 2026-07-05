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
 * state (All / Enrolled / Available) AND the client-only sort
 * state (Recent / Mastery / Name). The data is passed in
 * pre-resolved from the server-preloaded query, so this
 * component never needs to re-fetch.
 *
 * Sort + filter interaction: the Convex `list` query returns
 * the backend default order (enrolled-first by enrollment time
 * desc, then alpha). The "Recent" sort dropdown option
 * preserves that order verbatim. "Mastery" sorts enrolled
 * subjects by mastery desc, available subjects by alpha.
 * "Name" sorts all alpha. The sort dropdown only re-orders
 * the visible array; it does not refetch.
 *
 * The catalog is NOT gated on the Convex `users` row existing —
 * see `SubjectsClient.tsx` for why. A signed-in user always
 * sees the full curriculum, with `enrolled: false` annotations
 * until their first enroll click lazy-creates the row.
 */
export function SubjectsGrid({
  subjects,
}: {
  readonly subjects: ReadonlyArray<{
    readonly id: Id<"subjects">;
    readonly slug: string;
    readonly title: string;
    // `description` mirrors the canonical `subjects.list` query:
    // `v.optional(v.string())` → `string | undefined`. Missing
    // stays missing; present stays present. The SubjectCard
    // body either shows a short blurb from the slug-based
    // `subjectShortBlurb()` lookup or falls through to
    // `subject.description`, so a missing field is fine.
    readonly description?: string;
    readonly color?: string;
    readonly icon?: string;
    readonly enrolled: boolean;
    readonly enrolledAt: number | null;
    readonly chapterCount: number;
    readonly topicCount: number;
    readonly mastery: number;
    readonly topicsStudied: number;
    readonly lastStudiedAt: number | null;
    readonly firstTopic: {
      readonly slug: string;
      readonly chapterSlug: string;
      readonly title: string;
      readonly mastery: number;
    } | null;
  }>;
}) {
  const [filter, setFilter] = useState<"all" | "enrolled" | "available">("all");
  const [sort, setSort] = useState<"recent" | "mastery" | "name">("recent");

  const filtered = useMemo(() => {
    if (filter === "enrolled") return subjects.filter((s) => s.enrolled);
    if (filter === "available") return subjects.filter((s) => !s.enrolled);
    return subjects;
  }, [filter, subjects]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === "name") {
      arr.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === "mastery") {
      arr.sort((a, b) => {
        // Enrolled subjects sort by mastery desc; available
        // subjects sort alpha. The split keeps the "what
        // am I strongest in" question trivial to answer
        // while still respecting the enrolled/available
        // partition.
        if (a.enrolled && !b.enrolled) return -1;
        if (!a.enrolled && b.enrolled) return 1;
        if (a.enrolled && b.enrolled) {
          if (b.mastery !== a.mastery) return b.mastery - a.mastery;
        }
        return a.title.localeCompare(b.title);
      });
    }
    // "recent" is the backend default order. No client-side
    // resort needed; the order is preserved as-is.
    return arr;
  }, [filtered, sort]);

  const enrolledCount = subjects.filter((s) => s.enrolled).length;
  const availableCount = subjects.length - enrolledCount;

  return (
    <div className="flex flex-col gap-5">
      <CockpitCard>
        <CockpitCardHeader
          label="Filter &amp; sort"
          trailing={
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
              {subjects.length} subjects &middot; {enrolledCount} enrolled
            </span>
          }
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          <div
            role="radiogroup"
            aria-label="Sort subjects"
            className="inline-flex h-8 shrink-0 items-center rounded-full border border-border bg-surface-elevated p-0.5"
          >
            <SortChip
              active={sort === "recent"}
              onClick={() => setSort("recent")}
              label="Recent"
            />
            <SortChip
              active={sort === "mastery"}
              onClick={() => setSort("mastery")}
              label="Mastery"
            />
            <SortChip
              active={sort === "name"}
              onClick={() => setSort("name")}
              label="Name"
            />
          </div>
        </div>
      </CockpitCard>

      {sorted.length === 0 ? (
        <CockpitCard>
          {/*
            Three distinct empty states:

            1. `filter === "enrolled"` + nothing — the user has
               no enrollments yet. Invite them to pick one.
            2. `filter === "available"` + nothing — they are
               enrolled in every subject. Celebrate it.
            3. `filter === "all"` + nothing — the curriculum
               table is genuinely empty (no `subjects` rows in
               Convex). Tell the user honestly.
          */}
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
          {sorted.map((s) => (
            <SubjectCard key={s.id} subject={s} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * SortChip.
 *
 * One cell of the sort segmented control. Radiogroup
 * semantics so screen readers read it as a single choice
 * with a current selection. The active state uses the
 * accent surface (same family as the Filter chips) so the
 * two controls read as the same component family.
 */
function SortChip({
  active,
  onClick,
  label,
}: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center justify-center rounded-full px-3 text-[11.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-accent-subtle/60 text-accent"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
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
