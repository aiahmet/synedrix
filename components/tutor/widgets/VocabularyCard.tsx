"use client";

/**
 * VocabularyCard.tsx — Phase 5 §7.2.
 *
 * Flip card widget for language-related `[[concept:...]]`
 * markers. When the concept name looks like a vocabulary term
 * (has an article prefix like "der", "die", "das", "le", "la",
 * "el", etc. or has a pipe-separated payload), it renders as an
 * interactive flip card that reveals gender, definition, and
 * an example sentence on tap/click.
 *
 * Marker format:
 *   [[concept:der Tisch]]
 *   [[concept:die Freiheit|freedom|Freiheit ist wichtig.]]
 *
 * The piped form `Name|Definition|Example` lets the AI provide
 * richer context. The article-only form `der Tisch` auto-detects
 * the article from the prefix.
 *
 * The flip animation uses CSS 3D transforms with a smooth
 * 400ms transition.
 *
 * Term parsing is in `./vocabularyUtils.ts` (pure, no React)
 * so `tutorWidgets.tsx` can import `isLanguageTerm` without
 * eagerly evaluating this entire component module.
 */

import { useState } from "react";
import { ArrowsClockwise, GenderFemale, GenderMale, GenderNeuter } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils/cn";
import { parseTerm } from "./vocabularyUtils";

// ── Gender helpers ────────────────────────────────────────

function detectGender(article: string): "m" | "f" | "n" | null {
  const a = article.toLowerCase();
  if (["der", "le", "el", "un"].includes(a)) return "m";
  if (["die", "la", "una"].includes(a)) return "f";
  if (a === "das") return "n";
  return null;
}

function GenderIcon({ gender }: { readonly gender: "m" | "f" | "n" }) {
  const cls = "h-4 w-4";
  switch (gender) {
    case "m":
      return <GenderMale className={cls} weight="fill" />;
    case "f":
      return <GenderFemale className={cls} weight="fill" />;
    case "n":
      return <GenderNeuter className={cls} weight="fill" />;
  }
}

const GENDER_COLORS: Record<string, string> = {
  m: "var(--subject-physics, #7c3aed)",
  f: "var(--subject-french, #db2777)",
  n: "var(--subject-chemistry, #059669)",
};

const GENDER_LABELS: Record<string, string> = {
  m: "masculine",
  f: "feminine",
  n: "neuter",
};

// ── Component ─────────────────────────────────────────────

export interface VocabularyCardProps {
  readonly term: string;
  readonly className?: string;
}

export function VocabularyCard({ term, className }: VocabularyCardProps) {
  const [flipped, setFlipped] = useState(false);
  const parts = parseTerm(term);

  if (!parts) {
    // Should not happen — caller guards with isLanguageTerm
    return null;
  }

  const gender = parts.article ? detectGender(parts.article) : null;
  const genderColor = gender ? GENDER_COLORS[gender] : "var(--muted-foreground)";

  return (
    <div
      className={cn("my-3", className)}
      style={{ perspective: "800px" }}
    >
      {/* The flip container */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setFlipped((f) => !f);
          }
        }}
        className={cn(
          "relative w-full cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated",
        )}
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          transition: "transform 0.4s ease",
          minHeight: 100,
        }}
        aria-label={flipped ? `${parts.word} — tap to flip back` : `${parts.word} — tap to reveal`}
      >
        {/* ── Front face ─────────────────────────────────── */}
        <div
          className={cn(
            "overflow-hidden rounded-xl border border-border bg-surface-elevated",
            "shadow-[var(--shadow-soft)]",
          )}
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-border/60">
            <span className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-subtle/70 text-accent">
                <ArrowsClockwise className="h-3 w-3" weight="duotone" />
              </span>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
                Vocabulary
              </span>
            </span>
            {gender && (
              <span
                className="flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.16em]"
                style={{
                  borderColor: `color-mix(in srgb, ${genderColor} 32%, transparent)`,
                  backgroundColor: `color-mix(in srgb, ${genderColor} 10%, transparent)`,
                  color: genderColor,
                }}
              >
                <GenderIcon gender={gender} />
                {GENDER_LABELS[gender]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 px-3.5 py-4">
            {parts.article && (
              <span
                className="shrink-0 rounded-lg border px-2 py-1 font-mono text-[11px] font-medium"
                style={{
                  borderColor: `color-mix(in srgb, ${genderColor} 30%, var(--border))`,
                  color: genderColor,
                }}
              >
                {parts.article}
              </span>
            )}
            <span className="text-[15px] font-semibold tracking-tight text-foreground">
              {parts.word}
            </span>
          </div>
          <div className="border-t border-border/60 px-3.5 py-2">
            <span className="text-[10px] text-muted-foreground/70">
              Tap to reveal
            </span>
          </div>
        </div>

        {/* ── Back face ──────────────────────────────────── */}
        <div
          className={cn(
            "absolute inset-0 overflow-hidden rounded-xl border border-accent-border/40 bg-accent-subtle/30",
            "shadow-[var(--shadow-soft)]",
          )}
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-accent-border/30">
            <span className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <ArrowsClockwise className="h-3 w-3" weight="duotone" />
              </span>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-accent">
                {parts.word}
              </span>
            </span>
            {gender && (
              <span
                className="flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.16em]"
                style={{
                  borderColor: `color-mix(in srgb, ${genderColor} 32%, transparent)`,
                  backgroundColor: `color-mix(in srgb, ${genderColor} 12%, transparent)`,
                  color: genderColor,
                }}
              >
                <GenderIcon gender={gender} />
                {GENDER_LABELS[gender]}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2.5 px-3.5 py-3">
            {parts.article && parts.definition && (
              <div>
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  Definition
                </span>
                <p className="mt-0.5 text-[13px] leading-relaxed text-foreground">
                  {parts.definition}
                </p>
              </div>
            )}
            {parts.article && !parts.definition && (
              <div>
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  Article
                </span>
                <p className="mt-0.5 flex items-center gap-2 text-[13px] leading-relaxed text-foreground">
                  <span
                    className="rounded-md px-1.5 py-0.5 font-mono text-[11px] font-medium"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${genderColor} 12%, transparent)`,
                      color: genderColor,
                    }}
                  >
                    {parts.article}
                  </span>
                  {GENDER_LABELS[gender ?? "m"]}
                </p>
              </div>
            )}
            {parts.example && (
              <div>
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  Example
                </span>
                <p className="mt-0.5 text-[13px] leading-relaxed italic text-foreground/85">
                  &ldquo;{parts.example}&rdquo;
                </p>
              </div>
            )}
            {!parts.definition && !parts.example && (
              <p className="text-[12px] text-muted-foreground">
                Ask the tutor for a definition and example sentence.
              </p>
            )}
          </div>
          <div className="border-t border-accent-border/30 px-3.5 py-2">
            <span className="text-[10px] text-accent/70">
              Tap to flip back
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
