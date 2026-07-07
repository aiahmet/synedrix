"use client";

import { motion, useReducedMotion } from "motion/react";

import { Section, SectionHeading } from "@/components/landing/ui/Section";
import {
  installSteps,
  prerequisites,
} from "@/components/landing/data";

/**
 * Getting started section.
 *
 * Three install steps in a clean editorial column. Each step carries a
 * real terminal preview. The presentation is typography-first: no halo
 * blobs, no icon containers, no generic step-numbering labels, no
 * carded metadata rows.
 *
 * The prerequisites strip sits above the steps as a plain text row so
 * the visitor knows what they need before reading the commands.
 */
export function GettingStarted() {
  const reduce = useReducedMotion() ?? false;

  return (
    <Section
      id="getting-started"
      ariaLabelledBy="getting-started-title"
      className="py-24 sm:py-32"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      >
        <SectionHeading
          titleId="getting-started-title"
          title={
            <>
              Running in
              <br />
              under two minutes.
            </>
          }
          description="Clone, configure keys, run two dev commands. Sign in and start your first topic before your coffee arrives."
        />
      </motion.div>

      {/* Prerequisites: plain typography, no carded rows. */}
      <div className="mt-10">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Prerequisites
        </p>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
          {prerequisites.map((req) => (
            <li
              key={req.label}
              className="flex items-baseline gap-1.5"
            >
              <span className="text-[13.5px] font-medium text-foreground">
                {req.label}
              </span>
              <span className="text-[12px] text-muted-foreground">
                {req.note}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <ol className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
        {installSteps.map((step, i) => (
          <motion.li
            key={step.title}
            initial={reduce ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{
              duration: 0.6,
              delay: i * 0.06,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface-elevated transition-colors duration-500 hover:border-border/70"
          >
            <div className="flex h-full flex-col p-6 sm:p-7">
              {/* Verb eyebrow: plain text per Synedrix §2, no step numbering. */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {step.verb}
                </span>
                <step.icon
                  className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground"
                  weight="duotone"
                />
              </div>
              <h3 className="mt-3 text-[18px] font-semibold tracking-tight text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                {step.description}
              </p>

              {/* Terminal preview: single-layer card, no accent chrome. */}
              <div className="mt-5 flex-1 overflow-hidden rounded-xl border border-border bg-surface">
                <div className="flex items-center justify-between border-b border-border bg-surface-elevated px-3 py-2">
                  <span className="font-mono text-[10.5px] text-muted-foreground">
                    {i === 0 ? "shell" : i === 1 ? ".env.local" : "terminal"}
                  </span>
                  <span className="font-mono text-[10.5px] text-muted-foreground/80">
                    {i === 0 ? "bash" : i === 1 ? "env" : "bash"}
                  </span>
                </div>
                <pre className="overflow-x-auto p-4 text-[12px] leading-relaxed text-muted-foreground">
                  <code>
                    {step.commands.map((line, idx) => (
                      <span key={idx} className="block">
                        <span
                          aria-hidden
                          className="select-none pr-3 text-muted-foreground/50"
                        >
                          $
                        </span>
                        {line}
                      </span>
                    ))}
                  </code>
                </pre>
              </div>
            </div>
          </motion.li>
        ))}
      </ol>

      {/* Context note: muted, no accent label. */}
      <div className="mt-6 rounded-xl border border-border bg-surface p-4">
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          The full env-var reference lives in the README, with sign-up links
          for Convex, Clerk, and OpenRouter if you do not have accounts yet.
          Both dev commands should be running side by side; the first run of{" "}
          <code className="rounded bg-surface-elevated px-1 py-0.5 font-mono text-[11.5px] text-foreground">
            npx convex dev
          </code>{" "}
          will print the deploy URL to paste into your{" "}
          <code className="rounded bg-surface-elevated px-1 py-0.5 font-mono text-[11.5px] text-foreground">
            .env.local
          </code>.
        </p>
      </div>
    </Section>
  );
}
