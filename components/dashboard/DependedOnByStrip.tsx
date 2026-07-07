import Link from "next/link";

import { CockpitCard, CockpitCardHeader } from "@/components/dashboard/CockpitCard";
import { resolveColorVar } from "@/lib/utils/subjectColor";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";

export interface DependedOnEntry {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly chapterSlug: string;
  readonly chapterTitle: string;
  readonly subjectSlug: string;
  readonly subjectTitle: string;
  readonly color?: string;
  readonly mastery: number;
  readonly isStudied: boolean;
  readonly examRelevance: number;
  readonly difficulty: "EASY" | "MEDIUM" | "HARD";
}

export function DependedOnByStrip({
  topics,
}: {
  readonly topics: readonly DependedOnEntry[];
}) {
  if (topics.length === 0) {
    return (
      <CockpitCard>
        <CockpitCardHeader label="Depended on by" />
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          No topics list this one as a prerequisite. It may be an end-of-chain
          topic or a standalone concept.
        </p>
      </CockpitCard>
    );
  }

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Depended on by"
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            {topics.length} {topics.length === 1 ? "topic" : "topics"}
          </span>
        }
      />
      <ol className="divide-y divide-border/60">
        {topics.map((t) => {
          const fillVar = resolveColorVar(t.color);
          const masteryPct = Math.round(t.mastery * 100);
          const yieldTag = t.examRelevance >= 4;
          return (
            <li key={t.id}>
              <Link
                href={`/subjects/${t.subjectSlug}/${t.chapterSlug}/${t.slug}`}
                className="group flex items-center gap-3 py-3 outline-none first:pt-0 last:pb-0 transition-colors hover:bg-surface focus-visible:bg-surface"
              >
                <span
                  className="mt-0.5 flex h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: fillVar ?? "var(--accent)" }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-[12.5px] font-medium tracking-tight text-foreground">
                      {t.title}
                    </p>
                    {yieldTag && (
                      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-accent">
                        High yield
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {t.subjectTitle} · {t.chapterTitle}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1 w-12 overflow-hidden rounded-full bg-surface">
                    <div
                      className="h-full rounded-full transition-[width] duration-500 ease-out"
                      style={{
                        width: `${Math.max(t.isStudied ? 6 : 0, masteryPct)}%`,
                        backgroundColor: "var(--accent)",
                      }}
                    />
                  </div>
                  <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                    {masteryPct}%
                  </span>
                </div>
                <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" weight="bold" />
              </Link>
            </li>
          );
        })}
      </ol>
    </CockpitCard>
  );
}
