"use client";
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
const REMARK_PLUGINS: MarkdownOptions["remarkPlugins"] = [
  [remarkMath, { singleDollarTextMath: true }],
];

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

function safeUrlTransform(rawUrl: string): string {
  const url = rawUrl.trim();
  if (url.length === 0) return "";
  if (/^(https?:|mailto:|tel:|#|\/|\.{1,2}\/)/i.test(url)) return url;
  return ""; // dropped
}

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

export type AIMarkdownDensity = "prose" | "compact" | "bare";

const DENSITY_CLASSES: Record<AIMarkdownDensity, string> = {
  prose: "text-[13.5px] leading-[1.65]",
  compact: "text-[13.5px] leading-[1.5]",
  bare: "text-[13.5px] leading-[1.55]",
};

const LATEX_SENTINEL_OPEN_INLINE = "\uE050\uE051";
const LATEX_SENTINEL_CLOSE_INLINE = "\uE052\uE053";
const LATEX_SENTINEL_OPEN_BLOCK = "\uE054\uE055";
const LATEX_SENTINEL_CLOSE_BLOCK = "\uE056\uE057";

function encodeLatexDelimiters(s: string): string {
  return s
    .replace(/(?<!\\)\$/g, "\\$")
    .replace(/\\\(/g, LATEX_SENTINEL_OPEN_INLINE)
    .replace(/\\\)/g, LATEX_SENTINEL_CLOSE_INLINE)
    .replace(/\\\[/g, LATEX_SENTINEL_OPEN_BLOCK)
    .replace(/\\\]/g, LATEX_SENTINEL_CLOSE_BLOCK);
}

function decodeLatexDelimiters(s: string): string {
  return s
    .replaceAll(LATEX_SENTINEL_OPEN_INLINE, "$")
    .replaceAll(LATEX_SENTINEL_CLOSE_INLINE, "$")
    .replaceAll(LATEX_SENTINEL_OPEN_BLOCK, "$$")
    .replaceAll(LATEX_SENTINEL_CLOSE_BLOCK, "$$");
}
function parseMarkdownIntoBlocks(markdown: string): string[] {
  if (markdown.length === 0) return [];
  const encoded = encodeLatexDelimiters(markdown);
  const tokens = marked.lexer(encoded);
  return tokens
    .map((t) => decodeLatexDelimiters(t.raw))
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
}

const MemoizedMarkdownBlock = memo(
  function MemoizedMarkdownBlock({
    content,
    streaming,
    onAskQuestion,
  }: {
    readonly content: string;
    readonly streaming?: boolean;
    readonly onAskQuestion?: (text: string) => void;
  }) {
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

const MemoizedMarkdown = memo(function MemoizedMarkdown({
  content,
  id,
  streaming,
  onAskQuestion,
}: {
  readonly content: string;
  readonly id: string;
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


interface AIErrorBoundaryProps {
  readonly children: React.ReactNode;
  readonly fallback: string;
}
interface AIErrorBoundaryState {
  readonly errored: boolean;
}

class AIErrorBoundary extends React.Component<
  AIErrorBoundaryProps,
  AIErrorBoundaryState
> {

  state: AIErrorBoundaryState = { errored: false };
  static getDerivedStateFromError(): AIErrorBoundaryState {
    return { errored: true };
  }

  componentDidCatch(err: unknown): void {
    if (process.env.NODE_ENV !== "production") {
      console.warn("AIMarkdown: falling back to raw text", err);
    }
  }
  componentDidUpdate(prevProps: AIErrorBoundaryProps): void {
    if (this.state.errored && prevProps.fallback !== this.props.fallback) {
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

export interface AIMarkdownProps {
  readonly content: string;
  readonly id: string;
  readonly density?: AIMarkdownDensity;
  readonly className?: string;
  readonly streaming?: boolean;
  readonly onAskQuestion?: (text: string) => void;
}

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
