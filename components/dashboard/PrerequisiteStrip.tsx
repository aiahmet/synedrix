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
 * current topic. Each row is a deep link to the prerequisite's
 * topic page so the user can drill back into the curriculum.
 *
 * Per `docs/SYNEDRIX-FRONTEND-STYLE.md`:
 *
 *   - **No carded inner list rows.** The previous
 *     `border bg-background` mini-cards inside the `CockpitCard`
 *     were the "carded list rows" anti-pattern. Rows are now a
 *     flat ordered list with `divide-y` between rows, no border
 *     on each row (§1).
 *
 *   - **No icon container.** The check / lock icon renders at
 *     native size in a quiet text-muted-foreground tone, not
 *     inside an `bg-accent-subtle/60` pill (§8).
 *
 *   - **No pill chip.** The "Locked" footer hint is a quiet
 *     target icon + body copy, no `bg-surface-elevated/60`
 *     container.
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
      <ol className="divide-y divide-border/60">
        {prerequisites.map((p) => (
          <li key={p.id}>
            <Link
              href={`/subjects/${p.subjectSlug}/${p.chapterSlug}/${p.slug}`}
              className={cn(
                "group flex items-center gap-3 py-3 outline-none transition-colors first:pt-0 last:pb-0 hover:bg-surface focus-visible:bg-surface",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center",
                  p.unlocked ? "text-accent" : "text-muted-foreground",
                )}
                aria-hidden
              >
                {p.unlocked ? (
                  <Check className="h-3.5 w-3.5" weight="bold" />
                ) : (
                  <LockSimple className="h-3.5 w-3.5" weight="bold" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-[12.5px] font-medium tracking-tight",
                    p.unlocked ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {p.title}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1 w-16 overflow-hidden rounded-full bg-border">
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
            </Link>
          </li>
        ))}
      </ol>
      {lockedEntry && (
        <p className="mt-3 inline-flex items-start gap-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
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
