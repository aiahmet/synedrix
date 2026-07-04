"use client";

import { motion, useReducedMotion } from "motion/react";

import { Section, SectionHeading } from "@/components/landing/ui/Section";
import { designPrinciples } from "@/components/landing/data";

interface PrincipleExtra {
  readonly do: readonly string[];
  readonly dont: readonly string[];
}

const EXTRAS: Record<typeof designPrinciples[number]["title"], PrincipleExtra> = {
  Color: {
    do: [
      "One strong accent for primary actions.",
      "Subject hues used only as categorical labels.",
      "Token-based palette switches with theme.",
    ],
    dont: [
      "Multiple accents competing for attention.",
      "Pure #000000 for backgrounds.",
      "AI-style neon blue/purple gradients.",
    ],
  },
  Typography: {
    do: [
      "Geist for the interface.",
      "Geist Mono for stats, formulas, code.",
      "Compact scale with clear hierarchy.",
    ],
    dont: [
      "Inter as default.",
      "Oversized hero type in the app shell.",
      "All-caps subheaders everywhere.",
    ],
  },
  Layout: {
    do: [
      "Persistent sidebar for navigation.",
      "One vertical scroll region.",
      "Resizable tutor panel on large screens.",
    ],
    dont: [
      "Three equal Bootstrap-style columns.",
      "Edge-to-edge scroll-locked navbars.",
      "max-width stretching past 1400px.",
    ],
  },
  Motion: {
    do: [
      "Spring physics for interactive state.",
      "Always explain hierarchy or feedback.",
      "Honor prefers-reduced-motion.",
    ],
    dont: [
      "Linear easing on transitions.",
      "Decorative marquees that obscure content.",
      "Animations that block on generation.",
    ],
  },
};

/**
 * Design philosophy.
 *
 * Returns to a quiet two-column-by-two-card layout, which is appropriate
 * for conceptual content. Each card carries a mini do-list and a
 * dont-list so visitors see the difference between the intentional
 * decisions and the lazy defaults.
 *
 * Double-bezel pattern applied to every card so the page never has a
 * raw flat rectangle inside the section.
 */
export function DesignSection() {
  const reduce = useReducedMotion() ?? false;

  return (
    <Section
      id="design"
      ariaLabelledBy="design-title"
      className="py-24 sm:py-32"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      >
        <SectionHeading
          titleId="design-title"
          title={
            <>
              A disciplined
              <br />
              study cockpit.
            </>
          }
          description={
            <>
              Calm, serious, compact, fast. Neutral surfaces, one strong accent,
              optical hierarchy rather than decorative chrome. No generic AI
              gradients, no cartoon gamification, no trophies for clicking a
              button.
            </>
          }
        />
      </motion.div>

      <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
        {designPrinciples.map((principle, i) => {
          const extra = EXTRAS[principle.title];
          return (
            <motion.article
              key={principle.title}
              initial={reduce ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{
                duration: 0.6,
                delay: i * 0.06,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-surface p-1.5 transition-all duration-500 hover:border-border"
            >
              <div className="relative h-full rounded-[14px] border border-border/60 bg-surface-elevated p-6 inner-highlight sm:p-7">
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[var(--halo-3)] opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-100"
                />
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 ring-1 ring-accent/10">
                  <principle.icon
                    className="h-5 w-5 text-accent"
                    weight="duotone"
                  />
                </div>
                <h3 className="relative mt-4 text-[17px] font-semibold tracking-[-0.01em] text-foreground">
                  {principle.title}
                </h3>
                <p className="relative mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  {principle.description}
                </p>

                {extra && (
                  <div className="relative mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <ul className="space-y-1.5">
                      {extra.do.map((d) => (
                        <li
                          key={d}
                          className="flex items-start gap-2 text-[12px] text-foreground"
                        >
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                          {d}
                        </li>
                      ))}
                    </ul>
                    <ul className="space-y-1.5">
                      {extra.dont.map((d) => (
                        <li
                          key={d}
                          className="flex items-start gap-2 text-[12px] text-muted-foreground line-through decoration-subject-french/40"
                        >
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.article>
          );
        })}
      </div>
    </Section>
  );
}
