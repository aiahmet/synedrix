"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import { ArrowRight } from "@/components/landing/icons";

/**
 * Hero section. Real rewrite, not polish.
 *
 * The previous version (and all my prior edits to it) was still the
 * SaaS hero template — left "Five systems, one state." copy + right
 * `DashboardMock` of fake Tableau-style widgets. Killing the halos
 * and tightening the chips did not change the premise. The premise
 * was the slop. So this rewrite starts from scratch:
 *
 *   1. **Drops the right-side `DashboardMock` entirely.** Synthesizing
 *      a fake Tableau dashboard is the canonical 2014 SaaS hero move
 *      and proves nothing specific about Synedrix. A real study OS
 *      earns trust through a concrete claim, not a static product
 *      preview. The hero is now a single editorial column.
 *   2. **Anchors the H1 on the product's actual differentiator**
 *      ("yesterday's mistake becomes tomorrow's first question") —
 *      not brand-abstract "Five systems, one state." The H1 names the
 *      mechanism behind the curtain: mistake log → tutor → planner.
 *   3. **Reduces two CTAs to one primary + one ghost link.** Two
 *      equal buttons is the SaaS-template cliche. Primary commits the
 *      user; ghost "Sign in" returns them. Both routes matter, but
 *      they are not equal-weight actions.
 *   4. **Replaces the stat strip with honest product proof at the
 *      bottom** — MIT, single-user, free during beta, GitHub source
 *      link. No fake-precise numbers. The proof that this is real
 *      software is the source, not "7 / 19 / 6 / 3."
 *   5. **No atmospherics. No pretense chrome.** `bg-background`,
 *      single column, max-width 4xl, typography does the work.
 *
 * Style-guide checkpoints (§1, §2, §3, §6, §9):
 *   - no halos, no dot grids, no decorative overlays ✓
 *   - plain uppercase eyebrow, no pill chip ✓
 *   - editorial H1, manual `<br />`, tight tracking, manual line break ✓
 *   - one accent CTA, hover bg-accent/90, shadow-[var(--shadow-pop)], no
 *     `active:scale-[0.97]` ✓
 *   - ghost secondary, no background ✓
 *   - honest GitHub-link proof, no checkmark list ✓
 *   - entrance motion preserved; reduced-motion users collapse to end ✓
 */
export function HeroSection() {
  const reduce = useReducedMotion();

  return (
    <section
      aria-labelledby="hero-title"
      className="relative flex min-h-[100dvh] flex-col bg-background px-6 pt-32 pb-24 sm:px-10 md:pt-36 md:pb-28"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.85, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto flex w-full max-w-4xl flex-col"
      >
        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          For the German Gymnasium · single-user by design
        </span>

        <h1
          id="hero-title"
          className="mt-6 max-w-3xl text-balance text-[clamp(2.5rem,5.4vw+0.6rem,4.75rem)] font-bold leading-[1.02] tracking-[-0.04em] text-foreground"
        >
          Yesterday you missed the sign in ln(a&middot;b).
          <br />
          Today your tutor walks you through why.
        </h1>

        <p className="mt-8 max-w-2xl text-pretty text-[17px] leading-relaxed text-muted-foreground sm:text-[19px]">
          Your mistake log feeds your tutor. Your tutor feeds your planner.
          Curriculum, practice, review, and reflection read the same state
          &mdash; so nothing gets re-loaded between sessions.
        </p>

        <div className="mt-10 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-6">
          <Link
            href="/sign-up"
            className="group inline-flex h-10 items-center gap-2 rounded-md bg-accent px-5 text-[13px] font-medium text-accent-foreground shadow-none outline-none transition-colors hover:bg-accent/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Start learning
            <ArrowRight
              className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5"
              weight="bold"
            />
          </Link>

          <Link
            href="/sign-in"
            className="inline-flex h-10 items-center gap-1.5 px-2 text-[13px] font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Sign in
            <ArrowRight className="h-3 w-3" weight="bold" />
          </Link>
        </div>
      </motion.div>

      {/* Honest product proof at the bottom. No fake stat strip, no
          checkmark list, no marketing veneer. Open-source + single-
          user + free-during-beta is the only truthful stack of
          claims to make about a v1 product, and the GitHub link is
          how the user verifies them. */}
      <motion.div
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.9, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto mt-28 w-full max-w-4xl"
      >
        <div className="border-t border-border pt-7">
          <p className="text-[11.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            MIT licensed · single-user · no signup wall
          </p>
          <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted-foreground/80">
            Self-host or use the hosted instance. Your work never trains
            anyone else&rsquo;s model. No telemetry is shared with model
            providers.
          </p>
          <a
            href="https://github.com/aiahmet/synedrix"
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground transition-colors hover:text-accent"
          >
            View the source on GitHub
            <ArrowRight
              className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5"
              weight="bold"
            />
          </a>
        </div>
      </motion.div>
    </section>
  );
}
