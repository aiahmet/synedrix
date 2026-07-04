/**
 * Resolve a subject color slug to a concrete CSS variable.
 *
 * Subjects carry an optional free-form `color` slug in the
 * schema. We accept either the bare form (`math`) or the
 * fully-prefixed form (`subject-math`) and normalize to a
 * `var(--subject-<name>)` reference. If the slug is missing
 * or unknown, fall back to the global accent so the bar is
 * always visible.
 */
export function resolveColorVar(slug: string | null | undefined): string {
  if (!slug) return "var(--accent)";
  const normalized = slug.startsWith("subject-") ? slug : `subject-${slug}`;
  return `var(--${normalized})`;
}
