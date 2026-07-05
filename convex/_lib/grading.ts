/**
 * grading.ts (convex-side shim).
 *
 * The Convex runtime does not resolve the project's
 * `@/lib/...` path alias, so we keep a small
 * computation-only copy of the German letter-grade
 * helpers here for `finishLessonPractice` to consume.
 *
 * The canonical source remains
 * `src/lib/ai/prompts/grading.ts` — the Zod-validated
 * prompt/schema builder and the grade-mapping helper
 * have the SAME numeric thresholds. Update both files
 * if the Gymnasium scale changes.
 *
 * This file MUST NOT include `zod`. Anything that needs
 * the schema lives in src/lib/ai/prompts/grading.ts.
 */

export type GermanLetterGrade = "1" | "2" | "3" | "4" | "5" | "6";

export const GERMAN_GRADE_LABELS: Record<
  GermanLetterGrade,
  { readonly label: string; readonly minPct: number }
> = {
  "1": { label: "sehr gut", minPct: 92 },
  "2": { label: "gut", minPct: 81 },
  "3": { label: "befriedigend", minPct: 67 },
  "4": { label: "ausreichend", minPct: 50 },
  "5": { label: "mangelhaft", minPct: 30 },
  "6": { label: "ungenügend", minPct: 0 },
};

export function scoreToGermanGrade(score: number): GermanLetterGrade {
  if (!Number.isFinite(score)) return "6";
  const pct = Math.max(0, Math.min(1, score)) * 100;
  if (pct >= GERMAN_GRADE_LABELS["1"].minPct) return "1";
  if (pct >= GERMAN_GRADE_LABELS["2"].minPct) return "2";
  if (pct >= GERMAN_GRADE_LABELS["3"].minPct) return "3";
  if (pct >= GERMAN_GRADE_LABELS["4"].minPct) return "4";
  if (pct >= GERMAN_GRADE_LABELS["5"].minPct) return "5";
  return "6";
}
