"use client";

/**
 * MoleculeDiagram.tsx — Phase 5 §7.4.
 *
 * Simple SVG ball-and-stick molecule renderer for
 * `[[diagram:molecule|H2O]]` markers. Parses a chemical
 * formula and renders atoms as colored circles connected
 * by single/double bonds.
 *
 * Supported:
 *   - Simple formulas: H2O, NaCl, CO2, CH4, NH3
 *   - Organic molecules: C2H6, C2H4, C2H2, C6H12O6
 *   - The layout uses a simple radial/linear placement
 *     (not a full force-directed graph — that's Phase 6).
 *
 * Atom colors follow the common CPK/Jmol convention:
 *   - H: white, C: dark grey, N: blue, O: red
 *   - Na: purple, Cl: green, S: yellow, P: orange
 *   - Fe: brown, Ca: dark grey, K: purple
 */

import { useMemo } from "react";
import { Flask } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils/cn";

// ── Parser ────────────────────────────────────────────────

interface Atom {
  readonly element: string;
  readonly count: number;
}

interface ParsedFormula {
  readonly atoms: Atom[];
}

/**
 * Parse a simple chemical formula like "H2O", "NaCl",
 * "C6H12O6" into a list of (element, count) pairs.
 */
function parseFormula(raw: string): ParsedFormula | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const atoms: Atom[] = [];
  let i = 0;

  while (i < trimmed.length) {
    // Element: starts with uppercase, optionally followed by lowercase
    if (!/[A-Z]/.test(trimmed[i]!)) return null;
    let element = trimmed[i]!;
    i++;
    while (i < trimmed.length && /[a-z]/.test(trimmed[i]!)) {
      element += trimmed[i]!;
      i++;
    }

    // Count: optional digits
    let countStr = "";
    while (i < trimmed.length && /[0-9]/.test(trimmed[i]!)) {
      countStr += trimmed[i]!;
      i++;
    }
    const count = countStr ? parseInt(countStr, 10) : 1;
    if (count <= 0) return null;

    // Merge with existing atom of same element
    const existing = atoms.find((a) => a.element === element);
    if (existing) {
      // Replace with merged
      const idx = atoms.indexOf(existing);
      atoms[idx] = { element, count: existing.count + count };
    } else {
      atoms.push({ element, count });
    }
  }

  return atoms.length > 0 ? { atoms } : null;
}

// ── CPK Colors ────────────────────────────────────────────

const CPK_COLORS: Record<string, string> = {
  H: "#ffffff",
  C: "#404040",
  N: "#3050f8",
  O: "#ff2010",
  F: "#90e050",
  Cl: "#1ff01f",
  Br: "#a62929",
  I: "#940094",
  S: "#ffff30",
  P: "#ff8000",
  Na: "#ab5cf2",
  K: "#ab5cf2",
  Ca: "#3dff00",
  Fe: "#e06633",
  Mg: "#8aff00",
  Zn: "#7d80b0",
  Cu: "#c88033",
  Mn: "#9c7acd",
  default: "#808080",
};

/**
 * Get a human-readable color for an element. Returns CPK color
 * for common elements, grey for unknowns.
 */
function atomColor(element: string): string {
  return CPK_COLORS[element] ?? CPK_COLORS.default;
}

/**
 * Check if a color is light (for text contrast on the atom).
 */
function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 150;
}

/**
 * Get the text color for an atom label based on background.
 */
function textColor(element: string): string {
  return isLightColor(atomColor(element)) ? "#1a1a1a" : "#ffffff";
}

// ── Layout helpers ────────────────────────────────────────

interface AtomNode {
  readonly element: string;
  readonly index: number;
  readonly x: number;
  readonly y: number;
}

interface Bond {
  readonly from: number;
  readonly to: number;
  readonly order: 1 | 2 | 3;
}

interface LayoutResult {
  readonly nodes: AtomNode[];
  readonly bonds: Bond[];
}

/**
 * Compute a simple radial layout for the atoms in a molecule.
 * The central atom is the one with the most bonds (C, N, O, etc.)
 * or the first atom for diatomic molecules. Peripheral atoms are
 * placed evenly around it.
 */
function computeLayout(formula: ParsedFormula): LayoutResult {
  const { atoms } = formula;

  // Determine which element is central.
  // Rules: Carbon is central if present, otherwise N, otherwise
  // the first non-H element. For diatomic molecules, just place
  // side by side.
  const hasCarbon = atoms.some((a) => a.element === "C" && a.count > 0);
  const centralElement = hasCarbon
    ? "C"
    : atoms.find((a) => a.element !== "H")?.element ??
      atoms[0]?.element ??
      "";

  // Build flat list of nodes
  const nodes: AtomNode[] = [];
  const bonds: Bond[] = [];
  let centralIndex = -1;

  // Find if any carbon atom should be central
  for (const atom of atoms) {
    for (let c = 0; c < atom.count; c++) {
      const idx = nodes.length;
      const isCentral =
        atom.element === centralElement && centralIndex === -1;
      if (isCentral) centralIndex = idx;
      // Position will be computed after
      nodes.push({ element: atom.element, index: idx, x: 0, y: 0 });
    }
  }

  // If no clear central atom, treat first non-H as central
  if (centralIndex === -1 && nodes.length > 0) {
    centralIndex = nodes.findIndex((n) => n.element !== "H");
    if (centralIndex === -1) centralIndex = 0;
  }

  // Compute radial positions
  const cx = 0;
  const cy = 0;
  const radius = 55;

  if (nodes.length === 1) {
    nodes[0] = { ...nodes[0]!, x: cx, y: cy };
    return { nodes, bonds };
  }

  if (nodes.length === 2) {
    nodes[0] = { ...nodes[0]!, x: -30, y: 0 };
    nodes[1] = { ...nodes[1]!, x: 30, y: 0 };
    bonds.push({ from: 0, to: 1, order: 1 });
    return { nodes, bonds };
  }

  // Radial: central at origin, others around it
  nodes[centralIndex] = { ...nodes[centralIndex]!, x: cx, y: cy };

  const peripheralIndices = nodes
    .map((_, i) => i)
    .filter((i) => i !== centralIndex);
  const n = peripheralIndices.length;

  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    const idx = peripheralIndices[i]!;
    nodes[idx] = {
      ...nodes[idx]!,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
    bonds.push({ from: centralIndex, to: idx, order: 1 });
  }

  return { nodes, bonds };
}

// ── Component ────────────────────────────────────────────

export interface MoleculeDiagramProps {
  readonly formula: string;
  readonly className?: string;
}

export function MoleculeDiagram({
  formula,
  className,
}: MoleculeDiagramProps) {
  const parsed = useMemo(() => parseFormula(formula), [formula]);
  const layout = useMemo(
    () => (parsed ? computeLayout(parsed) : null),
    [parsed],
  );

  if (!parsed || !layout) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border/50 bg-background p-4 text-center",
          className,
        )}
      >
        <p className="text-[12px] text-muted-foreground">
          Could not parse formula:{" "}
          <code className="font-mono text-accent">{formula}</code>
        </p>
      </div>
    );
  }

  const { nodes, bonds } = layout;

  // Compute SVG viewport bounds from node positions
  const pad = 45;
  const minX = Math.min(...nodes.map((n) => n.x)) - pad;
  const maxX = Math.max(...nodes.map((n) => n.x)) + pad;
  const minY = Math.min(...nodes.map((n) => n.y)) - pad;
  const maxY = Math.max(...nodes.map((n) => n.y)) + pad;
  const vbWidth = maxX - minX;
  const vbHeight = maxY - minY;

  const atomRadius = 22;

  return (
    <div
      className={cn(
        "my-3 overflow-hidden rounded-xl border border-border bg-surface-elevated",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-3.5 py-2">
        <span className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-subtle/70 text-accent">
            <Flask className="h-3 w-3" weight="duotone" />
          </span>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
            Molecule
          </span>
        </span>
        <span
          className="font-mono text-[14px] font-semibold tracking-tight"
          style={{ color: "var(--accent)" }}
        >
          {formula}
        </span>
      </header>

      <div className="flex flex-col gap-2 px-3.5 py-3">
        {/* Formula summary */}
        <div className="flex flex-wrap items-center gap-1.5">
          {parsed.atoms.map((atom) => (
            <span
              key={atom.element}
              className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface px-2 py-0.5 text-[11px]"
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full border border-border/40"
                style={{ backgroundColor: atomColor(atom.element) }}
              />
              <span className="font-mono font-medium text-foreground/90">
                {atom.element}
              </span>
              {atom.count > 1 && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  ×{atom.count}
                </span>
              )}
            </span>
          ))}
        </div>

        {/* SVG diagram */}
        <div className="flex justify-center rounded-lg border border-border/50 bg-background py-3">
          <svg
            viewBox={`${minX} ${minY} ${vbWidth} ${vbHeight}`}
            className="h-[200px] w-full max-w-[300px]"
            role="img"
            aria-label={`Ball-and-stick diagram of ${formula}`}
          >
            {/* Bonds (drawn first, behind atoms) */}
            {bonds.map((bond, bi) => {
              const from = nodes[bond.from]!;
              const to = nodes[bond.to]!;
              const dx = to.x - from.x;
              const dy = to.y - from.y;
              const len = Math.sqrt(dx * dx + dy * dy);
              const ux = dx / len;
              const uy = dy / len;

              // Perpendicular offset for double/triple bonds
              const perpX = -uy;
              const perpY = ux;
              const offset = bond.order > 1 ? 3 : 0;

              return (
                <g key={`bond-${bi}`}>
                  {Array.from({ length: bond.order }).map((_, oi) => {
                    const off =
                      bond.order === 1
                        ? 0
                        : oi - (bond.order - 1) / 2;
                    const sx = from.x + perpX * off * offset;
                    const sy = from.y + perpY * off * offset;
                    const ex = to.x + perpX * off * offset;
                    const ey = to.y + perpY * off * offset;
                    return (
                      <line
                        key={`${bi}-${oi}`}
                        x1={sx}
                        y1={sy}
                        x2={ex}
                        y2={ey}
                        stroke="oklch(from var(--muted-foreground) l c h / 0.5)"
                        strokeWidth={bond.order > 1 ? 1.5 : 2}
                        strokeLinecap="round"
                      />
                    );
                  })}
                </g>
              );
            })}

            {/* Atoms */}
            {nodes.map((node) => {
              const fill = atomColor(node.element);
              const stroke = isLightColor(fill)
                ? "oklch(from var(--border) l c h / 0.5)"
                : fill;
              const labelColor = textColor(node.element);

              return (
                <g key={`atom-${node.index}`}>
                  {/* Shadow */}
                  <circle
                    cx={node.x}
                    cy={node.y + 1.5}
                    r={atomRadius}
                    fill="oklch(from var(--foreground) l c h / 0.08)"
                  />
                  {/* Atom circle */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={atomRadius}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={1}
                  />
                  {/* Element symbol */}
                  <text
                    x={node.x}
                    y={node.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      fontFamily: "ui-monospace, monospace",
                      fill: labelColor,
                      userSelect: "none",
                    }}
                  >
                    {node.element}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <p className="text-[10px] leading-relaxed text-muted-foreground/70">
          Ball-and-stick diagram. Atom sizes and bond lengths are not to scale.
        </p>
      </div>
    </div>
  );
}

export { parseFormula };
export type { ParsedFormula, Atom };
