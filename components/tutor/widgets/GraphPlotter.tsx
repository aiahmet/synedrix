"use client";

/**
 * GraphPlotter.tsx — Phase 5 §7.1.
 *
 * Interactive canvas-based function plotter. Replaces the
 * previous `GraphDiagram` placeholder ("rough sketch") with
 * a real plotted graph. The widget:
 *
 *   - Parses the formula string into a callable `(x) => y`
 *   - Renders the curve on a `<canvas>` with labeled axes
 *   - Supports zoom (scroll) and pan (drag)
 *   - Shows the point under the cursor
 *   - Highlights roots (where f(x) ≈ 0) and local extrema
 *
 * The marker contract stays the same:
 *   [[diagram:graph|formula:y=x^2|xmin:-2|xmax:2]]
 *
 * Expressions supported:
 *   - Polynomials: x^2, 2*x+1, x^3-3*x
 *   - Trig: sin(x), cos(x), tan(x)
 *   - sqrt(x), abs(x), exp(x), log(x)
 *   - Combinations: sin(x)*cos(x), x^2+sin(x)
 *   - Constants: pi, e
 *
 * A lightweight recursive-descent parser evaluates
 * expressions on the fly — no eval(), no Function().
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crosshair } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils/cn";

// ── Expression parser ────────────────────────────────────

type UnaryFn = (x: number) => number;

/** Token types produced by the lexer. */
type Token =
  | { kind: "number"; value: number }
  | { kind: "ident"; name: string }
  | { kind: "op"; op: string }
  | { kind: "lparen" }
  | { kind: "rparen" }
  | { kind: "comma" };

const UNARY_FNS: Record<string, UnaryFn> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  abs: Math.abs,
  sqrt: Math.sqrt,
  exp: Math.exp,
  log: Math.log,
  ln: Math.log,
};

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

/**
 * Lex an expression string into tokens.
 * Handles numbers (including decimals), identifiers, operators,
 * parentheses, and commas.
 */
function lex(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch >= "0" && ch <= "9" || ch === ".") {
      let num = "";
      while (i < expr.length && /[0-9.]/.test(expr[i]!)) {
        num += expr[i]!;
        i++;
      }
      tokens.push({ kind: "number", value: parseFloat(num) });
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let name = "";
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i]!)) {
        name += expr[i]!;
        i++;
      }
      tokens.push({ kind: "ident", name });
      continue;
    }
    if (ch === "(") { tokens.push({ kind: "lparen" }); i++; continue; }
    if (ch === ")") { tokens.push({ kind: "rparen" }); i++; continue; }
    if (ch === ",") { tokens.push({ kind: "comma" }); i++; continue; }
    // Multi-char operators
    if (ch === "*" && expr[i + 1] === "*") {
      tokens.push({ kind: "op", op: "^" });
      i += 2;
      continue;
    }
    if ("+-*/^".includes(ch)) {
      tokens.push({ kind: "op", op: ch });
      i++;
      continue;
    }
    // Skip unknown characters (safety net)
    i++;
  }
  return tokens;
}

/**
 * Recursive-descent parser + evaluator.
 * Grammar (Precedence climbing):
 *
 *   expr     → term (('+' | '-') term)*
 *   term     → unary (('*' | '/') unary)*
 *   unary    → ('-' unary) | power
 *   power    → factor ('^' unary)*     (right-associative)
 *   factor   → NUMBER | IDENT | '(' expr ')' | IDENT '(' expr ')'
 *
 * Returns a function `(x: number) => number`.
 */
function parse(tokens: Token[]): UnaryFn {
  let pos = 0;

  function peek(): Token | undefined { return tokens[pos]; }
  function consume(): Token { const t = tokens[pos]!; pos++; return t; }

  /** Consume the next token if it matches an operator in `ops`. Returns the operator string, or null. */
  function tryConsumeOp(ops: ReadonlyArray<string>): string | null {
    const t = peek();
    if (t?.kind === "op" && ops.includes(t.op)) {
      pos++;
      return t.op;
    }
    return null;
  }

  function parseExpr(): UnaryFn {
    let left = parseTerm();
    let op: string | null;
    while ((op = tryConsumeOp(["+", "-"])) !== null) {
      const right = parseTerm();
      const prev = left;
      left = op === "+"
        ? (x: number) => prev(x) + right(x)
        : (x: number) => prev(x) - right(x);
    }
    return left;
  }

  function parseTerm(): UnaryFn {
    let left = parseUnary();
    let op: string | null;
    while ((op = tryConsumeOp(["*", "/"])) !== null) {
      const right = parseUnary();
      const prev = left;
      left = op === "*"
        ? (x: number) => prev(x) * right(x)
        : (x: number) => prev(x) / right(x);
    }
    return left;
  }

  function parseUnary(): UnaryFn {
    if (tryConsumeOp(["-"])) {
      const inner = parseUnary();
      return (x: number) => -inner(x);
    }
    return parsePower();
  }

  function parsePower(): UnaryFn {
    let left = parseFactor();
    if (tryConsumeOp(["^"])) {
      const right = parseUnary(); // right-associative
      const prev = left;
      left = (x: number) => Math.pow(prev(x), right(x));
    }
    return left;
  }

  function parseFactor(): UnaryFn {
    const tok = peek();
    if (!tok) {
      return () => NaN;
    }
    if (tok.kind === "number") {
      consume();
      const v = tok.value;
      return () => v;
    }
    if (tok.kind === "ident") {
      consume();
      const name = tok.name.toLowerCase();
      // Check if followed by '(' — function call
      if (peek()?.kind === "lparen") {
        consume(); // '('
        const arg = parseExpr();
        if (peek()?.kind === "rparen") consume(); // ')'
        const fn = UNARY_FNS[name];
        if (fn) return (x: number) => fn(arg(x));
        // Unknown function — return NaN
        return () => NaN;
      }
      // Variable
      if (name === "x") return (x: number) => x;
      // Constant
      const c = CONSTANTS[name];
      if (c !== undefined) return () => c;
      // Unknown identifier
      return () => NaN;
    }
    if (tok.kind === "lparen") {
      consume(); // '('
      const inner = parseExpr();
      if (peek()?.kind === "rparen") consume(); // ')'
      return inner;
    }
    return () => NaN;
  }

  const fn = parseExpr();
  return fn;
}

/**
 * Compile an expression string into a callable function.
 * Returns null if the expression can't be parsed.
 */
function compileExpression(expr: string): UnaryFn | null {
  try {
    const tokens = lex(expr);
    if (tokens.length === 0) return null;
    return parse(tokens);
  } catch {
    return null;
  }
}

/**
 * Find roots in a range using sign-change detection + bisection.
 * Returns approximate x-values where f(x) crosses zero.
 */
function findRoots(fn: UnaryFn, xmin: number, xmax: number, steps = 200): number[] {
  const dx = (xmax - xmin) / steps;
  const roots: number[] = [];
  for (let i = 0; i < steps; i++) {
    const a = xmin + i * dx;
    const b = a + dx;
    const fa = fn(a);
    const fb = fn(b);
    if (!Number.isFinite(fa) || !Number.isFinite(fb)) continue;
    if (fa * fb <= 0) {
      // Bisection to refine
      let lo = a;
      let hi = b;
      for (let j = 0; j < 20; j++) {
        const mid = (lo + hi) / 2;
        const fm = fn(mid);
        if (!Number.isFinite(fm)) break;
        if (Math.abs(fm) < 1e-10) {
          lo = mid;
          hi = mid;
          break;
        }
        if (fa * fm <= 0) { hi = mid; } else { lo = mid; }
      }
      const root = (lo + hi) / 2;
      // Deduplicate: don't add if too close to an existing root
      if (roots.every((r) => Math.abs(r - root) > dx * 0.8)) {
        roots.push(root);
      }
    }
  }
  return roots;
}

/**
 * Find local extrema by sampling the derivative.
 * Returns approximate x-values of local min/max.
 */
function findExtrema(fn: UnaryFn, xmin: number, xmax: number, steps = 300): number[] {
  const dx = (xmax - xmin) / steps;
  const extrema: number[] = [];
  let prevDy = (fn(xmin + dx) - fn(xmin)) / dx;
  for (let i = 1; i < steps - 1; i++) {
    const x = xmin + i * dx;
    const dy = (fn(x + dx) - fn(x - dx)) / (2 * dx);
    if (!Number.isFinite(prevDy) || !Number.isFinite(dy)) {
      prevDy = dy;
      continue;
    }
    // Sign change in derivative → extremum
    if (prevDy * dy < 0) {
      extrema.push(x);
    }
    prevDy = dy;
  }
  return extrema;
}

// ── Drawing helpers ──────────────────────────────────────

interface Viewport {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
}

/** Map data coords to pixel coords. */
function dataToPixel(
  vp: Viewport,
  width: number,
  height: number,
  x: number,
  y: number,
): [number, number] {
  const px = ((x - vp.xmin) / (vp.xmax - vp.xmin)) * width;
  const py = height - ((y - vp.ymin) / (vp.ymax - vp.ymin)) * height;
  return [px, py];
}

/** Map pixel coords to data coords. */
function pixelToData(
  vp: Viewport,
  width: number,
  height: number,
  px: number,
  py: number,
): [number, number] {
  const x = vp.xmin + (px / width) * (vp.xmax - vp.xmin);
  const y = vp.ymin + ((height - py) / height) * (vp.ymax - vp.ymin);
  return [x, y];
}

/** Pick nice tick spacing for an axis range. */
function niceStep(range: number, maxTicks = 8): number {
  const rough = range / maxTicks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const residual = rough / magnitude;
  if (residual <= 1.5) return magnitude;
  if (residual <= 3.5) return 2 * magnitude;
  if (residual <= 7.5) return 5 * magnitude;
  return 10 * magnitude;
}

/** Format a number for axis label display. */
function fmt(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const s = n.toFixed(2);
  return s.replace(/\.?0+$/, "");
}

// ── Component ────────────────────────────────────────────

export interface GraphPlotterProps {
  readonly formula: string;
  readonly xmin: number;
  readonly xmax: number;
  readonly className?: string;
}

export function GraphPlotter({
  formula,
  xmin: initialXmin,
  xmax: initialXmax,
  className,
}: GraphPlotterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Viewport state (in data coordinates)
  const [viewport, setViewport] = useState<Viewport>(() => {
    const xSpan = initialXmax - initialXmin;
    return {
      xmin: initialXmin - xSpan * 0.1,
      xmax: initialXmax + xSpan * 0.1,
      ymin: -5,
      ymax: 5,
    };
  });

  const currentFormulaKey = `${formula}|${initialXmin}|${initialXmax}`;
  const [prevFormulaKey, setPrevFormulaKey] = useState(currentFormulaKey);

  const fn = useMemo(() => compileExpression(formula), [formula]);

  if (currentFormulaKey !== prevFormulaKey) {
    setPrevFormulaKey(currentFormulaKey);
    const xSpan = initialXmax - initialXmin;
    const vpXmin = initialXmin - xSpan * 0.1;
    const vpXmax = initialXmax + xSpan * 0.1;
    let vpYmin = -5;
    let vpYmax = 5;
    if (fn) {
      const steps = 200;
      let computedYmin = Infinity;
      let computedYmax = -Infinity;
      for (let i = 0; i <= steps; i++) {
        const x = vpXmin + (i / steps) * (vpXmax - vpXmin);
        const y = fn(x);
        if (Number.isFinite(y)) {
          computedYmin = Math.min(computedYmin, y);
          computedYmax = Math.max(computedYmax, y);
        }
      }
      if (Number.isFinite(computedYmin) && Number.isFinite(computedYmax) && computedYmin < computedYmax) {
        const pad = Math.max((computedYmax - computedYmin) * 0.15, 0.5);
        vpYmin = computedYmin - pad;
        vpYmax = computedYmax + pad;
      }
    }
    setViewport({ xmin: vpXmin, xmax: vpXmax, ymin: vpYmin, ymax: vpYmax });
  }

  // Parse roots and extrema from the formula
  const roots = useMemo(
    () => (fn ? findRoots(fn, viewport.xmin, viewport.xmax) : []),
    [fn, viewport.xmin, viewport.xmax],
  );
  const extrema = useMemo(
    () => (fn ? findExtrema(fn, viewport.xmin, viewport.xmax) : []),
    [fn, viewport.xmin, viewport.xmax],
  );

  // Cursor tracking
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(
    null,
  );

  const panRef = useRef<{ startX: number; startY: number; vp: Viewport } | null>(null);

  // ── Drawing ──────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Grid
    const xStep = niceStep(viewport.xmax - viewport.xmin);
    const yStep = niceStep(viewport.ymax - viewport.ymin);
    ctx.strokeStyle = "oklch(from var(--border) l c h / 0.3)";
    ctx.lineWidth = 0.5;

    // Vertical grid lines
    const xStart = Math.ceil(viewport.xmin / xStep) * xStep;
    for (let x = xStart; x <= viewport.xmax; x += xStep) {
      const [px] = dataToPixel(viewport, w, h, x, 0);
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
    }

    // Horizontal grid lines
    const yStart = Math.ceil(viewport.ymin / yStep) * yStep;
    for (let y = yStart; y <= viewport.ymax; y += yStep) {
      const [, py] = dataToPixel(viewport, w, h, 0, y);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
      ctx.stroke();
    }

    // Axes (slightly bolder)
    ctx.strokeStyle = "oklch(from var(--muted-foreground) l c h / 0.4)";
    ctx.lineWidth = 1;

    // X-axis
    if (viewport.ymin <= 0 && viewport.ymax >= 0) {
      const [, py] = dataToPixel(viewport, w, h, 0, 0);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
      ctx.stroke();
    }

    // Y-axis
    if (viewport.xmin <= 0 && viewport.xmax >= 0) {
      const [px] = dataToPixel(viewport, w, h, 0, 0);
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = "oklch(from var(--muted-foreground) l c h / 0.6)";
    ctx.font = "10px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    for (let x = xStart; x <= viewport.xmax; x += xStep) {
      const [px] = dataToPixel(viewport, w, h, x, 0);
      const [, axisY] = viewport.ymin <= 0 && viewport.ymax >= 0
        ? dataToPixel(viewport, w, h, 0, 0)
        : [0, h - 2];
      ctx.fillText(fmt(x), px, axisY + 4);
    }

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let y = yStart; y <= viewport.ymax; y += yStep) {
      const [, py] = dataToPixel(viewport, w, h, 0, y);
      const [axisX] = viewport.xmin <= 0 && viewport.xmax >= 0
        ? dataToPixel(viewport, w, h, 0, 0)
        : [w - 2, 0];
      ctx.fillText(fmt(y), axisX - 6, py);
    }

    // ── Function curve ──────────────────────────────────────
    if (!fn) return;

    const steps = Math.max(w * 2, 400);
    const dx = (viewport.xmax - viewport.xmin) / steps;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();

    // Draw the curve
    ctx.strokeStyle = "var(--accent)";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.beginPath();

    let firstPoint = true;
    for (let i = 0; i <= steps; i++) {
      const x = viewport.xmin + i * dx;
      const y = fn(x);
      if (!Number.isFinite(y) || Math.abs(y) > 1e8) {
        firstPoint = true;
        continue;
      }
      const [px, py] = dataToPixel(viewport, w, h, x, y);
      if (firstPoint) {
        ctx.moveTo(px, py);
        firstPoint = false;
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();

    // ── Roots ───────────────────────────────────────────────
    for (const r of roots) {
      const y = fn(r);
      if (!Number.isFinite(y)) continue;
      const [px, py] = dataToPixel(viewport, w, h, r, y);
      ctx.fillStyle = "var(--subject-german, #e11d48)";
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "var(--subject-german, #e11d48)";
      ctx.font = "9px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(`x≈${fmt(r)}`, px, py - 10);
    }

    // ── Extrema ─────────────────────────────────────────────
    for (const e of extrema) {
      const y = fn(e);
      if (!Number.isFinite(y)) continue;
      const [px, py] = dataToPixel(viewport, w, h, e, y);
      // Diamond shape
      ctx.fillStyle = "var(--subject-physics, #7c3aed)";
      ctx.beginPath();
      ctx.moveTo(px, py - 5);
      ctx.lineTo(px + 5, py);
      ctx.lineTo(px, py + 5);
      ctx.lineTo(px - 5, py);
      ctx.closePath();
      ctx.fill();
    }

    // ── Cursor crosshair ────────────────────────────────────
    if (cursorPos && fn) {
      const [cx] = pixelToData(viewport, w, h, cursorPos.x, cursorPos.y);
      const fy = fn(cx);
      if (Number.isFinite(fy)) {
        const [cpx, cpy] = dataToPixel(viewport, w, h, cx, fy);
        ctx.strokeStyle = "var(--accent)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(cpx, 0);
        ctx.lineTo(cpx, h);
        ctx.moveTo(0, cpy);
        ctx.lineTo(w, cpy);
        ctx.stroke();
        ctx.setLineDash([]);

        // Dot on curve
        ctx.fillStyle = "var(--accent)";
        ctx.beginPath();
        ctx.arc(cpx, cpy, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Coordinate label
        ctx.fillStyle = "var(--foreground)";
        ctx.font = "bold 10px ui-monospace, monospace";
        ctx.textAlign = "left";
        ctx.fillText(`(${fmt(cx)}, ${fmt(fy)})`, cpx + 8, cpy - 8);
      }
    }

    ctx.restore();
  }, [viewport, fn, roots, extrema, cursorPos]);

  // Redraw on state changes. Wrapped in rAF to coalesce
  // rapid cursor-move re-renders into a single paint.
  useEffect(() => {
    const id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  });

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  // ── Interaction handlers ─────────────────────────────────

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const [cx, cy] = pixelToData(viewport, rect.width, rect.height, mx, my);

      const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
      setViewport((vp) => {
        const newXSpan = (vp.xmax - vp.xmin) * factor;
        const newYSpan = (vp.ymax - vp.ymin) * factor;
        const xFrac = (cx - vp.xmin) / (vp.xmax - vp.xmin);
        const yFrac = (cy - vp.ymin) / (vp.ymax - vp.ymin);
        return {
          xmin: cx - xFrac * newXSpan,
          xmax: cx + (1 - xFrac) * newXSpan,
          ymin: cy - (1 - yFrac) * newYSpan,
          ymax: cy + yFrac * newYSpan,
        };
      });
    },
    [viewport],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      panRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        vp: { ...viewport },
      };
    },
    [viewport],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });

      if (panRef.current) {
        const dx = e.clientX - panRef.current.startX;
        const dy = e.clientY - panRef.current.startY;
        const vp = panRef.current.vp;
        const w = rect.width;
        const h = rect.height;
        const xPerPx = (vp.xmax - vp.xmin) / w;
        const yPerPx = (vp.ymax - vp.ymin) / h;
        setViewport({
          xmin: vp.xmin - dx * xPerPx,
          xmax: vp.xmax - dx * xPerPx,
          ymin: vp.ymin + dy * yPerPx,
          ymax: vp.ymax + dy * yPerPx,
        });
      }
    },
    [],
  );

  const handleMouseUp = useCallback(() => {
    panRef.current = null;
  }, []);

  const handleMouseLeave = useCallback(() => {
    panRef.current = null;
    setCursorPos(null);
  }, []);

  const resetView = useCallback(() => {
    const xSpan = initialXmax - initialXmin;
    setViewport({
      xmin: initialXmin - xSpan * 0.1,
      xmax: initialXmax + xSpan * 0.1,
      ymin: -5,
      ymax: 5,
    });
  }, [initialXmin, initialXmax]);

  if (!fn) {
    return (
      <div className={cn("rounded-lg border border-border/50 bg-background p-4 text-center", className)}>
        <p className="text-[12px] text-muted-foreground">
          Could not parse formula: <code className="font-mono text-accent">{formula}</code>
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {/* Formula display */}
      <div className="flex items-center justify-between">
        <div className="rounded-md bg-accent-subtle/40 px-2.5 py-1 text-[13px] font-mono text-accent">
          f(x) = {formula}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={resetView}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-border/60 bg-surface-elevated text-muted-foreground transition-colors hover:border-accent-border/60 hover:text-accent"
            title="Reset view"
          >
            <Crosshair className="h-3 w-3" weight="bold" />
          </button>
        </div>
      </div>

      {/* Canvas container */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-lg border border-border/60 bg-background"
        style={{ width: "100%", aspectRatio: "4/3", minHeight: 220 }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full cursor-crosshair"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />

        {/* Controls overlay */}
        <div className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1">
          <span className="rounded-md bg-surface-elevated/80 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground backdrop-blur-sm">
            Scroll to zoom · Drag to pan
          </span>
        </div>

        {/* Legend */}
        {roots.length > 0 && (
          <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-2 rounded-md bg-surface-elevated/80 px-2 py-1 backdrop-blur-sm">
            <span className="flex items-center gap-1 font-mono text-[9px] text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--subject-german,#e11d48)]" />
              {roots.length} root{roots.length !== 1 ? "s" : ""}
            </span>
            {extrema.length > 0 && (
              <span className="flex items-center gap-1 font-mono text-[9px] text-muted-foreground">
                <span className="inline-block h-2 w-2 rotate-45 bg-[var(--subject-physics,#7c3aed)]" />
                {extrema.length} extrem{extrema.length !== 1 ? "a" : "um"}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default GraphPlotter;
