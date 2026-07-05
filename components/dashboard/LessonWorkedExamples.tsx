"use client";

import { useState } from "react";
import { parseInline, renderMath, type InlineNode } from "@/lib/content/miniMarkdown";
import { CaretDown, CaretUp, Lightbulb } from "@/components/landing/icons";

export interface WorkedExample {
  readonly setup: string;
  readonly solution: string;
  readonly skill: string;
}

/**
 * Render inline nodes as React elements.
 */
function InlineRenderer({ nodes }: { readonly nodes: readonly InlineNode[] }) {
  return (
    <>
      {nodes.map((node, i) => {
        if (node.kind === "text") return <span key={i}>{node.text}</span>;
        if (node.kind === "bold") return <strong key={i}><InlineRenderer nodes={node.children} /></strong>;
        if (node.kind === "italic") return <em key={i}><InlineRenderer nodes={node.children} /></em>;
        if (node.kind === "inline_math") return <code key={i} className="rounded bg-surface px-1 py-0.5 font-mono text-[12px] text-accent">{renderMath(node.expression)}</code>;
        if (node.kind === "inline_code") return <code key={i} className="rounded bg-surface px-1 py-0.5 font-mono text-[12px] text-foreground/80">{node.text}</code>;
        return null;
      })}
    </>
  );
}

/**
 * LessonWorkedExamples.
 *
 * Renders the per-depth worked examples below the lesson
 * prose. Each example is a card with setup + solution,
 * collapsible for self-testing.
 */
export function LessonWorkedExamples({
  examples,
}: {
  readonly examples: readonly WorkedExample[];
}) {
  if (examples.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-accent" weight="duotone" />
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Worked examples
        </span>
      </div>
      {examples.map((ex, idx) => (
        <WorkedExampleCard key={idx} example={ex} index={idx} />
      ))}
    </div>
  );
}

function WorkedExampleCard({
  example,
  index,
}: {
  readonly example: WorkedExample;
  readonly index: number;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-xl border border-border/60 bg-surface-elevated p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-[10.5px] tabular-nums uppercase tracking-[0.16em] text-muted-foreground">
              Example {index + 1}
            </span>
            <span className="rounded-full border border-border bg-surface px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
              {example.skill}
            </span>
          </div>
          <p className="text-[13.5px] leading-relaxed text-foreground">
            <InlineRenderer nodes={parseInline(example.setup)} />
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-surface hover:text-foreground transition-colors"
          aria-label={open ? "Hide solution" : "Show solution"}
        >
          {open ? <CaretUp className="h-3.5 w-3.5" weight="bold" /> : <CaretDown className="h-3.5 w-3.5" weight="bold" />}
        </button>
      </div>
      {open && (
        <div className="mt-3 rounded-lg bg-background p-3 border border-border/40">
          <p className="text-[13px] leading-relaxed text-foreground/90">
            <InlineRenderer nodes={parseInline(example.solution)} />
          </p>
        </div>
      )}
    </div>
  );
}
