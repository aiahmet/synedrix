import Link from "next/link";

import { CockpitCard } from "./CockpitCard";
import { ArrowRight, Sparkle } from "@/components/landing/icons";

/**
 * EmptySubjectsState.
 *
 * The first impression for a brand-new user. Replaces the
 * stats row + mastery strip when the cockpit has no data.
 *
 * The page is honest about what it is: there is no "magic
 * first session", there is no fake dashboard. The CTA
 * routes the user to /subjects, which is the next real
 * screen. Three short value-prop points underneath explain
 * what unlocks once they pick a subject.
 */
export function EmptySubjectsState({
  userName,
}: {
  readonly userName: string;
}) {
  return (
    <CockpitCard className="overflow-hidden">
      <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-12">
        <div className="md:col-span-7">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-border/50 bg-accent-subtle/60 px-3 py-1 text-[10.5px] font-medium uppercase tracking-[0.18em] text-accent">
            <span className="h-1 w-1 rounded-full bg-accent" />
            Welcome
          </span>
          <h2 className="mt-4 text-balance text-[clamp(1.5rem,2.4vw+0.5rem,2.1rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
            Your cockpit is ready, {userName}.
          </h2>
          <p className="mt-3 max-w-md text-pretty text-[14px] leading-relaxed text-muted-foreground">
            Pick a subject to begin. The curriculum map, AI tutor, practice
            engine, and review queue all unlock the moment you choose one.
          </p>

          <ul className="mt-5 flex flex-col gap-2.5">
            {[
              "Curriculum mapped to your grade and exam",
              "AI tutor grounded in your mistakes and progress",
              "Spaced repetition that adapts to what you forget",
            ].map((line) => (
              <li
                key={line}
                className="flex items-center gap-2.5 text-[12.5px] text-muted-foreground"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <Sparkle className="h-2.5 w-2.5" weight="fill" />
                </span>
                {line}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/subjects"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-5 text-[13.5px] font-medium text-accent-foreground shadow-[var(--shadow-soft)] transition-all hover:opacity-90 active:scale-[0.98]"
            >
              Add your first subject
              <ArrowRight className="h-4 w-4" weight="bold" />
            </Link>
            <Link
              href="/subjects"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-surface-elevated px-5 text-[13.5px] font-medium text-foreground transition-colors hover:bg-surface"
            >
              Browse subjects
            </Link>
          </div>
        </div>

        <div className="md:col-span-5">
          <EmptyStateDiagram />
        </div>
      </div>
    </CockpitCard>
  );
}

/**
 * Quiet diagrammatic preview shown next to the empty-state copy.
 *
 * Three subject-colored chips, no progress bars, no fake data.
 * Just a structural hint that "subjects land here". The dashed
 * border + "Awaiting" copy keep it honest: this is not your
 * data. Replaces the older version that rendered fake 62%
 * mastery bars.
 */
function EmptyStateDiagram() {
  return (
    <div
      aria-hidden
      className="relative mx-auto w-full max-w-sm rounded-2xl border border-dashed border-border bg-surface-elevated/60 p-5"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        cockpit shape
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {[
          { name: "Mathematics", tone: "var(--subject-math)" },
          { name: "Physics", tone: "var(--subject-physics)" },
          { name: "Chemistry", tone: "var(--subject-chemistry)" },
        ].map((row) => (
          <li
            key={row.name}
            className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-background px-2.5 py-2"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: row.tone }}
              aria-hidden
            />
            <span className="truncate text-[11.5px] font-medium text-muted-foreground">
              {row.name}
            </span>
            <span className="ml-auto font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground/60">
              Awaiting
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
