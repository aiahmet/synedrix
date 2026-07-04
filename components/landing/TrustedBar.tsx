import { Section } from "@/components/landing/ui/Section";
import { heroLogos } from "@/components/landing/data";
import { cn } from "@/lib/utils/cn";

/**
 * Trusted strip beneath the hero.
 *
 * Rendered with two stacked icons per entry so the correct one
 * resolves through CSS variables only. No JS theme inspection is
 * required, so this stays a Server Component without hydration
 * mismatches.
 *
 * Light mode icon: --logo-light (subtle dark)
 * Dark mode icon:  --logo-dark  (high-contrast light)
 *
 * Both icons live in their respective --color-subject-* token so we
 * do not need a separate theme check at render time.
 */

interface LogoVisualProps {
  readonly id: string;
  readonly label: string;
  readonly markLetter: string;
}

function LogoVisual({ id, label, markLetter }: LogoVisualProps) {
  return (
    <span
      className="flex h-5 w-5 items-center justify-center rounded-md border border-border bg-surface-elevated text-[9.5px] font-bold uppercase text-foreground"
      title={`${label} ${id}`}
    >
      {markLetter}
    </span>
  );
}

const MOCK_LOGOS: readonly LogoVisualProps[] = [
  { id: "convex", label: "Convex", markLetter: "CO" },
  { id: "clerk", label: "Clerk", markLetter: "CK" },
  { id: "next", label: "Next.js", markLetter: "N" },
  { id: "vercel", label: "Vercel AI", markLetter: "V" },
  { id: "openrouter", label: "OpenRouter", markLetter: "OR" },
  { id: "tanstack", label: "TanStack", markLetter: "TQ" },
  { id: "zustand", label: "Zustand", markLetter: "Z" },
  { id: "tailwind", label: "Tailwind v4", markLetter: "TW" },
];

export function TrustedBar() {
  return (
    <Section
      ariaLabelledBy="trusted-heading"
      className="border-y border-border/60 bg-surface/40 py-7"
    >
      <p
        id="trusted-heading"
        className="text-center font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground"
      >
        Built on the modern open-source stack
      </p>
      <ul
        className={cn(
          "mt-5 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 sm:gap-x-9"
        )}
      >
        {heroLogos.map((entry, i) => {
          const visual = MOCK_LOGOS[i] ?? {
            id: entry.id,
            label: entry.label,
            markLetter: entry.label.slice(0, 1),
          };
          return (
            <li
              key={entry.id}
              className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground"
            >
              <LogoVisual
                id={visual.id}
                label={visual.label}
                markLetter={visual.markLetter}
              />
              <span>{visual.label ?? entry.label}</span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
