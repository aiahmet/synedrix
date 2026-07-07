"use client";

import { MagnifyingGlass, X } from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";

/**
 * SubjectsSearch.
 *
 * Plan §4.3: a small client-side search input that
 * filters the visible subject cards in `SubjectsGrid`.
 * The filter is purely client-side (no Convex
 * round-trip); the parent owns the `value` state and
 * filters the array passed to the grid. Keeps the
 * search local to the catalog so we do not add a
 * re-fetch on every keystroke.
 *
 * Per `docs/SYNEDRIX-FRONTEND-STYLE.md`:
 *
 *   - **Crisp focus state.** `focus-within:border-foreground
 *     focus-within:ring-1 focus-within:ring-foreground/40` —
 *     not the airy 2px `focus-within:ring-2 focus-within:ring-ring`.
 */
export function SubjectsSearch({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (next: string) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 transition-colors focus-within:border-foreground focus-within:ring-1 focus-within:ring-foreground/40",
      )}
    >
      <MagnifyingGlass
        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
        weight="bold"
        aria-hidden
      />
      <input
        type="search"
        inputMode="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search subjects"
        aria-label="Search subjects"
        className="min-w-0 flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
        >
          <X className="h-3 w-3" weight="bold" />
        </button>
      )}
    </div>
  );
}
