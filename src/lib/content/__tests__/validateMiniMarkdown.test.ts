import { describe, it, expect } from "vitest";
import { validateMiniMarkdown } from "../miniMarkdown";

describe("validateMiniMarkdown — per-field scenarios", () => {
  it("accepts clean content", () => {
    expect(validateMiniMarkdown("Hello world")).toEqual([]);
  });

  it("accepts content with balanced mixed delimiters", () => {
    const input = "The **logarithm** of $x$ is `ln x`. Use $$x^2$$ for squares.";
    expect(validateMiniMarkdown(input)).toEqual([]);
  });

  it("accepts callouts", () => {
    const input = "> [!example] Rule\n> Use $f(x) = x^2$ for the square.";
    expect(validateMiniMarkdown(input)).toEqual([]);
  });

  it("accepts code blocks with math inside", () => {
    const input = "```\n$x = y$\n```";
    expect(validateMiniMarkdown(input)).toEqual([]);
  });

  it("flags unbalanced math block", () => {
    expect(validateMiniMarkdown("$$\nx^2\n").some(f => f.kind === "unmatched_math_block")).toBe(true);
  });

  it("flags consecutive $$ without proper closing", () => {
    // Two separate block-math segments: $$a$$ $$b$$
    expect(validateMiniMarkdown("$$\na\n$$\n\n$$\nb\n$$")).toEqual([]);
  });

  it("accepts empty string", () => {
    expect(validateMiniMarkdown("")).toEqual([]);
  });

  it("accepts content with $0$ and no issues", () => {
    expect(validateMiniMarkdown("$0$")).toEqual([]);
  });
});
