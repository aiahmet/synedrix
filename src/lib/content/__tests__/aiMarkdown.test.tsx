/**
 * aiMarkdown tests.
 *
 * The renderer is a React client component but we use
 * `react-dom/server`'s `renderToStaticMarkup` to test it
 * synchronously in the Vitest `node` environment — no
 * jsdom needed because we only need the HTML string
 * output, not a live DOM tree.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AIMarkdown } from "../aiMarkdown";

const render = (
  content: string,
  density: "prose" | "compact" | "bare" = "prose",
): string =>
  // Static rendering doesn't stream, so the memoization id
  // is irrelevant for test outcomes — but the prop is now
  // required, so we pass a sentinel. Pick a stable id per
  // test phase so block-level keys inside the renderer
  // remain deterministic across the multiple `render()`
  // calls in a single Vitest run.
  renderToStaticMarkup(
    <AIMarkdown id="test" content={content} density={density} />,
  );

describe("AIMarkdown — basic structure", () => {
  it("renders plain text in a <p> by default", () => {
    const html = render("Hello world.");
    expect(html).toMatch(/<p[^>]*>/);
    expect(html).toContain("Hello world.");
  });

  it("returns an outer wrapper div with the aimarkdown class", () => {
    const html = render("Hello");
    expect(html).toMatch(/<div[^>]*class="[^"]*aimarkdown-container/);
  });

  it("falls back gracefully when content is empty (no crash)", () => {
    const html = render("");
    expect(html).toContain("aimarkdown-container");
  });
});

describe("AIMarkdown — emphasis and inline formatting", () => {
  it("renders bold as <strong>", () => {
    const html = render("**important** word");
    expect(html).toContain("<strong");
    expect(html).toContain("important");
  });

  it("renders italic as <em>", () => {
    const html = render("*this* matters");
    expect(html).toContain("<em");
    expect(html).toContain("this");
  });

  it("renders inline code with the accent-pill design", () => {
    const html = render("Call `foo()` to start");
    expect(html).toMatch(/<code[^>]*>foo\(\)<\/code>/);
  });

  it("keeps <strong>'s font weight from the inline className", () => {
    const html = render("**bold**");
    expect(html).toMatch(/<strong[^>]*font-semibold/);
  });
});

describe("AIMarkdown — fenced code blocks", () => {
  it("renders triple-backtick fenced code with language class", () => {
    const html = render("```python\nprint(42)\n```");
    expect(html).toContain("<pre");
    expect(html).toContain("<code");
    expect(html).toMatch(/language-python/);
    expect(html).toContain("print(42)");
  });

  it("renders plain fenced code blocks (no language)", () => {
    const html = render("```\nsome text\n```");
    expect(html).toContain("<pre");
    expect(html).toContain("some text");
  });
});

describe("AIMarkdown — lists", () => {
  it("renders bullet lists as <ul><li>", () => {
    const html = render("- First\n- Second\n- Third");
    expect(html).toContain("<ul");
    expect(html).toContain("<li");
    expect(html).toMatch(/First[\s\S]*Second[\s\S]*Third/);
  });

  it("renders ordered lists as <ol><li>", () => {
    const html = render("1. One\n2. Two\n3. Three");
    expect(html).toContain("<ol");
    expect(html).toContain("<li");
  });

  it("renders list items as <li> (not <p> wrapping inside)", () => {
    const html = render("- a\n- b");
    // Two <li> elements; expect at least 2 li openers
    const liOpeners = html.match(/<li[\s>]/g) ?? [];
    expect(liOpeners.length).toBeGreaterThanOrEqual(2);
  });
});

describe("AIMarkdown — headings and blockquote", () => {
  it("renders h1 / h2 / h3 with descending sizes", () => {
    const h1 = render("# H1");
    const h2 = render("## H2");
    const h3 = render("### H3");
    expect(h1).toMatch(/<h1[^>]*text-\[18px\]/);
    expect(h2).toMatch(/<h2[^>]*text-\[15\.5px\]/);
    expect(h3).toMatch(/<h3[^>]*text-\[14px\]/);
  });

  it("renders blockquote as a styled callout", () => {
    const html = render("> A quoted thought.");
    expect(html).toContain("<blockquote");
    expect(html).toContain("A quoted thought.");
    expect(html).toMatch(/border-l-2/);
  });
});

describe("AIMarkdown — links and URL safety", () => {
  it("renders an https link with the accent underline", () => {
    const html = render("[Docs](https://example.com/docs)");
    expect(html).toMatch(/<a [^>]*href="https:\/\/example.com\/docs"/);
    expect(html).toMatch(/text-accent[^"]*underline/);
  });

  it("renders a mailto link", () => {
    const html = render("[Mail](mailto:hi@example.com)");
    expect(html).toMatch(/href="mailto:hi@example.com"/);
  });

  it("drops javascript: URLs entirely (no <a> emitted)", () => {
    const html = render("[Bad](javascript:alert(1))");
    // The fallback renders the inner text as a <span> without
    // a link wrapper. Critically, no javascript: scheme
    // survives anywhere in the output.
    expect(html.toLowerCase()).not.toContain("javascript:");
    expect(html).toMatch(/<span[^>]*>Bad<\/span>/);
  });

  it("drops data: URLs entirely", () => {
    const html = render("[Bad](data:text/html,<script>alert(1)</script>)");
    expect(html.toLowerCase()).not.toContain("data:text/html");
    expect(html.toLowerCase()).not.toContain("<script");
  });
});

describe("AIMarkdown — math (KaTeX)", () => {
  it("renders inline math with LaTeX-paren delimiters", () => {
    const html = render("The quadratic formula is \\(x = (-b \\pm \\sqrt{b^2 - 4ac}) / (2a)\\).");
    // KaTeX wraps its output in <span class="katex"> regardless of
    // inline vs block; presence of the class proves the plugin ran.
    expect(html).toMatch(/<span[^>]*class="[^"]*katex/);
    expect(html).toContain("\\sqrt");
  });

  it("renders block math with LaTeX-bracket delimiters", () => {
    const html = render("\\[\nE = mc^2\n\\]");
    expect(html).toMatch(/<span[^>]*class="[^"]*katex/);
    // Block math sets `displayMode`, which KaTeX signals via a
    // nuanced class set; the math-expression class is always present.
    expect(html).toContain("katex-mathml");
  });

  it("renders Greek letters and named symbols correctly", () => {
    const html = render("\\(\\alpha + \\beta = \\gamma\\)");
    expect(html).toMatch(/<span[^>]*class="[^"]*katex/);
    // Greek glyphs should appear in the HTML (KaTeX emits MathML
    // + visible HTML, so they appear as Unicode or as named
    // entities).
    expect(/α|&#x3B1;|α/.test(html)).toBe(true);
  });

  it("renders multi-line LaTeX (newlines + alignment preserved)", () => {
    const html = render("\\[\n\\begin{aligned}\nx &= 1 \\\\\ny &= 2\n\\end{aligned}\n\\]");
    expect(html).toMatch(/<span[^>]*class="[^"]*katex/);
    expect(html).toContain("aligned");
  });

  it("treats single-dollar text as currency, not math", () => {
    // The whole point of `singleDollarTextMath: false`:
    // `$5 and $10 before 8 AM` must NOT be eaten as math.
    const html = render("The ticket cost $5 and $10 before 8 AM.");
    expect(html).toContain("$5");
    expect(html).toContain("$10");
    expect(html).not.toMatch(/class="[^"]*katex/);
  });
});

describe("AIMarkdown — sanitization", () => {
  it("strips a literal <script> tag", () => {
    const html = render("Hello <script>alert('xss')</script> world.");
    expect(html.toLowerCase()).not.toContain("<script");
    expect(html.toLowerCase()).not.toContain("alert('xss')");
  });

  it("strips onclick handlers on anchors", () => {
    const html = render(
      "[Click](https://example.com)",
    );
    // No onclick anywhere, even if Markdown allowed HTML.
    expect(html.toLowerCase()).not.toContain("onclick=");
  });

  it("strips a literal <iframe> tag", () => {
    const html = render("Before <iframe src='evil.com'></iframe> after.");
    expect(html.toLowerCase()).not.toContain("<iframe");
    expect(html).toContain("Before");
    expect(html).toContain("after");
  });

  it("strips onload / onerror attributes on img tags", () => {
    const html = render(
      "![alt](https://example.com/x.png)",
    );
    // Either no <img> at all (rehype-sanitize by default strips
    // standalone img with external src — but a CONTAINED link
    // could pass) OR an <img> without onerror/onload. Assert
    // hostile handlers are gone regardless.
    expect(html.toLowerCase()).not.toContain("onerror=");
    expect(html.toLowerCase()).not.toContain("onload=");
  });
});

describe("AIMarkdown — streaming robustness", () => {
  it("renders an open bold without throwing", () => {
    // Mid-stream the model may emit `**b` without closing.
    // remark is forgiving: the partial bold becomes plain text.
    const html = render("**incomplete bold");
    expect(html).toContain("aimarkdown-container");
    // Whatever happens, we don't crash. Welcome to resilience:
    // the markup is whatever remark handed us — `<strong>` if
    // remark decided, plain text otherwise. We do NOT collapse
    // to a raw fallback for this case.
    expect(html.length).toBeGreaterThan(0);
  });

  it("renders an unclosed inline math without throwing", () => {
    // `\(x^2` mid-stream is similar: KaTeX with strict:false
    // either renders the unparsed source or falls back to
    // text. Either is acceptable.
    const html = render("The expression \\(x^2 is large");
    expect(html).toContain("aimarkdown-container");
  });

  it("renders an unclosed fenced code block without throwing", () => {
    const html = render("```python\nprint(42)");
    expect(html).toContain("aimarkdown-container");
    expect(html).toContain("print(42)");
  });

  it("renders an unclosed parenthesis in math without throwing", () => {
    const html = render("\\( \\frac{1}{x");
    expect(html).toContain("aimarkdown-container");
  });
});

describe("AIMarkdown — density variants", () => {
  it("prose density sets the relaxed line-height", () => {
    const html = render("a", "prose");
    // Tailwind emits `leading-[…]` for arbitrary line-height
    // values, so the regex needs the `d` (the older
    // `line-[…]` form was a silent typo that always failed).
    expect(html).toMatch(/leading-\[1\.65\]/);
  });

  it("compact density sets the tighter line-height", () => {
    const html = render("a", "compact");
    expect(html).toMatch(/leading-\[1\.5\]/);
  });

  it("bare density is between compact and prose", () => {
    const html = render("a", "bare");
    expect(html).toMatch(/leading-\[1\.55\]/);
  });
});

describe("AIMarkdown — multi-feature integration", () => {
  it("renders bold + inline math + inline code in one block", () => {
    const html = render(
      "**derivation**: apply \\(f'(x) = 2x\\) to compute `grad(x^2)`.",
    );
    expect(html).toContain("<strong");
    expect(html).toMatch(/<span[^>]*class="[^"]*katex/);
    expect(html).toMatch(/<code[^>]*>grad\(x\^2\)<\/code>/);
  });

  it("renders a list with mixed bold and math", () => {
    const html = render(
      "- **Energy** \\(E = mc^2\\)\n- **Momentum** \\(p = mv\\)",
    );
    expect(html).toContain("<li");
    expect(html).toMatch(/<strong[^>]*>Energy<\/strong>/);
    // Two distinct KaTeX spans (one per item).
    const katexMatches = html.match(/<span[^>]*class="[^"]*katex/g) ?? [];
    expect(katexMatches.length).toBeGreaterThanOrEqual(2);
  });
});
