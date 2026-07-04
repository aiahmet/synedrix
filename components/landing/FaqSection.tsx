"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils/cn";
import { Section, SectionHeading } from "@/components/landing/ui/Section";
import { faqItems } from "@/components/landing/data";

/**
 * FAQ section.
 *
 * Native HTML <details>/<summary> accordion: zero JS-only state, full
 * keyboard support, screen-reader friendly, and progressive enhancement
 * if JS fails to load. We intentionally avoid the JS-controlled accordion
 * + animated height trick because it is the LLM default for FAQ UIs and
 * usually breaks the back button or deep-link scroll.
 *
 * Each answer is short on purpose; deeper questions should be answered
 * in the README, CONTRIBUTING, or the spec doc.
 */
export function FaqSection() {
  const reduce = useReducedMotion() ?? false;
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <Section
      id="faq"
      ariaLabelledBy="faq-title"
      className="py-24 sm:py-32"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      >
        <SectionHeading
          titleId="faq-title"
          title={
            <>
              Honest answers
              <br />
              to common questions.
            </>
          }
          description={
            <>
              What this app does today, what it does not, and the design
              decisions behind it. The full architectural and product spec
              lives in the spec doc and the README.
            </>
          }
        />
      </motion.div>

      <ul className="mt-14 overflow-hidden rounded-2xl border border-border bg-surface-elevated">
        {faqItems.map((item, i) => {
          const open = openIndex === i;
          return (
            <li
              key={item.question}
              className="border-b border-border/70 last:border-b-0"
            >
              <button
                type="button"
                aria-expanded={open}
                aria-controls={`faq-panel-${i}`}
                onClick={() => setOpenIndex(open ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left outline-none transition-colors hover:bg-surface focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated sm:px-6 sm:py-5"
              >
                <span className="text-[15px] font-semibold tracking-tight text-foreground sm:text-[16px]">
                  {item.question}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface font-mono text-[14px] font-medium text-muted-foreground transition-transform duration-300",
                    open && "rotate-45 text-accent"
                  )}
                >
                  +
                </span>
              </button>
              <motion.div
                id={`faq-panel-${i}`}
                hidden={!open}
                initial={false}
                animate={{
                  height: open ? "auto" : 0,
                  opacity: open ? 1 : 0,
                }}
                transition={{
                  duration: reduce ? 0 : 0.35,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="overflow-hidden"
              >
                <p className="px-5 pb-5 text-[13.5px] leading-relaxed text-muted-foreground sm:px-6 sm:pb-6 sm:text-[14px]">
                  {item.answer}
                </p>
              </motion.div>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4">
        <p className="text-[13px] text-muted-foreground">
          Still curious? Open a thread on GitHub Discussions or read the spec
          document on the project wiki.
        </p>
        <a
          href="https://github.com/aiahmet/synedrix/discussions"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-surface-elevated px-4 text-[12.5px] font-medium text-foreground outline-none transition-colors hover:border-border/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Open a thread
        </a>
      </div>
    </Section>
  );
}
