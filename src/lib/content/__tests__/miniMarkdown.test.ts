import { describe, it, expect } from "vitest";
import {
  parseMiniMarkdown,
  parseInline,
  validateMiniMarkdown,
  assertMiniMarkdown,
  type InlineNode,
} from "../miniMarkdown";

// ── Inline parsing ─────────────────────────────────────

describe("parseInline", () => {
  it("parses plain text", () => {
    const result = parseInline("Hello world");
    expect(result).toEqual([{ kind: "text", text: "Hello world" }]);
  });

  it("parses inline math $x$", () => {
    const result = parseInline("The value of $x$ is 5");
    expect(result).toEqual([
      { kind: "text", text: "The value of " },
      { kind: "inline_math", expression: "x" },
      { kind: "text", text: " is 5" },
    ]);
  });

  it("parses bold **text**", () => {
    const result = parseInline("This is **important** text");
    expect(result).toEqual([
      { kind: "text", text: "This is " },
      { kind: "bold", children: [{ kind: "text", text: "important" }] },
      { kind: "text", text: " text" },
    ]);
  });

  it("parses italic *text*", () => {
    const result = parseInline("Read *this* carefully");
    expect(result).toEqual([
      { kind: "text", text: "Read " },
      { kind: "italic", children: [{ kind: "text", text: "this" }] },
      { kind: "text", text: " carefully" },
    ]);
  });

  it("parses inline code `foo()`", () => {
    const result = parseInline("Call `foo()` to start");
    expect(result).toEqual([
      { kind: "text", text: "Call " },
      { kind: "inline_code", text: "foo()" },
      { kind: "text", text: " to start" },
    ]);
  });

  it("parses mixed inline", () => {
    const result = parseInline("The **log** of $x$ is `ln x` for *natural* logs");
    // Nine nodes: "The ", bold("log"), " of ", math("x"),
    // " is ", code("ln x"), " for ", italic("natural"),
    // " logs".
    expect(result.length).toBe(9);
    expect(result[0]).toEqual({ kind: "text", text: "The " });
    expect(result[1].kind).toBe("bold");
    expect(result[3].kind).toBe("inline_math");
    expect(result[5].kind).toBe("inline_code");
    expect(result[7].kind).toBe("italic");
  });
});

// ── Block parsing ──────────────────────────────────────

describe("parseMiniMarkdown", () => {
  it("parses a single paragraph", () => {
    const result = parseMiniMarkdown("Hello world");
    expect(result.blocks).toEqual([
      { kind: "paragraph", children: [{ kind: "text", text: "Hello world" }] },
    ]);
  });

  it("parses block math $$...$$", () => {
    const result = parseMiniMarkdown("$$\nx^2 + y^2 = 1\n$$");
    expect(result.blocks).toEqual([
      { kind: "block_math", expression: "x^2 + y^2 = 1" },
    ]);
  });

  it("parses a code block", () => {
    const result = parseMiniMarkdown("```python\nprint(42)\nreturn 0\n```");
    expect(result.blocks).toEqual([
      { kind: "code_block", text: "print(42)\nreturn 0" },
    ]);
  });

  it("parses callouts", () => {
    const result = parseMiniMarkdown("> [!example] The product rule\n> Apply log(xy) = log x + log y");
    expect(result.blocks[0].kind).toBe("callout");
    const c = result.blocks[0] as { kind: "callout"; calloutKind: string; title: string };
    expect(c.calloutKind).toBe("example");
    expect(c.title).toBe("The product rule");
  });

  it("parses mistake callout", () => {
    const result = parseMiniMarkdown("> [!mistake] Forgetting the constant\n> d/dx ln x is 1/x, not 1.");
    expect(result.blocks[0].kind).toBe("callout");
    const c = result.blocks[0] as { kind: "callout"; calloutKind: string };
    expect(c.calloutKind).toBe("mistake");
  });

  it("parses note callout", () => {
    const result = parseMiniMarkdown("> [!note] Reminder\n> The exam is on Friday.");
    expect(result.blocks[0].kind).toBe("callout");
    const c = result.blocks[0] as { kind: "callout"; calloutKind: string };
    expect(c.calloutKind).toBe("note");
  });

  it("parses bullet lists", () => {
    const result = parseMiniMarkdown("- First item\n- Second item\n- Third item");
    expect(result.blocks[0].kind).toBe("bullet_list");
    const block = result.blocks[0] as { kind: "bullet_list"; items: { children: InlineNode[] }[] };
    expect(block.items.length).toBe(3);
    expect(block.items[0].children[0]).toEqual({ kind: "text", text: "First item" });
  });

  it("parses ordered lists", () => {
    const result = parseMiniMarkdown("1. Step one\n2. Step two\n3. Step three");
    expect(result.blocks[0].kind).toBe("ordered_list");
    const block = result.blocks[0] as { kind: "ordered_list"; items: { children: InlineNode[] }[] };
    expect(block.items.length).toBe(3);
  });

  it("parses tables", () => {
    const result = parseMiniMarkdown("| Rule | Formula |\n|---|---|\n| Product | $\\log(xy) = \\log x + \\log y$ |\n| Quotient | $\\log(x/y) = \\log x - \\log y$ |");
    expect(result.blocks[0].kind).toBe("table");
  });

  it("parses multiple paragraphs", () => {
    const result = parseMiniMarkdown("First paragraph.\n\nSecond paragraph.");
    expect(result.blocks.length).toBe(2);
    expect(result.blocks[0].kind).toBe("paragraph");
    expect(result.blocks[1].kind).toBe("paragraph");
  });
});

// ── Validation ─────────────────────────────────────────

describe("validateMiniMarkdown", () => {
  it("passes valid content", () => {
    expect(validateMiniMarkdown("Hello $world$")).toEqual([]);
    expect(validateMiniMarkdown("```code``` **bold** *italic*")).toEqual([]);
  });

  it("flags unmatched $$", () => {
    const result = validateMiniMarkdown("$$\nunclosed math");
    expect(result.some(f => f.kind === "unmatched_math_block")).toBe(true);
  });

  it("flags unmatched $", () => {
    const result = validateMiniMarkdown("The value of $x is 5");
    expect(result.some(f => f.kind === "unmatched_math_inline")).toBe(true);
  });

  it("flags unmatched ```", () => {
    const result = validateMiniMarkdown("```typescript\ncode without closing");
    expect(result.some(f => f.kind === "unmatched_code_block")).toBe(true);
  });

  it("flags unmatched **", () => {
    const result = validateMiniMarkdown("**unclosed bold");
    expect(result.some(f => f.kind === "unmatched_bold")).toBe(true);
  });

  it("flags unmatched *", () => {
    const result = validateMiniMarkdown("*unclosed italic");
    expect(result.some(f => f.kind === "unmatched_italic")).toBe(true);
  });

  it("flags unmatched `", () => {
    const result = validateMiniMarkdown("`unclosed code");
    expect(result.some(f => f.kind === "unmatched_code")).toBe(true);
  });
});

describe("assertMiniMarkdown", () => {
  it("does not throw on valid content", () => {
    expect(() => assertMiniMarkdown("Valid $content$")).not.toThrow();
  });

  it("throws on invalid content", () => {
    expect(() => assertMiniMarkdown("$unclosed math")).toThrow("Mini-markdown validation failed");
  });
});
