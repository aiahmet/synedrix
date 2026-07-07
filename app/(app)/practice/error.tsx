"use client";

export default function PracticeError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  void error;
  return (
    <div className="mx-auto max-w-3xl py-12 text-center">
      <div className="rounded-xl border border-border bg-background p-7 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.08)] sm:p-8">
        <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
          Something went wrong
        </h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          The practice arena could not load. Try again.
        </p>
        <button
          onClick={reset}
          className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-[12.5px] font-medium text-accent-foreground transition-colors hover:bg-accent/90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
