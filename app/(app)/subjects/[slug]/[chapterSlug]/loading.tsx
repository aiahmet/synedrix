import { CockpitCard, CockpitCardHeader } from "@/components/dashboard/CockpitCard";

/**
 * Loading state for /subjects/[slug]/[chapterSlug].
 *
 * Faithful skeleton of the populated state: breadcrumb chain,
 * chapter header, and topic list with five placeholder rows.
 */
export default function ChapterDetailLoading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:gap-7">
      {/* Breadcrumb skeleton */}
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="h-7 w-32 animate-pulse rounded-full bg-muted/30" />
        <span className="text-muted-foreground/30">/</span>
        <div className="h-5 w-24 animate-pulse rounded-full bg-muted/30" />
        <span className="text-muted-foreground/30">/</span>
        <div className="h-5 w-32 animate-pulse rounded-full bg-muted/30" />
      </div>

      {/* Header skeleton */}
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 animate-pulse rounded-xl bg-muted/40" />
        <div className="flex-1">
          <div className="h-7 w-72 animate-pulse rounded-md bg-muted/40" />
          <div className="mt-2 h-3.5 w-96 max-w-full animate-pulse rounded bg-muted/30" />
          <div className="mt-3 flex gap-3">
            <div className="h-3 w-20 animate-pulse rounded bg-muted/30" />
            <div className="h-3 w-28 animate-pulse rounded bg-muted/30" />
          </div>
        </div>
      </div>

      {/* Topic list skeleton */}
      <CockpitCard>
        <CockpitCardHeader label=" " />
        <ol className="flex flex-col divide-y divide-border/60">
          {Array.from({ length: 5 }).map((_, i) => (
            <li
              key={i}
              className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-40 animate-pulse rounded bg-muted/40" />
                  <div className="h-3 w-12 animate-pulse rounded-full bg-muted/30" />
                  <div className="h-3 w-14 animate-pulse rounded-full bg-muted/30" />
                </div>
                <div className="mt-2 h-3 w-full max-w-md animate-pulse rounded bg-muted/30" />
                <div className="mt-3 h-1.5 w-40 animate-pulse rounded-full bg-muted/30" />
                <div className="mt-2 h-3 w-32 animate-pulse rounded bg-muted/30" />
              </div>
              <div className="h-9 w-28 animate-pulse rounded-lg bg-muted/40" />
            </li>
          ))}
        </ol>
      </CockpitCard>
    </div>
  );
}
