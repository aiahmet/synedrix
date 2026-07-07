"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils/cn";
import { Section } from "@/components/landing/ui/Section";
import { ArrowRight } from "@/components/landing/icons";
import { faqItems } from "@/components/landing/data";

/**
 * FAQ section.
 *
 * A JS-controlled accordion with Motion-powered height
 * animation. Each answer is short on purpose; deeper
 * questions should be answered in the README,
 * CONTRIBUTING, or the spec doc.
 *
 * The heading is a concrete editorial H2 with no
 * description paragraph — the questions themselves
 * carry the section's meaning. The closing bar is a
 * single GitHub link + licence line matching the brand
 * panel pattern from the style rulebook.
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
        <h2
          id="faq-title"
          className="text-[clamp(1.95rem,2.4vw+0.5rem,2.75rem)] font-semibold leading-[1.04] tracking-[-0.024em] text-foreground"
        >
          The honest
          <br />
          FAQ.
        </h2>
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

      <div className="mt-6 flex flex-col gap-1.5 border-t border-border pt-6">
        <a
          href="https://github.com/aiahmet/synedrix/discussions"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex w-fit items-center gap-1.5 text-[12.5px] font-medium text-foreground outline-none transition-colors hover:text-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Ask on GitHub Discussions
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" weight="bold" />
        </a>
        <p className="text-[11.5px] text-muted-foreground/80">
          MIT licensed. Every answer above is from the spec, not a marketer.
        </p>
      </div>
    </Section>
  );
}
