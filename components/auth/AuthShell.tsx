import Link from "next/link";
import Image from "next/image";

import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils/cn";
import { ArrowRight } from "@/components/landing/icons";

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
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      <header className="relative z-10 flex items-center justify-between px-5 py-4 sm:px-8 sm:py-4">
        <Link
          href="/"
          aria-label="Synedrix home"
          className="group flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-md">
            <Image
              src="/synedrix-logo.png"
              alt=""
              fill
              className="object-cover"
              sizes="28px"
            />
          </span>
          <span className="text-[13.5px] font-medium tracking-[-0.005em]">
            Synedrix
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link
            href={alternate.href}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="hidden sm:inline">{alternate.label}</span>
            <span className="sm:hidden">{alternate.cta}</span>
            <ArrowRight className="h-3 w-3" weight="bold" />
          </Link>
        </div>
      </header>

      <main
        id="main"
        className="relative z-10 grid flex-1 grid-cols-1 lg:grid-cols-2"
      >
        <aside
          aria-label="Product context"
          className="border-b border-border bg-surface-elevated/30 px-6 pb-10 pt-8 sm:px-10 lg:border-b-0 lg:border-r lg:px-12 lg:py-14 xl:px-16"
        >
          {brandPanel}
        </aside>

        <section
          aria-label={alternate.label}
          className="flex items-start justify-center bg-background px-6 py-10 sm:px-10 lg:items-center lg:px-14 lg:py-14 xl:px-20"
        >
          <div className="w-full max-w-md">{form}</div>
        </section>
      </main>

      <footer className="relative z-10 px-6 py-5 sm:px-10">
        <p className="mx-auto max-w-6xl text-center text-[11px] leading-relaxed text-muted-foreground/70">
          {legalNote}
        </p>
      </footer>
    </div>
  );
}

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
    <div className="relative rounded-xl border border-border bg-background p-7 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.08)] sm:p-8 dark:shadow-[0_1px_0_0_rgb(255_255_255_/_0.05),0_8px_24px_-12px_rgba(0,0,0,0.45)]">
      <header className="mb-7 flex flex-col gap-1.5">
        <h1 className="text-[22px] font-semibold leading-[1.05] tracking-[-0.022em] text-foreground">
          {title}
        </h1>
        <p className="max-w-sm text-[13px] leading-[1.55] text-muted-foreground">
          {description}
        </p>
      </header>
      {children}
    </div>
  );
}

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
        "text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground",
        className
      )}
    >
      {children}
    </span>
  );
}
