import { cn } from "@/lib/utils/cn";

/**
 * CockpitCard.
 *
 * Single-layer surface primitive for the dashboard cockpit. Per
 * `docs/SYNEDRIX-FRONTEND-STYLE.md` §5, we use ONE layer
 * (`rounded-xl border bg-background` with a layered shadow) and
 * stop. The previous double-bezel ("rounded-2xl bg-surface-elevated
 * p-1.5" outer + "rounded-xl bg-background" inner) is the
 * triple-nested-card anti-pattern the rulebook bans; the
 * `bg-surface-elevated` ring read as halo chrome.
 *
 * The card is a Server Component. It does not own state and does
 * not need to cross the client boundary.
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
        "rounded-xl border border-border bg-background p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-16px_rgba(0,0,0,0.08)] sm:p-7 dark:shadow-[0_1px_0_0_rgb(255_255_255_/_0.05),0_8px_24px_-12px_rgba(0,0,0,0.45)]",
        className
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * CockpitCardHeader.
 *
 * Small label + optional action row that sits at the top of a
 * CockpitCard. The label uses mono-uppercase tracking for the
 * same reason it does on the landing page: it reads as instrument
 * labeling, not marketing. Plain text only (no pill chip — the
 * rulebook §1 lists pill/track eyebrow chips as banned).
 */
export function CockpitCardHeader({
  label,
  trailing,
}: {
  readonly label: string;
  readonly trailing?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      {trailing}
    </div>
  );
}
