"use client";

import { useState } from "react";
import { CockpitCard, CockpitCardHeader } from "@/components/dashboard/CockpitCard";
import { CaretDown, CaretUp } from "@/components/landing/icons";

interface VocabularyEntry {
  readonly term: string;
  readonly definition: string;
  readonly gender?: "m" | "f" | "n";
  readonly example?: string;
}

const GENDER_LABELS: Record<string, string> = { m: "m", f: "f", n: "n" };

/**
 * TopicVocabularyDeck.
 *
 * Collapsible card that lists the per-topic vocabulary
 * entries. Each shows the foreign term (with gender if
 * set), the German/English definition, and an optional
 * example sentence.
 */
export function TopicVocabularyDeck({
  contents,
}: {
  readonly contents: readonly VocabularyEntry[];
}) {
  const [open, setOpen] = useState(true);

  if (contents.length === 0) return null;

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Vocabulary"
        trailing={
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {open ? "Collapse" : "Expand"} ({contents.length} terms)
            {open ? <CaretUp className="h-3 w-3" weight="bold" /> : <CaretDown className="h-3 w-3" weight="bold" />}
          </button>
        }
      />
      {open && (
        <div className="flex flex-col gap-2 mt-1">
          {contents.map((v, idx) => (
            <div
              key={idx}
              className="flex flex-col gap-1 rounded-lg border border-border/60 bg-background p-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-semibold text-foreground">
                  {v.term}
                </span>
                {v.gender && (
                  <span className="rounded-full bg-surface px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                    {GENDER_LABELS[v.gender] ?? v.gender}
                  </span>
                )}
              </div>
              <p className="text-[12px] text-muted-foreground">
                {v.definition}
              </p>
              {v.example && (
                <p className="text-[11.5px] italic text-muted-foreground/70">
                  {v.example}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </CockpitCard>
  );
}
