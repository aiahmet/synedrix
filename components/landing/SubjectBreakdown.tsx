"use client";

import { motion, useReducedMotion } from "motion/react";

import { Section, SectionHeading } from "@/components/landing/ui/Section";
import { subjects } from "@/components/landing/data";

/**
 * Subject-specific behavior section.
 *
 * The product spec dedicates section 7.3 to the rule: not every
 * subject gets the same workflow. This section exposes that rule as
 * a single dense tile per subject so the visitor can scan the
 * differences in one glance.
 *
 * Tiles use the subject color from the design tokens as a small
 * categorical label only. The body text never carries the hue.
 */
export function SubjectBreakdown() {
  const reduce = useReducedMotion() ?? false;

  return (
    <Section
      id="subjects"
      ariaLabelledBy="subjects-title"
      className="py-24 sm:py-32"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      >
        <SectionHeading
          titleId="subjects-title"
          title={
            <>
              One app, six
              <br />
              subject workflows.
            </>
          }
          description={
            <>
              The app should not treat every subject the same. Math gets a
              hint ladder. Physics decomposes units. French runs rubric-graded
              writing drills. Below: the workflow shape and the tutor mode
              each subject ships with.
            </>
          }
        />
      </motion.div>

      <ul className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 md:gap-5">
        {subjects.map((subject, i) => (
          <motion.li
            key={subject.id}
            initial={reduce ? false : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{
              duration: 0.55,
              delay: i * 0.05,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface-elevated p-6 transition-shadow duration-300 hover:shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_1px_0_0_rgb(255_255_255_/_0.05),0_8px_24px_-12px_rgba(0,0,0,0.45)]"
          >
            <div className="flex items-center justify-between">
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-white"
                  style={{ backgroundColor: `var(--${subject.tailwindColor})` }}
                >
                  <subject.icon className="h-[1.05rem] w-[1.05rem]" weight="duotone" />
                </span>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                  {subject.id}
                </span>
              </div>

              <h3 className="mt-4 text-[17px] font-semibold tracking-[-0.01em] text-foreground">
                {subject.name}
              </h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                {subject.blurb}
              </p>

              <div className="mt-5 grid grid-cols-1 gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
                    Workflow
                  </p>
                  <ol className="mt-2 flex flex-wrap gap-1.5">
                    {subject.workflow.map((step, idx) => (
                      <li
                        key={step}
                        className="flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[10.5px] text-foreground"
                      >
                        <span className="text-muted-foreground">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="rounded-md border border-accent-border/50 bg-accent-subtle/40 px-3 py-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
                    Tutor mode
                  </p>
                  <p className="mt-0.5 text-[12px] font-medium text-foreground">
                    {subject.tutorMode}
                  </p>
                </div>
              </div>
          </motion.li>
        ))}
      </ul>
    </Section>
  );
}
