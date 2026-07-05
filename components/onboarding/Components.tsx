"use client";

/**
 * components/onboarding/Components.tsx.
 *
 * Shared onboarding UI primitives. One file because the four
 * components are tightly co-themed and small enough that
 * splitting them costs more in cognitive overhead than it
 * saves in browsing.
 *
 *  - `OptionCard`: single-tap card used by every
 *    single-select screen. Auto-advance is handled by the
 *    parent (page-level), not by the card itself.
 *  - `ProgressBar`: 1/11 .. 11/11 with smooth fill animation.
 *  - `ScreenHeader`: question + subtitle, used by all
 *    question screens.
 *  - `ConfettiBurst`: CSS-only particle burst for the Finish
 *    screen. No third-party dependency.
 */

import { type ReactNode, useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { ArrowRight, Check } from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";

/**
 * PhosphorIconComponent.
 *
 * Co-located here (rather than re-imported from the
 * icon barrel) so this file does not depend on types
 * exported through a barrel that intentionally does not
 * re-export them. The shape matches the props every
 * Phosphor `<Icon />` accepts, narrowed to the subset
 * the onboarding components use.
 */
type PhosphorIconComponent = React.ComponentType<{
  className?: string;
  weight?: "duotone" | "bold" | "regular" | "fill" | "light" | "thin";
}>;

/**
 * Resolve the per-subject icon for OptionCard's optional
 * `Icon` prop. Mirrors `resolveSubjectIcon` in
 * `icons.ts` but typed locally to avoid circular barrel
 * imports. Unknown slug → `Books`.
 */

// ===========================================================================
// OptionCard
// ===========================================================================

export interface OptionCardProps<TValue extends string | number> {
  readonly value: TValue;
  readonly label: string;
  readonly description?: string;
  readonly preview?: string;
  readonly selected: boolean;
  readonly onSelect: (next: TValue) => void;
  readonly accent?: string; // CSS variable
  /** Multi-select: the card flips a check instead of a ring and counts. */
  readonly multi?: boolean;
  /** When true, render a smaller variant for dense multi-select grids. */
  readonly dense?: boolean;
  /** Optional glyph rendered in the leading slot before the label. */
  readonly Icon?: PhosphorIconComponent;
}

/**
 * OptionCard.
 *
 * Single tap → calls `onSelect(value)`. Selection state is
 * owned by the parent. The card reads its accent color
 * (border + tinted bg) so each subject / option can carry
 * its own tone without leaking color tokens.
 *
 * Animation budget: a quick scale-down on press, a ring +
 * tinted bg + checkmark on selected. Reduced-motion users
 * skip the press animation; the rest stays put.
 */
export function OptionCard<TValue extends string | number>({
  value,
  label,
  description,
  preview,
  selected,
  onSelect,
  accent,
  multi,
  dense,
  Icon,
}: OptionCardProps<TValue>) {
  const accentVar = accent ?? "var(--accent)";

  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={selected}
      data-option-value={String(value)}
      className={cn(
        // The 3-padded left edge hosts the absolute accent stripe.
        // We pad-left instead of margin-left so the stripe aligns
        // exactly with the icon's left edge and the label's text
        // start - no horizontal jump on selection.
        "group relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border bg-surface-elevated text-left transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)] active:translate-y-0 active:scale-[0.985]",
        selected
          ? "border-2"
          : "border border-border hover:border-accent-border/60",
        dense ? "p-3.5 pl-5" : "p-4 sm:p-4.5 sm:pl-6"
      )}
      style={
        accent
          ? {
              borderColor: selected ? accentVar : undefined,
              backgroundColor: selected
                ? `color-mix(in srgb, ${accentVar} 6%, var(--surface-elevated))`
                : undefined,
            }
          : selected
            ? {
                borderColor: "var(--accent)",
                backgroundColor:
                  "color-mix(in srgb, var(--accent) 6%, var(--surface-elevated))",
              }
            : undefined
      }
    >
      {/* Crisp left-edge accent stripe. 2px wide, transparent on
          unselected (no layout shift), accent when selected. Sits
          inside the p-1-aware content box so radius clipping
          handles the rounded corners for us. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 h-full w-[3px] origin-top transition-opacity duration-200"
        style={{
          backgroundColor: accentVar,
          opacity: selected ? 1 : 0,
        }}
      />

      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex shrink-0 items-center justify-center rounded-lg border transition-colors",
          dense ? "h-7 w-7" : "h-8 w-8",
          selected
            ? "border-transparent text-accent-foreground"
            : "border-border bg-surface text-muted-foreground group-hover:text-foreground"
        )}
        style={
          selected
            ? {
                backgroundColor: accent ?? "var(--accent)",
              }
            : undefined
        }
      >
        {selected ? (
          <Check
            className={dense ? "h-3.5 w-3.5" : "h-4 w-4"}
            weight="bold"
          />
        ) : Icon ? (
          <Icon className={dense ? "h-3.5 w-3.5" : "h-4 w-4"} weight="duotone" />
        ) : (
          <span
            className={cn(
              "block rounded-full border-2 border-current opacity-30",
              dense ? "h-2.5 w-2.5" : "h-3 w-3"
            )}
          />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3
            className={cn(
              "font-semibold tracking-tight text-foreground",
              dense ? "text-[13.5px]" : "text-[15px]"
            )}
          >
            {label}
          </h3>
          {multi && selected && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-foreground/5 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
              picked
            </span>
          )}
        </div>
        {description && (
          <p
            className={cn(
              "mt-1 leading-snug text-muted-foreground",
              dense ? "text-[12px]" : "text-[12.5px]"
            )}
          >
            {description}
          </p>
        )}
        {preview && (
          <p
            className={cn(
              "mt-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2 italic leading-relaxed text-foreground/80",
              dense ? "text-[11.5px]" : "text-[12.5px]"
            )}
          >
            {preview}
          </p>
        )}
      </div>
    </button>
  );
}

// ===========================================================================
// ScreenHeader
// ===========================================================================

export function ScreenHeader({
  question,
  hint,
  eyebrow,
}: {
  readonly question: string;
  readonly hint?: string;
  /**
   * Eyebrow is kept in the API for callers that genuinely
   * want a small caps label above the question, but is
   * NOT used by any current screen. The shared top bar
   * already carries the step counter, so a per-screen
   * eyebrow would create a second tier of mono micro-
   * labels (violating the design-taste eyebrow restraint
   * rule of max one per three sections).
   */
  readonly eyebrow?: string;
}) {
  return (
    <header className="flex flex-col items-center gap-3 text-center">
      {eyebrow && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated/70 px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-sm">
          {eyebrow}
        </span>
      )}
      <h1 className="max-w-2xl text-balance text-[clamp(1.7rem,2.4vw+0.6rem,2.25rem)] font-semibold leading-[1.06] tracking-[-0.022em] text-foreground">
        {question}
      </h1>
      {hint && (
        <p className="max-w-xl text-pretty text-[13.5px] leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
    </header>
  );
}

// ===========================================================================
// ConfettiBurst
// ===========================================================================

/**
 * generateConfettiParticles.
 *
 * Generates 60 randomised particles at module level so the
 * impure Math.random calls never run inside a component
 * render body. Called once from a useEffect on mount.
 */
function generateConfettiParticles() {
  const palette = [
    "var(--accent)",
    "var(--subject-math)",
    "var(--subject-physics)",
    "var(--subject-chemistry)",
    "var(--subject-german)",
    "var(--subject-french)",
    "var(--subject-english)",
  ];
  return Array.from({ length: 60 }).map((_, i) => {
    const angle = (i / 60) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
    const distance = 220 + Math.random() * 360;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance - 80;
    const rot = (Math.random() - 0.5) * 720;
    const delay = Math.random() * 120;
    const size = 6 + Math.random() * 10;
    const color = palette[i % palette.length] ?? "var(--accent)";
    return { tx, ty, rot, delay, size, color, key: i };
  });
}

/**
 * ConfettiBurst.
 *
 * Pure CSS / DOM celebration. Spawns 60 particles from the
 * center of the viewport and animates each outward with
 * random bearing / distance / rotation. No third-party
 * library. Respects `prefers-reduced-motion`.
 */
export function ConfettiBurst() {
  const reduceMotion = useReducedMotion();
  const [particles, setParticles] = useState<ReadonlyArray<{
    readonly tx: number;
    readonly ty: number;
    readonly rot: number;
    readonly delay: number;
    readonly size: number;
    readonly color: string;
    readonly key: number;
  }> | null>(null);

  useEffect(() => {
    if (reduceMotion) return;
    // eslint-disable-next-line -- confetti init on mount, not cascading render
    setParticles(generateConfettiParticles());
  }, [reduceMotion]);

  if (reduceMotion) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {particles &&
        particles.map((p) => (
          <span
            key={p.key}
            className="absolute left-1/2 top-1/2 block rounded-full"
            style={{
              width: p.size,
              height: p.size * 0.35, // rectangle-ish confetti
              backgroundColor: p.color,
              transform: `translate(-50%, -50%) rotate(${p.rot}deg)`,
              animation: `synedrix-confetti 1500ms ${p.delay}ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
              // The two custom props are read by the keyframe via CSS.
              ["--tx" as never]: `${p.tx}px`,
              ["--ty" as never]: `${p.ty}px`,
              ["--rot" as never]: `${p.rot}deg`,
            }}
          />
        ))}
      <style jsx>{`
        @keyframes synedrix-confetti {
          0% {
            transform: translate(-50%, -50%) rotate(0deg) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(
              calc(-50% + var(--tx, 0px)),
              calc(-50% + var(--ty, 0px))
            )
              rotate(var(--rot, 0deg))
              scale(0.6);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

// ===========================================================================
// ContinueBar
// ===========================================================================

/**
 * ContinueBar.
 *
 * The bottom-aligned multi-select CTA. Disabled until the
 * the validation predicate resolves true.
 *
 * **Width contract.** Always renders `w-full`. Every screen
 * that mounts ContinueBar does so inside
 * `<QuestionLayout>`'s inner flex-col-items-center
 * container; without an explicit `w-full` the bar shrinks
 * to its content width (~150–180px on desktop, just the
 * button + hint text) and renders as a tiny floating pill
 * instead of a full-width CTA that matches the option
 * grid above it. The bar would otherwise look "mobile-style"
 * on a wide viewport.
 */
export function ContinueBar({
  label,
  disabled,
  onContinue,
  hint,
}: {
  readonly label: string;
  readonly disabled: boolean;
  readonly onContinue: () => void;
  readonly hint?: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col items-stretch gap-2 border-t border-border bg-surface-elevated/85 px-4 py-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="text-[12px] leading-snug text-muted-foreground">{hint}</div>
      <button
        type="button"
        onClick={onContinue}
        disabled={disabled}
        className={cn(
          "group inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-[13.5px] font-medium transition-all duration-200",
          disabled
            ? "cursor-not-allowed bg-muted/40 text-muted-foreground/60"
            : "bg-accent text-accent-foreground shadow-[var(--shadow-soft)] hover:opacity-95 active:scale-[0.98]"
        )}
      >
        {label}
        <ArrowRight
          className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
          weight="bold"
        />
      </button>
    </div>
  );
}
