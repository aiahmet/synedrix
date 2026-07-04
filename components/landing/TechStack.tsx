"use client";

import { motion, useReducedMotion } from "motion/react";

import { Section, SectionHeading } from "@/components/landing/ui/Section";
import { techStack } from "@/components/landing/data";

const TONE: ReadonlyArray<string> = [
  "border-accent-border/60 bg-accent-subtle/40",
  "border-border bg-surface-elevated",
  "border-subject-math/30 bg-subject-math/8",
  "border-subject-physics/30 bg-subject-physics/10",
  "border-subject-chemistry/30 bg-subject-chemistry/10",
  "border-subject-french/30 bg-subject-french/10",
  "border-subject-german/30 bg-subject-german/10",
  "border-subject-english/30 bg-subject-english/10",
];

const TOOLS: readonly string[] = [
  "Next.js 16 \u00b7 Turbopack",
  "Convex \u00b7 realtime",
  "Tailwind CSS v4",
  "OpenRouter \u00b7 Vercel AI SDK",
  "Clerk \u00b7 convex/react-clerk",
  "TanStack \u00b7 Zustand \u00b7 Zod",
  "MDX \u00b7 TipTap \u00b7 KaTeX",
  "PostHog \u00b7 Sentry",
];

/**
 * Tech stack section.
 *
 * Eight categories, eight rows. We deliberately avoid the eight-cell
 * card grid because the stack is functional reference information,
 * not a feature grid. Each row carries: the category, the actual tool
 * quoted in mono, what it does in one line, and a single capability
 * verb that survives a quick scan.
 */
export function TechStack() {
  const reduce = useReducedMotion() ?? false;

  return (
    <Section
      id="stack"
      ariaLabelledBy="stack-title"
      className="py-24 sm:py-32"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      >
        <SectionHeading
          titleId="stack-title"
          title={
            <>
              A modern stack
              <br />
              chosen for type safety.
            </>
          }
          description={
            <>
              Every layer is chosen for one job. Type safety, realtime data,
              structured AI outputs, predictable caching. No community-trap
              libraries that ship a breaking change every Friday.
            </>
          }
        />
      </motion.div>

      <ul className="mt-14 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border bg-surface-elevated">
        {techStack.map((item, i) => (
          <motion.li
            key={item.category}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{
              duration: 0.5,
              delay: i * 0.04,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="group flex flex-col gap-3 p-5 transition-colors duration-200 hover:bg-surface sm:grid sm:grid-cols-12 sm:items-center sm:gap-6 sm:p-6"
          >
            <div className="flex items-center gap-3 sm:col-span-3">
              <span
                className={
                  "flex h-8 w-8 items-center justify-center rounded-lg border font-mono text-[11px] font-semibold " +
                  TONE[i % TONE.length]
                }
                aria-hidden
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                  Layer
                </p>
                <p className="text-[15px] font-semibold tracking-tight text-foreground">
                  {item.category}
                </p>
              </div>
            </div>

            <p className="text-[13px] leading-relaxed text-foreground sm:col-span-6">
              {item.description}
            </p>

            <div className="flex items-center justify-between gap-3 sm:col-span-3 sm:justify-end">
              <span className="font-mono text-[11px] text-muted-foreground">
                {TOOLS[i]}
              </span>
              <span className="inline-flex h-7 items-center rounded-full bg-accent/12 px-2.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-accent">
                {item.capability}
              </span>
            </div>
          </motion.li>
        ))}
      </ul>
    </Section>
  );
}
