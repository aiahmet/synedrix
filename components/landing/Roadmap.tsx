"use client";

import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils/cn";
import { Section, SectionHeading } from "@/components/landing/ui/Section";
import { roadmapPhases } from "@/components/landing/data";
import { Check } from "@/components/landing/icons";

const STATUS_LABEL: Record<typeof roadmapPhases[number]["status"], string> = {
  complete: "Complete",
  "in-progress": "In progress",
  planned: "Planned",
};

const STATUS_TONE: Record<typeof roadmapPhases[number]["status"], string> = {
  complete: "bg-accent text-accent-foreground",
  "in-progress":
    "bg-accent-subtle text-accent ring-1 ring-accent/30",
  planned: "bg-surface text-muted-foreground ring-1 ring-border",
};

const STATUS_BAR: Record<typeof roadmapPhases[number]["status"], string> = {
  complete: "bg-accent",
  "in-progress": "bg-accent/40",
  planned: "bg-border",
};

/**
 * Roadmap timeline.
 *
 * Each phase is its own row with a left rail that expresses phase
 * progress through the meter fill. The rail carries the status
 * circle plus the phase label. Headlines are the phase names
 * themselves; we deliberately skipped &ldquo;Phase 01 / Phase 02&rdquo;
 * because those add nothing the headline does not already say.
 *
 * Milestone chips render as a single horizontal flex that wraps
 * calmly when the row is narrow.
 */
export function Roadmap() {
  const reduce = useReducedMotion() ?? false;

  return (
    <Section
      id="roadmap"
      ariaLabelledBy="roadmap-title"
      className="py-24 sm:py-32"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      >
        <SectionHeading
          titleId="roadmap-title"
          title={
            <>
              Built in phases,
              <br />
              the loop first.
            </>
          }
          description={
            <>
              Foundation funds the loop. The loop ships it. Every later phase
              reinforces the loop without rewriting it. No piling in features
              until the core workflow works exceptionally.
            </>
          }
        />
      </motion.div>

      <ol className="mt-14 grid grid-cols-1 gap-3 rounded-2xl border border-border bg-surface p-1.5 sm:gap-0">
        {roadmapPhases.map((item, i) => {
          const isComplete = item.status === "complete";
          const isLast = i === roadmapPhases.length - 1;
          return (
            <motion.li
              key={item.label}
              initial={reduce ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{
                duration: 0.55,
                delay: i * 0.06,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={cn(
                "relative flex flex-col gap-4 rounded-[14px] bg-surface-elevated p-5 sm:flex-row sm:items-start sm:gap-6 sm:p-6",
                !isLast && "sm:border-b sm:border-border/40"
              )}
            >
              <div className="flex shrink-0 items-start gap-3 sm:flex-col sm:items-center sm:gap-3">
                <span
                  aria-hidden
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-semibold transition-colors",
                    STATUS_TONE[item.status]
                  )}
                >
                  {isComplete ? (
                    <Check className="h-4 w-4" weight="bold" />
                  ) : (
                    <span className="font-mono">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  )}
                </span>
                <div className="flex h-2 w-full min-w-[120px] items-center overflow-hidden rounded-full bg-border sm:h-2 sm:w-24">
                  <span
                    className={cn("h-full transition-all duration-700", STATUS_BAR[item.status])}
                    style={{
                      width:
                        item.status === "complete"
                          ? "100%"
                          : item.status === "in-progress"
                            ? "55%"
                            : "12%",
                    }}
                  />
                </div>
                <span
                  className={cn(
                    "inline-flex rounded-full px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.14em]",
                    STATUS_TONE[item.status]
                  )}
                >
                  {STATUS_LABEL[item.status]}
                </span>
              </div>

              <div className="flex-1">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">
                  {item.label}
                </p>
                <h3 className="mt-1 text-pretty text-[19px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
                  {item.title}
                </h3>
                <p className="mt-1.5 max-w-prose text-[13.5px] leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
                <ul className="mt-4 flex flex-wrap gap-1.5">
                  {item.milestones.map((m) => (
                    <li
                      key={m}
                      className="rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                    >
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </Section>
  );
}
