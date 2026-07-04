import { CockpitCard, CockpitCardHeader } from "@/components/dashboard/CockpitCard";

/**
 * Loading state for /subjects/[slug].
 *
 * Faithful skeleton of the populated state: breadcrumb + header,
 * three-card stats row, and chapter list card with five
 * placeholder rows.
 */
export default function SubjectDetailLoading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:gap-7">
      {/* Breadcrumb skeleton */}
      <div className="h-7 w-32 animate-pulse rounded-full bg-muted/30" />

      {/* Header skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 animate-pulse rounded-xl bg-muted/40" />
          <div>
            <div className="h-7 w-64 animate-pulse rounded-md bg-muted/40" />
            <div className="mt-2 h-3.5 w-80 max-w-full animate-pulse rounded bg-muted/30" />
          </div>
        </div>
        <div className="h-11 w-56 animate-pulse rounded-lg bg-muted/40" />
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <CockpitCard key={i}>
            <CockpitCardHeader label=" " />
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="h-9 w-16 animate-pulse rounded bg-muted/30" />
                <div className="mt-3 h-3 w-40 animate-pulse rounded bg-muted/30" />
                <div className="mt-3 h-3 w-24 animate-pulse rounded bg-muted/40" />
              </div>
              <div className="h-12 w-12 animate-pulse rounded-full bg-muted/40" />
            </div>
          </CockpitCard>
        ))}
      </div>

      {/* Chapter list skeleton */}
      <CockpitCard>
        <CockpitCardHeader label=" " />
        <ol className="flex flex-col divide-y divide-border/60">
          {Array.from({ length: 5 }).map((_, i) => (
            <li
              key={i}
              className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
            >
              <div className="h-8 w-8 animate-pulse rounded-lg bg-muted/40" />
              <div className="flex-1">
                <div className="h-4 w-40 animate-pulse rounded bg-muted/40" />
                <div className="mt-2 h-1.5 w-full animate-pulse rounded-full bg-muted/30" />
                <div className="mt-1.5 h-3 w-32 animate-pulse rounded bg-muted/30" />
              </div>
            </li>
          ))}
        </ol>
      </CockpitCard>
    </div>
  );
}
