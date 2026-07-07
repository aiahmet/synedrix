"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle,
  CircleNotch,
  Flask,
  FlowArrow,
  MathOperations,
  Pulse,
  Question,
  Sparkle,
  Stack,
  Warning,
} from "@phosphor-icons/react/dist/ssr";

import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import dynamic from "next/dynamic";
import { isLanguageTerm } from "@/components/tutor/widgets/vocabularyUtils";
import { parseFormula } from "@/components/tutor/widgets/MoleculeDiagram";


const GraphPlotter = dynamic(
  async () => (await import("@/components/tutor/widgets/GraphPlotter")).GraphPlotter,
  { ssr: false }
);

const VocabularyCard = dynamic(
  async () => (await import("@/components/tutor/widgets/VocabularyCard")).VocabularyCard,
  { ssr: false }
);

const CodeBlock = dynamic(
  async () => (await import("@/components/tutor/widgets/CodeBlock")).CodeBlock,
  { ssr: false }
);

const MoleculeDiagram = dynamic(
  async () => (await import("@/components/tutor/widgets/MoleculeDiagram")).MoleculeDiagram,
  { ssr: false }
);

export type BlockMarker =
  | { kind: "topic"; slug: string; title: string; complete: true }
  | { kind: "formula"; name: string; expression: string; when: string; complete: true }
  | { kind: "mistake"; type: string; cause: string; complete: true }
  | { kind: "concept"; name: string; complete: true }
  | { kind: "steps"; steps: ReadonlyArray<string>; complete: true }
  | {
      kind: "choice";
      prompt: string;
      options: ReadonlyArray<{ label: string; text: string }>;
      correctLabel: string;
      complete: true;
    }
  | { kind: "diagram"; subkind: DiagramKind; spec: DiagramSpec; complete: true }
  | {
      kind: "code";
      language: string;
      code: string;
      complete: true;
    }
  | { kind: "incomplete"; raw: string };

export type DiagramKind = "tree" | "numberline" | "barchart" | "graph" | "molecule";

export type DiagramSpec =
  | { kind: "tree"; edges: ReadonlyArray<readonly [string, string]> }
  | {
      kind: "numberline";
      min: number;
      max: number;
      highlight: number;
    }
  | {
      kind: "barchart";
      labels: ReadonlyArray<string>;
      values: ReadonlyArray<number>;
    }
  | {
      kind: "graph";
      formula: string;
      xmin: number;
      xmax: number;
    }
  | {
      kind: "molecule";
      formula: string;
    };

const OPEN = "[[";
const CLOSE = "]]";

export function parseBlockMarker(raw: string): BlockMarker | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith(OPEN)) return null;

  if (!trimmed.endsWith(CLOSE)) {
    return { kind: "incomplete", raw: trimmed };
  }

  const inner = trimmed.slice(OPEN.length, trimmed.length - CLOSE.length);
  const colonIdx = inner.indexOf(":");
  if (colonIdx <= 0) return { kind: "incomplete", raw: trimmed };
  const kind = inner.slice(0, colonIdx);
  const payload = inner.slice(colonIdx + 1);

  switch (kind) {
    case "topic": {
      const parts = splitPipes(payload, 2);
      if (parts.length !== 2) return null;
      const [slug, title] = parts;
      if (!slug || !title) return null;
      return { kind: "topic", slug, title, complete: true };
    }
    case "formula": {
      const parts = splitPipes(payload, 3);
      if (parts.length !== 3) return null;
      const [name, expression, when] = parts;
      if (!name || !expression || !when) return null;
      return { kind: "formula", name, expression, when, complete: true };
    }
    case "mistake": {
      // Format: `TYPE|Cause`.
      const parts = splitPipes(payload, 2);
      if (parts.length !== 2) return null;
      const [type, cause] = parts;
      if (!type) return null;
      return { kind: "mistake", type, cause: cause ?? "", complete: true };
    }
    case "concept": {
      // Format: `Name` (no pipes).
      const trimmedName = payload.trim();
      if (!trimmedName) return null;
      return { kind: "concept", name: trimmedName, complete: true };
    }
    case "steps": {
      // Format: `Step 1: do X|Step 2: do Y|...`. Pipe-
      // separated, in reveal order.
      const steps = splitPipes(payload).filter((s) => s.trim().length > 0);
      if (steps.length === 0) return null;
      return { kind: "steps", steps, complete: true };
    }
    case "choice": {
      // Format:
      //   Prompt|Option A text|Option B text|...|Correct=<label>
      const parts = splitPipes(payload);
      if (parts.length < 3) return null;
      const prompt = parts[0];
      const correctPart = parts[parts.length - 1];
      if (!prompt || !correctPart.startsWith("Correct=")) return null;
      const correctLabel = correctPart.slice("Correct=".length);
      const optionTexts = parts.slice(1, -1);
      const options = optionTexts
        .map((text) => parseChoiceOption(text))
        .filter((o): o is { label: string; text: string } => o !== null);
      if (options.length < 2) return null;
      return { kind: "choice", prompt, options, correctLabel, complete: true };
    }
    case "diagram": {
      // Format: `diagramKind|spec-string`. Diagram
      // kind is the FIRST pipe-piece; spec is the rest,
      // also pipe-separated into key:value pairs.
      const parts = splitPipes(payload, 2);
      if (parts.length !== 2) return null;
      return parseDiagramMarker(parts[0] ?? "", parts[1] ?? "");
    }
    case "code": {
      // Phase 5 §7.3 — [[code:lang|code-body]]
      // Format: `language|code`. Language is a short
      // identifier (python, js, html, etc.). Code is
      // the rest of the payload (may contain pipes).
      const parts = splitPipes(payload, 2);
      if (parts.length !== 2) return null;
      const language = (parts[0] ?? "").trim();
      const code = (parts[1] ?? "").trim();
      if (!language || !code) return null;
      return { kind: "code", language, code, complete: true };
    }
    default:
      // Unknown marker — surface as raw so the user
      // can still read it. Returning null would
      // silently strip content; the partial-parse
      // path here keeps the text visible in the chat
      // surface even when the model emits a typo.
      return null;
  }
}

/**
 * Split a payload string on `|` UP TO `limit` parts.
 * Last part is the remainder (so a payload that
 * accidentally contains `|` is preserved verbatim
 * rather than split into nonsense). When `limit` is
 * undefined, returns every part.
 */
function splitPipes(s: string, limit?: number): string[] {
  if (limit === undefined) return s.split("|");
  const parts: string[] = [];
  let cursor = 0;
  let found = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "|" && found < limit - 1) {
      parts.push(s.slice(cursor, i));
      cursor = i + 1;
      found += 1;
    }
  }
  parts.push(s.slice(cursor));
  return parts;
}

/**
 * Parse `A) Product Rule` into `{ label: "A", text:
 * "Product Rule" }`. Returns `null` if the leading
 * `A) ` is missing — the choice marker should never
 * emit the option text without a label leading it.
 */
function parseChoiceOption(raw: string): { label: string; text: string } | null {
  const m = /^([A-Za-z0-9]+)\)\s*(.+)$/.exec(raw);
  if (!m) return null;
  return { label: m[1], text: m[2] };
}

/**
 * parseDiagramMarker.
 *
 * Parses `kind|specPieces` into the DiagramSpec
 * discriminated union. Each subkind parses its own
 * shape — unknown kinds return `null` so the caller
 * passes the marker through react-markdown as plain
 * text (which is the safest fallback for an unknown
 * syntax).
 */
function parseDiagramMarker(kindRaw: string, specRaw: string): BlockMarker | null {
  const subkind = kindRaw.trim();
  switch (subkind) {
    case "tree":
      return parseTreeDiagram(specRaw);
    case "numberline":
      return parseNumberlineDiagram(specRaw);
    case "barchart":
      return parseBarchartDiagram(specRaw);
    case "graph":
      return parseGraphDiagram(specRaw);
    case "molecule":
      return parseMoleculeDiagram(specRaw);
    default:
      return null;
  }
}

/**
 * Tree diagram spec: comma-separated edges. Each edge
 * is a `parent->child1->child2->...` chain. The
 * parser collapses the chain into the canonical
 * left-to-right sequence so a single comma-separated
 * entry can describe a whole branch in one go, e.g.
 *
 *   `a->b->c,a->d`  →  [(a,b), (b,c), (a,d)]
 *
 * Three-deep is the practical MVP ceiling; deeper
 * trees just look cramped on a chat bubble.
 */
function parseTreeDiagram(specRaw: string): { kind: "diagram"; subkind: DiagramKind; spec: DiagramSpec; complete: true } | null {
  const edgeStrings = specRaw.split(",").map((s) => s.trim()).filter(Boolean);
  const edges: Array<readonly [string, string]> = [];
  for (const e of edgeStrings) {
    const parts = e.split("->").map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) return null;
    // Collapse the chain into a left-to-right walk:
    // each node becomes the parent of the next.
    for (let i = 0; i < parts.length - 1; i++) {
      const a = parts[i];
      const b = parts[i + 1];
      if (!a || !b) return null;
      edges.push([a, b]);
    }
  }
  if (edges.length === 0) return null;
  return {
    kind: "diagram",
    subkind: "tree",
    spec: { kind: "tree", edges },
    complete: true,
  };
}

/**
 * Numberline spec: `min:N|max:M|highlight:H`. The
 * `highlight` is the single chip the panel renders
 * on top of the bar. Negative values are accepted
 * (the math is common).
 */
function parseNumberlineDiagram(specRaw: string): { kind: "diagram"; subkind: DiagramKind; spec: DiagramSpec; complete: true } | null {
  const map = readKeyValues(specRaw);
  if (map === null) return null;
  const min = Number(map["min"]);
  const max = Number(map["max"]);
  const highlight = Number(map["highlight"] ?? "NaN");
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) return null;
  if (!Number.isFinite(highlight) || highlight < min || highlight > max) return null;
  return {
    kind: "diagram",
    subkind: "numberline",
    spec: { kind: "numberline", min, max, highlight },
    complete: true,
  };
}

/**
 * Barchart spec: `labels:A,B,C|values:5,3,7`. Visual
 * = a horizontal flex of proportional widths.
 */
function parseBarchartDiagram(specRaw: string): { kind: "diagram"; subkind: DiagramKind; spec: DiagramSpec; complete: true } | null {
  const map = readKeyValues(specRaw);
  if (map === null) return null;
  const labels = (map["labels"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const values = (map["values"] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s));
  if (labels.length === 0 || values.length === 0) return null;
  if (labels.length !== values.length) return null;
  if (values.some((v) => !Number.isFinite(v) || v < 0)) return null;
  return {
    kind: "diagram",
    subkind: "barchart",
    spec: { kind: "barchart", labels, values },
    complete: true,
  };
}

/**
 * Graph spec: `formula:y=x^2|xmin:-2|xmax:2`.
 * Phase 5 §7.1: rendered by the interactive
 * GraphPlotter canvas widget (zoom, pan, roots,
 * extrema). The previous placeholder card is
 * replaced.
 */
function parseGraphDiagram(specRaw: string): { kind: "diagram"; subkind: DiagramKind; spec: DiagramSpec; complete: true } | null {
  const map = readKeyValues(specRaw);
  if (map === null) return null;
  const formula = (map["formula"] ?? "").trim();
  if (!formula) return null;
  const xmin = Number(map["xmin"] ?? "-1");
  const xmax = Number(map["xmax"] ?? "1");
  if (!Number.isFinite(xmin) || !Number.isFinite(xmax) || xmin >= xmax) return null;
  return {
    kind: "diagram",
    subkind: "graph",
    spec: { kind: "graph", formula, xmin, xmax },
    complete: true,
  };
}

/**
 * Molecule spec: plain chemical formula like `H2O`.
 * Phase 5 §7.4: rendered as an SVG ball-and-stick
 * diagram.
 */
function parseMoleculeDiagram(specRaw: string): { kind: "diagram"; subkind: DiagramKind; spec: DiagramSpec; complete: true } | null {
  const formula = specRaw.trim();
  if (!formula) return null;
  // Validate formula syntax at parse time so invalid
  // markers are rejected early (the DiagramBlock
  // never renders a broken molecule).
  if (parseFormula(formula) === null) return null;
  return {
    kind: "diagram",
    subkind: "molecule",
    spec: { kind: "molecule", formula },
    complete: true,
  };
}

/**
 * readKeyValues.
 *
 * Parses `key:value,key:value` into a map. Tokens
 * with no colon are silently ignored; we don't bail
 * on the whole spec for one malformed piece.
 */
function readKeyValues(raw: string): Record<string, string> | null {
  const pieces = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const out: Record<string, string> = {};
  let any = false;
  for (const p of pieces) {
    const colonIdx = p.indexOf(":");
    if (colonIdx <= 0) continue;
    out[p.slice(0, colonIdx)] = p.slice(colonIdx + 1);
    any = true;
  }
  return any ? out : null;
}

/**
 * BlockWidget.
 *
 * The dispatch face. Receives a parsed marker and
 * renders the focused widget for its kind. Falls
 * through to a styled raw-text view if the parse
 * failed (so a malformed marker still renders).
 *
 * Streamed partial markers (`kind: "incomplete"` from
 * the parser) render a quiet skeleton with a Pulse
 * chip so the user sees the widget shaping up — much
 * cleaner than letting them see raw `[[steps:...`.
 *
 * Phase 4 §6.1 — choice-click engagement signal:
 * `streaming` and `onChoicePicked` are threaded down
 * to `ChoiceMenu` so the widget can compute
 * `responseTimeMs` from the moment it became
 * interactable (streaming flipped false) to the
 * user's click. The signal flows up to `MessageList`
 * → `TutorClient` → Convex strategy state, where the
 * route handler decides whether to inject a
 * passive-dismissal nudge block on the next prompt
 * build.
 */
export function BlockWidget({
  marker,
  className,
  streaming,
  onAskQuestion,
  onChoicePicked,
}: {
  readonly marker: BlockMarker;
  readonly className?: string;
  /**
   * Whether the parent chat surface is actively
   * streaming this message. Threaded down to
   * `StepReveal` so it auto-emerges progressively
   * instead of waiting for the user's manual
   * reveal CTA. Threaded down to `ChoiceMenu` so
   * it can compute the choice-click response time
   * from "settled" rather than "first mounted"
   * (the streaming seconds themselves should NOT
   * count as readable time). Defaults to `false`
   * (the user-controlled pattern, which is
   * correct for any widget rendered outside a
   * live stream).
   */
  readonly streaming?: boolean;
  /**
   * Optional callback the choice widget invokes when
   * the user clicks an option. The parent composer
   * uses it to thread the choice as a follow-up
   * message into the chat.
   */
  readonly onAskQuestion?: (text: string) => void;
  /**
   * Phase 4 §6.1: callback fired when the user
   * clicks a `[[choice:...]]` option. Carries
   * `responseTimeMs` (time from when the widget
   * became interactable to the click) and the picked
   * label so the parent can persist the signal to
   * the strategy state. Render paths that don't
   * surface choice widgets can omit this prop.
   */
  readonly onChoicePicked?: (signal: {
    readonly responseTimeMs: number;
    readonly pickedCorrect: boolean;
  }) => void;
}) {
  if (marker.kind === "incomplete") {
    return <IncompleteSkeleton className={className} />;
  }
  switch (marker.kind) {
    case "topic":
      return <TopicCard slug={marker.slug} title={marker.title} className={className} />;
    case "formula":
      return <FormulaCard name={marker.name} expression={marker.expression} when={marker.when} className={className} />;
    case "mistake":
      return <MistakeCard mistakeType={marker.type} cause={marker.cause} className={className} />;
    case "concept":
      // Phase 5 §7.2: if the concept looks like a language
      // term (has article prefix like "der", "die", "das"),
      // render as a flip card instead of a plain chip.
      if (isLanguageTerm(marker.name)) {
        return (
          <VocabularyCard term={marker.name} className={className} />
        );
      }
      return <ConceptChip name={marker.name} className={className} />;
    case "steps":
      return (
        <StepReveal
          steps={marker.steps}
          {...(streaming !== undefined ? { streaming } : {})}
          className={className}
        />
      );
    case "choice":
      return (
        <ChoiceMenu
          prompt={marker.prompt}
          options={marker.options}
          correctLabel={marker.correctLabel}
          onAskQuestion={onAskQuestion}
          {...(onChoicePicked !== undefined ? { onChoicePicked } : {})}
          {...(streaming !== undefined ? { streaming } : {})}
          className={className}
        />
      );
    case "code":
      return (
        <CodeBlock
          language={marker.language}
          code={marker.code}
          className={className}
        />
      );
    case "diagram":
      return <DiagramBlock diagram={marker.spec} className={className} />;
    default:
      return null;
  }
}

/**
 * IncompleteSkeleton.
 *
 * The streaming-edge placeholder. Centered Pulse
 * with a quiet "map pending…" label so the user
 * understands what they're waiting for without
 * guessing.
 */
function IncompleteSkeleton({ className }: { readonly className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "my-3 flex items-center gap-3 rounded-xl border border-dashed border-border bg-surface-elevated/40 px-3.5 py-2.5",
        className
      )}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-subtle/60 text-accent" aria-hidden>
        <Pulse className="h-3.5 w-3.5 animate-pulse" weight="duotone" />
      </span>
      <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
        Composing widget
      </span>
    </div>
  );
}

/**
 * TopicCard.
 *
 * Renders the AI's mention of a topic in the
 * curriculum as a clickable card. Falls through to
 * `/subjects/[slug]` when the slug matches a known
 * pattern (we don't have a canonical
 * `topicSlugByName` lookup, so we use the slug the
 * AI emitted verbatim — the prompt teaches a
 * `/subjects/[subject]/[chapter]/[topic]` slug
 * shape).
 */
function TopicCard({
  slug,
  title,
  className,
}: {
  readonly slug: string;
  readonly title: string;
  readonly className?: string;
}) {
  // The slug is opaque here — the chat prompt teaches
  // a canonical `"relativeSlug"` like
  // "logarithmen" (the chapter+topic form), but the
  // client can't resolve it without another query.
  // We link to the subject's index page when no
  // slash is present, or to the nested path when it
  // is. This is intentionally tolerant — clicking
  // opens a relevant page rather than 404'ing.
  const href = guessTopicHref(slug);
  return (
    <LinkSurface href={href} className={className}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-subtle/70 text-accent" aria-hidden>
        <Stack className="h-4 w-4" weight="duotone" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground">
          Topic
        </p>
        <p className="truncate text-[13.5px] font-semibold tracking-tight text-foreground">
          {title}
        </p>
      </div>
      <span className="flex items-center gap-1 text-[11.5px] font-medium text-accent">
        Open
        <ArrowRight className="h-3 w-3" weight="bold" />
      </span>
    </LinkSurface>
  );
}

function guessTopicHref(slug: string): string {
  const s = slug.trim().toLowerCase();
  if (!s) return "/subjects";
  // Already a path-shaped slug (e.g.
  // 'math/arithmetik/potenzen') → return as-is under
  // /subjects/.
  if (s.includes("/")) return `/subjects/${s}`;
  return `/subjects/${s}`;
}

/**
 * FormulaCard.
 *
 * Renders the AI's reference to a formula as a
 * floating card. The expression is rendered with
 * KaTeX via the existing `AIMarkdown` math extension
 * — wrapping `\(…\)` around the raw expression
 * routes it through the same KaTeX-aware sanitizer
 * the chat prose uses, with no extra code path.
 */
function FormulaCard({
  name,
  expression,
  when,
  className,
}: {
  readonly name: string;
  readonly expression: string;
  readonly when: string;
  readonly className?: string;
}) {
  // Wrap the expression in markdown inline-math so
  // AIMarkdown's rehype-katex fires. This keeps a
  // single math-rendering pipeline across the chat
  // surface.
  const md = `\\(${expression}\\)`;
  // Lazy import the renderer to avoid a circular
  // typecheck between this file and aiMarkdown.tsx.
  // The renderer is React.memo + pure — no setup at
  // render time.
  return (
    <div
      className={cn(
        "my-3 overflow-hidden rounded-xl border border-accent-border/40 bg-accent-subtle/30",
        "shadow-[inset_0_1px_0_rgb(255_255_255_/_0.06)]",
        className
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-accent-border/30 px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground"
            aria-hidden
          >
            <MathOperations className="h-3.5 w-3.5" weight="duotone" />
          </span>
          <p className="truncate text-[13.5px] font-semibold tracking-tight text-foreground">
            {name}
          </p>
        </div>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-accent">
          Formula
        </span>
      </header>
      <div
        data-testid="widget-formula"
        className="flex flex-col gap-1.5 px-3.5 py-3"
      >
        <div className="flex items-baseline justify-center rounded-lg border border-border/40 bg-background px-3 py-3 text-[15px] text-foreground">
          <FormulaExpression markdown={md} />
        </div>
        <p className="text-[11.5px] leading-relaxed text-muted-foreground">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-accent">
            When
          </span>{" "}
          {when}
        </p>
      </div>
    </div>
  );
}

/**
 * Lazy-imported expression renderer so this file
 * doesn't pull the full react-markdown + KaTeX
 * bundle a second time. The dynamic import resolves
 * once per client; the module is cached by Next.js.
 *
 * `dynamic` is imported once at the top of this file
 * and reused here.
 */
const FormulaExpression = dynamic(
  async () => {
    const m = await import("@/lib/content/aiMarkdown");
    return function FormulaExpressionImpl({
      markdown,
    }: {
      readonly markdown: string;
    }) {
      return (
        <m.AIMarkdown
          id={`widget-formula-${markdown}`}
          content={markdown}
          density="compact"
        />
      );
    };
  },
  { ssr: false }
);

/**
 * MistakeCard.
 *
 * Renders the AI's call-out of a recurring mistake.
 * The chip color follows the per-mistake palette
 * established in CommonMistakesPanel for visual
 * consistency (concept → math, calculation →
 * chemistry, careless → physics, formula → german,
 * misread → french, language → english).
 */
function MistakeCard({
  mistakeType,
  cause,
  className,
}: {
  readonly mistakeType: string;
  readonly cause: string;
  readonly className?: string;
}) {
  const { label, color } = MISTAKE_META[mistakeType] ?? MISTAKE_META.UNCATEGORIZED;
  return (
    <div
      className={cn(
        "my-3 overflow-hidden rounded-xl border bg-surface-elevated p-3",
        className
      )}
      style={{ borderColor: `color-mix(in srgb, ${color} 30%, var(--border))` }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
          style={{
            backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
            borderColor: `color-mix(in srgb, ${color} 28%, transparent)`,
            color,
          }}
          aria-hidden
        >
          <Warning className="h-3.5 w-3.5" weight="duotone" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
              Watch out
            </span>
            <span
              className="inline-flex items-center rounded-full border px-1.5 py-0.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.16em]"
              style={{
                backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
                borderColor: `color-mix(in srgb, ${color} 32%, transparent)`,
                color,
              }}
            >
              {label}
            </span>
          </div>
          <p className="mt-1.5 text-[13.5px] font-medium leading-snug text-foreground">
            {cause || "This kind of mistake keeps coming up on this topic."}
          </p>
        </div>
      </div>
    </div>
  );
}

const MISTAKE_META: Record<string, { label: string; color: string }> = {
  CONCEPT_MISUNDERSTANDING: { label: "Concept", color: "var(--subject-math)" },
  CALCULATION_MISTAKE: { label: "Calculation", color: "var(--subject-chemistry)" },
  CARELESS_ERROR: { label: "Careless", color: "var(--subject-physics)" },
  FORMULA_RECALL_FAILURE: { label: "Recall", color: "var(--subject-german)" },
  MISREAD_QUESTION: { label: "Misread", color: "var(--subject-french)" },
  LANGUAGE_EXPRESSION_ISSUE: { label: "Language", color: "var(--subject-english)" },
  UNCATEGORIZED: { label: "Note", color: "var(--accent)" },
};

/**
 * ConceptChip.
 *
 * A small pill that the AI sprinkles inline to
 * mark jargon terms. Click to surface a tiny
 * definition in the bottom of the panel. For the
 * MVP the chip is purely informational — leaves
 * the actual lookup to the model on subsequent
 * turns ("Define logarithm" et al).
 */
function ConceptChip({
  name,
  className,
}: {
  readonly name: string;
  readonly className?: string;
}) {
  return (
    <span
      className={cn(
        "mx-0.5 inline-flex items-center gap-1 rounded-full border border-accent-border/50 bg-accent-subtle/60 px-2 py-0.5 align-middle text-[11px] font-medium tracking-tight text-accent",
        className
      )}
      title={`${name} — concept`}
    >
      <Sparkle className="h-2.5 w-2.5" weight="fill" />
      {name}
    </span>
  );
}

/**
 * StepReveal.
 *
 * The interactive "Show step" component the model
 * uses to break an explanation into discrete steps.
 * Steps start collapsed, the user advances them one
 * at a time. The whole row uses motion height
 * transitions so the reveal pulses into view rather
 * than popping.
 *
 * Streaming edge: when `streaming === true` the
 * component auto-reveals each step as the model
 * emits it — `revealedCount` mirrors `steps.length`
 * so the user sees every step land in real time
 * without clicking the CTA. Once `streaming` flips
 * back to `false` (status="ready"), the component
 * freezes at its current count, and the user can use
 * the manual "Reveal next step" CTA to advance one
 * step at a time on their own pace.
 */
function StepReveal({
  steps,
  streaming,
  className,
}: {
  readonly steps: ReadonlyArray<string>;
  /**
   * When `true`, the component auto-reveals every
   * step as the model emits them (revealedCount =
   * steps.length). When `false` or `undefined`, the
   * user advances reveals manually via the "Reveal
   * next step" CTA. The chat surface passes the
   * current `useChat` status — only the LAST
   * assistant message is treated as streaming, so
   * older assistant messages fall back to the user-
   * controlled reveal pattern.
   */
  readonly streaming?: boolean;
  readonly className?: string;
}) {
  // Two-phase reveal count, derived rather than synced:
  //
  //   Phase 1 — Streaming. While the model is still
  //   emitting steps (`streaming === true`), `revealedCount`
  //   mirrors `steps.length` so every new step emerges in
  //   real time. No CTA required, no clicking.
  //
  //   Phase 2 — Settled. Once the stream ends, the user
  //   advances the count manually via the "Reveal next
  //   step" CTA; that bumps `manualRevealed`, and the
  //   derived clamping keeps the render in bounds.
  //
  // We use a derived calculation instead of a `useEffect`
  // that calls `setRevealedCount` because the
  // `react-compiler/no-direct-set-state-in-effect` rule
  // forbids the sync pattern. Doing it in render keeps the
  // behaviour the same without the lint.
  const [manualRevealed, setManualRevealed] = useState(1);
  const revealedCount = streaming
    ? Math.max(steps.length, manualRevealed)
    : Math.min(manualRevealed, Math.max(steps.length, 1));

  if (steps.length === 0) return null;

  const allRevealed = revealedCount >= steps.length;
  return (
    <div
      data-testid="widget-steps"
      className={cn(
        "my-3 overflow-hidden rounded-xl border border-border bg-surface-elevated",
        className
      )}
    >
      <header className="flex items-center justify-between border-b border-border/60 px-3.5 py-2">
        <span className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-subtle/70 text-accent" aria-hidden>
            <FlowArrow className="h-3 w-3" weight="duotone" />
          </span>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
            Step-by-step
          </span>
        </span>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground">
          {revealedCount}/{steps.length}
        </span>
      </header>
      <ol className="flex flex-col divide-y divide-border/60">
        {steps.map((text, idx) => (
          <StepRow
            key={idx}
            index={idx + 1}
            text={text}
            revealed={idx < revealedCount}
          />
        ))}
      </ol>
      {!allRevealed && (
        <button
          type="button"
          onClick={() =>
            setManualRevealed((prev) => Math.min(steps.length, prev + 1))
          }
          className="group flex w-full items-center justify-center gap-2 border-t border-border/60 px-3 py-2 text-[12px] font-medium text-accent transition-colors hover:bg-accent-subtle/40"
        >
          <CircleNotch className="h-3 w-3 group-hover:rotate-90 transition-transform duration-300" weight="bold" />
          Reveal{" "}
          {revealedCount + 1 === steps.length ? "last step" : "next step"}
        </button>
      )}
    </div>
  );
}

/**
 * StepRow.
 *
 * Single row of the step reveal. The body is rendered
 * with `AIMarkdown` so it can carry math + bold while
 * the `reveal` flag is false we render a small pill
 * instead of hiding so the user always sees the row.
 */
function StepRow({
  index,
  text,
  revealed,
}: {
  readonly index: number;
  readonly text: string;
  readonly revealed: boolean;
}) {
  return (
    <li className="flex items-start gap-3 px-3.5 py-2.5">
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-[10.5px] font-semibold",
          revealed
            ? "bg-accent text-accent-foreground"
            : "bg-surface text-muted-foreground"
        )}
        aria-hidden
      >
        {index}
      </span>
      <div className="min-w-0 flex-1">
        {revealed ? (
          <AIMarkdown id={`step-${index}-${text.slice(0, 8)}`} content={text} density="compact" />
        ) : (
          <span className="flex items-center gap-2 font-mono text-[11.5px] text-muted-foreground">
            <Pulse className="h-3 w-3 animate-pulse" weight="duotone" />
            Indexed
          </span>
        )}
      </div>
    </li>
  );
}

/**
 * Lazy-import the Markdown renderer so we don't
 * cycle on module resolution. AIMarkdown is already
 * memoized + KaTeX-aware, so reusing it costs
 * nothing.
 *
 * `dynamic` is imported once at the top of this file
 * and reused here.
 */
const AIMarkdown = dynamic(
  async () => (await import("@/lib/content/aiMarkdown")).AIMarkdown,
  { ssr: false }
);

/**
 * ChoiceMenu.
 *
 * Multi-choice question surface the model emits to
 * check understanding. The user picks an option;
 * a correct answer turns the chip green, a wrong
 * answer turns it red and reveals the rationale.
 * Either way, the parent `onAskQuestion` callback
 * threads the choice + brief into the chat so the
 * AI can react.
 *
 * The choice widget does not auto-send the answer
 * to the chat — the user has to hit "Send my
 * answer" explicitly so they can read the rationale
 * first. This keeps the loop deliberate (the
 * tutor should pause, not auto-feed).
 *
 * Phase 4 §6.1 — Choice-click engagement signal:
 * the widget tracks `interactableAt` (the moment
 * the choice became clickable, i.e. when the
 * playground streamed settled OR the structured
 * response rendered the widget) and computes
 * `responseTimeMs = Date.now() - interactableAt`
 * on the user's first click. The signal is
 * forwarded via `onChoicePicked` so the parent
 * shell can persist it to Convex strategy state.
 *
 * The semantic is: `interactableAt` is the START of
 * "read time" for the choice. During streaming the
 * user has not yet seen the choice (the explanation
 * prose is still rendering), so counting from
 * `mountTime` would conflate streaming seconds with
 * engagement seconds. The `streaming` prop flip
 * from `true` → `false` is the correct anchor.
 *
 * In the StructuredResponse path the widget is
 * rendered with `streaming` undefined (treated as
 * `false`) so `interactableAt` is set on the very
 * first render — correct because the parse-and-
 * render happens in one tick once the JSON is in.
 */
function ChoiceMenu({
  prompt,
  options,
  correctLabel,
  onAskQuestion,
  onChoicePicked,
  streaming,
  className,
}: {
  readonly prompt: string;
  readonly options: ReadonlyArray<{ label: string; text: string }>;
  readonly correctLabel: string;
  readonly onAskQuestion?: (text: string) => void;
  /**
   * Phase 4 §6.1: optional callback fired exactly
   * once when the user clicks the first option.
   * `responseTimeMs` is measured from the moment
   * `streaming` flipped false (or the widget
   * mounted with `streaming` already false) to
   * the click. The parent uses it to detect
   * "passive dismissal" — clicks faster than 2
   * seconds without engaging.
   */
  readonly onChoicePicked?: (signal: {
    readonly responseTimeMs: number;
    readonly pickedCorrect: boolean;
  }) => void;
  /**
   * Phase 4 §6.1: whether the parent chat surface
   * is currently streaming this message. When
   * `true`, the choice is not yet interactable so
   * `interactableAt` is left `null`. When this
   * prop flips to `false`, the useEffect below
   * stamps `interactableAt = Date.now()` so the
   * response time measure is "since the user
   * could actually click", not "since the
   * component parsed".
   */
  readonly streaming?: boolean;
  readonly className?: string;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const groupId = useId();
  const interactableAtRef = useRef<number | null>(null);
  const signalFiredRef = useRef<boolean>(false);

  // Stamp interactableAt when the choice becomes
  // clickable. Mirrors the structured-response path
  // (mount with `streaming === false` → stamp
  // instantly) and the streamed path (mount with
  // `streaming === true` → stamp on flip to false).
  useEffect(() => {
    if (streaming === true) {
      interactableAtRef.current = null;
      return;
    }
    if (interactableAtRef.current === null) {
      interactableAtRef.current = Date.now();
    }
  }, [streaming]);

  const correctOption = options.find((o) => o.label === correctLabel);
  const isCorrect = picked !== null && picked === correctLabel;

  const handlePick = (label: string) => {
    if (picked !== null) return; // already committed
    setPicked(label);
    // Phase 4 §6.1: fire the engagement signal
    // exactly once per widget lifetime. We compute
    // the latency from the moment the choice
    // became interactable; if the user clicks
    // before the streaming flip registered (very
    // rare race because the streaming flag and
    // click handler both run on the main thread),
    // we fall back to a 0ms reading so the
    // downstream signal is well-defined. The
    // defence-in-depth `signalFiredRef` prevents a
    // future refactor from double-firing if, e.g.
    // ROLLY picks are wired up later.
    if (!signalFiredRef.current && onChoicePicked) {
      signalFiredRef.current = true;
      const startedAt =
        // eslint-disable-next-line react-hooks/purity
        interactableAtRef.current ?? Date.now();
      // eslint-disable-next-line react-hooks/purity
      const now = Date.now();
      onChoicePicked({
        responseTimeMs: Math.max(0, now - startedAt),
        pickedCorrect: label === correctLabel,
      });
    }
  };

  return (
    <div
      data-testid="widget-choice"
      className={cn(
        "my-3 overflow-hidden rounded-xl border border-border bg-surface-elevated",
        className
      )}
    >
      <header className="flex items-center gap-2 border-b border-border/60 px-3.5 py-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-subtle/70 text-accent" aria-hidden>
          <Question className="h-3.5 w-3.5" weight="duotone" />
        </span>
        <div className="min-w-0 flex-1">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground">
            Quick check
          </span>
          <AIMarkdown id={`choice-prompt-${groupId}`} content={prompt} density="compact" />
        </div>
      </header>
      <ol className="flex flex-col gap-1.5 p-2.5">
        {options.map((o) => {
          const isPicked = picked === o.label;
          const isThisCorrect = o.label === correctLabel;
          const tone = picked === null
            ? "border-border bg-background hover:border-accent-border/60 hover:bg-surface-elevated"
            : isThisCorrect
              ? "border-accent bg-accent-subtle/60 text-accent"
              : isPicked
                ? "border-subject-french/40 bg-subject-french/10 text-subject-french"
                : "border-border/60 bg-background text-muted-foreground";
          return (
            <li key={o.label}>
              <button
                type="button"
                onClick={() => handlePick(o.label)}
                disabled={picked !== null}
                aria-pressed={isPicked}
                className={cn(
                  "group flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left text-[13px] font-medium transition-colors disabled:cursor-default",
                  tone
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold",
                    picked === null && "bg-surface text-foreground",
                    isThisCorrect && "bg-accent text-accent-foreground",
                    isPicked && !isThisCorrect && "bg-subject-french text-background",
                    picked !== null && !isPicked && !isThisCorrect && "bg-surface text-muted-foreground"
                  )}
                  aria-hidden
                >
                  {o.label}
                </span>
                <span className="flex-1">{o.text}</span>
                {picked !== null && isThisCorrect && (
                  <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" weight="fill" />
                )}
                {picked !== null && isPicked && !isThisCorrect && (
                  <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subject-french" weight="fill" />
                )}
              </button>
            </li>
          );
        })}
      </ol>
      {picked !== null && (
        <div className="border-t border-border/60 px-3.5 py-2.5">
          <p className={cn("text-[12px] font-medium", isCorrect ? "text-accent" : "text-subject-french")}>
            {isCorrect ? "Correct." : `Not quite — the right answer is ${correctLabel} ${correctOption ? `(${correctOption.text})` : ""}.`}
          </p>
          {onAskQuestion && (
            <button
              type="button"
              onClick={() =>
                onAskQuestion(
                  isCorrect
                    ? `I chose ${picked}. Walk me through why this works.`
                    : `I picked ${picked}. Why is ${correctLabel} correct instead?`
                )
              }
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1.5 text-[11.5px] font-medium text-accent-foreground transition-colors hover:bg-accent/90"
            >
              Ask the tutor to explain
              <ArrowRight className="h-3 w-3" weight="bold" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * DiagramBlock.
 *
 * Single dispatcher for the four diagram kinds.
 * Each kind renders a focused inline block at a
 * consistent visual size so the chat bubble does
 * not jump when a diagram swaps with prose.
 */
function DiagramBlock({
  diagram,
  className,
}: {
  readonly diagram: DiagramSpec;
  readonly className?: string;
}) {
  return (
    <div
      data-testid="widget-diagram"
      className={cn(
        "my-3 overflow-hidden rounded-xl border border-border bg-surface-elevated",
        className
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-3.5 py-2">
        <span className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-subtle/70 text-accent" aria-hidden>
            <Flask className="h-3 w-3" weight="duotone" />
          </span>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
            Diagram · {diagram.kind}
          </span>
        </span>
      </header>
      <div className="px-3.5 py-3">
        {diagram.kind === "tree" ? <TreeDiagram edges={diagram.edges} /> : null}
        {diagram.kind === "numberline" ? (
          <NumberlineDiagram
            min={diagram.min}
            max={diagram.max}
            highlight={diagram.highlight}
          />
        ) : null}
        {diagram.kind === "barchart" ? (
          <BarchartDiagram labels={diagram.labels} values={diagram.values} />
        ) : null}
        {diagram.kind === "graph" ? (
          <GraphDiagram
            formula={diagram.formula}
            xmin={diagram.xmin}
            xmax={diagram.xmax}
          />
        ) : null}
        {diagram.kind === "molecule" ? (
          <MoleculeDiagram formula={diagram.formula} />
        ) : null}
      </div>
    </div>
  );
}

/**
 * TreeDiagram.
 *
 * Two-column approach: left column lists each root
 * + descendants in indented rows; right column is
 * a vertical connector with subtle dotted lines.
 * This keeps the tree readable on phone (no SVG
 * path math, no overflow) and on 4K.
 */
function TreeDiagram({
  edges,
}: {
  readonly edges: ReadonlyArray<readonly [string, string]>;
}) {
  // Build a child-by-parent map so each row can be
  // formatted as `<root> → <child1>, <child2>`. The
  // whole derivation is memoised on `edges` so a
  // parent re-render that didn't change edges
  // (e.g. because of a chat-stream tick) doesn't
  // rebuild the map.
  type NodeRow = { parent: string; children: string[] };
  const rows = useMemo<NodeRow[]>(() => {
    const byParent = new Map<string, string[]>();
    for (const [parent, child] of edges) {
      const arr = byParent.get(parent) ?? [];
      arr.push(child);
      byParent.set(parent, arr);
    }
    const out: NodeRow[] = [];
    for (const [parent, children] of byParent.entries()) {
      out.push({ parent, children });
    }
    return out;
  }, [edges]);

  if (rows.length === 0) return null;
  return (
    <ol className="flex flex-col divide-y divide-border/40">
      {rows.map((row) => (
        <li key={row.parent} className="flex items-center gap-3 py-1.5">
          <span className="rounded-md bg-accent-subtle/60 px-2 py-1 text-[12px] font-medium text-accent">
            {row.parent}
          </span>
          <ArrowRight className="h-3 w-3 text-muted-foreground" weight="bold" />
          <span className="flex flex-wrap items-center gap-1.5">
            {row.children.map((c) => (
              <span
                key={c}
                className="rounded-md border border-border/60 bg-background px-2 py-0.5 text-[12px] text-foreground/90"
              >
                {c}
              </span>
            ))}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * NumberlineDiagram.
 *
 * A horizontal track with labeled tick marks; the
 * highlight is rendered as a chip above the
 * corresponding tick. Pure flex layout — no SVG.
 */
function NumberlineDiagram({
  min,
  max,
  highlight,
}: {
  readonly min: number;
  readonly max: number;
  readonly highlight: number;
}) {
  // Cap labeled tick density so a 0..1000 axis
  // doesn't overflow. The model emits a sensible
  // range but a defensive clamp keeps us safe.
  const span = max - min;
  const tickStep = span <= 12 ? 1 : span <= 24 ? 2 : Math.ceil(span / 12);
  const ticks: number[] = [];
  for (let v = min; v <= max; v += tickStep) ticks.push(v);
  const highlightPct = Math.max(
    0,
    Math.min(100, ((highlight - min) / (max - min)) * 100)
  );
  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative h-6 rounded-full bg-surface">
        <div className="absolute inset-y-0 left-0 right-0 rounded-full border border-border" />
        {ticks.map((t) => {
          const left = ((t - min) / (max - min)) * 100;
          return (
            <div
              key={t}
              className="absolute top-0 h-full w-px bg-border-strong"
              style={{ left: `${left}%` }}
              aria-hidden
            />
          );
        })}
        <div
          className="absolute -top-1 flex flex-col items-center"
          style={{ left: `${highlightPct}%`, transform: "translateX(-50%)" }}
          aria-hidden
        >
          <span className="rounded-full bg-accent px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-accent-foreground shadow-[var(--shadow-soft)]">
            {highlight}
          </span>
          <span className="mt-0.5 h-1.5 w-px bg-accent" />
        </div>
      </div>
      <div className="flex justify-between font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground">
        {ticks.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
    </div>
  );
}

/**
 * BarchartDiagram.
 *
 * Horizontal bars whose widths are proportional to
 * the maximum value. Each bar carries its numeric
 * label + the category label underneath.
 */
function BarchartDiagram({
  labels,
  values,
}: {
  readonly labels: ReadonlyArray<string>;
  readonly values: ReadonlyArray<number>;
}) {
  const max = Math.max(...values, 1);
  return (
    <ul className="flex flex-col gap-1.5">
      {labels.map((label, idx) => {
        const v = values[idx] ?? 0;
        const pct = Math.max(2, (v / max) * 100);
        return (
          <li key={`${label}-${idx}`} className="flex items-center gap-2.5">
            <span className="w-12 shrink-0 truncate text-[11.5px] font-medium text-muted-foreground">
              {label}
            </span>
            <div className="flex-1 overflow-hidden rounded-full bg-surface">
              <div
                className="h-3 rounded-full bg-accent"
                style={{ width: `${pct}%` }}
                aria-hidden
              />
            </div>
            <span className="w-8 shrink-0 text-right font-mono text-[10.5px] tabular-nums text-foreground">
              {v}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * GraphDiagram.
 *
 * Phase 5 §7.1: delegates to the interactive GraphPlotter
 * canvas widget (zoom, pan, roots, extrema). The previous
 * placeholder card is replaced by a real plotted curve.
 *
 * Note: `dynamic` is imported once at the top of this file
 * and reused for both FormulaExpression, AIMarkdown, and the
 * Phase 5 widgets.
 */
function GraphDiagram({
  formula,
  xmin,
  xmax,
}: {
  readonly formula: string;
  readonly xmin: number;
  readonly xmax: number;
}) {
  return (
    <GraphPlotter
      formula={formula}
      xmin={xmin}
      xmax={xmax}
    />
  );
}

function LinkSurface({
  href,
  children,
  className,
}: {
  readonly href: string;
  readonly children: React.ReactNode;
  readonly className?: string;
}) {
  return (      <Link
        href={href}
        className={cn(
          "my-3 flex items-center gap-3 rounded-xl border border-accent-border/40 bg-accent-subtle/30 px-3 py-2.5 outline-none transition-colors hover:border-accent-border hover:bg-accent-subtle/60 focus-visible:ring-2 focus-visible:ring-ring",
          className
        )}
      >
        {children}
      </Link>
  );
}
