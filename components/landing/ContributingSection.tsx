"use client";

import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils/cn";
import { Section, SectionHeading } from "@/components/landing/ui/Section";
import {
  ArrowUpRight,
  Code,
  GitFork,
} from "@/components/landing/icons";

interface ActionLink {
  readonly label: string;
  readonly description: string;
  readonly href: string;
  readonly icon: typeof GitFork;
  readonly primary: boolean;
}

const actions: readonly ActionLink[] = [
  {
    label: "View the repository",
    description:
      "Browse the source, file issues, or read the README in full from any branch.",
    href: "https://github.com/aiahmet/synedrix",
    icon: GitFork,
    primary: true,
  },
  {
    label: "Open a pull request",
    description:
      "Fork, branch, commit, push. Conventional commits enforced in CI.",
    href: "https://github.com/aiahmet/synedrix/blob/main/CONTRIBUTING.md",
    icon: Code,
    primary: false,
  },
  {
    label: "Report what is broken",
    description:
      "UI bugs, AI regressions, schema-validation failures, accessibility issues.",
    href: "https://github.com/aiahmet/synedrix/issues",
    icon: ArrowUpRight,
    primary: false,
  },
];

/**
 * Contributing section.
 *
 * Editorial split with a single primary action and two secondary
 * action rows. The 7/5 column split reads as a respectable alternative
 * to the centered &ldquo;View on GitHub&rdquo; button row that most OSS
 * landing pages use by default.
 *
 * The guide card carries the short contribution philosophy pulled
 * from CONTRIBUTING.md. It does not duplicate the README content.
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
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      >
        <SectionHeading
          titleId="contributing-title"
          title={
            <>
              Open source,
              <br />
              open to contributions.
            </>
          }
          description={
            <>
              Bug fixes, feature ideas, and improvements to the AI tutoring
              pipeline all qualify. Fork the repo, cut a feature branch, and
              open a pull request.
            </>
          }
        />
      </motion.div>

      <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <motion.article
          initial={reduce ? false : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-1.5 lg:col-span-7"
        >
          <div className="relative h-full rounded-[14px] border border-border/60 bg-surface-elevated p-6 inner-highlight sm:p-8">
            <span
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[var(--halo-2)] opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-100"
            />
            <span className="relative font-mono text-[10.5px] uppercase tracking-[0.16em] text-accent">
              How to contribute
            </span>
            <h3 className="relative mt-2 text-pretty text-[22px] font-semibold tracking-[-0.01em] text-foreground">
              A short contribution guide.
            </h3>
            <p className="relative mt-3 text-[14px] leading-relaxed text-muted-foreground">
              The codebase favors small, focused PRs. Bug fixes ship in hours.
              New features ship in conversation first, then code. AI prompting
              changes need to ship with an AiGeneration telemetry row proving
              schema validation still passes.
            </p>

            <ol className="relative mt-6 space-y-2">
              {[
                "Fork the repository.",
                "Cut a feature branch with a conventional name.",
                "Commit with a conventional commit message.",
                "Push the branch and open a pull request.",
              ].map((step, idx) => (
                <li
                  key={step}
                  className="flex items-start gap-3 rounded-md border border-border/60 bg-surface px-3 py-2"
                >
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[12.5px] text-foreground">{step}</span>
                </li>
              ))}
            </ol>

            <div className="relative mt-6 flex flex-wrap items-center gap-2">
              <a
                href="https://github.com/aiahmet/synedrix/blob/main/CONTRIBUTING.md"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-surface px-4 text-[13px] font-medium text-foreground outline-none transition-colors hover:border-border/70 hover:bg-surface-elevated focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Read the full guide
                <ArrowUpRight className="h-3.5 w-3.5" weight="bold" />
              </a>
              <a
                href="https://github.com/aiahmet/synedrix/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                MIT license
              </a>
            </div>
          </div>
        </motion.article>

        <ul className="flex flex-col gap-4 lg:col-span-5 lg:gap-5">
          {actions.map((action, i) => (
            <motion.li
              key={action.label}
              initial={reduce ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{
                duration: 0.6,
                delay: 0.1 + i * 0.05,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <a
                href={action.href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "group flex items-start gap-4 rounded-2xl border p-5 outline-none transition-all duration-300",
                  action.primary
                    ? "border-border bg-accent text-accent-foreground shadow-[0_2px_8px_rgba(13,148,136,0.25)] hover:opacity-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    : "border-border bg-surface-elevated hover:border-border/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1",
                    action.primary
                      ? "bg-accent-foreground/15 ring-accent-foreground/10"
                      : "bg-accent/10 ring-accent/10"
                  )}
                >
                  <action.icon
                    className={cn(
                      "h-5 w-5",
                      action.primary
                        ? "text-accent-foreground"
                        : "text-accent"
                    )}
                    weight="duotone"
                  />
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold tracking-tight">
                      {action.label}
                    </span>
                    <ArrowUpRight
                      className={cn(
                        "h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5",
                        action.primary ? "opacity-80" : "opacity-50"
                      )}
                      weight="bold"
                    />
                  </div>
                  <p
                    className={cn(
                      "mt-1 text-[12.5px] leading-relaxed",
                      action.primary
                        ? "text-accent-foreground/80"
                        : "text-muted-foreground"
                    )}
                  >
                    {action.description}
                  </p>
                </div>
              </a>
            </motion.li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
