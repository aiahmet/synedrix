"use client";

import { motion, useReducedMotion } from "motion/react";

import { Section, SectionHeading } from "@/components/landing/ui/Section";
import { problemPillars } from "@/components/landing/data";

/**
 * Problem section.
 *
 * Three pillars below the headline break the page rhythm from the dense
 * bento and timeline to follow. Spans are intentionally asymmetric:
 * column-5, column-7, column-12. The combination reads as deliberately
 * weighted, never as a row of identical cards.
 *
 * The narrow first column carries a 5-&ndash;-line text-heavy pillar so we
 * do not repeat the same shape three times. The middle column carries
 * the operating-thesis pillar. The final full-width row carries the
 * &ldquo;insight, not vanity&rdquo; pillar with a side band.
 */
export function ProblemSection() {
  const reduce = useReducedMotion();

  return (
    <Section
      id="problem"
      ariaLabelledBy="problem-title"
      className="py-24 sm:py-32"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      >
        <SectionHeading
          titleId="problem-title"
          align="center"
          title={
            <>
              Most study tools fragment
              <br />
              the learning process.
            </>
          }
          description={
            <>
              PDFs, generic chat windows, and isolated flashcard apps scatter
              attention across tabs. Synedrix unifies the curriculum map,
              knowledge workspace, AI tutor, practice engine, and review
              queue into a single state-driven loop. Each system feeds the
              next one, so the tutor already knows what the practice engine
              just tested.
            </>
          }
        />
      </motion.div>

      <ul className="mt-14 grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-12 sm:gap-5">
        {problemPillars.map((pillar, i) => (
          <motion.li
            key={pillar.title}
            initial={reduce ? false : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{
              duration: 0.6,
              delay: i * 0.07,
              ease: [0.16, 1, 0.3, 1],
            }}
            className={
              "group relative overflow-hidden rounded-2xl border border-border bg-surface-elevated p-6 transition-all duration-500 hover:border-border/70 sm:p-7 " +
              (i === 0
                ? "sm:col-span-5"
                : i === 1
                  ? "sm:col-span-7"
                  : "sm:col-span-12")
            }
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[var(--halo-2)] opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-100"
            />
            <div className="relative">
              <span className="inline-flex h-7 items-center rounded-full border border-border/60 bg-surface px-2.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 text-pretty text-[18px] font-semibold leading-snug tracking-[-0.01em] text-foreground">
                {pillar.title}
              </h3>
              <p className="mt-2 max-w-prose text-[14px] leading-relaxed text-muted-foreground">
                {pillar.description}
              </p>
            </div>
          </motion.li>
        ))}
      </ul>
    </Section>
  );
}
