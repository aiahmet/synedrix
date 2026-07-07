"use client";

/**
 * StructuredResponse.tsx — Phase 1 §3.1.
 *
 * Section-by-section renderer for AI tutor responses that
 * follow the 5-part teaching rhythm. When the route handler
 * successfully parses the AI's output into structured
 * sections (explanation → visual → key insight → check →
 * next), this component renders each section with distinct
 * visual treatment so the user reads the response as a
 * carefully composed lesson, not a flat wall of text.
 *
 * For messages without structured content (legacy messages,
 * or messages where parsing failed), the component falls
 * back to the standard `AssistantParts` markdown renderer.
 *
 * Design principles:
 *   - Minimal extra chrome — each section gets just enough
 *     visual separation (a thin rule, a slightly different
 *     background, an emoji prefix) to be distinguishable
 *     at a glance.
 *   - Widget reuse — sections that contain block markers
 *     (`[[choice:...]]`, `[[formula:...]]`, etc.) use the
 *     existing `parseBlockMarker` + `BlockWidget` pipeline
 *     so interactive widgets still work.
 *   - Streaming-safe — the component is designed for
 *     settled (non-streaming) rendering. During streaming,
 *     the parent `MessageList` renders the normal
 *     `AssistantParts` markdown renderer; once the stream
 *     settles and structured content is available, this
 *     component replaces it.
 */

import { useMemo } from "react";
import { Sparkle, Lightbulb } from "@phosphor-icons/react/dist/ssr";

import { AIMarkdown } from "@/lib/content/aiMarkdown";
import { parseBlockMarker, BlockWidget } from "@/lib/content/tutorWidgets";

/**
 * Structured content shape produced by the route handler's
 * `parseStructuredFromText` function.
 */
export interface StructuredContent {
  readonly explanation: string;
  readonly keyInsight: string;
  readonly nextSuggestion: string;
  readonly nextActionPrompt: string;
  readonly affirmation?: string;
  readonly _rawText: string;
  readonly _hasCheck: boolean;
  readonly _hasVisual: boolean;
}

/**
 * StructuredResponse.
 *
 * Renders a tutor response using the parsed structured
 * content. Falls back to the raw text when `structured` is
 * null.
 *
 * Phase 4 §6.1 — Choice-click engagement signal:
 * `onChoicePicked` is forwarded to the BlockWidget
 * inside the CheckSection (and the VisualSection if
 * the visual happens to be a `[[choice:...]]`). Both
 * section renderers pass it through unchanged so the
 * signal flows up to `MessageList` → `TutorClient`
 * → `teachingStrategyState.latestChoiceResponseTimeMs`.
 */
export function StructuredResponse({
  structured,
  rawText,
  messageId,
  onPickSuggestion,
  onChoicePicked,
}: {
  readonly structured: StructuredContent | null;
  readonly rawText: string;
  readonly messageId: string;
  readonly onPickSuggestion?: (text: string) => void;
  /**
   * Phase 4 §6.1: forwarded to BlockWidget inside the
   * CheckSection + VisualSection so a `[[choice:...]]`
   * widget emits an engagement signal when clicked.
   * The wired component is exactly the same widget
   * type as the streamed path; only the latency
   * measurement differs (StructuredResponse renders
   * with `streaming` undefined → immediate
   * `interactableAt`).
   */
  readonly onChoicePicked?: (signal: {
    readonly responseTimeMs: number;
    readonly pickedCorrect: boolean;
  }) => void;
}) {
  const blocks = useMemo(
    () => splitIntoBlocks(rawText),
    [rawText]
  );

  if (!structured) {
    return (
      <AIMarkdown
        id={`${messageId}-fallback`}
        content={rawText}
        density="compact"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 1. Explanation — the prose paragraph */}
      {structured.explanation && (
        <ExplanationSection
          text={structured.explanation}
          messageId={messageId}
        />
      )}

      {/* 2. Visual — a single widget block (formula, steps,
          diagram) */}
      {blocks.visual && (
        <VisualSection
          block={blocks.visual}
          messageId={messageId}
          onChoicePicked={onChoicePicked}
        />
      )}

      {/* 3. Key insight — the "aha!" moment */}
      {structured.keyInsight && (
        <KeyInsightSection insight={structured.keyInsight} />
      )}

      {/* Extra widgets between insight and check */}
      {blocks.extraWidgets.length > 0 && (
        <div className="flex flex-col gap-2">
          {blocks.extraWidgets.map((block, i) => {
            const marker = parseBlockMarker(block);
            if (!marker) return null;
            return (
              <BlockWidget
                key={`ew-${i}`}
                marker={marker}
                onAskQuestion={onPickSuggestion}
                onChoicePicked={onChoicePicked}
              />
            );
          })}
        </div>
      )}

      {/* 4. Check — the mandatory [[choice:...]] widget */}
      {blocks.choice && (
        <CheckSection
          block={blocks.choice}
          messageId={messageId}
          onPickSuggestion={onPickSuggestion}
          onChoicePicked={onChoicePicked}
        />
      )}

      {/* 5. Next step — the italic footer */}
      {structured.nextSuggestion && (
        <NextSection
          suggestion={structured.nextSuggestion}
          actionPrompt={structured.nextActionPrompt}
          onPick={onPickSuggestion}
        />
      )}

      {/* Affirmation (Phase 7 pre-wire) */}
      {structured.affirmation && (
        <AffirmationSection text={structured.affirmation} />
      )}
    </div>
  );
}

// ── Section renderers ────────────────────────────────────

function ExplanationSection({
  text,
  messageId,
}: {
  readonly text: string;
  readonly messageId: string;
}) {
  return (
    <div className="min-h-[1em]">
      <AIMarkdown
        id={`${messageId}-explanation`}
        content={text}
        density="compact"
      />
    </div>
  );
}

function VisualSection({
  block,
  messageId,
  onChoicePicked,
}: {
  readonly block: string;
  readonly messageId: string;
  /**
   * Phase 4 §6.1: forwarded to BlockWidget so a
   * `[[choice:...]]` rendered in PART 2 (visual)
   * still emits the engagement signal. PART 2 is
   * usually a formula/steps/diagram, but the AI is
   * technically allowed to emit a choice there;
   * we forward the signal so the metric is
   * uniform.
   */
  readonly onChoicePicked?: (signal: {
    readonly responseTimeMs: number;
    readonly pickedCorrect: boolean;
  }) => void;
}) {
  const marker = parseBlockMarker(block);
  if (!marker) {
    // Not a recognised widget — render as markdown.
    return (
      <AIMarkdown
        id={`${messageId}-visual`}
        content={block}
        density="compact"
      />
    );
  }
  return (
    <BlockWidget
      marker={marker}
      onChoicePicked={onChoicePicked}
    />
  );
}

function KeyInsightSection({
  insight,
}: {
  readonly insight: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-accent-border/30 bg-accent-subtle/30 px-3 py-2">
      <Lightbulb
        aria-hidden
        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent"
        weight="fill"
      />
      <p className="text-[12.5px] font-medium leading-relaxed text-foreground">
        {insight}
      </p>
    </div>
  );
}

function CheckSection({
  block,
  messageId,
  onPickSuggestion,
  onChoicePicked,
}: {
  readonly block: string;
  readonly messageId: string;
  readonly onPickSuggestion?: (text: string) => void;
  /**
   * Phase 4 §6.1: forwarded to BlockWidget so the
   * PART 4 `[[choice:...]]` widget emits an
   * engagement signal. The CheckSection is the
   * canonical place a `[[choice:...]]` marker
   * appears, so this is the metric's primary
   * source.
   */
  readonly onChoicePicked?: (signal: {
    readonly responseTimeMs: number;
    readonly pickedCorrect: boolean;
  }) => void;
}) {
  const marker = parseBlockMarker(block);
  if (!marker) {
    return (
      <AIMarkdown
        id={`${messageId}-check`}
        content={block}
        density="compact"
      />
    );
  }
  return (
    <BlockWidget
      marker={marker}
      onAskQuestion={onPickSuggestion}
      onChoicePicked={onChoicePicked}
    />
  );
}

function NextSection({
  suggestion,
  actionPrompt,
  onPick,
}: {
  readonly suggestion: string;
  readonly actionPrompt: string;
  readonly onPick?: (text: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-surface/60 px-3 py-2">
      <Sparkle
        aria-hidden
        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
        weight="duotone"
      />
      <p className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">{suggestion}</span>
        {actionPrompt && (
          <button
            type="button"
            onClick={() => onPick?.(actionPrompt)}
            className="inline whitespace-nowrap rounded-md border border-border bg-surface-elevated px-2 py-0.5 text-[10.5px] font-medium text-accent transition-colors hover:border-accent-border/60 hover:bg-accent-subtle/40"
          >
            {actionPrompt}
          </button>
        )}
      </p>
    </div>
  );
}

/**
 * Phase 7 §9.2: AffirmationSection.
 *
 * Renders a genuine, specific progress affirmation as a
 * quiet single-line chip. Not flattery — specific,
 * observed, true. The visual treatment is deliberately
 * understated so the affirmation lands as a whisper, not
 * a badge.
 */
function AffirmationSection({
  text,
}: {
  readonly text: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-accent-border/20 bg-accent-subtle/15 px-3 py-2">
      <Sparkle
        aria-hidden
        className="mt-0.5 h-3 w-3 shrink-0 text-accent/70"
        weight="fill"
      />
      <p className="text-[11.5px] leading-relaxed text-foreground/70">
        {text}
      </p>
    </div>
  );
}

// ── Block splitter ───────────────────────────────────────

interface ParsedBlocks {
  readonly visual: string | null;
  readonly choice: string | null;
  readonly extraWidgets: string[];
}

/**
 * Split the raw response text into the structured blocks the
 * 5-part rhythm defines. Returns nulls for missing sections.
 */
function splitIntoBlocks(rawText: string): ParsedBlocks {
  const blocks = rawText
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  let visual: string | null = null;
  let choice: string | null = null;
  const extraWidgets: string[] = [];

  for (const block of blocks) {
    // Skip the explanation (first block), insight, next, and
    // affirmation — those are handled as text sections.
    if (
      block.startsWith("**💡 Key insight:") ||
      block.startsWith("_Next:") ||
      block.startsWith("> ")
    ) {
      continue;
    }
    // Skip the first block (explanation).
    if (block === blocks[0]) continue;

    if (block.startsWith("[[choice:")) {
      choice = block;
    } else if (
      block.startsWith("[[formula:") ||
      block.startsWith("[[steps:") ||
      block.startsWith("[[diagram:") ||
      block === "(no visual needed)"
    ) {
      if (!visual) {
        visual = block;
      }
    } else if (
      block.startsWith("[[mistake:") ||
      block.startsWith("[[concept:")
    ) {
      extraWidgets.push(block);
    }
  }

  return {
    visual: visual === "(no visual needed)" ? null : visual,
    choice,
    extraWidgets,
  };
}

/**
 * Try to parse structured content from either a JSON string
 * (produced by the route handler's `parseStructuredFromText`)
 * or from raw text by attempting to extract sections.
 *
 * Returns null only when both parsing approaches fail.
 */
export function tryParseStructured(
  input: string | undefined | null
): StructuredContent | null {
  if (!input) return null;
  // Try JSON first (preferred: route handler parsed it).
  try {
    const parsed = JSON.parse(input) as Record<string, unknown>;
    if (
      typeof parsed.explanation === "string" &&
      typeof parsed.keyInsight === "string"
    ) {
      return {
        explanation: String(parsed.explanation),
        keyInsight: String(parsed.keyInsight),
        nextSuggestion: String(parsed.nextSuggestion ?? "Continue studying"),
        nextActionPrompt: String(
          parsed.nextActionPrompt ?? "Let's keep going."
        ),
        affirmation: parsed.affirmation
          ? String(parsed.affirmation)
          : undefined,
        _rawText: String(parsed._rawText ?? input),
        _hasCheck: Boolean(parsed._hasCheck),
        _hasVisual: Boolean(parsed._hasVisual),
      };
    }
  } catch {
    // Not valid JSON — try parsing as raw text.
  }

  // Fallback: parse the raw text for section markers.
  return parseFromRawText(input);
}

/**
 * Parse structured sections from raw AI output text by
 * looking for the markdown section markers defined in
 * the system prompt ("**💡 Key insight:**", "_Next:", etc.).
 */
function parseFromRawText(raw: string): StructuredContent | null {
  const blocks = raw
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (blocks.length < 2) return null;

  const explanation = blocks[0] ?? "";
  let keyInsight = "";
  let nextSuggestion = "";
  let nextActionPrompt = "";
  let affirmation: string | undefined;

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i] ?? "";
    if (block.startsWith("**💡 Key insight:")) {
      keyInsight = block
        .replace(/^\*\*💡 Key insight:\*\*\s*/u, "")
        .trim();
    } else if (block.startsWith("_Next:") && block.endsWith("_")) {
      const inner = block.slice(6, -1).trim();
      const tryIdx = inner.indexOf('— try: "');
      if (tryIdx > 0) {
        nextSuggestion = inner.slice(0, tryIdx).trim();
        nextActionPrompt = inner.slice(tryIdx + 8).replace(/"$/, "").trim();
      } else {
        nextSuggestion = inner;
      }
    } else if (block.startsWith("> ")) {
      affirmation = block.slice(2).trim();
    }
  }

  if (!explanation || !keyInsight) return null;

  return {
    explanation,
    keyInsight,
    nextSuggestion: nextSuggestion || "Continue studying",
    nextActionPrompt:
      nextActionPrompt || "Let's keep going with the next concept.",
    affirmation,
    _rawText: raw,
    _hasCheck: blocks.some((b) => b.startsWith("[[choice:")),
    _hasVisual: blocks.some(
      (b) =>
        b.startsWith("[[formula:") ||
        b.startsWith("[[steps:") ||
        b.startsWith("[[diagram:") ||
        b === "(no visual needed)"
    ),
  };
}
