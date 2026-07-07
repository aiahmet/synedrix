"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils/cn";
import { Section, SectionHeading } from "@/components/landing/ui/Section";
import { ArrowRight } from "@/components/landing/icons";
import { faqItems } from "@/components/landing/data";

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
              Häufig gestellte
              <br />
              Lehrplanfragen.
            </>
          }
        />
      </motion.div>

      <ul className="mt-14 divide-y divide-border/40 border-t border-b border-border/40">
        {faqItems.map((item, i) => {
          const open = openIndex === i;
          return (
            <li
              key={item.question}
              className="py-1"
            >
              <button
                type="button"
                aria-expanded={open}
                aria-controls={`faq-panel-${i}`}
                onClick={() => setOpenIndex(open ? null : i)}
                className="flex w-full items-center justify-between gap-4 py-4 text-left outline-none transition-colors text-foreground/80 hover:text-foreground focus-visible:text-foreground"
              >
                <span className="text-[14.5px] font-medium leading-[1.25] tracking-[-0.005em] sm:text-[15.5px]">
                  {item.question}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "font-mono text-[16px] font-normal text-muted-foreground/60 transition-all duration-300 px-2",
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
                  duration: reduce ? 0 : 0.25,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="overflow-hidden"
              >
                <p className="pb-5 text-[13.5px] leading-[1.55] text-muted-foreground sm:pb-6 max-w-2xl">
                  {item.answer}
                </p>
              </motion.div>
            </li>
          );
        })}
      </ul>

      <div className="mt-8 flex flex-col gap-1.5 border-t border-border pt-6">
        <a
          href="https://github.com/aiahmet/synedrix/discussions"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex w-fit items-center gap-1.5 text-[12.5px] font-medium text-foreground outline-none transition-colors hover:text-accent"
        >
          Auf GitHub-Discussions fragen
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" weight="bold" />
        </a>
        <p className="text-[11.5px] text-muted-foreground/80">
          Unter MIT-Lizenz. Jede Antwort oben stammt aus der Spezifikation, nicht von einem Vermarkter.
        </p>
      </div>
    </Section>
  );
}
