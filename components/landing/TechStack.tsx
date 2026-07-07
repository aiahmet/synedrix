"use client";

import { motion, useReducedMotion } from "motion/react";

import { Section, SectionHeading } from "@/components/landing/ui/Section";
import { techStack } from "@/components/landing/data";
import type { TechStackItem } from "@/components/landing/data";
import type { PhosphorIcon } from "@/components/landing/icons";
import {
  Brain,
  Cube,
  Database,
  FlowArrow,
  Key,
  Palette,
  PencilLine,
  Pulse,
} from "@/components/landing/icons";

/**
 * Per-category icon mapping so the row identity is carried by a
 * native Phosphor glyph instead of a numbered badge. The numbered
 * badges (TONE array, 01-08) were section-numbering eyebrows
 * (design-taste §9.F), the "LAYER" micro-label above each category
 * was eyebrow abuse (eight cosmetic labels on one surface, §4.7),
 * and the pill capability chips (rounded-full bg-accent/12) were
 * pill/track eyebrow chips (rulebook §1). All three are removed.
 *
 * Each row now carries four pieces of typography:
 *   - col-span-4: native icon + category name (bold)
 *   - col-span-5: description
 *   - col-span-3: tool name (mono) + capability verb (muted mono)
 *
 * The container is a single editorial column (one outer border,
 * divide-y, bg-surface-elevated) matching the DesignSection and
 * ArchitectureSection patterns. The rows are not individually
 * carded; hover shows a subtle bg-surface tint only.
 */
const ICON_BY_CATEGORY: Record<TechStackItem["category"], PhosphorIcon> = {
  Framework: Cube,
  Database: Database,
  Styling: Palette,
  "AI Engine": Brain,
  Authentication: Key,
  State: FlowArrow,
  Editors: PencilLine,
  Observability: Pulse,
};

/**
 * Tech stack section.
 *
 * Eight categories, eight rows. The stack is functional reference
 * information, not a feature grid, so the editorial divide-y
 * column is the right container. Each row shows what the layer is,
 * what it does, and which concrete tool ships.
 */
export function TechStack() {
  const reduce = useReducedMotion() ?? false;

  return (
    <Section
      id="stack"
      ariaLabelledBy="stack-title"
      className="py-24 sm:py-32"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      >
        <SectionHeading
          titleId="stack-title"
          title={
            <>
              A modern stack
              <br />
              chosen for type safety.
            </>
          }
          description={
            <>
              Every layer is chosen for one job. Type safety, realtime data,
              structured AI outputs, predictable caching. No community-trap
              libraries that ship a breaking change every Friday.
            </>
          }
        />
      </motion.div>

      <ul className="mt-14 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border bg-surface-elevated">
        {techStack.map((item, i) => {
          const Icon = ICON_BY_CATEGORY[item.category] ?? Cube;
          return (
            <motion.li
              key={item.category}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{
                duration: 0.5,
                delay: i * 0.04,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="grid grid-cols-1 gap-4 p-6 transition-colors duration-200 hover:bg-surface sm:grid-cols-12 sm:items-center sm:gap-7 sm:p-7"
            >
              <div className="flex items-center gap-3 sm:col-span-4">
                <Icon
                  className="h-5 w-5 shrink-0 text-foreground"
                  weight="duotone"
                  aria-hidden
                />
                <p className="text-[15px] font-semibold tracking-tight text-foreground">
                  {item.category}
                </p>
              </div>

              <p className="text-[13.5px] leading-[1.55] text-muted-foreground sm:col-span-5">
                {item.description}
              </p>

              <div className="flex items-center gap-2.5 sm:col-span-3 sm:justify-end">
                <span className="font-mono text-[11.5px] text-foreground">
                  {item.toolName}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground/60">
                  {item.capability}
                </span>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </Section>
  );
}
