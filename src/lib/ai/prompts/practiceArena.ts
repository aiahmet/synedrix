import { z } from "zod";
import { getSubjectBehavior } from "@/lib/ai/subjectBehaviors";

function truncateAtSentence(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const lastPeriod = truncated.lastIndexOf(".");
  if (lastPeriod > maxLen * 0.6) return truncated.slice(0, lastPeriod + 1);
  const lastNewline = truncated.lastIndexOf("\n");
  if (lastNewline > maxLen * 0.5) return truncated.slice(0, lastNewline);
  return truncated + "…";
}

export const practiceItemSchema = z.object({
  prompt: z.string().min(10).max(400),
  expectedAnswer: z.string().min(10).max(800),
  skill: z.string().min(1).max(40),
  rubric: z.array(z.string().min(2).max(120)).min(1).max(4),
});

export const arenaPracticeItemsSchema = z
  .object({
    items: z
      .array(
        practiceItemSchema.extend({
          type: z.enum([
            "essay_analysis",
            "translation_drill",
            "formula_derivation",
            "oral_recall",
            "user_text_answer",
            "mcq",
            "fill_blank",
            "step_problem",
          ]),
          wordCountTarget: z.number().optional(),
          sourcePhrase: z.string().optional(),
          startingExpression: z.string().optional(),
          options: z.array(z.string()).max(4).optional(),
        })
      )
      .min(3)
      .max(8),
  })
  .strict();

export type ArenaPracticeItemsShape = z.infer<
  typeof arenaPracticeItemsSchema
>;

/**
 * The Practice Arena intentionally omits `worked_walkthrough`
 * and `short_answer` from the canonical `PracticeItemType`
 * union defined in `subjectBehaviors.ts` — walkthrough items
 * require multi-turn reveal pacing and short-answer items
 * duplicate what `user_text_answer` already covers at the
 * arena level, so this 8-variant subset keeps the arena
 * generator prompt focused.
 */
export type ArenaQuestionType =
  | "essay_analysis"
  | "translation_drill"
  | "formula_derivation"
  | "oral_recall"
  | "user_text_answer"
  | "mcq"
  | "fill_blank"
  | "step_problem";

export type ArenaMode =
  | "sequential"
  | "timed"
  | "retry_wrong"
  | "exam_simulation";

export interface ArenaPracticePromptInput {
  readonly topicContents: ReadonlyArray<{
    readonly topicTitle: string;
    readonly content: string;
    readonly gradeLevel: string | null;
  }>;
  readonly count: number;
  readonly mode: ArenaMode;
  readonly questionTypes: ReadonlyArray<ArenaQuestionType>;
  readonly language: string;
  readonly difficulty?: "EASY" | "MEDIUM" | "HARD";
  readonly subjectSlug?: string;
}

function topicBlockText(
  topicContents: ReadonlyArray<{
    readonly topicTitle: string;
    readonly content: string;
    readonly gradeLevel: string | null;
  }>
): string {
  return topicContents
    .map(
      (tc) =>
        `Topic: "${tc.topicTitle}" (grade: ${tc.gradeLevel ?? "Gymnasium"})\nContent excerpt:\n"""\n${tc.content.slice(0, 3000)}\n"""`
    )
    .join("\n\n---\n\n");
}

function difficultyGuidance(difficulty?: "EASY" | "MEDIUM" | "HARD"): string {
  switch (difficulty) {
    case "EASY":
      return "DIFFICULTY: Easy. Questions should be accessible, concrete, and focused on core recall or basic application. Use simpler vocabulary and shorter expected answers.";
    case "HARD":
      return "DIFFICULTY: Hard. Questions should require synthesis, deeper reasoning, or multi-step application. Challenge the student with subtle distinctions or compound reasoning.";
    default:
      return "DIFFICULTY: Medium. Questions should probe understanding at the standard Gymnasium level — not trivially simple but not exam-honours hard.";
  }
}

const ARENA_OUTPUT_RULES = `Output rules:
- Return ONE structured object: \`{ items: [...] }\`.
- Each item has:
    - \`type\`: one of essay_analysis, translation_drill, formula_derivation, oral_recall, user_text_answer, mcq, fill_blank, step_problem.
    - \`prompt\`: 10–400 chars. The question text.
    - \`expectedAnswer\`: 10–800 chars. What a strong answer says.
    - \`skill\`: 1–40 chars. The skill being tested.
    - \`rubric\`: 1–4 bullets (2–120 chars each). Grading checkmarks.
    - For essay_analysis items, optionally include \`wordCountTarget\` (80-300).
    - For translation_drill items, optionally include \`sourcePhrase\`.
    - For formula_derivation items, optionally include \`startingExpression\`.
    - For mcq items, include an \`options\` array of exactly 4 strings (one correct, three plausible distractors).
- Ground every question in the provided lesson content. Do not invent material.
- Return only the structured object, no preamble.`;

function basePromptHeader(
  g: Omit<ArenaPracticePromptInput, "questionTypes" | "mode">,
  mode: ArenaMode,
  difficulty?: "EASY" | "MEDIUM" | "HARD"
): string {
  const topicBlock = topicBlockText(g.topicContents);
  const diffGuidance = difficultyGuidance(difficulty);

  const modeGuidance =
    mode === "exam_simulation"
      ? "EXAM SIMULATION mode. Questions should feel like a real Gymnasium exam paper — formal tone, multi-part when appropriate, no hints in the prompt."
      : mode === "timed"
        ? "TIMED mode. Questions should be answerable within the time limit. Prefer concise prompts."
        : mode === "retry_wrong"
          ? "RETRY WRONG mode. These are items the student previously answered incorrectly. Rephrase around the same concepts without repeating the original prompt verbatim."
          : "SEQUENTIAL mode. Standard practice — one question at a time with immediate feedback.";

  return `You are the Synedrix Practice Arena generator. The student is a German Gymnasium pupil working in ${g.language}.\n\nSession mode: ${modeGuidance}\n${diffGuidance}\n\nLesson content for the selected topics:\n${topicBlock}`;
}

function questionTypeGuidance(types: ReadonlyArray<ArenaQuestionType>): string {
  if (types.length === 0) return "open-prose questions";

  const descriptions: Record<ArenaQuestionType, string> = {
    essay_analysis:
      "essay-analysis questions: a prompt asking the student to analyse a concept, structure, or argument in 80-300 words. Include a word count target.",
    translation_drill:
      "translation-drill questions: a source-language phrase the student must translate into the target language. Include the source phrase context.",
    formula_derivation:
      "formula-derivation questions: a starting expression or principle; the student derives the target formula step by step.",
    oral_recall:
      "oral-recall questions: a fact or concept the student must recall aloud from memory, with a self-check toggle.",
    user_text_answer:
      "open-prose questions: a short-answer question the student writes a paragraph for.",
    mcq:
      "multiple-choice questions: four options (one correct, three plausible distractors). Include an options array.",
    fill_blank:
      "fill-in-the-blank questions: a sentence with one or two gaps.",
    step_problem:
      "step-by-step problem: a multi-part question the student works through sequentially.",
  };

  return types.map((t) => `  - ${descriptions[t]}`).join("\n");
}

export interface IndividualPromptInput {
  readonly topicContents: ReadonlyArray<{
    readonly topicTitle: string;
    readonly content: string;
    readonly gradeLevel: string | null;
  }>;
  readonly count: number;
  readonly language: string;
  readonly difficulty?: "EASY" | "MEDIUM" | "HARD";
}

export function buildEssayAnalysisPrompt(
  g: IndividualPromptInput
): string {
  return [
    basePromptHeader(
      {
        topicContents: g.topicContents,
        count: g.count,
        language: g.language,
      },
      "sequential",
      g.difficulty
    ),
    ``,
    `Generate ${g.count} essay-analysis questions ONLY. Each item must have type: "essay_analysis" and a wordCountTarget between 80 and 300.`,
    ``,
    `Essay-analysis questions ask the student to write a short analytical paragraph (80–300 words) grounded in the lesson content. Each prompt should name a specific concept, comparison, or argument the student must explain in their own words. Provide a wordCountTarget that matches the expected depth.`,
    ``,
    ARENA_OUTPUT_RULES,
    ``,
    `Work entirely in ${g.language}.`,
  ].join("\n");
}

export function buildTranslationDrillPrompt(
  g: IndividualPromptInput
): string {
  return [
    basePromptHeader(
      {
        topicContents: g.topicContents,
        count: g.count,
        language: g.language,
      },
      "sequential",
      g.difficulty
    ),
    ``,
    `Generate ${g.count} translation-drill questions ONLY. Each item must have type: "translation_drill" and a sourcePhrase — the source-language text the student must translate.`,
    ``,
    `Translation-drill items present a phrase, sentence, or short paragraph in the source language and ask the student to translate it. The sourcePhrase field holds the original text. Choose material anchored in the lesson content — vocabulary, grammar patterns, or idiomatic expressions from the excerpts.`,
    ``,
    ARENA_OUTPUT_RULES,
    ``,
    `Work entirely in ${g.language}.`,
  ].join("\n");
}

export function buildFormulaDerivationPrompt(
  g: IndividualPromptInput
): string {
  return [
    basePromptHeader(
      {
        topicContents: g.topicContents,
        count: g.count,
        language: g.language,
      },
      "sequential",
      g.difficulty
    ),
    ``,
    `Generate ${g.count} formula-derivation questions ONLY. Each item must have type: "formula_derivation" and a startingExpression — the initial expression or principle the student starts from.`,
    ``,
    `Formula-derivation questions present a starting expression or physical principle and ask the student to derive a target formula step by step. The startingExpression field holds the starting point. The expectedAnswer should show the complete derivation path. Ground every derivation in the lesson content.`,
    ``,
    ARENA_OUTPUT_RULES,
    ``,
    `Work entirely in ${g.language}.`,
  ].join("\n");
}

export function buildOralRecallPrompt(
  g: IndividualPromptInput
): string {
  return [
    basePromptHeader(
      {
        topicContents: g.topicContents,
        count: g.count,
        language: g.language,
      },
      "sequential",
      g.difficulty
    ),
    ``,
    `Generate ${g.count} oral-recall questions ONLY. Each item must have type: "oral_recall".`,
    ``,
    `Oral-recall questions ask the student to recite an answer aloud from memory, then type a brief summary. Questions should target concrete facts, definitions, rules, or procedures from the lesson that a student can be expected to have memorised. The expectedAnswer should provide the canonical correct recall.`,
    ``,
    ARENA_OUTPUT_RULES,
    ``,
    `Work entirely in ${g.language}.`,
  ].join("\n");
}

export function buildMixedTopicPracticePrompt(
  g: IndividualPromptInput
): string {
  return [
    basePromptHeader(
      {
        topicContents: g.topicContents,
        count: g.count,
        language: g.language,
      },
      "exam_simulation",
      g.difficulty
    ),
    ``,
    `Generate ${g.count} exam-simulation questions spanning multiple topics. Emphasise cross-topic synthesis — questions that require the student to connect ideas from different topics.`,
    ``,
    `EXAM SIMULATION with multiple topics. Questions should feel like a real Gymnasium exam paper that tests material across all the topics listed above. Include connections between topics where natural — e.g., a physics problem that requires maths derivations, or a language question that references cultural context from another topic.`,
    ``,
    `Use a mix of question types: essay_analysis, user_text_answer, formula_derivation, translation_drill, oral_recall, mcq, fill_blank, step_problem.`,
    ``,
    ARENA_OUTPUT_RULES,
    ``,
    `Work entirely in ${g.language}.`,
  ].join("\n");
}

export function buildArenaPracticePrompt(
  g: ArenaPracticePromptInput
): string {
  if (g.questionTypes.length === 1) {
    const type = g.questionTypes[0];
    switch (type) {
      case "essay_analysis":
        return buildEssayAnalysisPrompt({
          topicContents: g.topicContents,
          count: g.count,
          language: g.language,
          difficulty: g.difficulty,
        });
      case "translation_drill":
        return buildTranslationDrillPrompt({
          topicContents: g.topicContents,
          count: g.count,
          language: g.language,
          difficulty: g.difficulty,
        });
      case "formula_derivation":
        return buildFormulaDerivationPrompt({
          topicContents: g.topicContents,
          count: g.count,
          language: g.language,
          difficulty: g.difficulty,
        });
      case "oral_recall":
        return buildOralRecallPrompt({
          topicContents: g.topicContents,
          count: g.count,
          language: g.language,
          difficulty: g.difficulty,
        });
      default:
        break;
    }
  }

  if (
    g.mode === "exam_simulation" &&
    g.topicContents.length > 1
  ) {
    return buildMixedTopicPracticePrompt({
      topicContents: g.topicContents,
      count: g.count,
      language: g.language,
      difficulty: g.difficulty,
    });
  }

  const typeGuidance = questionTypeGuidance(g.questionTypes);

  const perTypeCount = Math.max(
    1,
    Math.floor(g.count / g.questionTypes.length)
  );
  const remainder = g.count - perTypeCount * g.questionTypes.length;

  const countDirective =
    g.questionTypes.length > 1
      ? `Generate ${g.count} items TOTAL, interleaved across the selected types. Produce roughly ${perTypeCount} of each type${
          remainder > 0
            ? `, with ${remainder} extra item${remainder > 1 ? "s" : ""} spread across the first ${remainder} type${remainder > 1 ? "s" : ""}`
            : ""
        }. Alternate types rather than grouping them (e.g., essay → translation → essay → translation, not all essays then all translations).`
      : `Generate ${g.count} items.`;

  const topicBlock = topicBlockText(g.topicContents);
  const diffGuidance = difficultyGuidance(g.difficulty);

  const modeGuidance =
    g.mode === "exam_simulation"
      ? "EXAM SIMULATION mode. Questions should feel like a real Gymnasium exam paper — formal tone, multi-part when appropriate, no hints in the prompt. The student will not see feedback until the end."
      : g.mode === "timed"
        ? "TIMED mode. Questions should be answerable within the time limit. Prefer concise prompts."
        : g.mode === "retry_wrong"
          ? "RETRY WRONG mode. These are items the student previously answered incorrectly. Rephrase around the same concepts without repeating the original prompt verbatim."
          : "SEQUENTIAL mode. Standard practice — one question at a time with immediate feedback after each.";

  return `You are the Synedrix Practice Arena generator. The student is a German Gymnasium pupil working in ${g.language}. Generate practice questions from the lesson content below.

${g.subjectSlug ? `Subject-specific guidance for practice generation: ${truncateAtSentence(getSubjectBehavior(g.subjectSlug).tutorInstructions, 800)}\n\n` : ""}Session mode: ${modeGuidance}
${diffGuidance}

${countDirective}

Question types to include:
${typeGuidance}

Lesson content for the selected topics:
${topicBlock}

${ARENA_OUTPUT_RULES}

Work entirely in ${g.language}.
`;
}

export interface ArenaGradingPromptInput {
  readonly itemType: ArenaQuestionType | "short_answer" | "user_text_answer";
  readonly prompt: string;
  readonly expectedAnswer: string;
  readonly rubric: readonly string[];
  readonly userAnswer: string;
  readonly options?: readonly string[] | null;
  readonly wordCountTarget?: number | null;
  readonly sourcePhrase?: string | null;
  readonly startingExpression?: string | null;
  readonly language: string;
  readonly subjectSlug?: string;
}

function typeSpecificGradingInstructions(
  itemType: ArenaQuestionType | "short_answer" | "user_text_answer",
  userAnswer: string,
  options?: readonly string[] | null,
  wordCountTarget?: number | null,
  sourcePhrase?: string | null,
  startingExpression?: string | null
): string {
  switch (itemType) {
    case "essay_analysis": {
      const wc = wordCountTarget ?? 150;
      return `ESSAY ANALYSIS grading:\n- Grade on analytical quality, structure, clarity, and relevance to the prompt.\n- Be lenient on word count ±20% of the ${wc}-word target — do not penalise an otherwise strong answer for being slightly short or long.\n- Credit original thinking and synthesis, not just regurgitation of the lesson content.\n- A partial answer that identifies the right concept but does not develop it fully should still receive partial credit.`;
    }
    case "translation_drill": {
      const src = sourcePhrase ?? "the source phrase";
      return `TRANSLATION DRILL grading:\n- Grade on accuracy against the source phrase: "${src.slice(0, 200)}".\n- Check vocabulary choice, grammar correctness, and idiomatic naturalness.\n- A translation that is semantically correct but uses a different (still valid) idiomatic construction should still receive a high score.\n- Grammar errors that change meaning are severe; spelling-only errors are minor.`;
    }
    case "formula_derivation": {
      const start = startingExpression ?? "the starting expression";
      return `FORMULA DERIVATION grading:\n- Grade on step-by-step logical progression from "${start.slice(0, 200)}" to the target.\n- Each step should be explicitly stated and mathematically valid.\n- Partial credit for correct setup even if a later step is wrong.\n- A student who writes the correct starting point and first derivation step but makes a mistake later should score at least 0.4.`;
    }
    case "oral_recall": {
      if (userAnswer.includes("[self-check: correct]")) {
        return `ORAL RECALL grading (self-check: correct):\n- The student self-reported correct recall. Verify the typed summary matches key facts from the expected answer.\n- If the summary contains the core concepts, verdict=correct with score ≥ 0.85.\n- If the summary is vague or misses a major fact, verdict=partially_correct.`;
      }
      if (userAnswer.includes("[self-check: struggled]")) {
        return `ORAL RECALL grading (self-check: struggled):\n- The student already self-identified the gap — grade leniently.\n- Score ≥ 0.3 regardless of answer quality to reward honest self-assessment.\n- Focus feedback on what to study, not on what was wrong.\n- BetterAnswer should be a complete, concise reference the student can memorise.`;
      }
      return `ORAL RECALL grading:\n- The student typed a recall summary. Grade against the expected answer for factual correctness.\n- No self-check tag found — treat as a standard recall attempt.`;
    }
    case "mcq": {
      const allOptions = (options ?? []).join(" | ");
      return `MCQ grading:\n- Options: ${allOptions}.\n- The expected answer (shown above) is the correct option.\n- If the student's answer matches the expected answer exactly, verdict=correct with score 1.0.\n- If the student's answer matches one of the distractors, verdict=incorrect with score 0.0. No partial credit for MCQs.\n- If the answer is empty or does not match any option, verdict=incorrect with score 0.0.`;
    }
    default:
      return `GENERIC grading:\n- Use the rubric below as the primary grading checklist.\n- Pass all rubric bullets to earn "correct" (score 1.0).\n- Partial credit proportional to the number of bullets satisfied.`;
  }
}

export function buildArenaGradingPrompt(g: ArenaGradingPromptInput): string {
  const rubricBlock =
    g.rubric.length > 0
      ? g.rubric.map((r, i) => `  ${i + 1}. ${r}`).join("\n")
      : "  (no explicit rubric — judge correctness holistically against the expected answer)";

  const typeInstructions = typeSpecificGradingInstructions(
    g.itemType,
    g.userAnswer,
    g.options,
    g.wordCountTarget,
    g.sourcePhrase,
    g.startingExpression
  );

  return `You are the Synedrix Practice Arena grader. The student is a Gymnasium-age pupil working in ${g.language}. Grade ONE answer using type-specific grading rules.

Item type: ${g.itemType}

${typeInstructions}

${g.subjectSlug ? `Subject-specific grading rules:\n${getSubjectBehavior(g.subjectSlug).gradingEmphasis}\n\n` : ""}Question:
${g.prompt}

Expected strong answer:
${g.expectedAnswer}

Rubric (one bullet per check):
${rubricBlock}

Student's answer:
"""
${g.userAnswer.trim()}
"""

Output rules:
- Return ONE structured object: { verdict, score, feedback, betterAnswer, mistakeType, cause }.
- \`verdict\` ∈ { correct, partially_correct, incorrect }.
- \`score\` ∈ [0.0, 1.0].
- \`feedback\` 5–800 chars. Quote specific phrases from the student's answer. Reference rubric bullets where applicable. You may use light formatting: \`**bold**\` for rubric references, \`\\( ... \\)\` for inline math.
- \`betterAnswer\` 10–800 chars. A compact version of what a strong answer would say.
- \`mistakeType\` is REQUIRED when \`verdict !== "correct"\`. \`null\` only when \`verdict === "correct"\`.
- \`cause\` 5–400 chars when \`mistakeType\` is set; explain the gap in one sentence. \`null\` otherwise.
- Do not include a preamble. Return only the structured object.
`;
}
