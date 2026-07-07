"use client";

import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import { motion, useReducedMotion } from "motion/react";

import { Section, SectionHeading } from "@/components/landing/ui/Section";
import { loopSteps } from "@/components/landing/data";
import type { PhosphorIcon } from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";

/**
 * Interactive learning loop.
 *
 * Structural rewrite (style guide sections 1, 2, 5 + design-taste-frontend
 * section 9). The previous version shipped six banned patterns on a
 * single surface; this rewrite attacks each at the structural level
 * instead of polishing around them.
 *
 *   1. **Pill eyebrow is dropped.** The H2 ("The core learning loop.")
 *      already names the section. The previous `<Eyebrow>` rendered a
 *      rounded-full bordered chip (banned §1: "Pill/track uppercase
 *      eyebrow chips. Use plain uppercase muted text."). Plain
 *      editorial typography does the work.
 *   2. **Timeline steps are no longer carded buttons.** The seven steps
 *      are now a divided row of plain text inside a single rounded
 *      surface. Each cell is still a real `<button>` for accessibility
 *      (aria-pressed, keyboard nav), but the cell carries no border,
 *      shadow, or hover translate of its own. The active step is
 *      shown through cell background, number color, and title weight
 *      alone (banned §1: "Lists are typography. Don't card them.").
 *   3. **Icon containers are removed.** The detail panel previously
 *      wrapped its icon in `bg-accent/10 ring-1 ring-accent/10` (banned
 *      §1, §8: "Just render the icon at native size and color."). The
 *      icon now sits at 16px in the muted-foreground, native-sized.
 *   4. **Connector line is removed.** The animated width-based progress
 *      bar was decorative chrome that did not communicate hierarchy.
 *   5. **Detail panel is single-layer.** The previous version
 *      triple-nested an outer card, a right-column faux product
 *      preview, and an inner icon container (banned §1, §5: "Every
 *      container is single-layer. No `border` wrapping a `bg-elevated`
 *      wrapping an inner padded inner box. Pick one surface."). The
 *      right-column faux preview is gone. The radial dot grid it sat
 *      on is also gone (banned §1, §9: "Radial dot grids"). The detail
 *      panel is now one border + bg-surface-elevated surface with
 *      the metadata strip, h3, and body text only.
 *   6. **Bouncy hover/active is gone.** The previous version used
 *      `-translate-y-1` on the active step and `hover:-translate-y-0.5`
 *      on the rest. The new version uses color + weight transitions
 *      only.
 *
 * Accessibility: the row of steps remains a real ordered list with
 * role="list" semantics; each step is a real button with aria-pressed
 * reflecting active state; arrow, Home, and End keys move selection;
 * the detail panel is wired with aria-controls and aria-live="polite".
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

      {/* Horizontal step row (desktop and tablet). */}
      <div
        role="list"
        aria-label="Learning loop steps"
        onKeyDown={handleKey}
        className="mt-14 hidden md:block"
      >
        <ol className="grid grid-cols-7 overflow-hidden rounded-2xl border border-border bg-surface-elevated">
          {loopSteps.map((step, i) => {
            const isActive = i === active;
            return (
              <li
                key={step.title}
                role="listitem"
                className="border-r border-border/60 last:border-r-0"
              >
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
                    "group flex h-full w-full flex-col items-start gap-2 px-3.5 py-5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isActive ? "bg-background" : "hover:bg-surface"
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "font-mono text-[10.5px] uppercase tracking-[0.14em] transition-colors",
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={cn(
                      "text-[13.5px] leading-[1.2] tracking-[-0.005em] transition-colors",
                      isActive
                        ? "font-medium text-foreground"
                        : "text-foreground/70 group-hover:text-foreground"
                    )}
                  >
                    {step.title}
                  </span>
                  <span
                    className={cn(
                      "line-clamp-2 text-[11.5px] leading-snug transition-colors",
                      isActive
                        ? "text-muted-foreground"
                        : "text-muted-foreground/80 group-hover:text-muted-foreground"
                    )}
                  >
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
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          aria-live="polite"
          className="mt-5 rounded-2xl border border-border bg-surface-elevated p-7 sm:p-8"
        >
          <div className="flex items-center gap-2.5">
            <ActiveIcon
              className="h-4 w-4 text-muted-foreground"
              weight="duotone"
              aria-hidden
            />
            <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
              <span className="text-foreground">
                {String(active + 1).padStart(2, "0")}
              </span>
              <span className="mx-1.5 text-border">/</span>
              <span>{String(loopSteps.length).padStart(2, "0")}</span>
              <span className="mx-2.5 text-border" aria-hidden>·</span>
              <span className="text-foreground/80">{activeStep.title}</span>
            </p>
          </div>
          <h3 className="mt-4 max-w-2xl text-[22px] font-semibold leading-[1.18] tracking-[-0.018em] text-foreground">
            {activeStep.tagline}
          </h3>
          <p className="mt-3 max-w-prose text-[14.5px] leading-[1.55] text-muted-foreground">
            {activeStep.detail}
          </p>
        </motion.div>
      </div>

      {/* Vertical list for small screens. */}
      <ol
        role="list"
        aria-label="Learning loop steps"
        className="mt-12 md:hidden"
      >
        {loopSteps.map((step, i) => {
          const StepIcon: PhosphorIcon = step.icon;
          return (
            <li
              key={step.title}
              className="grid grid-cols-[auto_1fr] gap-x-4 border-b border-border py-5 last:border-b-0"
            >
              <span className="pt-0.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <StepIcon
                    className="h-4 w-4 text-muted-foreground"
                    weight="duotone"
                    aria-hidden
                  />
                  <h3 className="text-[15px] font-medium leading-[1.2] tracking-[-0.005em] text-foreground">
                    {step.title}
                  </h3>
                </div>
                <p className="mt-1 text-[12.5px] leading-[1.55] text-muted-foreground">
                  {step.tagline}
                </p>
                <p className="mt-2 text-[12.5px] leading-[1.55] text-muted-foreground/80">
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
