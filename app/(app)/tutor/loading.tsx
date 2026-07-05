import { Brain, Sparkle } from "@phosphor-icons/react/dist/ssr";

/**
 * Loading state for /tutor.
 *
 * Mirrors the new 3-pane layout so the page does not
 * flash a stale shape when TutorClient subscribes to
 * the right Convex queries. Skeleton uses the same
 * grid layout (history | chat | memory) so the swap
 * to live content is layout-stable.
 */
export default function TutorLoading() {
  return (
    <div className="mx-auto flex h-[calc(100dvh-7rem)] w-full max-w-[1480px] flex-col gap-3.5">
      <div className="flex flex-col gap-2.5">
        <nav aria-hidden className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated/60 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            Subjects
          </span>
          <span className="text-muted-foreground/30">/</span>
          <span className="h-3 w-24 animate-pulse rounded-full bg-muted/30" />
          <span className="text-muted-foreground/30">/</span>
          <span className="h-3 w-32 animate-pulse rounded-full bg-muted/30" />
        </nav>
        <div className="flex items-end justify-between gap-5">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 animate-pulse rounded-md bg-muted/40" />
            <div>
              <div className="h-3 w-16 animate-pulse rounded bg-muted/30" />
              <div className="mt-2 h-7 w-72 animate-pulse rounded bg-muted/40" />
            </div>
          </div>
          <div className="h-14 w-14 animate-pulse rounded-full bg-muted/30" />
        </div>
        <ul className="flex flex-wrap items-center gap-2">
          <li className="h-6 w-28 animate-pulse rounded-full bg-muted/30" />
          <li className="h-6 w-32 animate-pulse rounded-full bg-muted/30" />
          <li className="h-6 w-28 animate-pulse rounded-full bg-muted/30" />
        </ul>
      </div>
      <div className="grid h-full min-h-0 flex-1 grid-cols-1 gap-3.5 md:grid-cols-[18rem_1fr] xl:grid-cols-[18rem_1fr_22rem]">
        <aside
          aria-hidden
          className="hidden h-full flex-col gap-2.5 rounded-2xl border border-y border-r-0 border-border bg-surface-elevated/40 p-3 md:flex"
        >
          <div className="h-3 w-16 animate-pulse rounded bg-muted/30" />
          <div className="h-7 animate-pulse rounded-lg bg-muted/20" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5 py-2">
              <div className="h-3 w-3/4 animate-pulse rounded bg-muted/30" />
              <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted/20" />
            </div>
          ))}
        </aside>
        <section
          aria-label="Loading AI Copilot"
          className="flex h-full min-h-0 flex-col gap-3.5"
        >
          <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-border bg-surface-elevated p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 animate-pulse rounded-full bg-muted/40" />
              <div className="flex h-12 flex-1 animate-pulse flex-col gap-1.5 rounded-2xl bg-muted/20 p-3" />
            </div>
            <div className="flex justify-end">
              <div className="flex h-10 w-2/3 animate-pulse rounded-2xl bg-muted/30" />
            </div>
          </div>
          <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-surface-elevated p-2.5">
            <div className="flex flex-wrap gap-1 px-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-6 w-20 animate-pulse rounded-full bg-muted/20" />
              ))}
            </div>
            <div className="h-12 animate-pulse rounded-xl bg-muted/30" />
          </div>
          <p className="flex items-center justify-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
            <Sparkle className="h-3 w-3 animate-pulse text-accent" weight="fill" />
            Syncing tutor
          </p>
        </section>
        <aside
          aria-hidden
          className="hidden h-full flex-col gap-3 rounded-2xl border border-y border-l-0 border-border bg-surface-elevated/40 p-3 xl:flex"
        >
          <div className="h-6 w-24 animate-pulse rounded bg-muted/40" />
          <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background p-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-full bg-muted/40" />
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="h-3 w-3/4 animate-pulse rounded bg-muted/30" />
                <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted/20" />
              </div>
            </div>
            <div className="h-2 animate-pulse rounded-full bg-muted/30" />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted/30" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/20" />
            ))}
          </div>
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <Brain className="h-3 w-3 animate-pulse text-accent" weight="duotone" />
            Building memory snapshot
          </p>
        </aside>
      </div>
    </div>
  );
}
