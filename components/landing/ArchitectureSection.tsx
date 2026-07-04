"use client";

import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils/cn";
import { Section, SectionHeading } from "@/components/landing/ui/Section";
import { Eyebrow } from "@/components/landing/ui/Eyebrow";
import {
  architectureCards,
  engineeringPillars,
} from "@/components/landing/data";

/**
 * Architecture section.
 *
 * Layout family: asymmetric zig-zag on the upper half (two primary
 * cards, 50/50) plus a six-cell engineering pillar band beneath (a
 * deliberately different rhythm so the page never stacks two equal
 * grids back to back).
 *
 * The two primary cards each carry a real Convex snippet pulled from
 * the architectural philosophy in the spec. The first demonstrates
 * canonical vs per-user progress. The second demonstrates AI
 * structured output with telemetry.
 */
export function ArchitectureSection() {
  const reduce = useReducedMotion() ?? false;

  return (
    <Section
      id="architecture"
      ariaLabelledBy="architecture-title"
      className="py-24 sm:py-32"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      >
        <SectionHeading
          titleId="architecture-title"
          eyebrow={<Eyebrow tone="accent">Architecture</Eyebrow>}
          title={
            <>
              Built with explicit
              <br />
              engineering standards.
            </>
          }
          description={
            <>
              Strict boundaries, type safety, and modern Next.js 16 paradigms
              keep Synedrix maintainable by one person for the long term. The
              code samples below are real Convex + Vercel AI SDK shapes that
              ship in the app.
            </>
          }
        />
      </motion.div>

      <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
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
            className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-1.5 transition-all duration-500 hover:border-border/70 hover:shadow-[var(--shadow-soft)]"
          >
            <div className="relative flex h-full flex-col rounded-[14px] border border-border/60 bg-surface-elevated p-6 inner-highlight sm:p-7">
              <span
                aria-hidden
                className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[var(--halo-2)] opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-100"
              />
              <div className="relative">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 ring-1 ring-accent/10">
                  <card.icon className="h-5 w-5 text-accent" weight="duotone" />
                </div>
                <span className="mt-5 inline-flex rounded-full border border-border/60 bg-surface px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {card.tag}
                </span>
                <h3 className="mt-3 text-pretty text-[19px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
                  {card.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                  {card.description}
                </p>

                <div className="mt-5 flex flex-wrap gap-1.5">
                  {card.entities.map((entity) => (
                    <span
                      key={entity}
                      className="rounded-md border border-border bg-surface px-2.5 py-1 font-mono text-[11px] font-medium text-muted-foreground"
                    >
                      {entity}
                    </span>
                  ))}
                </div>

                <div className="mt-5 overflow-hidden rounded-xl border border-border bg-surface">
                  <div className="flex items-center justify-between border-b border-border bg-surface-elevated px-3 py-2">
                    <span className="font-mono text-[10.5px] text-muted-foreground">
                      {card.tag === "Data modeling" ? "convex/queries.ts" : "lib/ai/quiz.ts"}
                    </span>
                    <div className="flex gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-border" />
                      <span className="h-1.5 w-1.5 rounded-full bg-border" />
                      <span className="h-1.5 w-1.5 rounded-full bg-border" />
                    </div>
                  </div>
                  <pre className="overflow-x-auto p-4 font-mono text-[11.5px] leading-relaxed text-muted-foreground">
                    <code>{card.code}</code>
                  </pre>
                </div>
              </div>
            </div>
          </motion.article>
        ))}
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-5">
        {engineeringPillars.map((pillar, i) => (
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
              "group relative overflow-hidden rounded-2xl border border-border bg-surface-elevated p-5 transition-all duration-500 hover:border-border/70 hover:shadow-[var(--shadow-soft)] sm:p-6",
              pillar.span
            )}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[var(--halo-3)] opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-100"
            />
            <div className="relative flex h-full flex-col">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 ring-1 ring-accent/10">
                <pillar.icon className="h-5 w-5 text-accent" weight="duotone" />
              </div>
              <h3 className="mt-3 text-pretty text-[15.5px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
                {pillar.title}
              </h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                {pillar.description}
              </p>
            </div>
          </motion.li>
        ))}
      </ul>
    </Section>
  );
}
