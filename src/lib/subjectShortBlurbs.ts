/**
 * SUBJECT_SHORT_BLURBS.
 *
 * UI-only mirror of the per-subject `shortBlurb` value
 * declared in the canonical seed tree
 * (`convex/seed.ts`). The seed carries both the long
 * `description` (used on the subject detail page header)
 * and a 1-line `shortBlurb` (≤ 80 chars) used in the
 * catalog chips and strips.
 *
 * The plan is explicit that `shortBlurb` is NOT mirrored
 * to the Convex schema: it is a UI concern, not a
 * curriculum concern, and the seed is the source of
 * truth. This module keeps the two in sync so the UI
 * author and the seed author each touch one file.
 *
 * Sync rules:
 *   - One entry per canonical subject slug.
 *   - ≤ 80 chars.
 *   - No em-dashes (per SUBJECT-IMPROVEMENT-PLAN §0
 *     "anti-default rules").
 *   - When the seed adds or changes a `shortBlurb`, edit
 *     the matching entry here in the same commit.
 *
 * Unknown slugs return `null`. Callers should fall back
 * to the long `description` from the API response.
 */
export const SUBJECT_SHORT_BLURBS: Readonly<Record<string, string>> = {
  math: "Step-by-step solving workspace, formula sheet.",
  physics: "Concepts paired with formulas, unit-aware problems.",
  chemistry: "Reaction drills, organic patterns, equation practice.",
  french: "Vocabulary decks, grammar drills, text analysis.",
  german: "Text annotation, characterization templates.",
  english: "Reading comprehension, literary analysis, essays.",
};

/**
 * subjectShortBlurb.
 *
 * Returns the short blurb for a given subject slug, or
 * `null` when the slug is unknown. Use this in the
 * SubjectCard and AvailableSubjectStrip to render the
 * chip-level description. The long `description` from
 * the API response remains the detail-page header text.
 */
export function subjectShortBlurb(
  slug: string | null | undefined
): string | null {
  if (!slug) return null;
  return SUBJECT_SHORT_BLURBS[slug] ?? null;
}
