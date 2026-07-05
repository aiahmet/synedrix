import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ReasoningPart } from "../ReasoningPart";

/**
 * Helper. `renderToStaticMarkup` runs entirely in node
 * with no jsdom, no hydration, and no effects — perfect
 * for snapshot-level checks on the steady-state markup
 * (role + aria + data-state + chip copy) without the
 * noise of in-flight animation styles. `useEffect` does
 * not run during SSR, which means our auto-collapse
 * effect cannot run during the test; we only assert on
 * what the *initial* markup represents.
 */
const render = (text: string, state: "streaming" | "done") =>
  renderToStaticMarkup(
    <ReasoningPart text={text} state={state} />
  );

describe("ReasoningPart", () => {
  it("renders the model-reasoning landmark with correct ARIA", () => {
    const html = render("Let me think...", "streaming");
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Model reasoning"');
    expect(html).toContain('data-state="streaming"');
  });

  it("shows the LIVE chip while streaming", () => {
    const html = render("Computing...", "streaming");
    expect(html).toContain("data-testid=\"reasoning-status-live\"");
    expect(html).toContain("live");
    // The body of the reasoning is open by default.
    expect(html).toContain("Computing...");
  });

  it("shows the FINISHED chip + Sparkle glyph once done", () => {
    const html = render(
      "Sum-of-two-squares identity holds.",
      "done"
    );
    expect(html).toContain('data-state="done"');
    expect(html).toContain("data-testid=\"reasoning-status-done\"");
    expect(html).toContain("finished");
  });

  it("renders pending dots when streaming has not produced any text", () => {
    const html = render("", "streaming");
    expect(html).toContain("data-testid=\"reasoning-pending\"");
    // Body should still be present + open (the user sees
    // the pulse as confirmation that the chain is live).
    expect(html).toContain('id="reasoning-content"');
  });

  it("toggle button reflects the open-closed ARIA state", () => {
    const html = render("x", "done");
    // The toggle is a `<button>` with `aria-expanded`
    // and an `aria-controls` referencing the content
    // element by id. Each attribute is asserted
    // independently because SSR attribute order is not
    // part of the public contract — only the
    // *combination* is.
    expect(html).toContain('data-testid="reasoning-toggle"');
    expect(html).toContain('aria-controls="reasoning-content"');
    // Short settled text — initial render ships expanded.
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('id="reasoning-content"');
  });

  it("toggle ships collapsed for settled long traces (no post-hydration flicker)", () => {
    // The auto-collapse decision is made at component
    // mount time via `useState(() => deriveInitialOpen(...))`,
    // so the server-side render and the first client
    // render produce identical markup — no flicker on
    // hydration. The compiled string must include
    // `aria-expanded="false"` for the toggle.
    const html = render("x".repeat(800), "done");
    expect(html).toContain('data-testid="reasoning-toggle"');
    expect(html).toContain('aria-expanded="false"');
  });
  // Note: when `aria-expanded="false"`, the body content
  // is *absent* from the SSR markup — `<AnimatePresence>`
  // omits collapsed children. We do not assert on the body
  // text for the long-trace case because the design
  // intentionally hides it until the user expands.

  it("short settled traces ship expanded by default", () => {
    // The inverse direction of the previous test. Short
    // settled traces should never auto-collapse because
    // they read at a glance ("Looking up the formula.
    // Found it.").
    const html = render("short", "done");
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("short");
  });

  it("escapes potentially hostile content", () => {
    // Reasoning text is rendered plain (no markdown), so
    // any HTML passed in must surface as escaped text.
    // We're using renderToStaticMarkup, so a string of
    // HTML literally appears textually rather than being
    // parsed as markup.
    const html = render(
      "<script>alert('xss')</script>",
      "done"
    );
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");
  });

  it("ships an aria-live polite announcer for screen readers", () => {
    // The visually-hidden `<span aria-live="polite">`
    // re-announces the chip's state to assistive tech on
    // every transition. We assert the copy ships on the
    // SSR markup so the screen-reader contract never
    // silently regresses.
    const liveHtml = render("Thinking", "streaming");
    expect(liveHtml).toContain(
      'data-testid="reasoning-status-announcer"'
    );
    expect(liveHtml).toContain("Reasoning in progress");

    const doneHtml = render("Found it.", "done");
    expect(doneHtml).toContain(
      'data-testid="reasoning-status-announcer"'
    );
    expect(doneHtml).toContain("Reasoning finished");
  });
});
