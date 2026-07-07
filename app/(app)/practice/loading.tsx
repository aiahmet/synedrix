export default function PracticeLoading() {
  return (
    <div className="flex flex-col gap-6 sm:gap-7">
      <div className="rounded-xl border border-border bg-background p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.08)] sm:p-7">
        <div className="h-5 w-40 animate-pulse rounded bg-muted/30" />
        <div className="mt-4 space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-muted/20" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted/20" />
        </div>
      </div>
    </div>
  );
}
