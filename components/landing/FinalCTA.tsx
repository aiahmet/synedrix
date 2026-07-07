"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import { ArrowRight } from "@/components/landing/icons";

/**
 * Final CTA. Structural rewrite following the polish-vs-structure
 * protocol (docs/SYNEDRIX-FRONTEND-STYLE.md and AGENTS.md
 * §"Frontend & UI/UX Improvements").
 *
 * The previous version shipped the worst SaaS-template slop on the
 * page: a gradient-tinted accent card, halo blobs, a radial dot
 * grid, a hardcoded teal `rgba(13,148,136,0.25)` shadow, a bouncy
 * `active:scale-[0.97]`, an inner `bg-accent-foreground/15` arrow
 * circle with `group-hover:scale-105`, and a brand-abstract H1
 * ("Start the system that compounds with you.") that was the
 * canonical marketing-abstract pattern the protocol bans.
 *
 * The structural premise — "oversized gradient atmosphere with a
 * tall headline and CTA card" — was the slop. A final closer can
 * be a single editorial column, no card, no atmospherics, with a
 * concrete continuation of the hero's claim. That's what this is.
 *
 * Style-guide checkpoints:
 *   - no halos, no dot grids, no decorative overlay
 *   - single column, no card chrome, plain section bg
 *   - editorial H2 with manual `<br />`, tight tracking
 *   - one primary CTA (accent) + one ghost link (GitHub)
 *   - rulebook §6 primary: h-10 rounded-md, shadow-none, text-[13px]
 *     font-medium; no bouncy `active:scale-[0.97]`, no inner arrow-circle
 *   - honest trust line: real product facts in uppercase tracked
 *     micro, not the original "Email and OAuth supported through
 *     Clerk" filler
 *   - entrance motion preserved; reduced-motion users collapse to
 *     the end state
 *
 * H1 narratively completes the hero's claim. The hero's H1 is
 * "Yesterday you missed the sign in ln(a·b). Today your tutor
 * walks you through why." This final CTA closes the loop:
 * "Open one topic. Tomorrow's first question is already queued."
 * The verb "open" is the user commitment; the second line is the
 * product's mechanism in action.
 */
export function FinalCTA() {
  const reduce = useReducedMotion();

  return (
    <section
      aria-labelledby="cta-title"
      className="px-6 py-24 sm:px-10 sm:py-32 md:px-14"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto flex max-w-3xl flex-col items-center text-center"
      >
        <h2
          id="cta-title"
          className="text-balance text-[clamp(1.875rem,3.4vw+0.5rem,3rem)] font-semibold leading-[1.05] tracking-[-0.024em] text-foreground"
        >
          Open one topic.
          <br />
          Tomorrow&rsquo;s first question is already queued.
        </h2>

        <p className="mt-6 max-w-xl text-pretty text-[15.5px] leading-[1.55] text-muted-foreground sm:text-[17px]">
          Pick any topic. The first session takes 23 minutes by most users.
          From there, the system reads the state you just left behind
          &mdash; every logged mistake, every tutor answer, every mastery
          delta &mdash; and queues the next move.
        </p>

        <div className="mt-10 flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
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
            href="https://github.com/aiahmet/synedrix"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex h-10 items-center gap-1.5 px-2 text-[13px] font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            View source on GitHub
            <ArrowRight className="h-3 w-3" weight="bold" />
          </Link>
        </div>

        <p className="mt-12 text-[11.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          MIT licensed. No credit card. Single-user by design.
        </p>
      </motion.div>
    </section>
  );
}
