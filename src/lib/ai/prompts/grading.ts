import { z } from "zod";
import { getSubjectBehavior } from "@/lib/ai/subjectBehaviors";

export const mistakeTypeSchema = z.union([
  z.literal("CONCEPT_MISUNDERSTANDING"),
  z.literal("CALCULATION_MISTAKE"),
  z.literal("CARELESS_ERROR"),
  z.literal("FORMULA_RECALL_FAILURE"),
  z.literal("MISREAD_QUESTION"),
  z.literal("LANGUAGE_EXPRESSION_ISSUE"),
  z.literal("SIGN_ERROR"),
  z.literal("UNIT_CONVERSION_ERROR"),
  z.literal("GRAMMAR_ERROR"),
  z.literal("VOCABULARY_ERROR"),
  z.literal("REACTION_BALANCE_ERROR"),
  z.literal("ARGUMENT_STRUCTURE_ISSUE"),
]);

export const gradingSchema = z.object({
  verdict: z.union([
    z.literal("correct"),
    z.literal("partially_correct"),
    z.literal("incorrect"),
  ]),
  score: z.number().min(0).max(1),
  feedback: z.string().min(5).max(800),
  betterAnswer: z.string().min(10).max(800),
  mistakeType: mistakeTypeSchema.nullable(),
  cause: z.string().min(5).max(400).nullable(),
}).strict();

export type GradingShape = z.infer<typeof gradingSchema>;

export interface GradingPromptInput {
  readonly lessonExcerpt: string;
  readonly prompt: string;
  readonly expectedAnswer: string;
  readonly rubric: readonly string[];
  readonly userAnswer: string;
  readonly language: string;
  readonly subjectSlug?: string;
}

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

${g.subjectSlug ? `Subject-specific grading rules: ${getSubjectBehavior(g.subjectSlug).gradingEmphasis}\n\n` : ""}Lesson excerpt that grounds the question:
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
