# D5: Dark Mode Audit — Tutor Components

## Status: PASS (1 fix applied)

## Files Changed

| File | Change |
|------|--------|
| `components/tutor/ReasoningPart.tsx` | Replaced hardcoded `rgba(255,255,255,0.08)` inset shadow with `color-mix(in oklch, var(--foreground) 10%, transparent)` |

## Audit Scope

All 10 files in `components/tutor/` (including 5 widgets in `widgets/`) plus `app/(app)/tutor/TutorClient.tsx`.

## Findings

### Hardcoded Color Issues Found: 1

**ReasoningPart.tsx line 48** — `shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]`

This was a hardcoded white inset highlight shadow on the reasoning block container. It provided a subtle raised-edge shine that only made visual sense in light mode. Replaced with `color-mix(in oklch, var(--foreground) 10%, transparent)` which adapts to both modes: in dark mode it produces a light highlight (preserving the original intent), in light mode a very subtle dark edge.

### Hardcoded Hex Colors Ruled Acceptable

- **MoleculeDiagram.tsx** (CPK_COLORS) — Scientific CPK color conventions for chemical elements. Not theme-dependent.
- **MoleculeDiagram.tsx line 129** (`#1a1a1a` / `#ffffff`) — Text contrast computed against per-atom background luminance. Not theme-dependent.
- **CodeBlock.tsx lines 315–322** (TOKEN_CLASSES) — Uses CSS variables with hex fallbacks (e.g., `var(--subject-physics,#7c3aed)`). Subject colors are theme-invariant.
- **GraphPlotter.tsx lines 570/574/586/787/792** — Same subject-color-with-fallback pattern.
- **VocabularyCard.tsx lines 57–59** (GENDER_COLORS) — Same subject-color-with-fallback pattern.

### Spec Checkpoints

1. **Sticky composer backdrop blur** (`TutorClient.tsx` line 334) — Uses `bg-background/85` + `backdrop-blur-md`. Correct in both modes. **PASS**
2. **Streaming shimmer line** (`ReasoningPart.tsx` line 180) — Uses `var(--accent-border)` in gradient. Correct. **PASS**
3. **ReasoningPart accent border** (`ReasoningPart.tsx` lines 47, 163) — Uses `border-accent-border/50` and `border-accent-border/30`. Correct. **PASS**

## Concerns

None. The tutor components are already well-themed with CSS variables. The single fix addresses the only remaining hardcoded color value identified in the audit.
