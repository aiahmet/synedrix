"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils/cn";
import { Section, SectionHeading } from "@/components/landing/ui/Section";
import { dataEntities } from "@/components/landing/data";

const TIER_LABEL: Record<typeof dataEntities[number]["tier"], string> = {
  canonical: "Canonical",
  progress: "Progress",
  telemetry: "Telemetry",
};

type FilterId = "all" | typeof dataEntities[number]["tier"];
const FILTERS: readonly { readonly id: FilterId; readonly label: string }[] = [
  { id: "all", label: "All tiers" },
  { id: "canonical", label: "Canonical" },
  { id: "progress", label: "Progress" },
  { id: "telemetry", label: "Telemetry" },
];

/**
 * Data model section.
 *
 * The single most important architectural decision in the app is the
 * strict split between canonical curriculum data and per-user progress.
 * We expose the entity list as a real spec table, not a card grid:
 *
 *   - One row per table. Hairline divider between rows.
 *   - Mono entity name, plain uppercase tier label, prose purpose.
 *   - No carded rows, no pill tier chips, no nested chrome.
 *
 * The tier filter is an inline text-link control, not a button. The
 * active state is the underline + foreground text; a filled pill
 * would compete with the table rows for visual weight.
 *
 * The per-row tier label is kept on single-tier filters for stable
 * table structure. The redundancy is a deliberate trade for column
 * consistency.
 */
export function DataModel() {
  const reduce = useReducedMotion() ?? false;
  const [filter, setFilter] = useState<FilterId>("all");

  const visible =
    filter === "all"
      ? dataEntities
      : dataEntities.filter((e) => e.tier === filter);

  return (
    <Section
      id="data-model"
      ariaLabelledBy="data-model-title"
      className="py-24 sm:py-32"
    >
      <SectionHeading
        titleId="data-model-title"
        eyebrow={
          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Data model
          </span>
        }
        title={
          <>
            Thirteen tables.
            <br />
            One strict split.
          </>
        }
        description={
          <>
            Canonical curriculum content never shares a table with
            per-user progress. AI generation telemetry sits in its
            own tier so the AI pipeline can be debugged independently
            from user state.
          </>
        }
      />

      <div className="mt-10 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3 border-b border-border pb-4">
        <div
          role="radiogroup"
          aria-label="Filter by tier"
          className="flex flex-wrap items-baseline gap-x-5 gap-y-2"
        >
          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
            Tier
          </span>
          {FILTERS.map((f) => {
            const active = f.id === filter;
            return (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setFilter(f.id)}
                // `py-1` grows the tap target above the 24x24 WCAG AA
                // minimum without adding visible chrome.
                className={cn(
                  "border-b py-1 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <p className="font-mono text-[11.5px] text-muted-foreground/80">
          {visible.length} of {dataEntities.length} tables
        </p>
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <ul role="list" className="divide-y divide-border">
          {visible.map((entity) => (
            <EntityRow key={entity.name} entity={entity} />
          ))}
        </ul>
      </motion.div>
    </Section>
  );
}

function EntityRow({
  entity,
}: {
  readonly entity: (typeof dataEntities)[number];
}) {
  return (
    // Mobile: name + tier share row 1 (auto + 1fr), purpose spans the
    // full width on row 2. Desktop: the 3-column grid takes over and
    // `sm:col-span-1` collapses the purpose back to a single column.
    <li className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 py-4 sm:grid-cols-[10rem_7.5rem_1fr] sm:gap-x-6 sm:gap-y-0 sm:py-3.5">
      <p className="font-mono text-[13px] font-medium tracking-[-0.005em] text-foreground">
        {entity.name}
      </p>
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
        {TIER_LABEL[entity.tier]}
      </p>
      <p className="col-span-2 text-[13px] leading-[1.55] text-muted-foreground sm:col-span-1">
        {entity.purpose}
      </p>
    </li>
  );
}
