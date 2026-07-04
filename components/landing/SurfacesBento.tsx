"use client";

import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils/cn";
import { Section, SectionHeading } from "@/components/landing/ui/Section";
import { Eyebrow } from "@/components/landing/ui/Eyebrow";
import { surfaces } from "@/components/landing/data";
import { DashboardMock } from "@/components/landing/mock/DashboardMock";
import { TopicMock } from "@/components/landing/mock/TopicMock";
import { TutorMock } from "@/components/landing/mock/TutorMock";
import { PracticeMock } from "@/components/landing/mock/PracticeMock";
import { ReviewMock } from "@/components/landing/mock/ReviewMock";

/**
 * Backing inline mini-mock for surfaces that do not yet have a richer
 * dedicated preview (Focus Mode, Mistake Journal, Planner). Each
 * is a calm stand-in that mirrors the visual rhythm of the larger
 * mocks, not a placeholder wall of text.
 */
function MiniMock({
  name,
  rows,
  caption,
}: {
  name: string;
  rows: string[];
  caption: string;
}) {
  return (
    <div className="mt-6 overflow-hidden rounded-xl border border-border/60 bg-surface-sunken/60">
      <div className="flex items-center justify-between border-b border-border/60 bg-surface-elevated px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
          {name}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {caption}
        </span>
      </div>
      <ul className="divide-y divide-border/40 px-3">
        {rows.map((row) => (
          <li key={row} className="py-1.5 font-mono text-[11px] text-muted-foreground">
            {row}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Exactly one preview per surface. The hero bento gets the full
 * DashboardMock. Other named mocks are reused so visual continuity
 * carries through the page.
 */
const PREVIEW: Record<string, React.ReactNode> = {
  Cockpit: <DashboardMock />,
  "Subject Hubs": (
    <MiniMock
      name="Hub \u00b7 Math"
      caption="3rd chapter"
      rows={[
        "Algebra II \u00b7 60% mastery",
        "Trigonometry \u00b7 41% mastery",
        "Stats \u00b7 18% mastery",
      ]}
    />
  ),
  "Topic Pages": <TopicMock />,
  "Tutor Workspace": <TutorMock />,
  "Practice Arena": <PracticeMock />,
  "Review Center": <ReviewMock />,
  "Focus Mode": (
    <MiniMock
      name="Focus session"
      caption="00:18:40"
      rows={[
        "Goal: Master logarithms",
        "Hide nav, mute notifications",
        "Reflection at session close",
      ]}
    />
  ),
  "Mistake Journal": (
    <MiniMock
      name="Journal"
      caption="missed today"
      rows={[
        "\u00b7 Sign error on ln(a\u00b7b)",
        "\u00b7 domain check skipped",
        "\u00b7 mixed change-of-base bases",
      ]}
    />
  ),
  Planner: (
    <MiniMock
      name="Today"
      caption="2 / 4 goals"
      rows={[
        "Recover log foundations",
        "Practice 6 problems",
        "Review 9 due cards",
        "Reflect",
      ]}
    />
  ),
};

interface SurfaceTileProps {
  readonly surface: (typeof surfaces)[number];
  readonly index: number;
  readonly reduceMotion: boolean;
}

/**
 * Per-surface tile used inside the bento grid.
 *
 * Visual variation per cell:
 *   - Hero (Cockpit):  full mock fills the card, gradient halo, larger icon
 *   - Cells with their own mock:  mock renders inside the card
 *   - Quiet cells without a mock:  mini-mock row to keep rhythm
 *
 * Every card uses the double-bezel technique: outer wrapper carries
 * the hairline + padding, inner area is the surface-elevated core.
 * No card is dead space; each surfaces something real from the app.
 */
function SurfaceTile({ surface, index, reduceMotion }: SurfaceTileProps) {
  const isHero = surface.isHero ?? false;
  const hasMock = PREVIEW[surface.title] !== undefined;

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{
        duration: 0.65,
        delay: index * 0.05,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface p-1.5 transition-all duration-500 hover:border-border/70 hover:shadow-[var(--shadow-soft)]",
        surface.span
      )}
    >
      <div className="relative flex h-full flex-col rounded-[14px] border border-border/60 bg-surface-elevated p-5 inner-highlight sm:p-6">
        {isHero ? (
          <>
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[var(--halo-1)] opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-100" />
            <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-accent/60 via-accent/20 to-transparent" />
          </>
        ) : (
          <span
            aria-hidden
            className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[var(--halo-2)] opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-100"
          />
        )}

        {!isHero && (
          <div className="flex items-center justify-between">
            <div
              className={cn(
                "flex shrink-0 items-center justify-center rounded-xl bg-accent/10 ring-1 ring-accent/10",
                "h-10 w-10"
              )}
            >
              <surface.icon
                className="h-5 w-5 text-accent"
                weight="duotone"
              />
            </div>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
              {surface.highlight}
            </span>
          </div>
        )}

        {isHero && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">
                {surface.highlight}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {surface.summary}
              </span>
            </div>
            <span className="inline-flex h-6 items-center rounded-full border border-border bg-surface px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              core
            </span>
          </div>
        )}

        <h3
          className={cn(
            "mt-3 font-semibold tracking-tight text-foreground",
            isHero ? "text-[20px] leading-tight" : "text-[16px] leading-snug"
          )}
        >
          {surface.title}
        </h3>
        <p
          className={cn(
            "mt-1.5 leading-relaxed text-muted-foreground",
            isHero ? "text-[14px]" : "text-[12.5px]"
          )}
        >
          {surface.description}
        </p>

        {/* Preview block. Reused mocks for known surfaces; mini-mocks for the
            remaining ones keep visual rhythm without oversizing the card. */}
        {isHero ? (
          hasMock && (
            <div className="mt-5 -mx-1 -mb-1">{PREVIEW[surface.title]}</div>
          )
        ) : (
          hasMock && (
            <div className="mt-4">
              <div className="overflow-hidden rounded-xl">{PREVIEW[surface.title]}</div>
            </div>
          )
        )}
      </div>
    </motion.article>
  );
}

/**
 * Nine-cell bento covering the nine surfaces documented in section 7 of
 * the product specification. No empty cells, no placeholder. Tail spans
 * resolve to grid-auto-rows so heights stay calm.
 */
export function SurfacesBento() {
  const reduce = useReducedMotion() ?? false;

  return (
    <Section
      id="surfaces"
      ariaLabelledBy="surfaces-title"
      className="py-24 sm:py-32"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      >
        <SectionHeading
          titleId="surfaces-title"
          eyebrow={<Eyebrow tone="accent">Features</Eyebrow>}
          title={
            <>
              Nine surfaces,
              <br />
              one workflow.
            </>
          }
          description={
            <>
              Synedrix is &nbsp;not a notes app with a chatbot bolted on. Every
              surface reads from the same state, so the tutor already knows
              what the practice engine just tested and the planner already
              knows what the review queue is about to demand.
            </>
          }
        />
      </motion.div>

      <div className="mt-14 grid auto-rows-fr grid-cols-1 gap-4 md:grid-cols-4 md:gap-5">
        {surfaces.map((surface, index) => (
          <SurfaceTile
            key={surface.title}
            surface={surface}
            index={index}
            reduceMotion={reduce}
          />
        ))}
      </div>
    </Section>
  );
}
