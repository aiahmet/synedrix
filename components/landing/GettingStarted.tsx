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
 * Three steps inside a careful editorial column, each carrying a real
 * terminal preview. The verb label avoids &ldquo;Stage 1 / Stage 2&rdquo;
 * generic-label slop and reads like an NVIDIA / Linear install guide.
 *
 * The prerequisites strip sits above the steps so the visitor knows
 * what they need on hand before reading the commands. Each prerequisite
 * card uses the double-bezel pattern for visual consistency.
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
          description={
            <>
              Clone, configure keys, run two dev commands. You can sign in
              and start your first topic before your coffee arrives.
            </>
          }
        />
      </motion.div>

      <div className="mt-10">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
          Prerequisites
        </p>
        <ul className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          {prerequisites.map((req) => (
            <li
              key={req.label}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface p-3"
            >
              <span className="text-[12.5px] font-medium text-foreground">
                {req.label}
              </span>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
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
            className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface-elevated transition-all duration-500 hover:border-border/70 hover:shadow-[var(--shadow-soft)]"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[var(--halo-2)] opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-100"
            />
            <div className="relative flex h-full flex-col p-6 sm:p-7">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-accent">
                  Step {String(i + 1).padStart(2, "0")} {" \u00b7 "} {step.verb}
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-accent/10">
                  <step.icon className="h-4 w-4 text-accent" weight="duotone" />
                </span>
              </div>
              <h3 className="mt-3 text-[18px] font-semibold tracking-tight text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
                {step.description}
              </p>

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
                          className="select-none pr-3 text-accent/70"
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

      <div className="mt-6 rounded-xl border border-border bg-surface p-4 text-[12px] text-muted-foreground">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">
          Note
        </p>
        <p className="mt-1.5 text-[13px]">
          <span className="font-mono text-foreground">{"\u2192 "}</span>
          The full env-var reference lives in the README, with sign-up links
          for Convex, Clerk, and OpenRouter if you do not have accounts yet.
          Both dev commands should be running side-by-side; the first run of
          <span className="font-mono text-foreground"> npx convex dev </span>
          will print the deploy URL to paste into your
          <span className="font-mono text-foreground"> .env.local</span>.
        </p>
      </div>
    </Section>
  );
}
