export default function ReviewLoading() {
  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <header className="flex flex-col gap-3">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
          / review
        </span>
        <h1 className="text-balance text-[clamp(1.5rem,2vw+0.5rem,1.8rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
          Review Center
        </h1>
      </header>
      <div className="rounded-xl border border-border bg-background p-7 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.08)]">
        <div className="h-4 w-48 animate-pulse rounded bg-muted/30" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-lg bg-muted/20"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
