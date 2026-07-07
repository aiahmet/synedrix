/**
 * vocabularyUtils.ts — Phase 5 §7.2 helper.
 *
 * Pure utility functions for parsing language vocabulary terms
 * from `[[concept:...]]` markers. Extracted from
 * `VocabularyCard.tsx` so it can be imported synchronously
 * without pulling React / Phosphor icons / motion into the
 * bundle.
 *
 * This module has zero React dependencies — it's pure string
 * parsing and can be tree-shaken by Next.js.
 */

// ── Language detection ────────────────────────────────────

const GERMAN_ARTICLES = new Set(["der", "die", "das"]);
const FRENCH_ARTICLES = new Set(["le", "la", "l'", "les", "un", "une"]);
const SPANISH_ARTICLES = new Set(["el", "la", "los", "las", "un", "una"]);

const ALL_ARTICLES = new Set([
  ...GERMAN_ARTICLES,
  ...FRENCH_ARTICLES,
  ...SPANISH_ARTICLES,
]);

export interface TermParts {
  readonly article: string | null;
  readonly word: string;
  readonly definition: string | null;
  readonly example: string | null;
}

/**
 * Parse a concept name into article + word parts.
 * Handles both the simple `der Tisch` form and the
 * pipe-delimited `Name|Definition|Example` form.
 *
 * Returns `null` if the string does not look like
 * a language vocabulary term.
 */
export function parseTerm(raw: string): TermParts | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Check pipe-delimited form: Name|Definition|Example.
  // Only treated as a vocab term when the name part
  // carries an article prefix — otherwise it's a
  // regular concept with definition/example metadata
  // and should render as a ConceptChip, not a flip card.
  if (trimmed.includes("|")) {
    const parts = trimmed
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    const name = parts[0] ?? "";
    const definition = parts[1] ?? null;
    const example = parts[2] ?? null;

    // Try article detection on the name part
    const spaceIdx = name.indexOf(" ");
    if (spaceIdx > 0) {
      const firstWord = name.slice(0, spaceIdx).toLowerCase();
      if (ALL_ARTICLES.has(firstWord)) {
        return {
          article: name.slice(0, spaceIdx),
          word: name.slice(spaceIdx + 1).trim(),
          definition,
          example,
        };
      }
    }
    // No article found — not a vocab term, fall through to null
    return null;
  }

  // Simple form: check for article prefix
  const spaceIdx = trimmed.indexOf(" ");
  if (spaceIdx > 0) {
    const firstWord = trimmed.slice(0, spaceIdx).toLowerCase();
    if (ALL_ARTICLES.has(firstWord)) {
      return {
        article: trimmed.slice(0, spaceIdx),
        word: trimmed.slice(spaceIdx + 1).trim(),
        definition: null,
        example: null,
      };
    }
  }

  // Not a language term
  return null;
}

/**
 * Returns `true` when the raw concept string looks like
 * a language vocabulary term (has an article prefix like
 * "der", "die", "das", "le", "la", "el", etc., or uses
 * the pipe-delimited form).
 *
 * Used by `tutorWidgets.tsx` to decide whether to render
 * a `ConceptChip` or a `VocabularyCard`.
 */
export function isLanguageTerm(raw: string): boolean {
  return parseTerm(raw) !== null;
}
