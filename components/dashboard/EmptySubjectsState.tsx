import Link from "next/link";

import { CockpitCard } from "./CockpitCard";
import { AvailableSubjectStrip } from "./AvailableSubjectStrip";
import { ArrowRight } from "@/components/landing/icons";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * EmptySubjectsState.
 *
 * The first impression for a brand-new user. Replaces the
 * stats row + mastery strip when the cockpit has no data.
 *
 * Per `docs/SYNEDRIX-FRONTEND-STYLE.md`:
 *
 *   - **No pill chip.** The "Welcome" badge with
 *     `bg-accent-subtle/60 px-3 py-1 uppercase tracking-[0.18em]`
 *     is removed (§1).
 *
 *   - **No icon container.** The `bg-{color}/14 ring-1` box
 *     around the `Books` icon is removed (§8).
 *
 *   - **No proof-checkmark list.** The previous "Curriculum
 *     mapped to your grade…" / "AI tutor grounded in your
 *     mistakes…" / "Spaced repetition that adapts…" rows
 *     were the AI-tell proof list. The rulebook §1 bans
 *     this; the value props are kept but rendered as one
 *     honest paragraph.
 *
 *   - **No bouncy CTA.** The "Browse all subjects" button
 *     drops `active:scale-[0.98]`.
 *
 *   - **`hover:bg-accent/90`** not `hover:opacity-90` (§6).
 *
 * Two modes:
 *
 *  1. With `availableSubjects`: the right column renders the
 *     `AvailableSubjectStrip` so the user can add a subject
 *     with one click from the dashboard itself.
 *
 *  2. Without `availableSubjects`: the right column falls
 *     back to a quiet diagram showing the cockpit shape.
 */
export function EmptySubjectsState({
  userName,
  availableSubjects,
}: {
  readonly userName: string;
  /**
   * Optional. When provided, replaces the right-column
   * diagram with a one-click enroll strip. The dashboard
   * page passes the canonical subjects list along with the
   * user's enrollment state so each chip knows whether it
   * is already enrolled.
   */
  readonly availableSubjects?: ReadonlyArray<{
    readonly id: Id<"subjects">;
    readonly slug: string;
    readonly title: string;
    readonly color?: string;
    readonly icon?: string;
    readonly enrolled: boolean;
    readonly topicCount: number;
  }>;
}) {
  return (
    <CockpitCard className="overflow-hidden">
      <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-12">
        <div className="md:col-span-7">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Welcome
          </p>
          <h2 className="mt-3 text-balance text-[clamp(1.5rem,2.4vw+0.5rem,2.1rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
            Your cockpit is ready, {userName}.
          </h2>
          <p className="mt-3 max-w-md text-pretty text-[14px] leading-relaxed text-muted-foreground">
            Pick a subject to begin. The curriculum map, AI tutor,
            practice engine, and review queue all unlock the moment
            you choose one. Every system is already wired; the first
            enrollment is what opens the loop.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/subjects"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-5 text-[13.5px] font-medium text-accent-foreground transition-colors hover:bg-accent/90"
            >
              Browse all subjects
              <ArrowRight className="h-4 w-4" weight="bold" />
            </Link>
          </div>
        </div>

        <div className="md:col-span-5">
          {availableSubjects && availableSubjects.length > 0 ? (
            <SubjectPickerPanel subjects={availableSubjects} />
          ) : (
            <EmptyStateDiagram />
          )}
        </div>
      </div>
    </CockpitCard>
  );
}

/**
 * Right-column panel when the canonical subjects list is
 * available. Title + the inline enroll strip. The dashboard
 * page renders this when Convex has the curriculum data,
 * giving the user a one-click in-place add flow.
 */
function SubjectPickerPanel({
  subjects,
}: {
  readonly subjects: ReadonlyArray<{
    readonly id: Id<"subjects">;
    readonly slug: string;
    readonly title: string;
    readonly color?: string;
    readonly icon?: string;
    readonly enrolled: boolean;
    readonly topicCount: number;
  }>;
}) {
  return (
    <div
      aria-label="Add a subject"
      className="relative mx-auto w-full max-w-sm rounded-lg border border-border bg-background p-4"
    >
      <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        Pick your first subject
      </p>
      <p className="mt-1 text-[12px] text-muted-foreground">
        One click adds it. The cockpit flips open the moment you pick.
      </p>
      <div className="mt-3">
        <AvailableSubjectStrip subjects={subjects} />
      </div>
    </div>
  );
}

/**
 * Quiet diagrammatic preview shown when no canonical subjects
 * data is available (the canonical curriculum has not been
 * seeded or Convex is unreachable). Honest about the
 * situation: this is not your data, it is a shape preview.
 */
function EmptyStateDiagram() {
  return (
    <div
      aria-hidden
      className="relative mx-auto w-full max-w-sm rounded-lg border border-dashed border-border bg-background p-5"
    >
      <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        Cockpit shape
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {[
          { name: "Mathematics", tone: "var(--subject-math)" },
          { name: "Physics", tone: "var(--subject-physics)" },
          { name: "Chemistry", tone: "var(--subject-chemistry)" },
        ].map((row) => (
          <li
            key={row.name}
            className="flex items-center gap-2.5 rounded-md border border-border/50 bg-background px-2.5 py-2"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: row.tone }}
              aria-hidden
            />
            <span className="truncate text-[12px] font-medium text-muted-foreground">
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
