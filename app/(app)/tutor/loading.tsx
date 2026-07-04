import { CockpitCard, CockpitCardHeader } from "@/components/dashboard/CockpitCard";

/**
 * Loading state for /tutor.
 *
 * Faithful skeleton: sidebar placeholder on the left, and
 * the breadcrumb chain + header band + scrollable
 * message-list surface + composer skeleton on the right.
 */
export default function TutorLoading() {
  return (
    <div className="mx-auto flex h-[calc(100dvh-7rem)] max-w-6xl flex-col gap-4">
      <div className="grid h-full min-h-0 grid-cols-1 gap-4 md:grid-cols-[300px_1fr]">
        {/* Sidebar skeleton */}
        <aside
          aria-hidden
          className="hidden h-full flex-col gap-3 rounded-2xl border border-border bg-surface-elevated/40 p-3 md:flex"
        >
          <div className="h-3 w-16 animate-pulse rounded bg-muted/40" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col gap-1.5 rounded-lg px-2.5 py-2"
              >
                <div className="h-3 w-3/4 animate-pulse rounded bg-muted/30" />
                <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted/20" />
              </div>
            ))}
          </div>
        </aside>

        {/* Main column skeleton */}
        <div className="flex h-full min-h-0 flex-col gap-5 sm:gap-6">
          {/* Breadcrumb skeleton */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="h-7 w-32 animate-pulse rounded-full bg-muted/30" />
            <span className="text-muted-foreground/30">/</span>
            <div className="h-5 w-24 animate-pulse rounded-full bg-muted/30" />
            <span className="text-muted-foreground/30">/</span>
            <div className="h-5 w-32 animate-pulse rounded-full bg-muted/30" />
          </div>

          {/* Header skeleton */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 animate-pulse rounded-xl bg-muted/40" />
              <div>
                <div className="h-4 w-40 animate-pulse rounded bg-muted/40" />
                <div className="mt-2 h-7 w-56 animate-pulse rounded-md bg-muted/40" />
                <div className="mt-1.5 h-3 w-32 animate-pulse rounded bg-muted/30" />
              </div>
            </div>
            <div className="h-10 w-32 animate-pulse rounded-lg bg-muted/40" />
          </div>

          {/* Thread skeleton */}
          <CockpitCard className="flex min-h-0 flex-1 flex-col">
            <CockpitCardHeader label=" " />
            <ol className="flex flex-1 flex-col gap-3 overflow-hidden">
              {Array.from({ length: 3 }).map((_, i) => (
                <li
                  key={i}
                  className={
                    i % 2 === 0 ? "flex justify-start" : "flex justify-end"
                  }
                >
                  <div
                    className={
                      i % 2 === 0
                        ? "h-12 w-2/3 animate-pulse rounded-2xl bg-muted/30"
                        : "h-10 w-1/2 animate-pulse rounded-2xl bg-muted/40"
                    }
                  />
                </li>
              ))}
            </ol>
          </CockpitCard>

          {/* Composer skeleton */}
          <div className="h-14 animate-pulse rounded-2xl bg-muted/30" />
        </div>
      </div>
    </div>
  );
}
