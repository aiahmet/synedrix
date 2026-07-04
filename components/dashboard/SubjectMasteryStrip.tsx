import Link from "next/link";

import { CockpitCard, CockpitCardHeader } from "./CockpitCard";
import { ArrowUpRight, Books } from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";
import { resolveColorVar } from "@/lib/utils/subjectColor";

/**
 * A single subject in the mastery strip.
 */
export interface SubjectMasteryEntry {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly color?: string;
  readonly icon?: string;
  readonly mastery: number;
  readonly topicsTotal: number;
  readonly topicsStudied: number;
}

/**
 * SubjectMasteryStrip.
 *
 * One horizontal strip of subject mastery bars. Designed to be
 * glanceable: a single row at desktop, a stack on mobile. Each
 * bar is a real anchor so the user can drill into a subject
 * with one click.
 *
 * The bar's fill color comes from `entry.color` (e.g. "subject-math")
 * when present and falls back to the global accent. The mastery
 * percentage is rendered in mono for tabular consistency across
 * rows.
 */
export function SubjectMasteryStrip({
  subjects,
}: {
  readonly subjects: readonly SubjectMasteryEntry[];
}) {
  if (subjects.length === 0) return null;

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Subjects"
        trailing={
          <Link
            href="/subjects"
            className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-elevated px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:border-accent-border hover:text-foreground"
          >
            All
            <ArrowUpRight className="h-3 w-3" weight="bold" />
          </Link>
        }
      />
      <ul className="flex flex-col divide-y divide-border/60">
        {subjects.map((s) => (
          <SubjectRow key={s.id} subject={s} />
        ))}
      </ul>
    </CockpitCard>
  );
}

function SubjectRow({ subject }: { readonly subject: SubjectMasteryEntry }) {
  const pct = Math.round(subject.mastery * 100);
  const fillVar = resolveColorVar(subject.color);
  const hasTopics = subject.topicsTotal > 0;

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <Link
        href={`/subjects/${subject.slug}`}
        className="group flex items-center gap-4 rounded-lg px-1 py-1 outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
          style={{
            backgroundColor: `color-mix(in srgb, ${fillVar} 12%, transparent)`,
            borderColor: `color-mix(in srgb, ${fillVar} 28%, transparent)`,
          }}
        >
          <Books
            className="h-[1.05rem] w-[1.05rem]"
            weight="duotone"
            style={{ color: fillVar }}
            aria-hidden
          />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-[13.5px] font-semibold tracking-tight text-foreground">
              {subject.title}
            </p>
            <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground">
              {pct}%
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface">
            <div
              className={cn("h-full rounded-full transition-[width] duration-500")}
              style={{
                width: `${Math.max(2, pct)}%`,
                backgroundColor: fillVar,
              }}
            />
          </div>
          <p className="mt-1.5 text-[11.5px] text-muted-foreground">
            {hasTopics
              ? `${subject.topicsStudied} / ${subject.topicsTotal} topics touched`
              : "No topics indexed yet"}
          </p>
        </div>
      </Link>
    </li>
  );
}
