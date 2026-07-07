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
 * Structural rewrite, not polish. The previous version was a 2x2 grid
 * of double-bezel cards (outer `border bg-surface p-1.5` wrapping an
 * inner `rounded-[14px] border bg-surface-elevated inner-highlight`)
 * with a `bg-accent/10 ring-1` icon container, a `blur-3xl` halo blob
 * on hover, and decorative `h-1 w-1 rounded-full` status dots on every
 * do/avoid item. Every one of those is explicitly banned by
 * docs/SYNEDRIX-FRONTEND-STYLE.md §1 and the design-taste-frontend
 * skill §9.F, so polishing it would have been a slop-on-slop
 * exercise. The premise was wrong.
 *
 * The new shape follows the TechStack blueprint: a single editorial
 * column made of one `overflow-hidden border bg-surface-elevated
 * divide-y` container. Four rows, four principles, exact cell count.
 * Each row is a 12-column split:
 *
 *   - Identity (col-span 4): native icon, H3, one description line.
 *   - Do (col-span 4): a mono-cap "Do" label + a plain list of the
 *     intentional decisions, in `text-foreground`.
 *   - Avoid (col-span 4): a mono-cap "Avoid" label + a plain list of
 *     the lazy defaults, in muted-foreground with line-through.
 *
 * What was removed and why:
 *
 *   1. The double-bezel card. The rulebook (§1, §5) and the
 *      design-taste skill (§4.4 "Cards omitted in favor of spacing
 *      where possible") both reject triple-nested chrome. The list
 *      IS the surface now; there is no inner padded box.
 *   2. The halo blob. The rulebook (§1, §9) bans halo blobs
 *      outright. Removed with no replacement.
 *   3. The `bg-accent/10 ring-1` icon container. The rulebook (§1,
 *      §8) bans icon containers. The icon now renders at native size
 *      in `text-foreground`, matching ArchitectureSection and
 *      TechStack.
 *   4. The decorative status dots. The design-taste skill §9.F bans
 *      colored dots by default. The do/avoid hierarchy is now
 *      carried by typography: a mono-cap label, line-through on the
 *      avoid items, and contrast through muted-foreground. No dots.
 *   5. The eyebrow. The page already carries an eyebrow on the
 *      architecture section, so dropping it here respects the
 *      "maximum one per three sections" rule and the
 *      design-taste §4.7 "drop it entirely, the headline alone is
 *      enough" default. The H2 "A disciplined study cockpit." is
 *      concrete enough on its own.
 *   6. The `inner-highlight` class. That class was load-bearing for
 *      the inner card chrome; with the double-bezel gone, the class
 *      is not referenced here.
 *   7. Bouncy CTAs were not present, but the hover behavior is now
 *      a quiet `hover:bg-surface` row tint, matching TechStack.
 *
 * Mobile collapse: each row is a single column on `< sm`. The Do and
 * Avoid lists stack under the description. The do/avoid split stays
 * visible as two adjacent blocks within the single column.
 *
 * Style-guide checkpoints:
 *   - no halos, no dot grids, no decorative overlays (rulebook §1, §9) ✓
 *   - editorial H2, manual <br />, tight tracking (§2) ✓
 *   - one accent is reserved for the page-level CTA; this section
 *     uses foreground + muted-foreground + line-through only (§3) ✓
 *   - single-layer card around the divide-y list (§5) ✓
 *   - native icon size, no `bg-accent/10` container (§8) ✓
 *   - eyebrow dropped; H2 carries section identity (§1, §2) ✓
 *   - entrance motion preserved; reduced-motion users collapse to end ✓
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

      <ul className="mt-14 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border bg-surface-elevated">
        {designPrinciples.map((principle, i) => {
          const extra = EXTRAS[principle.title];
          return (
            <motion.li
              key={principle.title}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{
                duration: 0.5,
                delay: i * 0.05,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="grid grid-cols-1 gap-6 p-6 transition-colors duration-200 hover:bg-surface sm:grid-cols-12 sm:items-start sm:gap-7 sm:p-7"
            >
              <div className="flex flex-col gap-3 sm:col-span-4">
                <principle.icon
                  className="h-5 w-5 shrink-0 text-foreground"
                  weight="duotone"
                  aria-hidden
                />
                <h3 className="text-[16px] font-semibold leading-snug tracking-[-0.005em] text-foreground">
                  {principle.title}
                </h3>
                <p className="text-[13px] leading-[1.55] text-muted-foreground">
                  {principle.description}
                </p>
              </div>

              <div className="flex flex-col gap-2.5 sm:col-span-4">
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

              <div className="flex flex-col gap-2.5 sm:col-span-4">
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
            </motion.li>
          );
        })}
      </ul>
    </Section>
  );
}
