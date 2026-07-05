"use client";

/**
 * aiMarkdown.tsx.
 *
 * A safe, design-system styled renderer for **AI-generated**
 * markdown + LaTeX. The implementation follows the Vercel AI
 * SDK chat-with-markdown memoization recipe:
 *
 *   https://ai-sdk.dev/cookbook/nextjs/markdown-chatbot-with-memoization
 *
 * instead of passing the entire (growing) markdown blob to
 * `<ReactMarkdown>` once. The high-level flow:
 *
 *   1. `marked.lexer(content)` partitions the stream into a
 *      list of top-level blocks (paragraphs, headings, lists,
 *      code, blockquotes, tables, …). Marked is small and
 *      fast — it emits rich `token.raw` strings that include
 *      the original markdown source.
 *
 *   2. Each block is rendered by an individually
 *      `React.memo`'d `<MemoizedMarkdownBlock>`. Identical
 *      block content across re-renders short-circuits the
 *      re-parse entirely.
 *
 *   3. `<MemoizedMarkdown>` itself is `React.memo`'d, so the
 *      expensive `marked.lexer()` call is also skipped when
 *      unchanged. The block-level keys are `${id}-block_${i}`
 *      where `id` is a stable per-message identifier — as
 *      the stream grows and a new block index is appended,
 *      the existing blocks stay mounted under stable keys
 *      and only the new one mounts.
 *
 * Four invariants we still preserve from the previous
 * whole-blob implementation:
 *
 *   1. **KaTeX first, sanitize second.** `rehypeKatex` runs
 *      BEFORE `rehypeSanitize`, so the KaTeX-aware schema
 *      lets `<math>` / `<svg>` / `class="katex"` through
 *      while still stripping `<script>`, `<iframe>`, and
 *      `javascript:` URLs. See `KATEX_AWARE_SCHEMA` below.
 *
 *   2. **Disable single-dollar math.** `remark-math` is
 *      configured with `singleDollarTextMath: false` so
 *      `$5 and $10 before 8 AM` is not misread as inline
 *      math.
 *
 *   3. **Streaming resilience.** If a malformed streaming
 *      chunk trips remark or KaTeX, the class-component
 *      `AIErrorBoundary` renders the raw text inside a
 *      styled `<pre>` so the user always reads the message.
 *      Next successful render replaces the fallback on the
 *      next chunk. The boundary is deliberately OUTSIDE the
 *      memoized core so a thrown error doesn't invalidate
 *      the memo cache.
 *
 *   4. **URL safety.** An explicit `urlTransform` allowlist
 *      (`http:`, `https:`, `mailto:`, `tel:`, fragment,
 *      relative paths) sits on TOP of the sanitizer's
 *      `javascript:` filter as defense-in-depth.
 *
 * KaTeX's CSS lives in the root layout (`app/layout.tsx`)
 * — do NOT import it here or every consuming file pulls
 * 30 KB of KaTeX CSS through its own chunks.
 */

import React, { memo, useMemo } from "react";
import { marked } from "marked";
import Markdown, {
  type Components,
  type Options as MarkdownOptions,
} from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

import { cn } from "@/lib/utils/cn";
import { parseBlockMarker, BlockWidget } from "./tutorWidgets";

// Widget marker parsing is naturally memoized by
// `<MemoizedMarkdownBlock>`'s React.memo equality on
// the `content` prop — unchanged blocks short-circuit
// the whole render tree. The previous module-scoped
// `widgetCache` (keyed only on `${id}-block_${index}`
// and never invalidated as content streamed in) was
// removed because it permanently froze streamed
// markers in their first-paint "incomplete" state:
// a chunk that arrived as `[[steps:A|B` was cached
// as `incomplete`, then the closing `]]` landed in
// the next chunk but the cache kept returning the
// stale result until the whole message unmounted.

// ── Plugin configuration ─────────────────────────────────

/**
 * `singleDollarTextMath: false` is the critical setting.
 * Without it, `remark-math` greedily matches `$5` and
 * `$10` as inline math. With it, only the explicit
 * LaTeX delimiters `\(...\)` (inline) and `\[...\]` (block)
 * trigger math rendering.
 */
/**
 * `singleDollarTextMath: true` is the critical
 * setting — the test suite emits inline math like
 * `\(f'(x) = 2x)` and the CommonMark escape rule
 * strips the backslash before `(` / `)` so the
 * delimiters would never reach remark-math.
 *
 * The trade-off: dollar amounts in prose (e.g.
 * `$5 budgets`) now risk being matched as inline
 * math. We pre-escape standalone `$` to `\$` in
 * `encodeLatexDelimiters` (CommonMark turns `\$`
 * back into a literal `$` for the user) so
 * currency-style content renders as prose while
 * converted math content renders as KaTeX. The
 * sentinel layer in this file also maps the AI's
 * standard `\(`, `\)`, `\[`, `\]` delimiters to
 * `$`, `$`, `$$`, `$$` internally before handing
 * the markdown to react-markdown.
 */
const REMARK_PLUGINS: MarkdownOptions["remarkPlugins"] = [
  [remarkMath, { singleDollarTextMath: true }],
];

/**
 * rehype-katex's recommended sanitize whitelist. We extend
 * `defaultSchema` (which already strips `<script>`, `<iframe>`,
 * `on*=` handlers, and `javascript:` URLs) with the tags
 * and attributes rehype-katex actually emits.
 *
 *  - KaTeX MathML nodes (math / mi / mo / mn / mrow / …)
 *    — only used when KaTeX renders with MathML output,
 *    which we don't, but the parent `<span class="katex">`
 *    wrapping is essential either way.
 *  - SVG graphics KaTeX uses for arrows, sqrt lines, etc.
 *  - `className` everywhere so the `katex` / `katex-html` /
 *    `katex-display` class names keep their styling.
 *  - `style` on `span` so KaTeX's `vertical-align` positioning
 *    for sub/sup and `\frac` numerators/denominators
 *    survives. rehype-sanitize validates `style` values and
 *    strips `expression()` / `url(javascript:…)`.
 */
const KATEX_AWARE_SCHEMA: typeof defaultSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "math",
    "annotation",
    "semantics",
    "mrow",
    "mi",
    "mo",
    "mn",
    "msup",
    "msub",
    "mfrac",
    "msqrt",
    "mover",
    "munder",
    "mtext",
    "mspace",
    "svg",
    "path",
    "g",
    "rect",
    "line",
    "circle",
    "polygon",
    "polyline",
  ],
  attributes: {
    ...defaultSchema.attributes,
    "*": [
      ...(Array.isArray(defaultSchema.attributes?.["*"])
        ? defaultSchema.attributes["*"]
        : []),
      "className",
    ],
    span: [
      ...(Array.isArray(defaultSchema.attributes?.span)
        ? defaultSchema.attributes.span
        : []),
      "style",
    ],
    svg: ["viewBox", "width", "height", "xmlns", "fill", "stroke"],
    path: ["d", "stroke", "fill", "stroke-width"],
    math: ["xmlns", "display"],
    annotation: ["encoding"],
  },
  protocols: defaultSchema.protocols,
};

const REHYPE_PLUGINS: MarkdownOptions["rehypePlugins"] = [
  [rehypeKatex, { strict: false, throwOnError: false, output: "html" }],
  [rehypeSanitize, KATEX_AWARE_SCHEMA],
];

// ── URL transform (defense in depth) ─────────────────────

/**
 * Carefully scoped URL allowlist for `Markdown.urlTransform`.
 * rehype-sanitize already strips `javascript:` but we layer
 * an explicit allowlist on top so a future library upgrade
 * can't accidentally regress the protection.
 *
 * Allowed:
 *   - http(s) — standard external links
 *   - mailto: / tel: — contact links
 *   - protocol-less relative (`/`, `#`, `./`, `../`)
 * Anything else, including `data:` (XSS vector), `vbscript:`,
 * and unknown schemes is dropped.
 */
function safeUrlTransform(rawUrl: string): string {
  const url = rawUrl.trim();
  if (url.length === 0) return "";
  if (/^(https?:|mailto:|tel:|#|\/|\.{1,2}\/)/i.test(url)) return url;
  return ""; // dropped
}

// ── Tailwind component overrides ─────────────────────────

/**
 * Components override for react-markdown. Each tag ships
 * with sizing/spacing that matches the design system's
 * 13.5 px baseline (`text-[13.5px] leading-relaxed`).
 *
 * Density is applied to the OUTER `<div>` of `AIMarkdown`
 * rather than per-component, so every rule lives in one
 * place; the components below are density-agnostic.
 */
const AI_MARKDOWN_COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="mt-4 mb-2 text-[18px] font-semibold tracking-[-0.015em] text-foreground">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-3.5 mb-1.5 text-[15.5px] font-semibold tracking-[-0.015em] text-foreground">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-2.5 mb-1 text-[14px] font-semibold tracking-tight text-foreground">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-2 mb-1 text-[13.5px] font-semibold tracking-tight text-foreground">
      {children}
    </h4>
  ),
  h5: ({ children }) => (
    <h5 className="mt-2 mb-0.5 text-[13px] font-semibold tracking-tight text-foreground/90">
      {children}
    </h5>
  ),
  h6: ({ children }) => (
    <h6 className="mt-2 mb-0.5 text-[12.5px] font-semibold tracking-tight text-muted-foreground">
      {children}
    </h6>
  ),
  p: ({ children }) => (
    <p className="my-2 text-[13.5px] leading-relaxed text-foreground/90">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="my-2 ml-5 list-disc text-[13.5px] text-foreground/90 marker:text-muted-foreground/60">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 ml-5 list-decimal text-[13.5px] text-foreground/90 marker:text-muted-foreground/60">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="my-0.5 leading-relaxed">{children}</li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-foreground/95">{children}</em>
  ),
  /**
   * react-markdown passes a `className="language-XYZ"` on
   * the inner `<code>` of a fenced block. Inline code
   * never has a `language-` prefix. We discriminate on
   * that — the `<pre>` wrapping the fenced block is
   * provided by the `pre` override below.
   */
  code: ({ children, className, ...rest }) => {
    const isFenced =
      typeof className === "string" && className.startsWith("language-");
    if (isFenced) {
      return (
        <code className={cn("font-mono text-[12.25px]", className)} {...rest}>
          {children}
        </code>
      );
    }
    return (
      <code className="rounded-md border border-border/60 bg-surface px-1.5 py-0.5 font-mono text-[12.25px] text-accent">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-lg border border-border/60 bg-surface-elevated p-3 font-mono text-[12px] leading-relaxed text-foreground/95">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-accent-border/80 bg-accent-subtle/30 pl-3 py-1 text-[13.5px] italic text-foreground/85">
      {children}
    </blockquote>
  ),
  a: ({ children, href }) => {
    const safe = typeof href === "string" ? safeUrlTransform(href) : "";
    if (!safe) {
      // Drop the link, keep the text. This is the same
      // behaviour the default rehype-sanitize uses for
      // stripped hrefs — readable, never broken-looking.
      return <span className="text-muted-foreground">{children}</span>;
    }
    return (
      <a
        href={safe}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent underline decoration-accent/40 underline-offset-[2px] transition-colors hover:decoration-accent"
      >
        {children}
      </a>
    );
  },
  hr: () => <hr className="my-4 border-border/60" />,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full text-[12.5px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-surface-elevated">{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-t border-border/40 first:border-t-0">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-2.5 py-1.5 text-left font-semibold tracking-tight text-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-2.5 py-1.5 text-foreground/90">{children}</td>
  ),
};

// ── Density-driven layout ────────────────────────────────

export type AIMarkdownDensity = "prose" | "compact" | "bare";

/**
 * Per-density Tailwind overrides for the outer wrapper.
 * All three are 13.5 px-ish with slight rhythm differences:
 *  - `prose`:   default 1.65 line-height, comfortable for
 *               section bodies (lesson view).
 *  - `compact`: 1.45 line-height, tighter for chat bubbles.
 *  - `bare`:    same line-height as compact, no extra
 *               vertical margins (good for inline rendering
 *               inside a result-feedback card).
 */
const DENSITY_CLASSES: Record<AIMarkdownDensity, string> = {
  prose: "text-[13.5px] leading-[1.65]",
  compact: "text-[13.5px] leading-[1.5]",
  bare: "text-[13.5px] leading-[1.55]",
};

// ── Block splitter (the recipe's core trick) ──────────────

/**
 * Block splitter.
 *
 * We deliberately do NOT use marked's lexer here.
 * Two reasons:
 *
 *   1. Standard CommonMark treats backslash + paren as an
 *      escape (`\(` → `(`, `\)` → `)`). Marked implements
 *      this rule even though we want `\(...\)` to be
 *      recognised as inline math by remark-math downstream.
 *      Running marked.lexer would strip those backslashes
 *      from the source we then hand to react-markdown,
 *      breaking every inline math token in the tutor
 *      stream.
 *   2. The widget parser (see `./tutorWidgets.tsx`) routes
 *      `[[kind:…]]` markers to focused components when
 *      they are emitted on their own paragraph. For that
 *      we only need to know "is this block the start of a
 *      widget marker?" — not a full CommonMark parse tree.
 *
 * Splitting on `\n{2,}` (one or more blank lines) gives
 * us the same granularity as the AI-SDK memoization
 * recipe without paying the marked cost. Each block is
 * passed verbatim to react-markdown; `\` characters,
 * LaTeX delimiters, and other plain-text specials all
 * survive the round-trip.
 *
 * Empty trailing whitespace blocks are filtered out so
 * the memoized renderer doesn't mount empty `<div>`s
 * for trailing newlines (common in streaming chunks).
 */

/**
 * Sentinel strings for inline/block LaTeX delimiters.
 *
 * Why we need them: CommonMark's escape rule turns
 * `\(` into a literal `(` (drops the backslash). Both
 * `marked.lexer` and `remark-parse` apply this rule
 * verbatim, so feeding `\(f'(x) = 2x\)` directly into
 * either parser emits `(f'(x) = 2x)` — and remark-math
 * needs to see the math delimiters to dispatch to
 * KaTeX.
 *
 * Strategy: substitute the four LaTeX delimiters
 * `\(` / `\)` / `\[` / `\]` with Private Use Area
 * sentinels that no markdown syntax ever produces,
 * run `marked.lexer` to partition the document
 * safely (handles fenced code / blockquote / multi-
 * line block math), then re-substitute the sentinels
 * for the KaTeX-native equivalent `$` (inline) /
 * `$$` (block). With `singleDollarTextMath: true`
 * above, `remark-math` then dispatches these ranges
 * to `rehype-katex` correctly.
 *
 * Currency handling: a standalone `$5` in prose would
 * otherwise be greedily matched as inline math. We
 * pre-escape it to `\$5` in `encodeLatexDelimiters`
 * (CommonMark turns `\$` back into a literal `$` for
 * the user) so currency amounts render as plain text
 * while converted math regions render as KaTeX.
 *
 * The sentinels live in the Unicode Private Use
 * Area (U+E050–U+E057), which is reserved for
 * application-defined use and guaranteed not to
 * collide with any text the model emits.
 */
const LATEX_SENTINEL_OPEN_INLINE = "\uE050\uE051";
const LATEX_SENTINEL_CLOSE_INLINE = "\uE052\uE053";
const LATEX_SENTINEL_OPEN_BLOCK = "\uE054\uE055";
const LATEX_SENTINEL_CLOSE_BLOCK = "\uE056\uE057";

function encodeLatexDelimiters(s: string): string {
  return s
    // 1. Standalone dollars (currency-style $5)
    //    become `\$5`. Negative lookbehind avoids
    //    double-escaping already-escaped dollar
    //    fences (the `$` after our sentinel swap is
    //    never on the boundary).
    .replace(/(?<!\\)\$/g, "\\$")
    // 2. AI's standard LaTeX delimiters → sentinels
    .replace(/\\\(/g, LATEX_SENTINEL_OPEN_INLINE)
    .replace(/\\\)/g, LATEX_SENTINEL_CLOSE_INLINE)
    .replace(/\\\[/g, LATEX_SENTINEL_OPEN_BLOCK)
    .replace(/\\\]/g, LATEX_SENTINEL_CLOSE_BLOCK);
}

function decodeLatexDelimiters(s: string): string {
  return s
    // Sentinels → KaTeX-native dollars ($ inline,
    // $$ block). With `singleDollarTextMath: true`
    // remark-math routes these straight to
    // rehype-katex. Inside fenced code blocks the
    // token is one big literal so the substitution
    // is a no-op visually — the code block content
    // already has `\$` (from step 1) so prose
    // dollars stay literal there too.
    .replaceAll(LATEX_SENTINEL_OPEN_INLINE, "$")
    .replaceAll(LATEX_SENTINEL_CLOSE_INLINE, "$")
    .replaceAll(LATEX_SENTINEL_OPEN_BLOCK, "$$")
    .replaceAll(LATEX_SENTINEL_CLOSE_BLOCK, "$$");
}

/**
 * Split a markdown string into discrete top-level
 * block spans, suitable for streaming-rate memoized
 * render.
 *
 *   input  →  ["# Heading", "*paragraph* with **bold**.",
 *               "```lang\ncode\n```"]
 *
 * Why `marked.lexer` instead of a regex split on
 * `/\n{2,}/`: regex splitting accidentally severs
 * multi-line fenced code blocks, blockquotes, and
 * LaTeX `\[…\]` whenever they contain an internal
 * blank line. Marked understands those constructs
 * and partitions them safely. The only contract
 * we have to maintain is that the LaTeX delimiters
 * survive marked's CommonMark escape rule, which
 * is exactly what the sentinel pre/post-processing
 * above guarantees.
 *
 * Each token's `.raw` retains the original
 * markdown source (with our sentinels already
 * restored to `\(` / `\)` / `\[` / `\]`), so
 * react-markdown sees the same LaTeX delimiters
 * the AI emitted verbatim.
 */
function parseMarkdownIntoBlocks(markdown: string): string[] {
  if (markdown.length === 0) return [];
  const encoded = encodeLatexDelimiters(markdown);
  const tokens = marked.lexer(encoded);
  return tokens
    .map((t) => decodeLatexDelimiters(t.raw))
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
}

// ── Memoized block renderers ─────────────────────────────

/**
 * Render a single block. React.memo with a content-only
 * equality predicate is the core trick from the recipe:
 *
 *   - On every parent re-render (tutor streaming a new
 *     chunk => the wrapper `<AIMarkdown>` re-renders => the
 *     `<MemoizedMarkdown>` derives a new `blocks` array),
 *     React still calls each `<MemoizedMarkdownBlock>`'s
 *     comparator. For every block whose `content` prop
 *     byte-matches the previous render, the comparator
 *     returns true ⇒ React skips the render entirely ⇒ the
 *     expensive remark/rehype/KaTeX pipeline doesn't run.
 *
 *   - Reference equality is sufficient: identical block
 *     markdown produces identical parsed AST + identical
 *     rendered HTML, so a deep diff would find nothing.
 *
 * The block-level memoization is the *only* reason this
 * is a performance win in the tutor chat use case — the
 * outer `<AIMarkdown>` itself legitimately re-renders on
 * every streaming chunk (it's how new tokens get displayed),
 * so memoizing the OUTER level (the pre-recipe approach)
 * rarely fires.
 */
const MemoizedMarkdownBlock = memo(
  function MemoizedMarkdownBlock({
    content,
    streaming,
    onAskQuestion,
  }: {
    readonly content: string;
    /**
     * Whether the parent chat surface is actively
     * streaming this message. Threaded down to
     * BlockWidget so `StepReveal` (and similar
     * stream-sensitive widgets) can auto-emerging
     * instead of waiting for manual reveals.
     */
    readonly streaming?: boolean;
    readonly onAskQuestion?: (text: string) => void;
  }) {
    // Widget short-circuit: if the WHOLE block content
    // is a `[[...]]` marker we render the focused widget
    // instead of feeding it through react-markdown. The
    // parser itself is cheap (regex + switch). The
    // expensive cost we'd otherwise pay on every
    // streaming chunk is the remark / rehype / KaTeX
    // pipeline inside the Markdown fallback below —
    // and that's what the surrounding `React.memo`
    // equality predicate short-circuits on unchanged
    // `content` from already-mounted blocks. No manual
    // cache needed; React's built-in memo IS the cache.
    const marker = parseBlockMarker(content);
    if (marker !== null) {
      return (
        <BlockWidget
          marker={marker}
          {...(streaming !== undefined ? { streaming } : {})}
          {...(onAskQuestion ? { onAskQuestion } : {})}
        />
      );
    }
    return (
      <Markdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={AI_MARKDOWN_COMPONENTS}
        urlTransform={safeUrlTransform}
      >
        {content}
      </Markdown>
    );
  },
  (prevProps, nextProps) => prevProps.content === nextProps.content
);
MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock";

/**
 * Top-level memoized renderer. Splitting into blocks is
 * itself memoized (`useMemo([content])`) so the
 * `marked.lexer` call is skipped when the surrounding
 * content is unchanged; the comparator on the outer
 * `memo(...)` allows the parent to swap in the same
 * `<MemoizedMarkdown>` instance across re-renders without
 * React flagging a re-render at all.
 *
 * Block-level keys `${id}-block_${i}` keep React's
 * reconciliation quiet across streaming growth: when the
 * `blocks` array grows from N to N+1, blocks 0..N-1 stay
 * mounted under stable keys (memoized, no re-render)
 * while the new block at index N mounts fresh.
 *
 * NEW: optional `onAskQuestion` callback, threaded
 * through to the widget dispatcher so the choice-menu
 * widget can route its follow-up prompt through the
 * parent's composer.
 */
const MemoizedMarkdown = memo(function MemoizedMarkdown({
  content,
  id,
  streaming,
  onAskQuestion,
}: {
  readonly content: string;
  readonly id: string;
  /**
   * Whether the parent chat surface is actively
   * streaming this message. Threaded down to
   * `MemoizedMarkdownBlock` and ultimately to
   * `StepReveal` so widgets can auto-emerge as the
   * model emits them.
   */
  readonly streaming?: boolean;
  readonly onAskQuestion?: (text: string) => void;
}) {
  const blocks = useMemo(() => parseMarkdownIntoBlocks(content), [content]);
  return (
    <>
      {blocks.map((block, index) => (
        <MemoizedMarkdownBlock
          key={`${id}-block_${index}`}
          content={block}
          {...(streaming !== undefined ? { streaming } : {})}
          {...(onAskQuestion ? { onAskQuestion } : {})}
        />
      ))}
    </>
  );
});
MemoizedMarkdown.displayName = "MemoizedMarkdown";

// ── Error boundary ───────────────────────────────────────

interface AIErrorBoundaryProps {
  readonly children: React.ReactNode;
  readonly fallback: string;
}
interface AIErrorBoundaryState {
  readonly errored: boolean;
}

/**
 * Class-component error boundary. React 19 still requires
 * a class component for caught-error state (`getDerivedStateFromError`
 * has no hooks equivalent). Kept colocated with `AIMarkdown`
 * rather than introducing a tiny `react-error-boundary`
 * dependency.
 */
class AIErrorBoundary extends React.Component<
  AIErrorBoundaryProps,
  AIErrorBoundaryState
> {
  // `state` is declared (and initialized) on the subclass.
  // We deliberately drop the `override` keyword: under
  // `lib.dom.d.ts`'s React 19 typings `state` is NOT a
  // declared member of `Component`, so `override` raises
  // TS4113. The runtime contract is unchanged.
  state: AIErrorBoundaryState = { errored: false };

  // The `override` keyword is deliberately omitted from
  // every member of this class: under `lib.dom.d.ts`'s React
  // 19 typings, `state` is not declared on `Component` (the
  // subclass is meant to introduce it), and the
  // `static getDerivedStateFromError` / `componentDidCatch` /
  // `render` signatures don't mirror the runtime shape
  // closely enough for TS to consider them overrides
  // (TS4113). Dropping the keyword keeps the runtime
  // contract intact and quiets tsc.
  static getDerivedStateFromError(): AIErrorBoundaryState {
    return { errored: true };
  }

  componentDidCatch(err: unknown): void {
    // Defensive: streaming chunks very rarely throw, but if
    // they ever do, we want the original message in the
    // server/browser logs so we can investigate the
    // offending input shape.
    if (process.env.NODE_ENV !== "production") {
      console.warn("AIMarkdown: falling back to raw text", err);
    }
  }

  // Auto-recover on the next successful render. If a
  // streaming chunk tripped remark or rehype (errored
  // = true) and a later chunk's content maps to a
  // NEW raw-text fallback string, reset the error
  // flag so React unmounts the `<pre>` fallback and
  // re-attempts the markdown pipeline on the new
  // content. This is what the doc-comment above the
  // class promises ("Next successful render replaces
  // the fallback on the next chunk") — without this
  // hook the contract was broken and the entire
  // message stayed locked on the raw-text fallback
  // for the rest of the stream.
  componentDidUpdate(prevProps: AIErrorBoundaryProps): void {
    if (this.state.errored && prevProps.fallback !== this.props.fallback) {
      // Unset the error state. React will then re-render
      // with `this.props.children`, which re-runs the
      // markdown pipeline on the latest content.
      this.setState({ errored: false });
    }
  }

  render(): React.ReactNode {
    if (this.state.errored) {
      return (
        <pre className="whitespace-pre-wrap break-words rounded-md border border-border/40 bg-surface-elevated p-3 font-mono text-[12.5px] leading-relaxed text-foreground">
          {this.props.fallback}
        </pre>
      );
    }
    return this.props.children;
  }
}

// ── Public component ─────────────────────────────────────

export interface AIMarkdownProps {
  /**
   * Markdown + LaTeX source. The model is taught to use
   * `\(...\)` and `\[...\]` for math.
   */
  readonly content: string;
  /**
   * Stable per-message identifier. The recipe's
   * block-level keys are `${id}-block_${i}` — as long as
   * `id` is stable across re-renders of the SAME logical
   * message (tutor chat stream, practice attempt slug,
   * lesson block id), already-mounted blocks stay cached
   * across streaming updates and only freshly-appended
   * blocks mount.
   *
   * Pick an id that survives the message's lifetime:
   *   - tutor chat: `\`t-${message.id}-${partIdx}\``
   *   - lesson content: `\`lesson-${lessonId}-${blockIdx}\``
   *   - practice item: `\`item-${attemptId}-${itemIdx}\``
   */
  readonly id: string;
  /** Visual density. Defaults to `"prose"`. */
  readonly density?: AIMarkdownDensity;
  /** Optional extra className applied to the outer wrapper.
   *  Use for ad-hoc spacing adjustments at the call site. */
  readonly className?: string;
  /**
   * Whether the parent chat surface is actively
   * streaming this message. Threaded down into the
   * widget registry so stream-sensitive widgets
   * (`StepReveal`) can auto-emerge progressively
   * instead of waiting for the user's manual reveal
   * CTA. Defaults to `false` — widgets fall back to
   * the user-controlled interaction pattern.
   */
  readonly streaming?: boolean;
  /**
   * Optional. Threaded through the block dispatcher so
   * the choice-menu widget can route its follow-up
   * prompt back to the parent's composer. When omitted
   * (e.g. lesson-page / results-page render) the widget
   * still renders, but its "Ask the tutor" button
   * becomes a no-op.
   */
  readonly onAskQuestion?: (text: string) => void;
}

/**
 * Public export. Streaming-safe by default: if remark
 * or rehype ever throws on a malformed chunk, the
 * surrounding bubble falls back to a styled raw-text
 * block. The next successful render (on the next
 * streaming chunk) replaces the fallback with the
 * parsed view — the user always reads something
 * coherent.
 */
export function AIMarkdown({
  content,
  id,
  density,
  className,
  streaming,
  onAskQuestion,
}: AIMarkdownProps): React.ReactElement {
  const effectiveDensity: AIMarkdownDensity = density ?? "prose";
  return (
    <AIErrorBoundary fallback={content}>
      <div
        className={cn(
          // Dense, well-rythmmed prose container. KaTeX
          // outputs its own `class="katex"` so we don't
          // need to style math here — only the wrapper.
          "aimarkdown-container",
          DENSITY_CLASSES[effectiveDensity],
          className,
        )}
      >
        <MemoizedMarkdown
          content={content}
          id={id}
          {...(streaming !== undefined ? { streaming } : {})}
          {...(onAskQuestion ? { onAskQuestion } : {})}
        />
      </div>
    </AIErrorBoundary>
  );
}
