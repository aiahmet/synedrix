"use client";

import { useEffect } from "react";
import { WarningCircle, House } from "@phosphor-icons/react";

interface AppErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AppError({ error, reset }: AppErrorProps) {
  useEffect(() => {
    console.error("App shell error:", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 ring-1 ring-red-200">
          <WarningCircle className="h-7 w-7 text-red-600" weight="duotone" />
        </div>

        <h2 className="mt-6 text-xl font-semibold tracking-tight text-foreground">
          Something went wrong
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          An unexpected error occurred. This might be temporary. Try reloading
          the page or return to the dashboard.
        </p>

        {error.digest && (
          <p className="mt-3 font-mono text-xs text-muted">Error ID: {error.digest}</p>
        )}

        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-accent px-6 text-sm font-medium text-accent-foreground transition-all hover:opacity-90 active:scale-[0.98] sm:w-auto"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface-elevated px-6 text-sm font-medium text-foreground transition-all hover:bg-surface active:scale-[0.98] sm:w-auto"
          >
            <House className="h-4 w-4" weight="duotone" />
            Go to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
