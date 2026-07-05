import { z } from "zod";

/**
 * grading.ts.
 *
 * Schema + prompt builder for the per-answer grader
 * (`gradeAnswer` task). Consumed by
 * `submitAnswerAndGrade` in `convex/practice.ts`.
 *
 * Output is small (one verdict + score + feedback +
 * better answer). Per plan decision D10 the call is
 * atomic — `generateObject`, not streaming. Latency
 * should be sub-3 s; a streaming UI here adds no value.
 *
 * The `mistakeType` union mirrors the
 * `mistakeEntries.mistakeType` union in convex/schema.ts
 * verbatim so we can write a MistakeEntry without an
 * enum cast downstream.
 */

export const mistakeTypeSchema = z.union([
  z.literal("CONCEPT_MISUNDERSTANDING"),
  z.literal("CALCULATION_MISTAKE"),
  z.literal("CARELESS_ERROR"),
  z.literal("FORMULA_RECALL_FAILURE"),
  z.literal("MISREAD_QUESTION"),
  z.literal("LANGUAGE_EXPRESSION_ISSUE"),
]);

export const gradingSchema = z.object({
  verdict: z.union([
    z.literal("correct"),
    z.literal("partially_correct"),
    z.literal("incorrect"),
  ]),
  // 0..1 — used by `finishLessonPractice` to aggregate the
  // run-level score and German 1–6 letter grade.
  score: z.number().min(0).max(1),
  // Shown verbatim to the student on the results page.
  feedback: z.string().min(5).max(800),
  // Model-authored "what a strong answer would say".
  // Persisted on the practiceAttempt row so the results
  // page and the tutor-page context can re-use it without
  // re-prompting the grader.
  betterAnswer: z.string().min(10).max(800),
  // `null` when verdict === "correct" — a correct answer
  // is not a mistake entry.
  mistakeType: mistakeTypeSchema.nullable(),
  // `null` when verdict === "correct".
  cause: z.string().min(5).max(400).nullable(),
}).strict();

export type GradingShape = z.infer<typeof gradingSchema>;

export interface GradingPromptInput {
  /**
   * The lesson excerpt that grounds the question. Pulled
   * server-side via the section index `practiceItems.rubric`
   * does not (yet) carry; this is the section the
   * practice-item's prompt referred to.
   */
  readonly lessonExcerpt: string;
  readonly prompt: string;
  readonly expectedAnswer: string;
  readonly rubric: readonly string[];
  readonly userAnswer: string;
  readonly language: string;
}

/**
 * Rubric bullets are formatted one per line so the model
 * can quote them back in `feedback`. Empty rubric arrays
 * fall back to a single "(no rubric specified)" line so
 * the prompt shape stays well-formed.
 *
 * Light formatting (bold/italic/inline-code and LaTeX
 * math via \(...\) and \[...\]) is allowed inside
 * `feedback` and `betterAnswer` — the consumer surfaces
 * (practice page, results page) feed those strings
 * through `AIMarkdown`. Single `$` is NEVER math; if
 * the model would write a price it should write it
 * verbatim so the parser does not mistake it for
 * inline math.
 */
export function buildGradingPrompt(g: GradingPromptInput): string {
  const rubricBlock =
    g.rubric.length > 0
      ? g.rubric.map((r, i) => `  ${i + 1}. ${r}`).join("\n")
      : "  (no explicit rubric — judge correctness holistically against the expected answer)";

  const excerpt =
    g.lessonExcerpt.length > 0
      ? g.lessonExcerpt
      : "(lesson section not retrieved — judge against the expected answer only)";

  return `You are the Synedrix grader. The student is a Gymnasium-age pupil working in ${g.language}. Grade ONE answer against the rubric below.

Lesson excerpt that grounds the question:
"""
${excerpt}
"""

Question:
${g.prompt}

Expected strong answer:
${g.expectedAnswer}

Rubric (one bullet per check — pass all to earn "correct"):
${rubricBlock}

Student's answer:
"""
${g.userAnswer.trim()}
"""

Output rules:
- Return ONE structured object: { verdict, score, feedback, betterAnswer, mistakeType, cause }.
- \`verdict\` ∈ { correct, partially_correct, incorrect }.
- \`score\` ∈ [0.0, 1.0]. 1.0 when every rubric bullet is satisfied.
- \`feedback\` 5–800 chars. Quote specific phrases from the student's answer that satisfy or fail each rubric bullet. Cite the rubric bullet numbers, e.g. "rubric #2 satisfied: you named X; rubric #3 missed: you did not state Y". You may use light formatting: \`**bold**\` for rubric references, \`\\( ... \\)\` for inline math, \`*italic*\` for technical terms if the situation warrants it. Never use bullet lists or headings.
- \`betterAnswer\` 10–800 chars. A compact version of what a strong answer would say. Cite the lesson excerpt. You may use \`**bold**\`, \`*italic*\`, \`\\( ... \\)\` inline math (e.g. \`\\(E = mc^2\\)\`) and \`\\[ ... \\]\` block math (e.g. \`\\[ E = mc^2 \\]\`).
- \`mistakeType\` is REQUIRED when \`verdict !== "correct"\`. \`null\` only when \`verdict === "correct"\`.
- \`cause\` 5–400 chars when \`mistakeType\` is set; explain the gap in one sentence. \`null\` otherwise.
- Do not include a preamble. Return only the structured object.
`;
}

/**
 * German Gymnasium letter-grade boundaries per plan decision
 * D11 and §11 of the lesson plan. Centralized here so the
 * grade computation in `convex/practice.ts:finishLessonPractice`
 * has one source of truth.
 *
 * 1 = sehr gut      ≥ 92 %
 * 2 = gut           ≥ 81 %
 * 3 = befriedigend  ≥ 67 %
 * 4 = ausreichend   ≥ 50 %
 * 5 = mangelhaft    ≥ 30 %
 * 6 = ungenügend    <  30 %
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

/**
 * Map a per-run mean score in [0,1] to the German 1–6
 * letter grade. Returns the lowest "1..6" whose
 * threshold the score clears. Score < 0.30 is a 6.
 * `computeRunScore` in convex/practice.ts (and the
 * unit test) call this.
 */
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
