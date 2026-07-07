import { describe, expect, it } from "vitest";

import {
  buildEssayAnalysisPrompt,
  buildTranslationDrillPrompt,
  buildFormulaDerivationPrompt,
  buildOralRecallPrompt,
  buildMixedTopicPracticePrompt,
  buildArenaPracticePrompt,
  buildArenaGradingPrompt,
  type IndividualPromptInput,
} from "@/lib/ai/prompts/practiceArena";

const baseIndividualInput: IndividualPromptInput = {
  topicContents: [
    {
      topicTitle: "Logarithms",
      content:
        "A logarithm is the inverse of an exponential. log_2(8) = 3 because 2^3 = 8.",
      gradeLevel: "11",
    },
  ],
  count: 4,
  language: "de",
};

const baseArenaInput = {
  topicContents: baseIndividualInput.topicContents,
  count: 4,
  mode: "sequential" as const,
  questionTypes: ["user_text_answer" as const],
  language: "de",
};

describe("buildEssayAnalysisPrompt", () => {
  const prompt = buildEssayAnalysisPrompt({
    ...baseIndividualInput,
    difficulty: "MEDIUM",
  });

  it("includes the topic title", () => {
    expect(prompt).toContain("Logarithms");
  });

  it("includes the requested count", () => {
    expect(prompt).toContain("4");
  });

  it("includes the working language", () => {
    expect(prompt).toContain("de");
  });

  it("includes essay_analysis type directive", () => {
    expect(prompt).toContain("essay_analysis");
  });

  it("includes wordCountTarget directive", () => {
    expect(prompt).toContain("wordCountTarget");
  });

  it("includes difficulty guidance", () => {
    expect(prompt).toContain("DIFFICULTY: Medium");
  });

  it("includes default Medium difficulty when difficulty is undefined", () => {
    const promptNoDifficulty = buildEssayAnalysisPrompt(baseIndividualInput);
    expect(promptNoDifficulty).toContain("DIFFICULTY: Medium");
  });
});

describe("buildTranslationDrillPrompt", () => {
  const prompt = buildTranslationDrillPrompt(baseIndividualInput);

  it("includes the topic title", () => {
    expect(prompt).toContain("Logarithms");
  });

  it("includes translation_drill type directive", () => {
    expect(prompt).toContain("translation_drill");
  });

  it("includes sourcePhrase directive", () => {
    expect(prompt).toContain("sourcePhrase");
  });
});

describe("buildFormulaDerivationPrompt", () => {
  const prompt = buildFormulaDerivationPrompt(baseIndividualInput);

  it("includes the topic title", () => {
    expect(prompt).toContain("Logarithms");
  });

  it("includes formula_derivation type directive", () => {
    expect(prompt).toContain("formula_derivation");
  });

  it("includes startingExpression directive", () => {
    expect(prompt).toContain("startingExpression");
  });
});

describe("buildOralRecallPrompt", () => {
  const prompt = buildOralRecallPrompt(baseIndividualInput);

  it("includes the topic title", () => {
    expect(prompt).toContain("Logarithms");
  });

  it("includes oral_recall type directive", () => {
    expect(prompt).toContain("oral_recall");
  });
});

describe("buildMixedTopicPracticePrompt", () => {
  const prompt = buildMixedTopicPracticePrompt({
    ...baseIndividualInput,
    topicContents: [
      {
        topicTitle: "Logarithms",
        content: "A logarithm is the inverse of an exponential.",
        gradeLevel: "11",
      },
      {
        topicTitle: "Exponential Growth",
        content: "Exponential growth follows the form f(t) = a * e^(kt).",
        gradeLevel: "12",
      },
    ],
  });

  it("includes all topic titles", () => {
    expect(prompt).toContain("Logarithms");
    expect(prompt).toContain("Exponential Growth");
  });

  it("includes exam_simulation mode language", () => {
    expect(prompt).toContain("EXAM SIMULATION");
  });
});

describe("buildArenaPracticePrompt", () => {
  it("dispatches to buildEssayAnalysisPrompt when only essay_analysis selected", () => {
    const prompt = buildArenaPracticePrompt({
      ...baseArenaInput,
      questionTypes: ["essay_analysis"],
    });
    expect(prompt).toContain("essay-analysis questions ONLY");
    expect(prompt).toContain("wordCountTarget");
  });

  it("dispatches to buildTranslationDrillPrompt when only translation_drill selected", () => {
    const prompt = buildArenaPracticePrompt({
      ...baseArenaInput,
      questionTypes: ["translation_drill"],
    });
    expect(prompt).toContain("translation-drill questions ONLY");
    expect(prompt).toContain("sourcePhrase");
  });

  it("dispatches to buildFormulaDerivationPrompt when only formula_derivation selected", () => {
    const prompt = buildArenaPracticePrompt({
      ...baseArenaInput,
      questionTypes: ["formula_derivation"],
    });
    expect(prompt).toContain("formula_derivation");
    expect(prompt).toContain("startingExpression");
  });

  it("dispatches to buildOralRecallPrompt when only oral_recall selected", () => {
    const prompt = buildArenaPracticePrompt({
      ...baseArenaInput,
      questionTypes: ["oral_recall"],
    });
    expect(prompt).toContain("oral_recall");
  });

  it("falls through to generic interleaving prompt for single non-specialized type", () => {
    const prompt = buildArenaPracticePrompt({
      ...baseArenaInput,
      questionTypes: ["mcq"],
    });
    expect(prompt).not.toContain("essay-analysis questions ONLY");
    expect(prompt).not.toContain("translation-drill questions ONLY");
  });

  it("produces interleaving directive when multiple types selected", () => {
    const prompt = buildArenaPracticePrompt({
      ...baseArenaInput,
      questionTypes: ["essay_analysis", "translation_drill"],
    });
    expect(prompt).toContain("interleaved");
    expect(prompt).toContain("Alternate types");
  });

  it("delegates to buildMixedTopicPracticePrompt when mode=exam_simulation and topicContents.length > 1", () => {
    const prompt = buildArenaPracticePrompt({
      ...baseArenaInput,
      mode: "exam_simulation",
      questionTypes: ["user_text_answer"],
      topicContents: [
        {
          topicTitle: "Logarithms",
          content: "A logarithm is the inverse of an exponential.",
          gradeLevel: "11",
        },
        {
          topicTitle: "Exponential Growth",
          content: "Exponential growth follows f(t) = a * e^(kt).",
          gradeLevel: "12",
        },
      ],
      count: 4,
    });
    expect(prompt).toContain("EXAM SIMULATION with multiple topics");
    expect(prompt).toContain("cross-topic synthesis");
    expect(prompt).toContain("Logarithms");
    expect(prompt).toContain("Exponential Growth");
  });

  it("includes difficulty guidance when difficulty provided", () => {
    const prompt = buildArenaPracticePrompt({
      ...baseArenaInput,
      difficulty: "HARD",
    });
    expect(prompt).toContain("DIFFICULTY: Hard");
    expect(prompt).toContain("synthesis");
  });

  it("includes default Medium difficulty when difficulty is undefined", () => {
    const prompt = buildArenaPracticePrompt(baseArenaInput);
    expect(prompt).toContain("DIFFICULTY: Medium");
  });

  it("includes MCQ options in ARENA_OUTPUT_RULES via per-type description", () => {
    const prompt = buildArenaPracticePrompt({
      ...baseArenaInput,
      questionTypes: ["mcq"],
    });
    expect(prompt).toContain("four options");
    expect(prompt).toContain("options array");
  });

  it("includes the mode label in the output", () => {
    const sequentialPrompt = buildArenaPracticePrompt({
      ...baseArenaInput,
      mode: "sequential",
    });
    expect(sequentialPrompt).toContain("SEQUENTIAL mode");

    const timedPrompt = buildArenaPracticePrompt({
      ...baseArenaInput,
      mode: "timed",
    });
    expect(timedPrompt).toContain("TIMED mode");
  });
});

describe("buildArenaGradingPrompt", () => {
  const baseGradingInput = {
    itemType: "essay_analysis" as const,
    prompt: "Analysiere den Logarithmus-Begriff",
    expectedAnswer: "Ein Logarithmus ist die Umkehrfunktion der Exponentialfunktion.",
    rubric: ["Definiert den Logarithmus korrekt", "Nennt ein Beispiel"],
    userAnswer: "Der Logarithmus kehrt die Exponentialfunktion um. log_2(8) = 3.",
    language: "de",
  };

  it("includes the item type in the output", () => {
    const prompt = buildArenaGradingPrompt(baseGradingInput);
    expect(prompt).toContain("essay_analysis");
  });

  it("includes the question text", () => {
    const prompt = buildArenaGradingPrompt(baseGradingInput);
    expect(prompt).toContain("Analysiere den Logarithmus-Begriff");
  });

  it("includes the expected answer", () => {
    const prompt = buildArenaGradingPrompt(baseGradingInput);
    expect(prompt).toContain("Umkehrfunktion der Exponentialfunktion");
  });

  it("includes rubric bullets", () => {
    const prompt = buildArenaGradingPrompt(baseGradingInput);
    expect(prompt).toContain("Definiert den Logarithmus korrekt");
    expect(prompt).toContain("Nennt ein Beispiel");
  });

  it("includes the student's answer", () => {
    const prompt = buildArenaGradingPrompt(baseGradingInput);
    expect(prompt).toContain("log_2(8) = 3");
  });

  it("includes the language", () => {
    const prompt = buildArenaGradingPrompt(baseGradingInput);
    expect(prompt).toContain("de");
  });

  it("includes essay_analysis specific grading instructions", () => {
    const prompt = buildArenaGradingPrompt(baseGradingInput);
    expect(prompt).toContain("ESSAY ANALYSIS grading");
    expect(prompt).toContain("word count");
  });

  it("includes translation_drill specific instructions", () => {
    const prompt = buildArenaGradingPrompt({
      ...baseGradingInput,
      itemType: "translation_drill",
      sourcePhrase: "The cat sits on the mat.",
    });
    expect(prompt).toContain("TRANSLATION DRILL grading");
    expect(prompt).toContain("The cat sits on the mat");
  });

  it("includes formula_derivation specific instructions", () => {
    const prompt = buildArenaGradingPrompt({
      ...baseGradingInput,
      itemType: "formula_derivation",
      startingExpression: "E = mc^2",
    });
    expect(prompt).toContain("FORMULA DERIVATION grading");
    expect(prompt).toContain("E = mc^2");
    expect(prompt).toContain("Partial credit");
  });

  it("handles oral_recall with self-check correct", () => {
    const prompt = buildArenaGradingPrompt({
      ...baseGradingInput,
      itemType: "oral_recall",
      userAnswer: "Der Logarithmus ist die Umkehrfunktion.\n\n[self-check: correct]",
    });
    expect(prompt).toContain("ORAL RECALL grading (self-check: correct)");
    expect(prompt).toContain("0.85");
  });

  it("handles oral_recall with self-check struggled", () => {
    const prompt = buildArenaGradingPrompt({
      ...baseGradingInput,
      itemType: "oral_recall",
      userAnswer: "Ich kann mich nicht erinnern.\n\n[self-check: struggled]",
    });
    expect(prompt).toContain("ORAL RECALL grading (self-check: struggled)");
    expect(prompt).toContain("grade leniently");
  });

  it("includes mcq specific instructions with options", () => {
    const prompt = buildArenaGradingPrompt({
      ...baseGradingInput,
      itemType: "mcq",
      options: ["log_2(8) = 3", "log_2(8) = 4", "log_2(8) = 2", "log_2(8) = 5"],
      userAnswer: "log_2(8) = 3",
    });
    expect(prompt).toContain("MCQ grading");
    expect(prompt).toContain("log_2(8) = 3 | log_2(8) = 4 | log_2(8) = 2 | log_2(8) = 5");
    expect(prompt).toContain("No partial credit for MCQs");
  });

  it("falls back to generic instructions for user_text_answer", () => {
    const prompt = buildArenaGradingPrompt({
      ...baseGradingInput,
      itemType: "user_text_answer",
    });
    expect(prompt).toContain("GENERIC grading");
  });

  it("falls back to generic instructions for short_answer", () => {
    const prompt = buildArenaGradingPrompt({
      ...baseGradingInput,
      itemType: "short_answer",
    });
    expect(prompt).toContain("GENERIC grading");
  });

  it("handles empty rubric", () => {
    const prompt = buildArenaGradingPrompt({
      ...baseGradingInput,
      rubric: [],
    });
    expect(prompt).toContain("no explicit rubric");
  });

  it("handles null options gracefully", () => {
    const prompt = buildArenaGradingPrompt({
      ...baseGradingInput,
      itemType: "mcq",
      options: null,
    });
    expect(prompt).toContain("MCQ grading");
  });

  it("handles null wordCountTarget", () => {
    const prompt = buildArenaGradingPrompt({
      ...baseGradingInput,
      wordCountTarget: null,
    });
    expect(prompt).toContain("150-word target");
  });

  describe("subjectSlug", () => {
    it("does NOT include subject-specific grading rules when subjectSlug is undefined", () => {
      const prompt = buildArenaGradingPrompt({
        ...baseGradingInput,
        subjectSlug: undefined,
      });
      expect(prompt).not.toContain("Subject-specific grading rules:");
    });

    it("includes MATHEMATICS GRADING and sign error rules when subjectSlug is math", () => {
      const prompt = buildArenaGradingPrompt({
        ...baseGradingInput,
        subjectSlug: "math",
      });
      expect(prompt).toContain("Subject-specific grading rules:");
      expect(prompt).toContain("MATHEMATICS GRADING");
      expect(prompt).toContain("sign error propagates");
    });

    it("includes PHYSICS GRADING and UNIT CHECK when subjectSlug is physics", () => {
      const prompt = buildArenaGradingPrompt({
        ...baseGradingInput,
        subjectSlug: "physics",
      });
      expect(prompt).toContain("Subject-specific grading rules:");
      expect(prompt).toContain("PHYSICS GRADING");
      expect(prompt).toContain("UNIT CHECK");
    });

    it("includes LANGUAGE GRADING when subjectSlug is english", () => {
      const prompt = buildArenaGradingPrompt({
        ...baseGradingInput,
        subjectSlug: "english",
      });
      expect(prompt).toContain("Subject-specific grading rules:");
      expect(prompt).toContain("LANGUAGE GRADING");
    });
  });
});
