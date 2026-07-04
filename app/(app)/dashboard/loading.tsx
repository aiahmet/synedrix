import { CockpitCard, CockpitCardHeader } from "@/components/dashboard/CockpitCard";

/**
 * Loading state for the dashboard cockpit.
 *
 * Renders a faithful skeleton of the populated state (header +
 * stats row + mastery strip) so the page never flashes the old
 * hardcoded placeholders during route transition.
 */
export default function DashboardLoading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:gap-7">
      {/* Header skeleton */}
      <div className="flex flex-col gap-2 pt-1">
        <div className="h-3 w-24 animate-pulse rounded bg-muted/40" />
        <div className="h-7 w-72 animate-pulse rounded-md bg-muted/40" />
        <div className="h-3.5 w-96 max-w-full animate-pulse rounded bg-muted/30" />
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <CockpitCard key={i}>
            <CockpitCardHeader label=" " />
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="h-9 w-14 animate-pulse rounded bg-muted/30" />
                <div className="mt-3 h-3 w-40 animate-pulse rounded bg-muted/30" />
                <div className="mt-3 h-3 w-20 animate-pulse rounded bg-muted/40" />
              </div>
              <div className="h-9 w-9 animate-pulse rounded-lg bg-muted/40" />
            </div>
          </CockpitCard>
        ))}
      </div>

      {/* Mastery strip skeleton */}
      <CockpitCard>
        <CockpitCardHeader label=" " />
        <ul className="flex flex-col divide-y divide-border/60">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
              <div className="h-9 w-9 animate-pulse rounded-lg bg-muted/40" />
              <div className="flex-1">
                <div className="h-3.5 w-32 animate-pulse rounded bg-muted/40" />
                <div className="mt-2 h-1.5 w-full animate-pulse rounded-full bg-muted/30" />
                <div className="mt-1.5 h-3 w-28 animate-pulse rounded bg-muted/30" />
              </div>
            </li>
          ))}
        </ul>
      </CockpitCard>
    </div>
  );
}
