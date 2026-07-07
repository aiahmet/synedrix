"use client";

import { motion, useReducedMotion } from "motion/react";

import { Section, SectionHeading } from "@/components/landing/ui/Section";
import { surfaces } from "@/components/landing/data";
import { TopicMock } from "@/components/landing/mock/TopicMock";
import type { ReactNode } from "react";

/**
 * One-line evidence row for a non-hero cell. Renders as quiet
 * muted text inside the cell; the cell is the surface, the
 * snippet is just a row of evidence. No card chrome.
 *
 * Used in place of the previous nested `MiniMock` cards, which
 * double-stacked border + bg-surface-sunken inside the cell's
 * own border + bg-surface. The rulebook's "single-layer card"
 * rule and "no carded list rows" rule both apply: a single
 * muted text line carries the same signal without the chrome.
 */
function DataSnippet({
  primary,
  secondary,
}: {
  readonly primary: string;
  readonly secondary: string;
}) {
  return (
    <p className="mt-5 border-t border-border-faint pt-3 text-[12px] leading-snug">
      <span className="text-foreground">{primary}</span>
      <span className="ml-2 text-muted-foreground">{secondary}</span>
    </p>
  );
}

/**
 * Tone-to-class lookup. Hoisted to module scope so it is not
 * re-allocated on every render; matches the convention the
 * deleted mocks used (`WINDOW_TONE`, `KIND_BADGE`).
 */
const TONE_CLASS: Record<"default" | "accent" | "warn", string> = {
  default: "text-foreground",
  accent: "text-accent",
  warn: "text-subject-french",
};

/**
 * Compact multi-row preview for a non-hero cell. Renders 2-3
 * short rows of (label, value) pairs separated by a single
 * hairline above the group, not between every row (rulebook
 * §9.F: pick one border direction and use it sparsely).
 *
 * Used on cells where a one-line DataSnippet would lose too
 * much signal (Tutor context, unified review queue). The hero
 * is the only cell with a real product mock; the other small
 * cells with structured multi-row data use this. The remaining
 * five cells stay on `DataSnippet` because a single line of
 * evidence is enough.
 */
function CompactPreview({
  rows,
}: {
  readonly rows: ReadonlyArray<{
    readonly label: string;
    readonly value: string;
    readonly tone?: "default" | "accent" | "warn";
  }>;
}) {
  return (
    <div className="mt-5 border-t border-border-faint pt-3">
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <li
            key={`${row.label}:${row.value}`}
            className="flex items-center justify-between gap-3 text-[11.5px] leading-snug"
          >
            <span className="truncate font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">
              {row.label}
            </span>
            <span
              className={`truncate font-medium ${TONE_CLASS[row.tone ?? "default"]}`}
              title={row.value}
            >
              {row.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Cell background variants for visual diversity.
 * Maps well-known surface titles to a background class that
 * differs from the default `bg-surface` so the bento has
 * at least 2-3 cells with real visual variation (design-taste
 * skill section 4.7 - Bento Background Diversity rule).
 *
 *   - default:      bg-surface (the current single uniform tint)
 *   - hero-cell:    subtle gradient for the anchor cell
 *   - tint-accent:  very quiet accent-subtle wash
 *   - tint-warm:    quiet warm tint (muted-foreground/5 via surface-sunken)
 */
const CELL_BG: Record<string, string> = {
  default: "bg-surface",
  "The Cockpit": "bg-gradient-to-b from-accent-subtle/20 to-surface",
  "Practice Arena": "bg-surface-elevated",
  "Mistake Journal": "bg-surface-elevated",
};

/**
 * Per-surface tile.
 *
 * Single-layer contract (style guide section 1, section 5):
 *   - One 1px border on the cell. Nothing nested inside.
 *   - The icon sits at 20px in muted-foreground, no chip.
 *   - All cells use the same H3 size and weight. The hero
 *     is differentiated by its full-row width and by the
 *     real product preview it carries, not by a different
 *     font scale.
 *   - The hero (Cockpit) renders `TopicMock` in `bare` mode
 *     so the cell provides the only card chrome. The other
 *     eight cells are typography with at most a one-line
 *     `DataSnippet` for evidence.
 */
function SurfaceTile({
  surface,
  isHero,
  preview,
}: {
  readonly surface: (typeof surfaces)[number];
  readonly isHero: boolean;
  readonly preview: ReactNode;
}) {
  const bgClass = CELL_BG[surface.title] ?? CELL_BG.default;
  return (
    <article
      className={
        "flex flex-col rounded-2xl border border-border p-6 sm:p-7 " +
        bgClass + " " +
        surface.span
      }
    >
      <surface.icon
        className="h-5 w-5 text-muted-foreground"
        weight="duotone"
        aria-hidden
      />

      <h3 className="mt-4 text-[16px] font-semibold leading-snug tracking-[-0.005em] text-foreground">
        {surface.title}
      </h3>
      <p className="mt-1.5 text-[13px] leading-[1.55] text-muted-foreground">
        {surface.description}
      </p>

      {isHero ? <div className="mt-6">{preview}</div> : preview}
    </article>
  );
}

/**
 * One preview per surface.
 *
 * Only the hero (Cockpit) carries a real product preview
 * (`TopicMock`, the most product-defining surface in the
 * system). The other eight surfaces get at most a one-line
 * `DataSnippet` so the bento stays one editorial block, not
 * nine competing visuals.
 */
const PREVIEW: Record<string, ReactNode> = {
  Cockpit: <TopicMock bare />,
  "Subject Hubs": (
    <DataSnippet
      primary="Math · Physics · Chemistry · French · German · English"
      secondary="six subject-tuned workflows"
    />
  ),
  "Topic Pages": (
    <DataSnippet
      primary="Simple · Standard · Rigorous"
      secondary="three depths on one page"
    />
  ),
  "Tutor Workspace": (
    <CompactPreview
      rows={[
        { label: "Context", value: "Math / Logs", tone: "default" },
        { label: "Recent", value: "3 mistakes on this topic", tone: "accent" },
        { label: "Mode", value: "Hint only", tone: "default" },
      ]}
    />
  ),
  "Practice Arena": (
    <DataSnippet
      primary="MCQ · step · fill-in · formula · oral"
      secondary="every answer gets full feedback"
    />
  ),
  "Review Center": (
    <CompactPreview
      rows={[
        { label: "Today", value: "log\u2082(x) domain rules", tone: "accent" },
        { label: "Today", value: "sign on dU/dt", tone: "accent" },
        { label: "Overdue", value: "subjonctif recovery", tone: "warn" },
      ]}
    />
  ),
  "Focus Mode": (
    <DataSnippet
      primary="Goal + timer + reflection"
      secondary="navigation hidden, notifications muted"
    />
  ),
  "Mistake Journal": (
    <DataSnippet
      primary="Tagged by concept and cause"
      secondary="every mistake enters the review queue"
    />
  ),
  Planner: (
    <DataSnippet
      primary="Daily and weekly goals"
      secondary="auto-recovery after missed days"
    />
  ),
};

/**
 * Nine-cell bento covering the nine surfaces documented in
 * section 7 of the product specification.
 *
 * Structural rewrite following the polish-vs-structure
 * protocol in docs/SYNEDRIX-FRONTEND-STYLE.md and
 * AGENTS.md §"Frontend & UI/UX Improvements":
 *
 *   1. **Eyebrow pill chip is removed.** The previous
 *      `<Eyebrow tone="accent">Features</Eyebrow>` is a
 *      banned pattern (style guide §1: "Pill/track uppercase
 *      eyebrow chips. Use plain uppercase muted text.").
 *      The H2 below now carries the section identity alone,
 *      which is also the design-taste-frontend default
 *      ("What to do instead of an eyebrow: drop it entirely.
 *      The headline alone is enough.").
 *   2. **H2 is sharpened to a concrete noun pair.** "Nine
 *      surfaces, one loop" replaces "Nine surfaces, one
 *      workflow" so the second noun names the actual system
 *      mechanism (the loop described in the next section),
 *      not the abstract "workflow."
 *   3. **The visual hierarchy now matches the product
 *      hierarchy.** The Cockpit is the morning anchor in the
 *      actual product, so it is the visual anchor here: full
 *      row width + the only real product preview. The
 *      previous version inverted this (4 detailed mocks on
 *      small 2-col cells, only a MiniMock on the hero).
 *   4. **Triple-nested chrome is gone.** The 4 detailed
 *      mocks previously rendered as their own
 *      `rounded-3xl border bg-surface-elevated shadow-pop`
 *      cards inside a bento cell that was already a
 *      `border bg-surface` card. The cell IS the surface
 *      now; the `TopicMock` runs in `bare` mode.
 *   5. **The 8 small cells are typography with at most one
 *      muted data line.** The previous MiniMock added a
 *      `bg-surface-sunken/50` chrome inside the cell. The
 *      new `DataSnippet` is a single hairline-divided text
 *      line, no second card layer.
 *   6. **All 9 cells use the same H3 size and weight.** The
 *      previous `isHero`-driven 20px vs 16px font variation
 *      was a Tell. The hero is differentiated by its size
 *      and its mock, not by a font bump.
 */
export function SurfacesBento() {
  const reduce = useReducedMotion() ?? false;

  return (
    <Section
      id="surfaces"
      ariaLabelledBy="surfaces-title"
      className="bg-surface py-24 sm:py-32"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      >
        <SectionHeading
          titleId="surfaces-title"
          title={
            <>
              Nine surfaces,
              <br />
              one loop.
            </>
          }
          description={
            <>
              Synedrix is not a notes app with a chatbot bolted on. Every
              surface reads from the same state, so the tutor already knows
              what the practice engine just tested and the planner already
              knows what the review queue is about to demand.
            </>
          }
        />
      </motion.div>

      <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-5">
        {surfaces.map((surface) => (
          <SurfaceTile
            key={surface.title}
            surface={surface}
            isHero={surface.isHero ?? false}
            preview={PREVIEW[surface.title]!}
          />
        ))}
      </div>
    </Section>
  );
}
