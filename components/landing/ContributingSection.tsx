"use client";

import { motion, useReducedMotion } from "motion/react";

import { Section } from "@/components/landing/ui/Section";
import { ArrowRight, ArrowUpRight } from "@/components/landing/icons";

const steps = [
  "Fork the repository.",
  "Cut a feature branch with a conventional name.",
  "Commit with a conventional commit message.",
  "Push the branch and open a pull request.",
] as const;

/**
 * Contributing section.
 *
 * Structural rewrite per the polish-vs-structure protocol
 * (docs/SYNEDRIX-FRONTEND-STYLE.md):
 *
 * The previous version shipped a halo blob on the guide
 * card, a triple-nested card (outer border ring around
 * inner border ring around a padded box), carded list rows
 * inside the step list, icon containers on the action
 * links, a hardcoded `rgba(13,148,136,0.25)` shadow on
 * the primary action, section-numbered steps ("01", "02",
 * "03", "04"), and an accent-colored eyebrow.
 * Every one of those patterns is banned by the style
 * rulebook.
 *
 * The structural fix:
 *   - Single editorial column (no 7/5 grid split).
 *   - One single-layer guide card with clean typography
 *     and plain-numbered steps (no carded rows).
 *   - Inline CTAs at the card bottom: one primary accent
 *     button ("View the repository"), one secondary
 *     border button ("Report a bug"), and one ghost link
 *     ("Read the full guide").
 *   - Closing trust line matching the pattern from the
 *     FaqSection and FinalCTA: a GitHub Discussions link
 *     + a small licence line.
 *   - No halos, no dot grids, no icon containers, no
 *     hardcoded teal shadows, no section-numbered steps,
 *     no accent-colored eyebrow.
 *   - Entrance motion preserved; reduced-motion users
 *     collapse to the end state.
 */
export function ContributingSection() {
  const reduce = useReducedMotion() ?? false;

  return (
    <Section
      id="contributing"
      ariaLabelledBy="contributing-title"
      className="py-24 sm:py-32"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      >
        <h2
          id="contributing-title"
          className="text-[clamp(1.95rem,2.4vw+0.5rem,2.75rem)] font-semibold leading-[1.04] tracking-[-0.024em] text-foreground"
        >
          Open source,
          <br />
          open to contributions.
        </h2>
      </motion.div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{
          duration: 0.6,
          delay: 0.05,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="mt-14 rounded-2xl border border-border bg-surface-elevated p-7 sm:p-8"
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          How to contribute
        </p>

        <h3 className="mt-2 text-pretty text-[22px] font-semibold tracking-[-0.01em] text-foreground">
          A short contribution guide.
        </h3>

        <p className="mt-3 max-w-prose text-[14px] leading-relaxed text-muted-foreground">
          The codebase favors small, focused PRs. Bug fixes ship in hours.
          New features ship in conversation first, then code. AI prompting
          changes need to ship with an AiGeneration telemetry row proving
          schema validation still passes.
        </p>

        <ol className="mt-6 space-y-2">
          {steps.map((step, idx) => (
            <li key={step} className="flex items-start gap-3">
              <span className="mt-0.5 font-mono text-[11.5px] tabular-nums text-muted-foreground">
                {idx + 1}.
              </span>
              <span className="text-[13.5px] text-foreground">{step}</span>
            </li>
          ))}
        </ol>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <a
            href="https://github.com/aiahmet/synedrix"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-[13px] font-medium text-accent-foreground outline-none transition-colors hover:bg-accent/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated"
          >
            View the repository
            <ArrowUpRight className="h-3 w-3" weight="bold" />
          </a>
          <a
            href="https://github.com/aiahmet/synedrix/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-background px-4 text-[13px] font-medium text-foreground outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated"
          >
            Report a bug
            <ArrowUpRight className="h-3 w-3" weight="bold" />
          </a>
          <a
            href="https://github.com/aiahmet/synedrix/blob/main/CONTRIBUTING.md"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-1.5 px-2 text-[13px] font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated"
          >
            Read the full guide
            <ArrowRight className="h-3 w-3" weight="bold" />
          </a>
        </div>
      </motion.div>

      <div className="mt-6 flex flex-col gap-1.5 border-t border-border pt-6">
        <a
          href="https://github.com/aiahmet/synedrix/blob/main/LICENSE"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex w-fit items-center gap-1.5 text-[12.5px] font-medium text-foreground outline-none transition-colors hover:text-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          MIT licensed
          <ArrowRight
            className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
            weight="bold"
          />
        </a>
        <p className="text-[11.5px] text-muted-foreground/80">
          Self-host or use the hosted instance. Pull requests welcome.
        </p>
      </div>
    </Section>
  );
}
