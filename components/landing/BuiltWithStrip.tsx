/* eslint-disable @next/next/no-img-element */
"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * "Built with" logo strip.
 *
 * A quiet row of real brand marks that shows the engineering stack
 * behind Synedrix. Sits directly below the hero and above the problem
 * section.
 *
 * The design-taste-frontend skill says "logo wall = logos and nothing
 * else." No industry labels, no category headings. The logos speak
 * for themselves.
 *
 * We use Simple Icons CDN for real brand SVG marks. For brands not on
 * Simple Icons (OpenRouter), we render a clean typographic wordmark.
 * The CDN slug format converts brand names to lowercase slugs:
 *   "Next.js" -> "nextdotjs"
 *   "Vercel AI SDK" -> "vercel"
 *   "TanStack Query" -> "tanstack"
 *   "Tailwind v4" -> "tailwindcss"
 *
 * CDN URL: https://cdn.simpleicons.org/{slug}/{color}
 */
const BRANDS: readonly {
  readonly slug: string;
  readonly label: string;
  readonly color: string;
}[] = [
  { slug: "convex", label: "Convex", color: "dc1a76" },
  { slug: "clerk", label: "Clerk", color: "6C47FF" },
  { slug: "nextdotjs", label: "Next.js", color: "ffffff" },
  { slug: "vercel", label: "Vercel AI SDK", color: "ffffff" },
  { slug: "tailwindcss", label: "Tailwind CSS", color: "06B6D4" },
  { slug: "tanstack", label: "TanStack Query", color: "FF4154" },
  { slug: "zustand", label: "Zustand", color: "764ABC" },
];

/**
 * OpenRouter has no Simple Icons entry. Render a clean text wordmark
 * styled to match the other brand marks.
 */
function OpenRouterWordmark() {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface-elevated px-2.5 text-[11px] font-semibold tracking-tight text-foreground">
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
      <span>OpenRouter</span>
    </span>
  );
}

/**
 * Renders a single brand logo as an SVG from Simple Icons CDN.
 * Falls back to a styled text wordmark for brands without a CDN
 * entry (OpenRouter).
 */
function BrandLogo({
  brand,
}: {
  readonly brand: (typeof BRANDS)[number];
}) {
  return (
    <img
      src={`https://cdn.simpleicons.org/${brand.slug}/${brand.color}`}
      alt={brand.label}
      title={brand.label}
      className="h-7 w-auto opacity-50 transition-opacity duration-300 hover:opacity-80"
      loading="lazy"
      width="auto"
      height="28"
    />
  );
}

/**
 * Built-with strip: hero bottom -> problem section.
 *
 * Shows the core engineering stack as a quiet, scannable row.
 * No heading, no eyebrow - the logos are the content.
 *
 * Matcha-light theme: brands render in their brand colors.
 * Reduced motion: collapses entrance animation.
 */
export function BuiltWithStrip() {
  const reduce = useReducedMotion() ?? false;

  return (
    <section
      aria-label="Built with"
      className="border-t border-border-faint bg-surface/50 px-6 py-10 sm:px-10 sm:py-12"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 sm:flex-row sm:justify-between"
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
          Built with
        </p>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 sm:justify-end">
          {BRANDS.map((brand) => (
            <BrandLogo key={brand.slug} brand={brand} />
          ))}

          {/* OpenRouter: text wordmark fallback */}
          <OpenRouterWordmark />
        </div>
      </motion.div>
    </section>
  );
}
