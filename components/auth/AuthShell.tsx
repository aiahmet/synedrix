import Link from "next/link";

import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils/cn";
import { ArrowRight } from "@/components/landing/icons";

/**
 * AuthShell.
 *
 * Two-pane split layout shared by /sign-in and /sign-up. The left
 * pane is a server-rendered brand panel that carries the value prop
 * for the page; the right pane is where the Clerk component mounts.
 *
 * Layout discipline:
 *   - Desktop: 6/6 split, brand panel left, form panel right.
 *   - Tablet:  stacked, brand panel collapses to a thin strip on top.
 *   - Mobile:  same as tablet, brand panel becomes a sentence.
 *
 * The top bar is a thin floating nav so the page never reads as a
 * walled-off dialog. It exposes the brand mark, the theme toggle,
 * and an alternate-mode link (sign-up to sign-in, or vice versa).
 */

interface AuthShellProps {
  readonly brandPanel: React.ReactNode;
  readonly form: React.ReactNode;
  readonly alternate: {
    readonly label: string;
    readonly href: string;
    readonly cta: string;
  };
  readonly legalNote: string;
}

export function AuthShell({
  brandPanel,
  form,
  alternate,
  legalNote,
}: AuthShellProps) {
  return (
    <div className="relative isolate flex min-h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      {/* Ambient halo so the page never reads as flat. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <span className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-[var(--halo-1)] blur-[120px]" />
        <span className="absolute -bottom-40 -right-32 h-[440px] w-[440px] rounded-full bg-[var(--halo-2)] blur-[110px]" />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage:
              "radial-gradient(circle, currentColor 0.6px, transparent 0.6px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8">
        <Link
          href="/"
          aria-label="Synedrix home"
          className="flex items-center gap-2.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-[10px] font-bold text-accent-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
            SX
          </span>
          <span className="text-sm font-semibold tracking-tight">Synedrix</span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href={alternate.href}
            className="inline-flex h-8 items-center rounded-full border border-border bg-surface-elevated/60 px-3 text-[12.5px] font-medium text-muted-foreground backdrop-blur-sm transition-colors hover:border-border hover:text-foreground"
          >
            {alternate.cta}
            <ArrowRight className="ml-1.5 h-3 w-3" weight="bold" />
          </Link>
        </div>
      </header>

      <main
        id="main"
        className="relative z-10 grid flex-1 grid-cols-1 lg:grid-cols-12"
      >
        <aside
          aria-label="Product context"
          className="grid grid-cols-1 items-start gap-8 px-6 pb-10 pt-4 sm:px-10 lg:col-span-6 lg:items-center lg:gap-10 lg:px-12 lg:py-12 xl:px-16"
        >
          {brandPanel}
        </aside>

        <section
          aria-label={alternate.label}
          className="flex items-start justify-center px-6 pb-12 sm:px-10 lg:col-span-6 lg:items-center lg:px-12 lg:py-12"
        >
          <div className="w-full max-w-md">{form}</div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border/60 px-6 py-5 sm:px-10">
        <p className="mx-auto max-w-6xl text-center font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
          {legalNote}
        </p>
      </footer>
    </div>
  );
}

/**
 * Container for the form card. Used by both pages so the form sits
 * inside a consistent surface that hides Clerk's default chrome.
 */
export function AuthFormCard({
  children,
  title,
  description,
}: {
  readonly children: React.ReactNode;
  readonly title: string;
  readonly description: string;
}) {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 rounded-2xl bg-accent/5 ring-1 ring-accent/10"
      />
      <div className="relative rounded-2xl border border-border bg-surface-elevated p-1.5">
        <div className="rounded-xl bg-background p-7 sm:p-8">
          <header className="mb-7 text-center">
            <h1 className="text-pretty text-[24px] font-semibold leading-tight tracking-[-0.015em] text-foreground sm:text-[26px]">
              {title}
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Small helper to keep typography uniform across panels. */
export function AuthEyebrow({
  children,
  className,
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-accent-border/50 bg-accent-subtle/60 px-3 py-1 text-[10.5px] font-medium uppercase tracking-[0.18em] text-accent",
        className
      )}
    >
      <span className="h-1 w-1 rounded-full bg-accent" />
      {children}
    </span>
  );
}
