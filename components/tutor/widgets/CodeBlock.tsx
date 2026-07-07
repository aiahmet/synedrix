"use client";

/**
 * CodeBlock.tsx — Phase 5 §7.3.
 *
 * Syntax-highlighted code block widget for `[[code:lang|...]]`
 * markers. Renders code with basic keyword/comment/string
 * highlighting using regex (no heavy library dependency).
 *
 * Marker contract:
 *   [[code:python|def greet():
 *     print("Hello, world!")]]
 *
 * Features:
 *   - Language-aware syntax highlighting via regex patterns
 *   - Copy-to-clipboard button
 *   - Clean monospace display matching the design system
 *   - Responsive horizontal scroll for long lines
 *
 * Supported languages (basic highlighting):
 *   - python, javascript/typescript, html, css, sql, bash
 *   - Falls back to plain text for unknown languages
 */

import { useCallback, useState } from "react";
import { Check, ClipboardText, Code } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils/cn";

// ── Tokenizer ─────────────────────────────────────────────

interface Token {
  readonly text: string;
  readonly kind: "keyword" | "string" | "comment" | "number" | "builtin" | "punctuation" | "plain";
}

interface LanguageDef {
  readonly keywords: Set<string>;
  readonly builtins: Set<string>;
  readonly singleLineComment: string;
  readonly stringDelimiters: [string, string][];
  readonly numberPattern?: RegExp;
}

const LANGUAGES: Record<string, LanguageDef> = {
  python: {
    keywords: new Set([
      "def", "class", "return", "if", "elif", "else", "for", "while",
      "import", "from", "as", "try", "except", "finally", "raise",
      "with", "yield", "lambda", "pass", "break", "continue", "and",
      "or", "not", "in", "is", "None", "True", "False", "async", "await",
    ]),
    builtins: new Set([
      "print", "len", "range", "int", "float", "str", "list", "dict",
      "set", "tuple", "type", "isinstance", "open", "input", "sum",
      "min", "max", "abs", "round", "sorted", "enumerate", "zip", "map",
      "filter", "any", "all", "super", "self",
    ]),
    singleLineComment: "#",
    stringDelimiters: [
      ['"""', '"""'],
      ["'''", "'''"],
      ['"', '"'],
      ["'", "'"],
    ],
    numberPattern: /\b\d+(\.\d+)?([eE][+-]?\d+)?\b/,
  },
  javascript: {
    keywords: new Set([
      "const", "let", "var", "function", "return", "if", "else", "for",
      "while", "do", "switch", "case", "break", "continue", "try",
      "catch", "finally", "throw", "new", "class", "extends", "import",
      "export", "default", "from", "async", "await", "typeof",
      "instanceof", "this", "super", "null", "undefined", "true", "false",
    ]),
    builtins: new Set([
      "console", "document", "window", "Math", "JSON", "Promise",
      "Array", "Object", "String", "Number", "Map", "Set", "fetch",
      "setTimeout", "setInterval", "parseInt", "parseFloat",
    ]),
    singleLineComment: "//",
    stringDelimiters: [
      ["`", "`"],
      ['"', '"'],
      ["'", "'"],
    ],
    numberPattern: /\b\d+(\.\d+)?([eE][+-]?\d+)?\b/,
  },
  typescript: {
    keywords: new Set([
      "const", "let", "var", "function", "return", "if", "else", "for",
      "while", "do", "switch", "case", "break", "continue", "try",
      "catch", "finally", "throw", "new", "class", "extends", "import",
      "export", "default", "from", "async", "await", "typeof",
      "instanceof", "this", "super", "null", "undefined", "true", "false",
      "type", "interface", "enum", "implements", "readonly", "as",
      "satisfies", "infer", "keyof", "extends", "namespace", "declare",
    ]),
    builtins: new Set([
      "console", "document", "window", "Math", "JSON", "Promise",
      "Array", "Object", "String", "Number", "Map", "Set", "fetch",
      "setTimeout", "setInterval", "parseInt", "parseFloat", "React",
    ]),
    singleLineComment: "//",
    stringDelimiters: [
      ["`", "`"],
      ['"', '"'],
      ["'", "'"],
    ],
    numberPattern: /\b\d+(\.\d+)?([eE][+-]?\d+)?\b/,
  },
  html: {
    keywords: new Set([
      "html", "head", "body", "div", "span", "p", "a", "img", "ul", "ol",
      "li", "table", "tr", "td", "th", "form", "input", "button", "h1",
      "h2", "h3", "h4", "h5", "h6", "section", "article", "nav",
      "header", "footer", "main", "script", "style", "link", "meta",
    ]),
    builtins: new Set(),
    singleLineComment: "",  // HTML uses <!-- --> which is multi-line
    stringDelimiters: [
      ['"', '"'],
      ["'", "'"],
    ],
  },
  css: {
    keywords: new Set([
      "color", "background", "margin", "padding", "border", "font",
      "display", "position", "width", "height", "flex", "grid",
      "align", "justify", "gap", "overflow", "opacity", "transform",
      "transition", "animation",
    ]),
    builtins: new Set([
      "px", "em", "rem", "%", "vh", "vw", "rgb", "rgba", "hsl",
      "var", "calc", "none", "auto", "inherit", "initial", "unset",
    ]),
    singleLineComment: "",  // CSS uses /* */ which is multi-line
    stringDelimiters: [
      ['"', '"'],
      ["'", "'"],
    ],
    numberPattern: /\b\d+(\.\d+)?(px|em|rem|%|vh|vw|s|ms)?\b/,
  },
  sql: {
    keywords: new Set([
      "SELECT", "FROM", "WHERE", "INSERT", "UPDATE", "DELETE", "CREATE",
      "TABLE", "ALTER", "DROP", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER",
      "ON", "AND", "OR", "NOT", "IN", "LIKE", "BETWEEN", "ORDER", "BY",
      "GROUP", "HAVING", "LIMIT", "OFFSET", "AS", "DISTINCT", "COUNT",
      "SUM", "AVG", "MIN", "MAX", "NULL", "IS", "CASE", "WHEN", "THEN",
      "ELSE", "END", "UNION", "ALL", "EXISTS", "PRIMARY", "KEY", "FOREIGN",
      "REFERENCES", "INDEX", "UNIQUE", "DEFAULT", "VALUES", "SET",
      "INTO", "TRUNCATE", "BEGIN", "COMMIT", "ROLLBACK",
      "select", "from", "where", "insert", "update", "delete", "create",
      "table", "alter", "drop", "join", "left", "right", "inner", "outer",
      "on", "and", "or", "not", "in", "like", "between", "order", "by",
      "group", "having", "limit", "offset", "as", "distinct", "count",
      "sum", "avg", "min", "max", "null", "is", "case", "when", "then",
      "else", "end", "union", "all", "exists",
    ]),
    builtins: new Set(),
    singleLineComment: "--",
    stringDelimiters: [
      ["'", "'"],
    ],
    numberPattern: /\b\d+(\.\d+)?\b/,
  },
  bash: {
    keywords: new Set([
      "if", "then", "else", "elif", "fi", "for", "while", "do", "done",
      "case", "esac", "in", "function", "return", "exit", "export",
      "local", "source", "echo", "cd", "ls", "mkdir", "rm", "cp", "mv",
      "cat", "grep", "sed", "awk", "chmod", "chown", "curl", "wget",
    ]),
    builtins: new Set(),
    singleLineComment: "#",
    stringDelimiters: [
      ['"', '"'],
      ["'", "'"],
    ],
  },
};

// Map common aliases
const LANG_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
};

function getLanguageDef(lang: string): LanguageDef | null {
  const normalized = lang.toLowerCase().trim();
  const resolved = LANG_ALIASES[normalized] ?? normalized;
  return LANGUAGES[resolved] ?? null;
}

/**
 * Tokenize source code into colored segments.
 * Uses a simple state-machine approach: scan for comments,
 * strings, and keywords in a single left-to-right pass.
 */
function tokenize(source: string, lang: LanguageDef): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    // ── Single-line comment ────────────────────────────
    if (
      lang.singleLineComment &&
      source.startsWith(lang.singleLineComment, i)
    ) {
      const end = source.indexOf("\n", i);
      const text = end === -1 ? source.slice(i) : source.slice(i, end);
      tokens.push({ text, kind: "comment" });
      i += text.length;
      continue;
    }

    // ── Multi-line comment (/* */ for JS/TS/CSS) ────────
    if (source.startsWith("/*", i)) {
      const end = source.indexOf("*/", i + 2);
      if (end !== -1) {
        tokens.push({
          text: source.slice(i, end + 2),
          kind: "comment",
        });
        i = end + 2;
        continue;
      }
    }

    // ── HTML comment (<!-- -->) ────────────────────────
    if (source.startsWith("<!--", i)) {
      const end = source.indexOf("-->", i + 4);
      if (end !== -1) {
        tokens.push({
          text: source.slice(i, end + 3),
          kind: "comment",
        });
        i = end + 3;
        continue;
      }
    }

    // ── Strings ────────────────────────────────────────
    let matched = false;
    // Sort by length desc so triple-quoted strings match first
    const sortedDelims = [...lang.stringDelimiters].sort(
      (a, b) => b[0].length - a[0].length,
    );
    for (const [open, close] of sortedDelims) {
      if (source.startsWith(open, i)) {
        const end = source.indexOf(close, i + open.length);
        if (end !== -1) {
          tokens.push({
            text: source.slice(i, end + close.length),
            kind: "string",
          });
          i = end + close.length;
          matched = true;
          break;
        }
      }
    }
    if (matched) continue;

    // ── Numbers ────────────────────────────────────────
    if (lang.numberPattern) {
      const match = lang.numberPattern.exec(source.slice(i));
      if (match && match.index === 0) {
        tokens.push({ text: match[0], kind: "number" });
        i += match[0].length;
        continue;
      }
    }

    // ── Identifiers / keywords ─────────────────────────
    const identMatch = /^[a-zA-Z_$][a-zA-Z0-9_$]*/.exec(source.slice(i));
    if (identMatch) {
      const word = identMatch[0];
      if (lang.keywords.has(word)) {
        tokens.push({ text: word, kind: "keyword" });
      } else if (lang.builtins.has(word)) {
        tokens.push({ text: word, kind: "builtin" });
      } else {
        tokens.push({ text: word, kind: "plain" });
      }
      i += word.length;
      continue;
    }

    // ── Punctuation / operators ─────────────────────────
    const opMatch = /^[{}[\]();,:.<>+\-*/%=!&|^~?@#]+/.exec(
      source.slice(i),
    );
    if (opMatch) {
      tokens.push({ text: opMatch[0], kind: "punctuation" });
      i += opMatch[0].length;
      continue;
    }

    // ── Whitespace / everything else ────────────────────
    tokens.push({ text: source[i]!, kind: "plain" });
    i++;
  }

  return tokens;
}

// ── Token class mapping ──────────────────────────────────

const TOKEN_CLASSES: Record<Token["kind"], string> = {
  keyword: "text-[var(--subject-physics,#7c3aed)] font-medium",
  string: "text-[var(--subject-german,#059669)]",
  comment: "text-[var(--muted-foreground)]/50 italic",
  number: "text-[var(--subject-french,#db2777)]",
  builtin: "text-[var(--accent)]",
  punctuation: "text-[var(--muted-foreground)]/70",
  plain: "text-foreground/90",
};

// ── Component ────────────────────────────────────────────

export interface CodeBlockProps {
  readonly language: string;
  readonly code: string;
  readonly className?: string;
}

export function CodeBlock({ language, code, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const langDef = getLanguageDef(language);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available — silently fail
    }
  }, [code]);

  const tokens = langDef ? tokenize(code, langDef) : null;

  return (
    <div
      className={cn(
        "my-3 overflow-hidden rounded-xl border border-border bg-surface-elevated",
        className,
      )}
    >
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border/60 px-3.5 py-2">
        <span className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-subtle/70 text-accent">
            <Code className="h-3 w-3" weight="duotone" />
          </span>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
            {language}
          </span>
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex h-6 items-center gap-1.5 rounded-md border border-border/60 bg-surface px-2 text-[10.5px] font-medium text-muted-foreground transition-colors hover:border-accent-border/60 hover:text-accent"
        >
          {copied ? (
            <Check className="h-3 w-3 text-accent" weight="bold" />
          ) : (
            <ClipboardText className="h-3 w-3" weight="duotone" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </header>

      {/* Code body */}
      <div className="overflow-x-auto">
        <pre className="px-3.5 py-3 font-mono text-[12.25px] leading-relaxed text-foreground/95">
          <code>
            {tokens ? (
              tokens.map((tok, idx) => (
                <span key={idx} className={TOKEN_CLASSES[tok.kind]}>
                  {tok.text}
                </span>
              ))
            ) : (
              <span className="text-foreground/90">{code}</span>
            )}
          </code>
        </pre>
      </div>
    </div>
  );
}

export default CodeBlock;
