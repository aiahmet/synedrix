import Link from "next/link";

import {
  CockpitCard,
  CockpitCardHeader,
} from "@/components/dashboard/CockpitCard";
import { LockSimple, Check, Target } from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";

/**
 * Prerequisite topic entry shape. Mirrors the type returned by
 * `api.subjects.getTopicDetailBySlug` for each prerequisite.
 */
export interface PrerequisiteTopicEntry {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly chapterSlug: string;
  readonly subjectSlug: string;
  readonly mastery: number;
  readonly isStudied: boolean;
  readonly unlocked: boolean;
}

/**
 * PrerequisiteStrip.
 *
 * Renders a small ordered list of prerequisite topics for the
 * current topic. Each chip is a real link to the prerequisite's
 * topic page so the user can drill back into the curriculum.
 *
 * The "unlocked" boolean drives the visual: an unlocked prereq
 * shows a small check chip; a locked (mastery < 0.5) prereq
 * shows a tiny lock badge and a softer treatment. The headline
 * copy on the card switches between "Prerequisites in place"
 * and "Finish X first" depending on whether any prerequisite is
 * still locked.
 *
 * Server-renderable. No interactive elements.
 */
export function PrerequisiteStrip({
  prerequisites,
}: {
  readonly prerequisites: readonly PrerequisiteTopicEntry[];
}) {
  if (prerequisites.length === 0) {
    return (
      <CockpitCard>
        <CockpitCardHeader label="Prerequisites" />
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          No formal prerequisites recorded for this topic.
        </p>
      </CockpitCard>
    );
  }

  const lockedEntry = prerequisites.find((p) => !p.unlocked);

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Prerequisites"
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            {prerequisites.length}{" "}
            {prerequisites.length === 1 ? "topic" : "topics"}
          </span>
        }
      />
      <ol className="flex flex-col gap-2">
        {prerequisites.map((p) => (
          <li key={p.id}>
            <Link
              href={`/subjects/${p.subjectSlug}/${p.chapterSlug}/${p.slug}`}
              className={cn(
                "group flex items-center gap-3 rounded-lg border px-3 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                p.unlocked
                  ? "border-border/60 bg-background hover:border-accent-border/60 hover:bg-surface"
                  : "border-border/40 bg-surface-sunken/40 hover:border-border"
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border",
                  p.unlocked
                    ? "border-accent-border/50 bg-accent-subtle/60 text-accent"
                    : "border-border bg-surface text-muted-foreground"
                )}
                aria-hidden
              >
                {p.unlocked ? (
                  <Check className="h-3 w-3" weight="bold" />
                ) : (
                  <LockSimple className="h-3 w-3" weight="bold" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-[12.5px] font-medium tracking-tight",
                    p.unlocked ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {p.title}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1 w-16 overflow-hidden rounded-full bg-surface">
                    <div
                      className="h-full rounded-full transition-[width] duration-500 ease-out"
                      style={{
                        width: `${Math.max(p.isStudied ? 6 : 0, Math.round(p.mastery * 100))}%`,
                        backgroundColor: p.unlocked
                          ? "var(--accent)"
                          : "var(--muted)",
                      }}
                    />
                  </div>
                  <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                    {Math.round(p.mastery * 100)}%
                  </span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ol>
      {lockedEntry && (
        <p className="mt-3 inline-flex items-start gap-1.5 rounded-md border border-border/60 bg-surface-elevated/60 px-2.5 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
          <Target className="mt-0.5 h-3 w-3 shrink-0 text-accent" weight="duotone" />
          <span>
            Finish{" "}
            <span className="font-medium text-foreground">
              {lockedEntry.title}
            </span>{" "}
            first to unlock the rest of this topic.
          </span>
        </p>
      )}
    </CockpitCard>
  );
}
