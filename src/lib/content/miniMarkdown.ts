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

export function renderMath(expression: string): string {
  let result = expression.trim();

  result = result.replace(/\\frac\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, (_, num, den) => {
    return `(${renderMath(num)})/(${renderMath(den)})`;
  });

  result = result.replace(/\\sqrt\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g, (_, inner) => {
    return `√(${renderMath(inner)})`;
  });

  result = result.replace(/\^\{([^}]*)\}/g, (_, exp) => {
    return [...exp].map((c: string) => SUPERSCRIPTS[c] ?? c).join("");
  });
  result = result.replace(/\^([0-9+\-=()ni])/g, (_, c) => SUPERSCRIPTS[c] ?? `^${c}`);

  result = result.replace(/_\{([^}]*)\}/g, (_, exp) => {
    return [...exp].map((c: string) => SUBSCRIPTS[c] ?? c).join("");
  });
  result = result.replace(/_([0-9+\-=()aehiklmoprstuvx])/g, (_, c) => SUBSCRIPTS[c] ?? `_${c}`);
  result = result.replace(/\\[a-zA-Z]+/g, (match) => {
    const name = match.slice(1);
    return GREEK[name] ?? SYMBOLS[name] ?? name;
  });

  result = result.replace(/\s+/g, " ").trim();

  return result;
}

export function parseMiniMarkdown(input: string): MiniMarkdownAST {
  const lines = input.split("\n");
  const blocks: BlockNode[] = [];

  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() === "") {
      i++;
      continue;
    }

    if (lines[i].startsWith("> [!")) {
      const callout = parseCallout(lines, i);
      blocks.push(callout.block);
      i = callout.nextIndex;
      continue;
    }

    if (lines[i].startsWith("```") && lines[i].length > 3) {
      const endIdx = lines.indexOf("```", i + 1);
      const text = endIdx > i
        ? lines.slice(i + 1, endIdx).join("\n")
        : lines.slice(i + 1).join("\n");
      blocks.push({ kind: "code_block", text });
      i = endIdx > i ? endIdx + 1 : lines.length;
      continue;
    }

    if (lines[i].startsWith("|") && lines[i].endsWith("|")) {
      const table = parseTable(lines, i);
      blocks.push({ kind: "table", node: table.block });
      i = table.nextIndex;
      continue;
    }

    if (lines[i].trim().startsWith("$$") && lines[i].trim() === "$$") {
      const mathLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== "$$") {
        mathLines.push(lines[i]);
        i++;
      }
      blocks.push({ kind: "block_math", expression: mathLines.join("\n").trim() });
      i++;
      continue;
    }

    if (lines[i].trim().startsWith("- ")) {
      const { items, nextIndex } = parseList(lines, i, "bullet");
      blocks.push({ kind: "bullet_list", items });
      i = nextIndex;
      continue;
    }

    if (/^\d+\.\s/.test(lines[i].trim())) {
      const { items, nextIndex } = parseList(lines, i, "ordered");
      blocks.push({ kind: "ordered_list", items });
      i = nextIndex;
      continue;
    }

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

export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let pos = 0;

  while (pos < text.length) {
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


export interface ValidationFailure {
  kind: string;
  message: string;
}

export function validateMiniMarkdown(input: string): ValidationFailure[] {
  const failures: ValidationFailure[] = [];

  const dollarDollarCount = (input.match(/\$\$/g) ?? []).length;
  if (dollarDollarCount % 2 !== 0) {
    failures.push({ kind: "unmatched_math_block", message: "Unmatched $$ block-math delimiter" });
  }

  let singleDollarCount = 0;
  for (let i = 0; i < input.length; i++) {
    if (input[i] === "$" && input[i + 1] !== "$") {
      singleDollarCount++;
    }
  }
  if (singleDollarCount % 2 !== 0) {
    failures.push({ kind: "unmatched_math_inline", message: "Unmatched $ inline-math delimiter" });
  }

  const codeBlockCount = (input.match(/```/g) ?? []).length;
  if (codeBlockCount % 2 !== 0) {
    failures.push({ kind: "unmatched_code_block", message: "Unmatched ``` code-block delimiter" });
  }

  const boldCount = (input.match(/\*\*/g) ?? []).length;
  if (boldCount % 2 !== 0) {
    failures.push({ kind: "unmatched_bold", message: "Unmatched ** bold delimiter" });
  }

  let italicStars = 0;
  for (let i = 0; i < input.length; i++) {
    if (input[i] === "*" && input[i + 1] !== "*" && (i === 0 || input[i - 1] !== "*")) {
      italicStars++;
    }
  }
  if (italicStars % 2 !== 0) {
    failures.push({ kind: "unmatched_italic", message: "Unmatched * italic delimiter" });
  }
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

export function assertMiniMarkdown(input: string): void {
  const failures = validateMiniMarkdown(input);
  if (failures.length > 0) {
    throw new Error(`Mini-markdown validation failed: ${failures[0].message}`);
  }
}
