/**
 * miniMarkdown.ts.
 *
 * A small typed parser + validator for the subset of markdown
 * that Synedrix lesson content and worked examples use. No
 * external dependency — the whole parser is ~300 lines of
 * pure TypeScript with no runtime deps.
 *
 * Supported syntax (whitelist):
 *   $x$          inline math (KaTeX-style)
 *   $$...$$      block math, centered
 *   `code`       inline code
 *   ```code```   code block
 *   **bold**     bold
 *   *italic*     italic
 *   > [!example] title\n  body    callout (info)
 *   > [!mistake] title\n  body    callout (warn)
 *   > [!note] title\n  body       callout (neutral)
 *   - item       bullet list
 *   1. item      numbered list
 *   | col |      table with header row
 *   blank line   paragraph break
 *
 * The parser emits a typed AST. The React renderer
 * (`components/dashboard/LessonBlockBody.tsx`) consumes
 * the AST and renders React elements.
 *
 * The validator (`validateMiniMarkdown`) checks for
 * unmatched delimiters and is called by `scripts/lint-content.ts`.
 */

// ── AST types ──────────────────────────────────────────

export type InlineNode =
  | { kind: "text"; text: string }
  | { kind: "bold"; children: InlineNode[] }
  | { kind: "italic"; children: InlineNode[] }
  | { kind: "inline_math"; expression: string }
  | { kind: "inline_code"; text: string };

export type ListItem = {
  children: InlineNode[];
};

export type TableCell = {
  children: InlineNode[];
};

export type TableRow = {
  cells: TableCell[];
};

export type TableNode = {
  kind: "table";
  header: TableRow;
  rows: TableRow[];
};

export type CalloutKind = "example" | "mistake" | "note";

export type BlockNode =
  | { kind: "paragraph"; children: InlineNode[] }
  | { kind: "block_math"; expression: string }
  | { kind: "code_block"; text: string }
  | { kind: "bullet_list"; items: ListItem[] }
  | { kind: "ordered_list"; items: ListItem[] }
  | { kind: "callout"; calloutKind: CalloutKind; title: string; body: InlineNode[] }
  | { kind: "table"; node: TableNode };

export type MiniMarkdownAST = {
  blocks: BlockNode[];
};

// ── Math renderer (hand-written V1) ────────────────────

/**
 * Render a LaTeX expression to a plain-text approximation
 * using Unicode. Handles:
 *   - Subscripts: x_2 → x₂
 *   - Superscripts: x^2 → x²
 *   - Greek letters: \alpha → α, \pi → π, etc.
 *   - One-level fractions: \frac{a}{b} → (a)/(b)
 *   - \sqrt{x} → √(x)
 *   - \int → ∫, \sum → Σ, \infty → ∞, etc.
 *
 * For expressions beyond this subset, returns the raw
 * LaTeX as a fallback.
 */
const SUPERSCRIPTS: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾",
  "n": "ⁿ", "i": "ⁱ",
};

const SUBSCRIPTS: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
  "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎",
  "a": "ₐ", "e": "ₑ", "h": "ₕ", "i": "ᵢ", "k": "ₖ",
  "l": "ₗ", "m": "ₘ", "n": "ₙ", "o": "ₒ", "p": "ₚ",
  "r": "ᵣ", "s": "ₛ", "t": "ₜ", "u": "ᵤ", "v": "ᵥ", "x": "ₓ",
};

const GREEK: Record<string, string> = {
  "alpha": "α", "beta": "β", "gamma": "γ", "Gamma": "Γ",
  "delta": "δ", "Delta": "Δ", "epsilon": "ε", "zeta": "ζ",
  "eta": "η", "theta": "θ", "Theta": "Θ", "iota": "ι",
  "kappa": "κ", "lambda": "λ", "Lambda": "Λ", "mu": "μ",
  "nu": "ν", "xi": "ξ", "Xi": "Ξ", "pi": "π", "Pi": "Π",
  "rho": "ρ", "sigma": "σ", "Sigma": "Σ", "tau": "τ",
  "upsilon": "υ", "phi": "φ", "Phi": "Φ", "chi": "χ",
  "psi": "ψ", "Psi": "Ψ", "omega": "ω", "Omega": "Ω",
};

const SYMBOLS: Record<string, string> = {
  "infty": "∞", "sqrt": "√", "int": "∫", "sum": "Σ",
  "prod": "∏", "partial": "∂", "cdot": "·", "times": "×",
  "div": "÷", "pm": "±", "mp": "∓", "leq": "≤", "geq": "≥",
  "neq": "≠", "approx": "≈", "equiv": "≡", "propto": "∝",
  "rightarrow": "→", "leftarrow": "←", "Rightarrow": "⇒",
  "Leftarrow": "⇐", "leftrightarrow": "↔", "to": "→",
  "mapsto": "↦", "degree": "°", "prime": "′",
};

/**
 * Render a LaTeX math expression to a Unicode plain-text
 * approximation. Handles the subset of LaTeX used in
 * Gymnasium-level formulas.
 */
export function renderMath(expression: string): string {
  let result = expression.trim();

  // Handle \frac{numerator}{denominator} → (numerator)/(denominator)
  result = result.replace(/\\frac\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, (_, num, den) => {
    return `(${renderMath(num)})/(${renderMath(den)})`;
  });

  // Handle \sqrt{...} → √(...)
  result = result.replace(/\\sqrt\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g, (_, inner) => {
    return `√(${renderMath(inner)})`;
  });

  // Superscripts: x^{abc} or x^a
  result = result.replace(/\^\{([^}]*)\}/g, (_, exp) => {
    return [...exp].map((c: string) => SUPERSCRIPTS[c] ?? c).join("");
  });
  result = result.replace(/\^([0-9+\-=()ni])/g, (_, c) => SUPERSCRIPTS[c] ?? `^${c}`);

  // Subscripts: x_{abc} or x_a
  result = result.replace(/_\{([^}]*)\}/g, (_, exp) => {
    return [...exp].map((c: string) => SUBSCRIPTS[c] ?? c).join("");
  });
  result = result.replace(/_([0-9+\-=()aehiklmoprstuvx])/g, (_, c) => SUBSCRIPTS[c] ?? `_${c}`);

  // Greek letters and named symbols. For unknown commands,
  // drop the backslash and emit the command name verbatim
  // so plain-text consumers see `ln` rather than `\ln`. The
  // well-known commands in GREEK + SYMBOLS still map to
  // their Unicode glyphs.
  result = result.replace(/\\[a-zA-Z]+/g, (match) => {
    const name = match.slice(1);
    return GREEK[name] ?? SYMBOLS[name] ?? name;
  });

  // Remove extra spaces around operators
  result = result.replace(/\s+/g, " ").trim();

  return result;
}

// ── Mini-markdown parser ───────────────────────────────

/**
 * Parse a mini-markdown string into a typed AST.
 * Throws ParseError on unmatched delimiters or
 * structural issues.
 */
export function parseMiniMarkdown(input: string): MiniMarkdownAST {
  // Split into lines, then group into blocks separated by blank lines.
  const lines = input.split("\n");
  const blocks: BlockNode[] = [];

  let i = 0;
  while (i < lines.length) {
    // Skip blank lines (paragraph separators)
    if (lines[i].trim() === "") {
      i++;
      continue;
    }

    // Check for callout (> [!kind] title)
    if (lines[i].startsWith("> [!")) {
      const callout = parseCallout(lines, i);
      blocks.push(callout.block);
      i = callout.nextIndex;
      continue;
    }

    // Check for code block (```)
    if (lines[i].startsWith("```") && lines[i].length > 3) {
      const endIdx = lines.indexOf("```", i + 1);
      const text = endIdx > i
        ? lines.slice(i + 1, endIdx).join("\n")
        : lines.slice(i + 1).join("\n");
      blocks.push({ kind: "code_block", text });
      i = endIdx > i ? endIdx + 1 : lines.length;
      continue;
    }

    // Check for table (| col | col |)
    if (lines[i].startsWith("|") && lines[i].endsWith("|")) {
      const table = parseTable(lines, i);
      blocks.push({ kind: "table", node: table.block });
      i = table.nextIndex;
      continue;
    }

    // Check for block math ($$...$$)
    if (lines[i].trim().startsWith("$$") && lines[i].trim() === "$$") {
      const mathLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== "$$") {
        mathLines.push(lines[i]);
        i++;
      }
      blocks.push({ kind: "block_math", expression: mathLines.join("\n").trim() });
      i++; // skip closing $$
      continue;
    }

    // Check for bullet list (- item)
    if (lines[i].trim().startsWith("- ")) {
      const { items, nextIndex } = parseList(lines, i, "bullet");
      blocks.push({ kind: "bullet_list", items });
      i = nextIndex;
      continue;
    }

    // Check for ordered list (1. item)
    if (/^\d+\.\s/.test(lines[i].trim())) {
      const { items, nextIndex } = parseList(lines, i, "ordered");
      blocks.push({ kind: "ordered_list", items });
      i = nextIndex;
      continue;
    }

    // Paragraph: consume consecutive non-blank, non-special lines
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" &&
           !lines[i].startsWith("> [!") &&
           !lines[i].startsWith("```") &&
           !lines[i].startsWith("|") &&
           !(lines[i].trim().startsWith("$$") && lines[i].trim() === "$$") &&
           !lines[i].trim().startsWith("- ") &&
           !/^\d+\.\s/.test(lines[i].trim())) {
      paraLines.push(lines[i]);
      i++;
    }
    const paraText = paraLines.join(" ").trim();
    if (paraText.length > 0) {
      blocks.push({ kind: "paragraph", children: parseInline(paraText) });
    }
  }

  return { blocks };
}

/** Parse inline content: text, $math$, **bold**, *italic*, `code` */
export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let pos = 0;

  while (pos < text.length) {
    // Inline math: $...$
    if (text[pos] === "$") {
      const end = text.indexOf("$", pos + 1);
      if (end === -1) {
        nodes.push({ kind: "text", text: text.slice(pos) });
        break;
      }
      nodes.push({ kind: "inline_math", expression: text.slice(pos + 1, end) });
      pos = end + 1;
      continue;
    }

    // Bold: **...**
    if (text.slice(pos, pos + 2) === "**") {
      const end = text.indexOf("**", pos + 2);
      if (end === -1) {
        nodes.push({ kind: "text", text: text.slice(pos) });
        break;
      }
      const inner = parseInline(text.slice(pos + 2, end));
      nodes.push({ kind: "bold", children: inner });
      pos = end + 2;
      continue;
    }

    // Italic: *...*
    if (text[pos] === "*" && text[pos + 1] !== "*") {
      const end = text.indexOf("*", pos + 1);
      if (end === -1) {
        nodes.push({ kind: "text", text: text.slice(pos) });
        break;
      }
      const inner = parseInline(text.slice(pos + 1, end));
      nodes.push({ kind: "italic", children: inner });
      pos = end + 1;
      continue;
    }

    // Inline code: `...`
    if (text[pos] === "`") {
      const end = text.indexOf("`", pos + 1);
      if (end === -1) {
        nodes.push({ kind: "text", text: text.slice(pos) });
        break;
      }
      nodes.push({ kind: "inline_code", text: text.slice(pos + 1, end) });
      pos = end + 1;
      continue;
    }

    // Regular text: accumulate until next special char
    let next = pos + 1;
    while (next < text.length && text[next] !== "$" && text[next] !== "`" &&
           text[next] !== "*") {
      next++;
    }
    nodes.push({ kind: "text", text: text.slice(pos, next) });
    pos = next;
  }

  return nodes;
}

function parseCallout(lines: string[], start: number): { block: BlockNode; nextIndex: number } {
  const line = lines[start];
  const match = line.match(/^> \[!(example|mistake|note)\]\s*(.*)/);
  if (!match) {
    // Fallback: treat as paragraph
    return { block: { kind: "paragraph", children: parseInline(line.replace("> ", "")) }, nextIndex: start + 1 };
  }
  const calloutKind = match[1] as CalloutKind;
  const title = match[2].trim();

  const bodyLines: string[] = [];
  let i = start + 1;
  while (i < lines.length && lines[i].startsWith("> ")) {
    bodyLines.push(lines[i].slice(2));
    i++;
  }

  const bodyText = bodyLines.join(" ").trim();
  return {
    block: {
      kind: "callout",
      calloutKind,
      title,
      body: parseInline(bodyText),
    },
    nextIndex: i,
  };
}

function parseList(lines: string[], start: number, kind: "bullet" | "ordered"): { items: ListItem[]; nextIndex: number } {
  const items: ListItem[] = [];
  let i = start;
  const bulletRegex = kind === "bullet" ? /^-\s/ : /^\d+\.\s/;

  while (i < lines.length && bulletRegex.test(lines[i].trim())) {
    const text = lines[i].trim().replace(bulletRegex, "");
    items.push({ children: parseInline(text) });
    i++;
  }
  return { items, nextIndex: i };
}

function parseTable(lines: string[], start: number): { block: TableNode; nextIndex: number } {
  const headerLine = lines[start];
  const headerCells = headerLine.split("|").filter(c => c.trim().length > 0);

  // Skip separator line |---|
  let i = start + 1;
  if (i < lines.length && lines[i].includes("---")) {
    i++;
  }

  const rows: TableRow[] = [];
  while (i < lines.length && lines[i].startsWith("|") && lines[i].endsWith("|")) {
    const cells = lines[i].split("|").filter(c => c.trim().length > 0);
    rows.push({
      cells: cells.map(c => ({ children: parseInline(c.trim()) })),
    });
    i++;
  }

  return {
    block: {
      kind: "table",
      header: { cells: headerCells.map(c => ({ children: parseInline(c.trim()) })) },
      rows,
    },
    nextIndex: i,
  };
}

// ── Validation ─────────────────────────────────────────

export interface ValidationFailure {
  kind: string;
  message: string;
}

/**
 * Validate a mini-markdown string for unmatched delimiters
 * and structural issues. Returns an array of failures; empty
 * array = valid.
 */
export function validateMiniMarkdown(input: string): ValidationFailure[] {
  const failures: ValidationFailure[] = [];

  // Check unmatched $$
  const dollarDollarCount = (input.match(/\$\$/g) ?? []).length;
  if (dollarDollarCount % 2 !== 0) {
    failures.push({ kind: "unmatched_math_block", message: "Unmatched $$ block-math delimiter" });
  }

  // Check unmatched $ (single, not part of $$)
  let singleDollarCount = 0;
  for (let i = 0; i < input.length; i++) {
    if (input[i] === "$" && input[i + 1] !== "$") {
      singleDollarCount++;
    }
  }
  if (singleDollarCount % 2 !== 0) {
    failures.push({ kind: "unmatched_math_inline", message: "Unmatched $ inline-math delimiter" });
  }

  // Check unmatched ``` blocks
  const codeBlockCount = (input.match(/```/g) ?? []).length;
  if (codeBlockCount % 2 !== 0) {
    failures.push({ kind: "unmatched_code_block", message: "Unmatched ``` code-block delimiter" });
  }

  // Check unmatched **
  const boldCount = (input.match(/\*\*/g) ?? []).length;
  if (boldCount % 2 !== 0) {
    failures.push({ kind: "unmatched_bold", message: "Unmatched ** bold delimiter" });
  }

  // Check unmatched * (italic, not part of **)
  let italicStars = 0;
  for (let i = 0; i < input.length; i++) {
    if (input[i] === "*" && input[i + 1] !== "*" && (i === 0 || input[i - 1] !== "*")) {
      italicStars++;
    }
  }
  if (italicStars % 2 !== 0) {
    failures.push({ kind: "unmatched_italic", message: "Unmatched * italic delimiter" });
  }

  // Check unmatched ` (inline code)
  let backtickCount = 0;
  for (let i = 0; i < input.length; i++) {
    if (input[i] === "`" && input[i + 1] !== "`" && input[i + 2] !== "`") {
      backtickCount++;
    }
  }
  if (backtickCount % 2 !== 0) {
    failures.push({ kind: "unmatched_code", message: "Unmatched ` inline-code delimiter" });
  }

  return failures;
}

/**
 * Convenience: validate and throw on first failure.
 */
export function assertMiniMarkdown(input: string): void {
  const failures = validateMiniMarkdown(input);
  if (failures.length > 0) {
    throw new Error(`Mini-markdown validation failed: ${failures[0].message}`);
  }
}
