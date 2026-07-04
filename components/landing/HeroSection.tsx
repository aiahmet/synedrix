"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import { DashboardMock } from "@/components/landing/mock/DashboardMock";
import { heroStats } from "@/components/landing/data";
import { ArrowRight } from "@/components/landing/icons";

/**
 * Hero section.
 *
 * Layout: editorial split on desktop. Massive left column carries the
 * value proposition, the dual CTAs, and a four-up stat strip pulled
 * from the spec (not invented SLAs). The right column shows the
 * Dashboard preview at full resolution so the page reads as a real
 * product, not a glorified coming-soon poster.
 *
 * Composition rules obeyed here:
 *   - Headline max 2 lines on desktop (clamp-driven fluid type).
 *   - Subtext under 20 words and 3 lines.
 *   - Exactly one CTA pair (primary + secondary), no trust strip
 *     bolted onto the hero.
 *   - Hero uses min-h-[100dvh], never h-screen, so iOS Safari cannot
 *     push the CTA below the fold.
 *   - Halo atmospherics use CSS variables so they re-color with the
 *     theme; no pixel-pushed magic color values.
 *   - Reduced-motion users collapse every entrance to its end state.
 */
export function HeroSection() {
  const reduce = useReducedMotion();

  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-[100dvh] flex-col items-center overflow-hidden px-4 pt-24 pb-16 sm:pt-28 md:pt-24"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <span className="absolute -left-32 -top-32 h-[520px] w-[520px] rounded-full bg-[var(--halo-1)] blur-[120px]" />
        <span className="absolute right-0 bottom-0 h-[460px] w-[460px] rounded-full bg-[var(--halo-2)] blur-[110px]" />
        <span className="absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--halo-3)] blur-[90px]" />
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "radial-gradient(circle, currentColor 0.6px, transparent 0.6px)",
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-10">
        <div className="flex flex-col items-start text-balance lg:col-span-7">
          <motion.span
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2 rounded-full border border-accent-border/50 bg-accent-subtle/60 px-3.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-accent"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            The personal learning operating system
          </motion.span>

          <motion.h1
            id="hero-title"
            initial={reduce ? false : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 max-w-3xl text-balance text-[clamp(2.5rem,5.5vw,4.5rem)] font-bold leading-[1.04] tracking-[-0.035em] text-foreground"
          >
            Five systems,
            <br />
            <span className="text-accent">one state.</span>
          </motion.h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="mt-5 max-w-xl text-pretty text-[15.5px] leading-relaxed text-muted-foreground sm:text-[17px]"
          >
            One tab and five hours of focused study. Everything you need to go
            from &ldquo;I don&rsquo;t get this&rdquo; to &ldquo;I can solve this alone&rdquo;.
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.26, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8 flex flex-col items-start gap-3 sm:flex-row"
          >
            <Link
              href="/sign-up"
              className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent pl-6 pr-3 text-sm font-medium text-accent-foreground shadow-[0_2px_12px_rgba(13,148,136,0.25)] outline-none transition-all duration-300 hover:opacity-95 hover:shadow-[0_4px_24px_rgba(13,148,136,0.35)] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
            >
              Start learning
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-foreground/15 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:scale-105">
                <ArrowRight className="h-3.5 w-3.5" weight="bold" />
              </span>
            </Link>
            <Link
              href="#surfaces"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-border/70 bg-surface-elevated/80 px-6 text-sm font-medium text-foreground outline-none backdrop-blur-sm transition-all duration-300 hover:border-border hover:bg-surface-elevated active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
            >
              Explore the surfaces
            </Link>
          </motion.div>

          <motion.dl
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.36, ease: [0.16, 1, 0.3, 1] }}
            className="mt-10 grid w-full max-w-md grid-cols-2 gap-4 sm:grid-cols-4 sm:max-w-2xl"
          >
            {heroStats.map((stat, i) => (
              <div
                key={stat.caption}
                className={`flex flex-col gap-0.5 ${
                  i % 2 === 0 ? "sm:border-r sm:border-border/40 sm:pr-6" : ""
                } ${i < 2 ? "border-b border-border/40 pb-4 sm:border-b-0 sm:pb-0" : ""}`}
              >
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {stat.caption}
                </dt>
                <dd className="font-mono text-[26px] font-semibold tabular-nums leading-none text-foreground">
                  {stat.value}
                </dd>
              </div>
            ))}
          </motion.dl>
        </div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.95, delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-5"
        >
          <DashboardMock />
        </motion.div>
      </div>

      {/* Subtle scroll-reassurance row, not a "Scroll to explore" tag. */}
      <motion.p
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.9, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="mt-12 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground"
      >
        Built with Convex, Clerk, and OpenRouter
      </motion.p>
    </section>
  );
}
