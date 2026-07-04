"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils/cn";
import { Section, SectionHeading } from "@/components/landing/ui/Section";
import { dataEntities } from "@/components/landing/data";

const TIER_LABEL: Record<typeof dataEntities[number]["tier"], string> = {
  canonical: "Canonical",
  progress: "Per-user progress",
  telemetry: "Telemetry",
};

const TIER_TONE: Record<typeof dataEntities[number]["tier"], string> = {
  canonical:
    "border-accent-border/60 bg-accent-subtle/40 text-accent",
  progress:
    "border-subject-physics/30 bg-subject-physics/10 text-subject-physics",
  telemetry:
    "border-subject-math/30 bg-subject-math/10 text-subject-math",
};

type FilterId = "all" | typeof dataEntities[number]["tier"];
const FILTERS: readonly { readonly id: FilterId; readonly label: string }[] = [
  { id: "all", label: "All entities" },
  { id: "canonical", label: "Canonical" },
  { id: "progress", label: "Progress" },
  { id: "telemetry", label: "Telemetry" },
];

/**
 * Data model section.
 *
 * The single most important architectural decision in the app is the
 * split between canonical curriculum data and per-user progress.
 * We expose that decision as a filterable table of the real entity
 * list pulled directly from the spec, so the visitor can see the
 * shape of what the system actually stores.
 *
 * The filter is a controlled state with explicit tab semantics. Reduced
 * motion users skip the staggered reveal of the cards.
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
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      >
        <SectionHeading
          titleId="data-model-title"
          title={
            <>
              Thirteen tables, one
              <br />
              strict split.
            </>
          }
          description={
            <>
              Canonical curriculum content never shares a table with the
              per-user progress tables. AiGeneration telemetry sits in its
              own tier so the AI pipeline can be debugged independently
              from user state. Filter by tier to see what lives where.
            </>
          }
        />
      </motion.div>

      <div
        role="tablist"
        aria-label="Filter by tier"
        className="mt-10 inline-flex flex-wrap items-center gap-1 rounded-full border border-border bg-surface p-1"
      >
        {FILTERS.map((f) => {
          const active = f.id === filter;
          return (
            <button
              key={f.id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                active
                  ? "bg-surface-elevated text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <ul className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {visible.map((entity, i) => (
          <motion.li
            key={entity.name}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.4,
              delay: i * 0.04,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="group flex items-start gap-3 rounded-xl border border-border bg-surface-elevated p-4 transition-colors duration-200 hover:border-border/70"
          >
            <span
              className={cn(
                "mt-0.5 inline-flex h-6 items-center rounded-md border px-2 font-mono text-[9.5px] font-medium uppercase tracking-[0.1em]",
                TIER_TONE[entity.tier]
              )}
            >
              {TIER_LABEL[entity.tier]}
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[13.5px] font-medium text-foreground">
                {entity.name}
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                {entity.purpose}
              </p>
            </div>
          </motion.li>
        ))}
      </ul>
    </Section>
  );
}
