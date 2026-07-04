import { cn } from "@/lib/utils/cn";

/**
 * CockpitCard.
 *
 * Shared surface primitive for the dashboard cockpit. Mirrors the
 * double-bezel language of the auth `AuthFormCard` (rounded-2xl
 * outer, rounded-xl inner, border + soft surface, subtle accent
 * ring on hover/active surfaces) so the user perceives a single
 * design system across sign-in, sign-up, and the app shell.
 *
 * The card is intentionally a Server Component. It does not own
 * state and does not need to cross the client boundary.
 */
export function CockpitCard({
  children,
  className,
  as: Tag = "div",
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly as?: "div" | "section" | "article" | "a";
}) {
  return (
    <Tag
      className={cn(
        "group relative rounded-2xl border border-border bg-surface-elevated p-1.5 shadow-[var(--shadow-soft)]",
        className
      )}
    >
      <div className="relative rounded-xl bg-background p-5 sm:p-6">{children}</div>
    </Tag>
  );
}

/**
 * CockpitCardHeader.
 *
 * Small label + optional action row that sits at the top of a
 * CockpitCard. The label uses mono-uppercase tracking for the
 * same reason it does on the landing page: it reads as instrument
 * labeling, not marketing.
 */
export function CockpitCardHeader({
  label,
  trailing,
}: {
  readonly label: string;
  readonly trailing?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      {trailing}
    </div>
  );
}
