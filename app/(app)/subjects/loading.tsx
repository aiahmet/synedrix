import { CockpitCard, CockpitCardHeader } from "@/components/dashboard/CockpitCard";

/**
 * Loading state for /subjects.
 *
 * Faithful skeleton of the populated state: header, filter row,
 * and a 3-column grid of subject cards. Mirrors the dashboard
 * loading skeleton in tone.
 */
export default function SubjectsLoading() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:gap-7">
      {/* Header skeleton */}
      <div className="flex flex-col gap-2 pt-1">
        <div className="h-3 w-24 animate-pulse rounded bg-muted/40" />
        <div className="h-7 w-64 animate-pulse rounded-md bg-muted/40" />
        <div className="h-3.5 w-96 max-w-full animate-pulse rounded bg-muted/30" />
      </div>

      {/* Filter row skeleton */}
      <CockpitCard>
        <CockpitCardHeader label=" " />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-8 w-24 animate-pulse rounded-full bg-muted/30"
            />
          ))}
        </div>
      </CockpitCard>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CockpitCard key={i}>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 animate-pulse rounded-lg bg-muted/40" />
              <div className="flex-1">
                <div className="h-4 w-32 animate-pulse rounded bg-muted/40" />
                <div className="mt-1.5 h-3 w-44 animate-pulse rounded bg-muted/30" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-3 w-full animate-pulse rounded bg-muted/30" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-muted/30" />
            </div>
            <div className="mt-5 flex items-center justify-between">
              <div className="h-3 w-20 animate-pulse rounded bg-muted/30" />
              <div className="h-9 w-24 animate-pulse rounded-lg bg-muted/40" />
            </div>
          </CockpitCard>
        ))}
      </div>
    </div>
  );
}
