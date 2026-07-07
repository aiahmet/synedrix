"use client";

import { motion, useReducedMotion } from "motion/react";

import { Section, SectionHeading } from "@/components/landing/ui/Section";
import { designPrinciples } from "@/components/landing/data";

interface PrincipleExtra {
  readonly do: readonly string[];
  readonly avoid: readonly string[];
}

const EXTRAS: Record<typeof designPrinciples[number]["title"], PrincipleExtra> = {
  Color: {
    do: [
      "One strong accent for primary actions.",
      "Subject hues used only as categorical labels.",
      "Token-based palette switches with theme.",
    ],
    avoid: [
      "Multiple accents competing for attention.",
      "Pure #000000 for backgrounds.",
      "AI-style neon blue or purple gradients.",
    ],
  },
  Typography: {
    do: [
      "Geist for the interface.",
      "Geist Mono for stats, formulas, code.",
      "Compact scale with clear hierarchy.",
    ],
    avoid: [
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
    avoid: [
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
    avoid: [
      "Linear easing on transitions.",
      "Decorative marquees that obscure content.",
      "Animations that block on generation.",
    ],
  },
};

/**
 * Design section.
 *
 * 2x2 card grid to break the divide-y repetition across sections
 * on the page (TechStack uses the divide-y pattern, Architecture
 * uses a 50/50 + bento, so DesignSection uses a 2x2 grid).
 *
 * Each card carries:
 *   - Native icon (no container, no halo)
 *   - H3 title
 *   - Short description
 *   - "Do" list: intentional decisions in text-foreground
 *   - "Avoid" list: lazy defaults in muted-foreground with line-through
 *
 * No double-bezel chrome, no icon containers, no halo blobs, no
 * decorative dots, no eyebrow (eyebrow budget is rationed).
 *
 * Single-layer card across each grid cell. Two columns on desktop,
 * single column on mobile.
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
              Calm, serious, compact, fast. One strong accent, optical
              hierarchy instead of decorative chrome. No generic AI
              gradients, no gamified rewards, no trophies for clicking
              a button.
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
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{
                duration: 0.55,
                delay: i * 0.05,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="flex h-full flex-col rounded-2xl border border-border bg-surface-elevated p-6 transition-colors duration-300 hover:border-foreground/25 sm:p-7"
            >
              <div className="flex items-center gap-3">
                <principle.icon
                  className="h-5 w-5 shrink-0 text-foreground"
                  weight="duotone"
                  aria-hidden
                />
                <h3 className="text-[16px] font-semibold leading-snug tracking-[-0.005em] text-foreground">
                  {principle.title}
                </h3>
              </div>

              <p className="mt-2.5 text-[13px] leading-[1.55] text-muted-foreground">
                {principle.description}
              </p>

              <div className="mt-5 grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2.5">
                  <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-foreground">
                    Do
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {extra?.do.map((d) => (
                      <li
                        key={d}
                        className="text-[12.5px] leading-[1.55] text-foreground"
                      >
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-col gap-2.5">
                  <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
                    Avoid
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {extra?.avoid.map((d) => (
                      <li
                        key={d}
                        className="text-[12.5px] leading-[1.55] text-muted-foreground/60 line-through decoration-muted-foreground/30"
                      >
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </Section>
  );
}
