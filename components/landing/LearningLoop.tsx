"use client";

import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import { motion, useReducedMotion } from "motion/react";

import { Section, SectionHeading } from "@/components/landing/ui/Section";
import { Eyebrow } from "@/components/landing/ui/Eyebrow";
import { loopSteps } from "@/components/landing/data";
import type { PhosphorIcon } from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";

/**
 * Interactive learning loop.
 *
 * Desktop: seven steps form a horizontal timeline; hovering or focusing
 * a step expands its detail panel beneath. The first step is expanded on
 * first render so the section never reads as empty.
 *
 * Accessibility:
 *   - The list is a real ordered list with role="list" semantics.
 *   - Each step is a real button with aria-pressed reflecting active state.
 *   - Arrow, Home, and End keys move selection for keyboard users.
 *   - The detail panel is wired with aria-controls and aria-live="polite".
 *   - On touch, the click keeps the panel expanded; hover is desktop only.
 */
export function LearningLoop() {
  const reduce = useReducedMotion() ?? false;
  const [active, setActive] = useState(0);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    buttonRefs.current = buttonRefs.current.slice(0, loopSteps.length);
  }, []);

  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setActive((i) => (i + 1) % loopSteps.length);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setActive((i) => (i - 1 + loopSteps.length) % loopSteps.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(loopSteps.length - 1);
    }
  };

  const activeStep = loopSteps[active]!;
  const ActiveIcon: PhosphorIcon = activeStep.icon;

  return (
    <Section
      id="loop"
      ariaLabelledBy="loop-title"
      className="py-24 sm:py-32"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      >
        <SectionHeading
          titleId="loop-title"
          eyebrow={<Eyebrow tone="accent">The loop</Eyebrow>}
          title={
            <>
              The core
              <br />
              learning loop.
            </>
          }
          description={
            <>
              Every topic in Synedrix runs the same atomic loop. This loop
              is the product. The nine surfaces are just the rooms where
              each step happens.
            </>
          }
        />
      </motion.div>

      {/* Horizontal timeline (desktop and tablet). */}
      <div
        role="list"
        aria-label="Learning loop steps"
        onKeyDown={handleKey}
        className="mt-14 hidden md:block"
      >
        <ol className="relative grid grid-cols-7 gap-2">
          {/* Connector line that highlights up to the active step. */}
          <span
            aria-hidden
            className="pointer-events-none absolute left-[5%] right-[5%] top-9 h-px bg-border"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute left-[5%] top-9 h-px bg-accent transition-[width] duration-700"
            style={{
              width: `calc(${(active / (loopSteps.length - 1)) * 90}%)`,
            }}
          />
          {loopSteps.map((step, i) => {
            const StepIcon: PhosphorIcon = step.icon;
            const isActive = i === active;
            const isPast = i < active;
            return (
              <li key={step.title} role="listitem">
                <button
                  ref={(el) => {
                    buttonRefs.current[i] = el;
                  }}
                  type="button"
                  onClick={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  aria-pressed={isActive}
                  aria-controls="loop-detail-panel"
                  className={cn(
                    "group flex w-full flex-col items-center rounded-2xl border p-4 text-center outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isActive
                      ? "-translate-y-1 border-border bg-surface-elevated shadow-[var(--shadow-soft)]"
                      : "border-border/60 bg-surface-elevated/60 hover:-translate-y-0.5 hover:border-border hover:bg-surface-elevated"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mb-2 flex h-7 w-7 items-center justify-center rounded-full font-mono text-[11px] font-semibold ring-1 transition-colors",
                      isActive
                        ? "bg-accent text-accent-foreground ring-accent"
                        : isPast
                          ? "bg-accent/15 text-accent ring-accent/30"
                          : "bg-accent/8 text-accent ring-accent/10"
                    )}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                      isActive ? "bg-accent/15" : "bg-accent/8"
                    )}
                  >
                    <StepIcon weight="duotone" className="h-5 w-5 text-accent" />
                  </span>
                  <span
                    className={cn(
                      "mt-3 text-[13px] font-semibold tracking-tight",
                      isActive ? "text-foreground" : "text-foreground/80"
                    )}
                  >
                    {step.title}
                  </span>
                  <span className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-muted-foreground">
                    {step.tagline}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <motion.div
          id="loop-detail-panel"
          key={activeStep.title}
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          aria-live="polite"
          className="mt-6 grid grid-cols-1 gap-4 rounded-2xl border border-border bg-surface-elevated p-6 sm:p-7 md:grid-cols-12"
        >
          <div className="md:col-span-8">
            <p className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-accent">
              <span>Step {String(active + 1).padStart(2, "0")}</span>
              <span aria-hidden className="h-px w-3 bg-accent/40" />
              <span>{activeStep.title}</span>
            </p>
            <h3 className="mt-2 text-[22px] font-semibold tracking-tight text-foreground">
              {activeStep.tagline}
            </h3>
            <p className="mt-3 max-w-prose text-[14px] leading-relaxed text-muted-foreground">
              {activeStep.detail}
            </p>
          </div>
          <div className="md:col-span-4">
            <div className="relative flex h-full min-h-[180px] items-center justify-center overflow-hidden rounded-xl border border-border bg-surface">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.4]"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, currentColor 0.4px, transparent 0.4px)",
                  backgroundSize: "16px 16px",
                }}
              />
              <span className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-accent/10 ring-1 ring-accent/10">
                <ActiveIcon weight="duotone" className="h-10 w-10 text-accent" />
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Vertical stack for small screens. */}
      <ol
        role="list"
        aria-label="Learning loop steps"
        className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 md:hidden"
      >
        {loopSteps.map((step, i) => {
          const StepIcon: PhosphorIcon = step.icon;
          return (
            <li
              key={step.title}
              className="group flex gap-4 rounded-2xl border border-border bg-surface-elevated p-5"
            >
              <div className="flex shrink-0 flex-col items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 font-mono text-[11px] font-semibold text-accent ring-1 ring-accent/10">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                  <StepIcon className="h-5 w-5 text-accent" weight="duotone" />
                </span>
              </div>
              <div>
                <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
                  {step.title}
                </h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                  {step.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
