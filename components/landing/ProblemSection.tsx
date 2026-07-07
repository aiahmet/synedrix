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
 * The narrow first column carries a 5-7-line text-heavy pillar so we
 * do not repeat the same shape three times. The middle column carries
 * the operating-thesis pillar. The final full-width row carries the
 * "insight, not vanity" pillar with a side band.
 *
 * Rulebook-driven decisions:
 *   - No numbered pill chips (01 / 02 / 03). The design-taste-frontend
 *     rulebook bans section-numbering eyebrows (`00 / INDEX`,
 *     `06 / how it works`), and the SYNEDRIX-FRONTEND-STYLE rulebook
 *     bans pill/track chips on marketing surfaces. The titles name
 *     the pillars; enumeration is redundant and reads as templated.
 *   - No halo blob on hover. Halos (`bg-[var(--halo-N)] blur-3xl`
 *     floating gradients) are banned by both rulebooks. The cards'
 *     single-layer chrome (border + bg-surface-elevated) is the
 *     entire visual treatment; the hover state is a subtle
 *     border-color shift only.
 *   - Asymmetric 5/7/12 grid preserved. The asymmetric spans are the
 *     reason this section reads as editorial, not as a row of three
 *     identical feature cards. The narrow first pillar forces the
 *     eye to read across the row, not down a column.
 *   - No eyebrow above the H2. The centered title already names the
 *     section's topic, and the page-wide eyebrow budget is rationed
 *     (Surfaces carries the only eyebrow in this run of sections).
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
              "group rounded-2xl border border-border bg-surface-elevated p-6 transition-colors duration-200 hover:border-border/70 sm:p-7 " +
              (i === 0
                ? "sm:col-span-5"
                : i === 1
                  ? "sm:col-span-7"
                  : "sm:col-span-12")
            }
          >
            <h3 className="text-pretty text-[18px] font-semibold leading-snug tracking-[-0.01em] text-foreground">
              {pillar.title}
            </h3>
            <p className="mt-2 max-w-prose text-[14px] leading-relaxed text-muted-foreground">
              {pillar.description}
            </p>
          </motion.li>
        ))}
      </ul>
    </Section>
  );
}
