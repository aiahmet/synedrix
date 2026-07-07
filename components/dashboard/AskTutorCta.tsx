"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  CockpitCard,
  CockpitCardHeader,
} from "@/components/dashboard/CockpitCard";
import {
  ArrowRight,
  ChatCircleText,
  Plus,
} from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";

/**
 * AskTutorCta.
 *
 * Small composer card on the topic page that lets the user
 * start an ask-tutor conversation without leaving the page.
 *
 * Behavior:
 *   1. The user types a question in the single-line composer.
 *   2. On submit, the component checks `window.getSelection()`
 *      for any selected text. If found, the selection is prefixed
 *      to the composed question as `About "selection": question`
 *      so the tutor thread carries the source context.
 *   3. The combined question is URL-encoded and the user is
 *      routed to /tutor?subject=…&topic=…&q=<encoded>, where the
 *      tutor page reads `?q=` and preloads the composer.
 *
 * Per `docs/SYNEDRIX-FRONTEND-STYLE.md`:
 *
 *   - **No bouncy CTA.** The "Ask" button drops
 *     `active:scale-[0.98]`.
 *
 *   - **`hover:bg-foreground/90`** not `hover:opacity-90` (§6).
 *
 *   - **Crisp focus state.** `focus-within:border-foreground
 *     focus-within:ring-1 focus-within:ring-foreground/40` —
 *     contrast ≥3:1, not the airy 2px `ring-ring` glow.
 *
 * The `slotId` prop is reserved for a future enhancement that
 * scopes selection capture to a specific DOM region. Client
 * because it reads `window.getSelection()` and pushes a route.
 */
export function AskTutorCta({
  subject,
  topic,
  slotId,
}: {
  readonly subject: {
    readonly slug: string;
    readonly title: string;
  };
  readonly topic?: {
    readonly slug: string;
    readonly title: string;
  } | null;
  readonly slotId?: string;
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [quotedHint, setQuotedHint] = useState(false);

  const onSubmit = () => {
    const typed = input.trim();
    let combined = typed;
    if (typeof window !== "undefined") {
      const selection = window.getSelection()?.toString().trim() ?? "";
      if (selection.length > 0 && selection.length < 800) {
        const truncated =
          selection.length > 600
            ? `${selection.slice(0, 600)}…`
            : selection;
        if (typed.length === 0) {
          combined = `About "${truncated}"`;
        } else {
          combined = `About "${truncated}": ${typed}`;
        }
      }
    }
    void slotId;
    const params = new URLSearchParams({
      subject: subject.slug,
      ...(topic ? { topic: topic.slug } : {}),
      ...(combined.length > 0 ? { q: combined } : {}),
      from:
        typeof window !== "undefined"
          ? window.location.pathname
          : topic
            ? `/subjects/${topic.slug}`
            : `/subjects/${subject.slug}`,
    });
    router.push(`/tutor?${params.toString()}`);
  };

  const onChange = (value: string) => {
    setInput(value);
    if (typeof window !== "undefined") {
      const sel = window.getSelection()?.toString().trim() ?? "";
      setQuotedHint(sel.length > 0 && value.length === 0);
    } else {
      setQuotedHint(false);
    }
  };

  const canSubmit = input.trim().length > 0 || quotedHint;

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Ask the tutor"
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            {topic ? "About this topic" : "About this subject"}
          </span>
        }
      />
      <div className="flex flex-col gap-2">
        <div
          className={cn(
            "flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 transition-colors",
            "focus-within:border-foreground focus-within:ring-1 focus-within:ring-foreground/40",
          )}
        >
          <ChatCircleText
            className="h-4 w-4 shrink-0 text-muted-foreground"
            weight="duotone"
          />
          <input
            type="text"
            value={input}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit) {
                e.preventDefault();
                onSubmit();
              }
            }}
            placeholder={
              topic
                ? "Ask a question — selection is quoted automatically"
                : "Ask about any topic in this subject"
            }
            className="min-w-0 flex-1 bg-transparent text-[12.5px] leading-snug text-foreground placeholder:text-muted-foreground focus:outline-none"
            aria-label={
              topic
                ? "Ask the tutor a question about this topic"
                : "Ask the tutor a question about this subject"
            }
          />
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2.5 text-[11.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              "bg-foreground text-background hover:bg-foreground/90",
            )}
          >
            <Plus className="h-3 w-3" weight="bold" />
            Ask
            <ArrowRight className="h-3 w-3" weight="bold" />
          </button>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {quotedHint
            ? "Selected text will be quoted into the question."
            : "Tip: select any text inside the lesson and the tutor will pick it up."}
        </p>
      </div>
    </CockpitCard>
  );
}
