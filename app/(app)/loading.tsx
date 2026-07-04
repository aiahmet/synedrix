export default function AppLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Generic content skeleton */}
      <div>
        <div className="h-7 w-64 animate-pulse rounded-md bg-muted/40" />
        <div className="mt-2 h-4 w-96 animate-pulse rounded bg-muted/30" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-surface-elevated p-5"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-16 animate-pulse rounded bg-muted/40" />
              <div className="h-5 w-5 animate-pulse rounded bg-muted/40" />
            </div>
            <div className="mt-3 h-8 w-12 animate-pulse rounded bg-muted/30" />
            <div className="mt-2 h-3 w-32 animate-pulse rounded bg-muted/30" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface-elevated p-6">
        <div className="h-6 w-32 animate-pulse rounded bg-muted/40" />
        <div className="mt-1.5 h-4 w-64 animate-pulse rounded bg-muted/30" />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-lg border border-border bg-background p-4"
            >
              <div className="h-10 w-10 animate-pulse rounded-lg bg-muted/40" />
              <div>
                <div className="h-4 w-24 animate-pulse rounded bg-muted/40" />
                <div className="mt-1.5 h-3 w-44 animate-pulse rounded bg-muted/30" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface-elevated p-6">
        <div className="h-6 w-48 animate-pulse rounded bg-muted/40" />
        <div className="mt-1.5 h-4 w-full max-w-md animate-pulse rounded bg-muted/30" />
        <div className="mt-1.5 h-4 w-full max-w-sm animate-pulse rounded bg-muted/30" />
      </div>
    </div>
  );
}
