"use client";

import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils/cn";
import { Section } from "@/components/landing/ui/Section";
import {
  architectureCards,
  engineeringPillars,
} from "@/components/landing/data";

/**
 * Architecture section.
 *
 * Two structurally distinct regions:
 *
 *   1. Two primary code cards (50/50 on desktop). Each card carries a
 *      real Convex + Vercel AI SDK snippet that ships in the app.
 *      Single-layer chrome per the style guide: one `rounded-xl
 *      border bg-background p-7` and a layered shadow. No halo
 *      blobs, no triple-nested rings, no `bg-accent/10 ring-1`
 *      icon containers, no `rounded-full` tag chips, and no fake
 *      macOS window dots on the code-block header.
 *
 *   2. A six-cell engineering-pillar bento. Cells alternate
 *      `bg-background` and `bg-surface-elevated` so the grid reads
 *      with rhythm, not as six identical cards. Feature cells
 *      (col-span 4 or 5) carry a bigger icon and a roomier title
 *      scale; compact cells (col-span 3) stay small. This satisfies
 *      the design bento-background-diversity rule and breaks the
 *      "stack of equal cards" pattern.
 *
 * The eyebrow is a plain uppercase muted label rather than the
 * shared `Eyebrow` pill component, because the rulebook bans
 * pill/track eyebrow chips (style guide §1). The shared `Eyebrow`
 * is the next surface to retire in a separate pass.
 */
export function ArchitectureSection() {
  const reduce = useReducedMotion() ?? false;

  return (
    <Section
      id="architecture"
      ariaLabelledBy="architecture-title"
      className="bg-surface py-24 sm:py-32"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col gap-4"
      >
        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Architecture
        </span>
        <h2
          id="architecture-title"
          className="text-[clamp(1.95rem,2.4vw+0.5rem,2.75rem)] font-semibold leading-[1.04] tracking-[-0.024em] text-foreground"
        >
          Built with explicit
          <br />
          engineering standards.
        </h2>
        <p className="mt-1 max-w-xl text-[15px] leading-[1.55] text-muted-foreground sm:text-[16px]">
          Strict boundaries, type safety, and modern Next.js 16 paradigms
          keep Synedrix maintainable by one person for the long term. The
          code samples below are real Convex + Vercel AI SDK shapes that
          ship in the app.
        </p>
      </motion.div>

      <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
        {architectureCards.map((card, i) => (
          <motion.article
            key={card.title}
            initial={reduce ? false : { opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{
              duration: 0.65,
              delay: i * 0.06,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="flex h-full flex-col rounded-xl border border-border bg-background p-7 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.08)] transition-colors hover:border-foreground/30 sm:p-8 dark:shadow-[0_1px_0_0_rgb(255_255_255_/_0.05),0_8px_24px_-12px_rgba(0,0,0,0.45)]"
          >
            <div className="flex items-center justify-between gap-4">
              <card.icon
                className="h-5 w-5 shrink-0 text-foreground"
                weight="duotone"
                aria-hidden
              />
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
                {card.tag}
              </span>
            </div>

            <h3 className="mt-5 text-pretty text-[19px] font-semibold leading-[1.15] tracking-[-0.01em] text-foreground">
              {card.title}
            </h3>
            <p className="mt-2 text-[14.5px] leading-[1.55] text-muted-foreground">
              {card.description}
            </p>

            <p className="mt-5 font-mono text-[12px] leading-[1.65] text-muted-foreground">
              {card.entities.join(", ")}
            </p>

            <div className="mt-5 overflow-hidden rounded-lg border border-border bg-surface">
              <div className="flex items-center justify-between border-b border-border bg-surface-elevated px-3.5 py-2">
                <span className="font-mono text-[10.5px] text-muted-foreground">
                  {card.filename}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
                  {card.codeMeta}
                </span>
              </div>
              <pre className="overflow-x-auto p-4 font-mono text-[11.5px] leading-[1.65] text-muted-foreground">
                <code>{card.code}</code>
              </pre>
            </div>
          </motion.article>
        ))}
      </div>

      <ul className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-12 md:gap-6 [grid-auto-flow:dense]">
        {engineeringPillars.map((pillar, i) => {
          // Feature cells (col-span 4 or 5) carry more weight in the
          // bento; compact cells (col-span 3) stay small. The span
          // string comes from the data layer.
          const isFeature =
            pillar.span.includes("col-span-4") ||
            pillar.span.includes("col-span-5");
          // Alternate background tint so the bento reads with rhythm,
          // not as six identical cards. Recessed = bg-background,
          // elevated = bg-surface-elevated.
          const isRecessed = i % 2 === 0;
          return (
            <motion.li
              key={pillar.title}
              initial={reduce ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{
                duration: 0.55,
                delay: i * 0.05,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={cn(
                "flex h-full flex-col rounded-xl border border-border transition-colors hover:border-foreground/30",
                pillar.span,
                isRecessed ? "bg-background" : "bg-surface-elevated",
                isFeature ? "p-7 sm:p-8" : "p-6 sm:p-7"
              )}
            >
              <pillar.icon
                className={cn(
                  "shrink-0 text-foreground",
                  isFeature ? "h-6 w-6" : "h-5 w-5"
                )}
                weight="duotone"
                aria-hidden
              />
              <h3
                className={cn(
                  "mt-5 text-pretty font-semibold leading-[1.2] tracking-[-0.01em] text-foreground",
                  isFeature ? "text-[18px]" : "text-[15.5px]"
                )}
              >
                {pillar.title}
              </h3>
              <p
                className={cn(
                  "mt-2 text-muted-foreground",
                  isFeature
                    ? "text-[14px] leading-[1.55]"
                    : "text-[13px] leading-[1.55]"
                )}
              >
                {pillar.description}
              </p>
            </motion.li>
          );
        })}
      </ul>
    </Section>
  );
}
