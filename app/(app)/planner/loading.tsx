export default function PlannerLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-8">
      <div className="flex flex-col gap-1">
        <div className="h-5 w-24 animate-pulse rounded bg-muted/30" />
        <div className="h-4 w-64 animate-pulse rounded bg-muted/20" />
        <div className="mt-2 flex gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 w-28 animate-pulse rounded-lg bg-muted/20" />
          ))}
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-xl bg-muted/15" />
        ))}
      </div>
      <div className="h-32 animate-pulse rounded-xl bg-muted/15" />
    </div>
  );
}
