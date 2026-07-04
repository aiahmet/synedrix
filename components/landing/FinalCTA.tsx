"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import { Section } from "@/components/landing/ui/Section";
import { ArrowRight } from "@/components/landing/icons";

/**
 * Final CTA.
 *
 * Oversized gradient atmosphere with a tall, calm-headed headline and
 * a single primary CTA. The trust line below the buttons sits inside
 * its own band so it never competes with the floor-volume headline.
 *
 * The CTA card rocks a quiet halo underneath the title (in both
 * themes) so the rounded card reads as a destination, not a billboard.
 */
export function FinalCTA() {
  const reduce = useReducedMotion() ?? false;

  return (
    <Section ariaLabelledBy="cta-title" className="py-24 sm:py-32">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16, scale: 0.99 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-[28px] border border-accent-border/40 bg-accent-subtle p-8 text-center sm:p-14"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full bg-[var(--halo-1)] blur-[120px]" />
          <div className="absolute -bottom-40 -left-32 h-[340px] w-[340px] rounded-full bg-[var(--halo-2)] blur-[110px]" />
          <div
            className="absolute inset-0 opacity-[0.4]"
            style={{
              backgroundImage:
                "radial-gradient(circle, currentColor 0.35px, transparent 0.35px)",
              backgroundSize: "20px 20px",
            }}
          />
        </div>

        <div className="relative">
          <h2
            id="cta-title"
            className="text-balance text-[clamp(2rem,4vw+0.5rem,3rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground"
          >
            Start the system that
            <br />
            compounds with you.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-[15.5px] leading-relaxed text-muted-foreground sm:text-[16.5px]">
            Sign in, pick a topic, run the loop once. The next session starts
            from a state the previous one already improved.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent pl-6 pr-3 text-sm font-medium text-accent-foreground shadow-[0_2px_12px_rgba(13,148,136,0.25)] outline-none transition-all duration-300 hover:opacity-95 hover:shadow-[0_4px_24px_rgba(13,148,136,0.35)] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
            >
              Create your account
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-foreground/15 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:scale-105">
                <ArrowRight className="h-3.5 w-3.5" weight="bold" />
              </span>
            </Link>
            <Link
              href="https://github.com/aiahmet/synedrix"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-border bg-surface-elevated px-6 text-sm font-medium text-foreground outline-none transition-colors duration-300 hover:border-border/70 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
            >
              Star on GitHub
            </Link>
          </div>

          <p className="mt-5 text-[12.5px] text-muted-foreground">
            No credit card. Email and OAuth supported through Clerk. The full
            project is MIT licensed.
          </p>
        </div>
      </motion.div>
    </Section>
  );
}
