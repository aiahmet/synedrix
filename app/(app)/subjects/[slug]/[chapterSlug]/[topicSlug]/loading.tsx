import { CockpitCard, CockpitCardHeader } from "@/components/dashboard/CockpitCard";
// ChatCircleText intentionally not imported in this loading shell — the
// skeleton is a visual placeholder, not an interactive surface.

/**
 * Loading state for /subjects/[slug]/[chapterSlug]/[topicSlug].
 *
 * Faithful skeleton of the populated atomic topic page:
 * breadcrumb chain, topic header with mastery pill, objectives
 * strip, three-depth tab bar, the lesson-block panel area, and
 * the right-rail cards (prerequisites, next-best, ask-tutor).
 */
export default function TopicDetailLoading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:gap-7">
      {/* Breadcrumb skeleton */}
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="h-7 w-32 animate-pulse rounded-full bg-muted/30" />
        <span className="text-muted-foreground/30">/</span>
        <div className="h-5 w-24 animate-pulse rounded-full bg-muted/30" />
        <span className="text-muted-foreground/30">/</span>
        <div className="h-5 w-28 animate-pulse rounded-full bg-muted/30" />
        <span className="text-muted-foreground/30">/</span>
        <div className="h-5 w-32 animate-pulse rounded-full bg-muted/30" />
      </div>

      {/* Header skeleton */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 animate-pulse rounded-xl bg-muted/40" />
          <div className="flex-1">
            <div className="h-7 w-72 animate-pulse rounded-md bg-muted/40" />
            <div className="mt-2 h-3.5 w-96 max-w-full animate-pulse rounded bg-muted/30" />
            <div className="mt-3 h-2 w-40 animate-pulse rounded-full bg-muted/30" />
          </div>
        </div>
        <div className="h-11 w-44 animate-pulse rounded-lg bg-muted/40" />
      </div>

      {/* Objectives skeleton */}
      <CockpitCard>
        <CockpitCardHeader label="Objectives" />
        <ol className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3">
              <div className="h-4 w-4 animate-pulse rounded-full bg-muted/40" />
              <div className="h-3 w-full max-w-sm animate-pulse rounded bg-muted/30" />
            </li>
          ))}
        </ol>
      </CockpitCard>

      {/* Depth tabs + lesson block skeleton */}
      <CockpitCard>
        <div className="flex gap-1 rounded-lg bg-surface p-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-8 w-24 animate-pulse rounded-md bg-muted/40"
            />
          ))}
        </div>
        <div className="mt-5 space-y-3">
          <div className="h-5 w-1/2 animate-pulse rounded bg-muted/40" />
          <div className="h-3 w-full animate-pulse rounded bg-muted/30" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-muted/30" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-muted/30" />
        </div>
      </CockpitCard>

      {/* Lower row skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-7">
        <div className="flex flex-col gap-6 sm:gap-7 lg:col-span-2">
          <CockpitCard>
            <CockpitCardHeader label="Common mistakes" />
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-background p-3"
                >
                  <div className="h-3 w-1/2 animate-pulse rounded bg-muted/40" />
                  <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-muted/30" />
                </div>
              ))}
            </div>
          </CockpitCard>
        </div>
        <div className="flex flex-col gap-6 sm:gap-7">
          <CockpitCard>
            <CockpitCardHeader label="Prerequisites" />
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="h-9 w-full animate-pulse rounded-lg bg-muted/30"
                />
              ))}
            </div>
          </CockpitCard>
          <CockpitCard>
            <CockpitCardHeader label="Continue next" />
            <div className="h-9 w-full animate-pulse rounded-lg bg-muted/30" />
            <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-muted/30" />
          </CockpitCard>
        </div>
      </div>
    </div>
  );
}
