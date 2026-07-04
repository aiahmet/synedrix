import { cn } from "@/lib/utils/cn";

/**
 * MasteryRing.
 *
 * A pure-SVG circular progress ring. Server-renderable, no
 * animation library, accessible (the value is exposed as a
 * visually-hidden `aria-label` rather than via the SVG).
 *
 * The ring uses a 12px stroke at a 56x56 viewport. Two passes
 * draw the track + the value arc, and the centered label is
 * plain HTML so it inherits the surrounding typography.
 */
export function MasteryRing({
  value, // 0..1
  size = 56,
  strokeWidth = 5,
  className,
  label,
  ariaLabel,
}: {
  readonly value: number;
  readonly size?: number;
  readonly strokeWidth?: number;
  readonly className?: string;
  readonly label: string;
  readonly ariaLabel: string;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        className
      )}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--border)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--accent)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute font-mono text-[11px] font-medium tabular-nums text-foreground">
        {label}
      </span>
      <span className="sr-only">{ariaLabel}</span>
    </div>
  );
}
