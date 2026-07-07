/**
 * Centralized Phosphor icon barrel for the landing page.
 *
 * Pure re-exports of the server-rendered Phosphor icon set. No hooks, no
 * client-only behavior, so this file stays in the server tree and can be
 * imported by both Server Components and Client Components without
 * crossing the client boundary.
 *
 * One family only (Phosphor) is used across the marketing site. Stroke
 * weight and tone come from the global Tailwind theme tokens. Adding a
 * new icon used anywhere on the landing page requires adding it here
 * first so the import surface stays auditable.
 */

import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Books,
  Brain,
  CalendarBlank,
  Cards,
  CaretDown,
  CaretUp,
  ChatCircle,
  ChatCircleText,
  Check,
  CheckCircle,
  CircleNotch,
  Clipboard,
  ClockCounterClockwise,
  Code,
  Command,
  Compass,
  Crosshair,
  Cube,
  Database,
  DownloadSimple,
  Fingerprint,
  Flame,
  Flask,
  FlowArrow,
  Info,
  MathOperations,
  Gauge,
  GitBranch,
  GitFork,
  GraduationCap,
  Infinity,
  Key,
  Lightbulb,
  Lightning,
  List,
  ListChecks,
  LockSimple,
  MagnifyingGlass,
  Notebook,
  Notepad,
  Palette,
  PaperPlaneTilt,
  PencilLine,
  Play,
  PlayCircle,
  Plus,
  Pulse,
  Quotes,
  Repeat,
  Rocket,
  ShieldCheck,
  SkipForward,
  Sparkle,
  Stack,
  Target,
  Terminal,
  Timer,
  User,
  UserCircle,
  WarningCircle,
  X,
} from "@phosphor-icons/react/dist/ssr";

/**
 * Per-subject glyph imports. Each of these aliases
 * a Phosphor icon to a stable, slug-friendly name so
 * the SUBJECT_ICON_MAP below reads at the slug level.
 *
 * Adding a new subject is two steps:
 *   1. Add the slug + glyph here and to SUBJECT_ICON_MAP.
 *   2. Set the `icon` field on the seeded Subject row.
 * Unknown slugs fall back to `Books` so a missing map
 * entry never breaks the screen.
 */
import { createElement } from "react";
import {
  Atom as AtomIcon,
  BookOpen as BookOpenIcon,
  Calculator as CalculatorIcon,
  Code as CodeIcon,
  Dna as DnaIcon,
  GlobeHemisphereEast as GlobeIcon,
  PaintBrush as PaintBrushIcon,
  PianoKeys as PianoKeysIcon,
  Scroll as ScrollIcon,
} from "@phosphor-icons/react/dist/ssr";

export {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Books,
  Brain,
  CalendarBlank,
  Cards,
  CaretDown,
  CaretUp,
  ChatCircle,
  ChatCircleText,
  Check,
  CheckCircle,
  CircleNotch,
  Clipboard,
  ClockCounterClockwise,
  Code,
  Command,
  Compass,
  Crosshair,
  Cube,
  Database,
  DownloadSimple,
  Fingerprint,
  Flame,
  Flask,
  FlowArrow,
  Info,
  MathOperations,
  Gauge,
  GitBranch,
  GitFork,
  GraduationCap,
  Infinity,
  Key,
  Lightbulb,
  Lightning,
  List,
  ListChecks,
  LockSimple,
  MagnifyingGlass,
  Notebook,
  Notepad,
  Palette,
  PaperPlaneTilt,
  PencilLine,
  Play,
  PlayCircle,
  Plus,
  Pulse,
  Quotes,
  Repeat,
  Rocket,
  ShieldCheck,
  SkipForward,
  Sparkle,
  Stack,
  Target,
  Terminal,
  Timer,
  User,
  UserCircle,
  WarningCircle,
  X,
  AtomIcon,
  BookOpenIcon,
  CalculatorIcon,
  CodeIcon,
  DnaIcon,
  GlobeIcon,
  PaintBrushIcon,
  PianoKeysIcon,
  ScrollIcon,
};

/**
 * PhosphorIconProps.
 *
 * The contract every Phosphor icon component accepts on
 * the dist/ssr build. We declare it locally because the
 * icon barrel does not re-export the upstream `Icon`
 * type alias; importing that name as a type symbol
 * triggers TS2305 in some workspaces that resolve the
 * tooltip-only re-exports differently.
 *
 * `style` is included so call sites can pass
 * `style={{ color: fillVar }}` for per-subject hue
 * without re-asserting types per-component.
 */
export interface PhosphorIconProps {
  className?: string;
  weight?: "duotone" | "bold" | "regular" | "fill" | "light" | "thin";
  size?: number | string;
  color?: string;
  style?: React.CSSProperties;
  "aria-hidden"?: boolean | "true" | "false";
}

/**
 * PhosphorIconComponent.
 *
 * Generic Phosphor icon component type. The barrelled
 * name `Icon` was the canonical alias upstream, but since
 * dist/ssr does not re-export it, calling sites use this
 * local alias instead.
 */
export type PhosphorIconComponent = React.ComponentType<PhosphorIconProps>;

/**
 * asIcon.
 *
 * Coerces a Phosphor `Icon` component (the upstream type
 * is `ForwardRefExoticComponent<IconProps>`) into our
 * minimal `PhosphorIconComponent` shape. The Phosphor
 * library's `IconProps` is structurally compatible with
 * our `PhosphorIconProps` (className, weight, size, color
 * are all there), but TS narrows inconsistently across
 * the `dist/ssr` build. This helper centralizes the
 * single unsafe cast in the entire icon barrel.
 *
 * Use this anywhere a `SUBJECT_ICON_MAP` value, or any
 * other icon imported from `@phosphor-icons/react`, is
 * read. Without it, every site that pulls from the map
 * needs its own `as unknown as PhosphorIconComponent`
 * cast.
 */
function asIcon(
  component: React.ComponentType<PhosphorIconProps>
): PhosphorIconComponent {
  return component as unknown as PhosphorIconComponent;
}

/**
 * SUBJECT_ICON_MAP.
 *
 * The `subjects.icon` field on every canonical Subject row
 * is the SUBJECT SLUG (e.g. `"math"`, `"physics"`, not
 * `"MathOperations"` or `"Infinity"`). The seed and the
 * map agree on the slug contract. `migrateIconSlugs`
 * (convex/subjects.ts) handles deployments where the
 * legacy Phosphor-component-name value is still present.
 *
 * When adding a 7th subject: add the slug here AND in the
 * canonical seed (convex/seed.ts). The map is grep-able
 * for the slug list; the seed defines the canonical
 * curriculum. Both must match.
 */
export const SUBJECT_ICON_MAP: Record<string, PhosphorIconComponent> = {
  math: asIcon(CalculatorIcon),
  physics: asIcon(AtomIcon),
  chemistry: asIcon(Flask),
  biology: asIcon(DnaIcon),
  computer_science: asIcon(CodeIcon),
  english: asIcon(BookOpenIcon),
  german: asIcon(ScrollIcon),
  french: asIcon(ScrollIcon),
  spanish: asIcon(ScrollIcon),
  latin: asIcon(ScrollIcon),
  history: asIcon(BookOpenIcon),
  geography: asIcon(GlobeIcon),
  politics: asIcon(ScrollIcon),
  philosophy: asIcon(Brain),
  art: asIcon(PaintBrushIcon),
  music: asIcon(PianoKeysIcon),
};

/**
 * resolveSubjectIcon.
 *
 * Returns the Phosphor component for a subject's `icon`
 * slug, falling back to `Books` for any unknown slug so
 * a missing map entry never breaks rendering.
 */
export function resolveSubjectIcon(
  slug?: string
): PhosphorIconComponent {
  if (!slug) return asIcon(Books);
  return SUBJECT_ICON_MAP[slug] ?? asIcon(Books);
}

export type PhosphorIcon = typeof ArrowRight;

/**
 * SubjectGlyph.
 *
 * Renders a subject's icon glyph from its slug. Module-level
 * component (not defined during a parent render) so it never
 * triggers react/no-unstable-nested-components.
 */
export function SubjectGlyph({
  icon,
  className,
  fillVar,
}: {
  readonly icon?: string;
  readonly className: string;
  readonly fillVar: string;
}) {
  return createElement(resolveSubjectIcon(icon), { className, weight: "duotone" as const, style: { color: fillVar }, "aria-hidden": true });
}
