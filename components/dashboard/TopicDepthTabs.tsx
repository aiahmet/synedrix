"use client";

import { useState, type ReactNode } from "react";
import {
  CockpitCard,
  CockpitCardHeader,
} from "@/components/dashboard/CockpitCard";
import {
  Compass,
  GraduationCap,
  Stack,
  Books,
} from "@/components/landing/icons";
import { cn } from "@/lib/utils/cn";
import {
  parseMiniMarkdown,
  renderMath,
  type InlineNode,
  type BlockNode,
} from "@/lib/content/miniMarkdown";
import { LessonWorkedExamples, type WorkedExample } from "./LessonWorkedExamples";

/**
 * LessonBlock row shape with enriched fields from
 * getTopicDetailBySlug.
 */
export interface TopicLessonBlock {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly order: number;
  readonly workedExamples?: readonly WorkedExample[];
  readonly commonMistakes?: readonly {
    mistake: string;
    correction: string;
    cause: string;
  }[];
  readonly formulas?: readonly {
    name: string;
    expression: string;
    when: string;
  }[];
  readonly vocabulary?: readonly {
    term: string;
    definition: string;
    gender?: "m" | "f" | "n";
  }[];
}

/**
 * Inline node renderer.
 */
function InlineNodes({ nodes }: { readonly nodes: readonly InlineNode[] }) {
  return (
    <>
      {nodes.map((node, i) => {
        if (node.kind === "text") return <span key={i}>{node.text}</span>;
        if (node.kind === "bold") return <strong key={i}><InlineNodes nodes={node.children} /></strong>;
        if (node.kind === "italic") return <em key={i}><InlineNodes nodes={node.children} /></em>;
        if (node.kind === "inline_math") return <code key={i} className="rounded bg-surface px-1 py-0.5 font-mono text-[12px] text-accent">{renderMath(node.expression)}</code>;
        if (node.kind === "inline_code") return <code key={i} className="rounded bg-surface px-1 py-0.5 font-mono text-[12px] text-foreground/80">{node.text}</code>;
        return null;
      })}
    </>
  );
}

/**
 * Block renderer. Renders each block node as its
 * corresponding React element.
 */
function BlockRenderer({ block }: { readonly block: BlockNode }) {
  if (block.kind === "paragraph") {
    return <p className="text-[13.5px] leading-relaxed text-foreground/90"><InlineNodes nodes={block.children} /></p>;
  }
  if (block.kind === "block_math") {
    return (
      <div className="my-3 rounded-lg bg-surface-elevated p-3 text-center font-mono text-[13px] text-accent">
        {renderMath(block.expression)}
      </div>
    );
  }
  if (block.kind === "code_block") {
    return (
      <pre className="my-3 rounded-lg bg-surface-elevated p-3 font-mono text-[12px] leading-relaxed text-foreground/80 overflow-x-auto">
        {block.text}
      </pre>
    );
  }
  if (block.kind === "callout") {
    const colors: Record<string, string> = {
      example: "var(--accent)",
      mistake: "var(--subject-french)",
      note: "var(--subject-english)",
    };
    const color = colors[block.calloutKind] ?? "var(--accent)";
    return (
      <div
        className="my-3 rounded-xl border p-3"
        style={{
          backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)`,
          borderColor: `color-mix(in srgb, ${color} 25%, transparent)`,
        }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-1" style={{ color }}>
          {block.calloutKind === "example" ? "Example" : block.calloutKind === "mistake" ? "Common mistake" : "Note"}
          {block.title ? `: ${block.title}` : ""}
        </p>
        <p className="text-[13px] leading-relaxed text-foreground/90">
          <InlineNodes nodes={block.body} />
        </p>
      </div>
    );
  }
  if (block.kind === "bullet_list") {
    return (
      <ul className="my-2 flex flex-col gap-1 pl-5 list-disc">
        {block.items.map((item, i) => (
          <li key={i} className="text-[13px] leading-relaxed text-foreground/90">
            <InlineNodes nodes={item.children} />
          </li>
        ))}
      </ul>
    );
  }
  if (block.kind === "ordered_list") {
    return (
      <ol className="my-2 flex flex-col gap-1 pl-5 list-decimal">
        {block.items.map((item, i) => (
          <li key={i} className="text-[13px] leading-relaxed text-foreground/90">
            <InlineNodes nodes={item.children} />
          </li>
        ))}
      </ol>
    );
  }
  if (block.kind === "table") {
    return (
      <div className="my-3 overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="bg-surface-elevated">
              {block.node.header.cells.map((cell, i) => (
                <th key={i} className="px-3 py-2 text-left font-semibold text-foreground">
                  <InlineNodes nodes={cell.children} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.node.rows.map((row, ri) => (
              <tr key={ri} className="border-t border-border/40">
                {row.cells.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-foreground/80">
                    <InlineNodes nodes={cell.children} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return null;
}

/**
 * Pre-seeded common mistakes per block (not from user history).
 */
function PreSeededMistakes({
  mistakes,
}: {
  readonly mistakes: readonly {
    mistake: string;
    correction: string;
    cause: string;
  }[];
}) {
  if (!mistakes || mistakes.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Watch out for
      </p>
      {mistakes.map((m, i) => (
        <div key={i} className="rounded-lg border border-subject-french/30 bg-subject-french/[0.06] p-3">
          <p className="text-[12.5px] font-medium text-foreground">
            ✗ {m.mistake}
          </p>
          <p className="mt-1 text-[12px] text-accent">
            ✓ {m.correction}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {m.cause}
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * Pre-seeded formulas per block.
 */
function InlineFormulas({
  formulas,
}: {
  readonly formulas: readonly {
    name: string;
    expression: string;
    when: string;
  }[];
}) {
  if (!formulas || formulas.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Key formulas
      </p>
      {formulas.map((f, i) => (
        <div key={i} className="rounded-lg border border-border/60 bg-surface-elevated p-3">
          <p className="text-[12.5px] font-semibold text-foreground">{f.name}</p>
          <code className="mt-1 block font-mono text-[13px] text-accent">{renderMath(f.expression)}</code>
          <p className="mt-1 text-[11.5px] text-muted-foreground">{f.when}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * Pre-seeded vocabulary per block.
 */
function InlineVocabulary({
  vocabulary,
}: {
  readonly vocabulary: readonly {
    term: string;
    definition: string;
    gender?: "m" | "f" | "n";
  }[];
}) {
  if (!vocabulary || vocabulary.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Key vocabulary
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {vocabulary.map((v, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface-elevated p-2.5">
            <span className="text-[12.5px] font-medium text-foreground">{v.term}</span>
            {v.gender && <span className="font-mono text-[10px] text-muted-foreground">({v.gender})</span>}
            <span className="text-[11.5px] text-muted-foreground ml-auto">{v.definition}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * TopicDepthTabs.
 *
 * Segmented control over the three lesson depths.
 * Now renders lesson content via the mini-markdown parser
 * and shows worked examples, pre-seeded mistakes, formulas,
 * and vocabulary per block.
 */
export function TopicDepthTabs({
  simple,
  standard,
  rigorous,
}: {
  readonly simple: readonly TopicLessonBlock[];
  readonly standard: readonly TopicLessonBlock[];
  readonly rigorous: readonly TopicLessonBlock[];
}) {
  const [active, setActive] = useState<"simple" | "standard" | "rigorous">("standard");

  return (
    <CockpitCard>
      <CockpitCardHeader
        label="Lesson"
        trailing={
          <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            Three depths · one topic
          </span>
        }
      />

      <div
        role="tablist"
        aria-label="Lesson depth"
        className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-surface p-1"
      >
        <DepthTab label="Simple" icon={<Books className="h-3.5 w-3.5" weight="duotone" />} active={active === "simple"} count={simple.length} onSelect={() => setActive("simple")} />
        <DepthTab label="Standard" icon={<Compass className="h-3.5 w-3.5" weight="duotone" />} active={active === "standard"} count={standard.length} onSelect={() => setActive("standard")} />
        <DepthTab label="Rigorous" icon={<GraduationCap className="h-3.5 w-3.5" weight="duotone" />} active={active === "rigorous"} count={rigorous.length} onSelect={() => setActive("rigorous")} />
      </div>

      <div className="mt-5">
        {active === "simple" && <LessonBlockList blocks={simple} emptyMessage="A simple walkthrough has not been authored yet for this topic." />}
        {active === "standard" && <LessonBlockList blocks={standard} emptyMessage="The standard exam-level walkthrough is not in the catalog yet." />}
        {active === "rigorous" && <LessonBlockList blocks={rigorous} emptyMessage="A rigorous, Olympiad-style block is not yet authored for this topic." />}
      </div>
    </CockpitCard>
  );
}

function DepthTab({
  label,
  icon,
  active,
  count,
  onSelect,
}: {
  readonly label: string;
  readonly icon: ReactNode;
  readonly active: boolean;
  readonly count: number;
  readonly onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-medium transition-all active:scale-[0.98]",
        active
          ? "bg-background text-foreground shadow-[var(--shadow-soft)]"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
      <span className={cn("ml-1 rounded-full px-1.5 py-0.5 font-mono text-[9.5px] tabular-nums", active ? "bg-accent-subtle text-accent" : "bg-surface-sunken/60 text-muted-foreground")}>
        {count}
      </span>
    </button>
  );
}

function LessonBlockList({
  blocks,
  emptyMessage,
}: {
  readonly blocks: readonly TopicLessonBlock[];
  readonly emptyMessage: string;
}) {
  if (blocks.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-dashed border-border bg-surface-elevated p-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: "color-mix(in srgb, var(--subject-french) 12%, transparent)", color: "var(--subject-french)" }} aria-hidden>
          <Stack className="h-4 w-4" weight="duotone" />
        </span>
        <p className="text-[13px] leading-relaxed text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5" data-topic-lesson-root="true">
      {blocks.map((block, idx) => (
        <article key={block.id} aria-labelledby={`block-${block.id}-title`} className="rounded-xl border border-border/60 bg-background p-4 sm:p-5">
          <header className="mb-3 flex items-baseline gap-3">
            <span className="font-mono text-[10.5px] tabular-nums uppercase tracking-[0.16em] text-muted-foreground">
              Block {String(idx + 1).padStart(2, "0")}
            </span>
            <h2 id={`block-${block.id}-title`} className="text-[15px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
              {block.title}
            </h2>
          </header>
          <LessonBlockBody content={block.content} />
          {block.workedExamples && block.workedExamples.length > 0 && (
            <LessonWorkedExamples examples={block.workedExamples} />
          )}
          {block.formulas && block.formulas.length > 0 && (
            <InlineFormulas formulas={block.formulas} />
          )}
          {block.commonMistakes && block.commonMistakes.length > 0 && (
            <PreSeededMistakes mistakes={block.commonMistakes} />
          )}
          {block.vocabulary && block.vocabulary.length > 0 && (
            <InlineVocabulary vocabulary={block.vocabulary} />
          )}
        </article>
      ))}
    </div>
  );
}

/**
 * Render the LessonBlock content via the mini-markdown parser.
 * This replaces the old paragraph-split renderer with full
 * support for math, code, callouts, lists, and tables.
 */
function LessonBlockBody({ content }: { readonly content: string }) {
  const ast = parseMiniMarkdownSafe(content);
  if (ast) {
    if (ast.blocks.length === 0) return null;
    return (
      <div className="flex flex-col gap-3">
        {ast.blocks.map((block, idx) => (
          <BlockRenderer key={idx} block={block} />
        ))}
      </div>
    );
  }

  // Fallback to plain paragraph rendering on parse error
  const paragraphs = content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (paragraphs.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {paragraphs.map((p, idx) => (
        <p key={idx} className="text-[13.5px] leading-relaxed text-foreground/90">{p}</p>
      ))}
    </div>
  );
}

/**
 * Safe parse wrapper — returns null when mini-markdown
 * parsing fails so LessonBlockBody can branch declaratively
 * without embedding JSX inside try/catch.
 */
function parseMiniMarkdownSafe(content: string): ReturnType<typeof parseMiniMarkdown> | null {
  try {
    return parseMiniMarkdown(content);
  } catch {
    return null;
  }
}
