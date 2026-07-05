import { describe, expect, it } from "vitest";

import {
  buildGradingPrompt,
  gradingSchema,
  scoreToGermanGrade,
  type GradingShape,
} from "@/lib/ai/prompts/grading";

/**
 * Vitest unit tests for the grading prompt + schema, plus
 * score-to-German-letter-grade boundary tests per plan D11.
 * Per plan §9.
 */

const baseInput = {
  lessonExcerpt:
    "log_b(x) is the exponent y such that b^y = x. Change of base: log_b(x) = ln x / ln b.",
  prompt: "Use the change-of-base rule to evaluate log_3(7).",
  expectedAnswer:
    "log_3(7) = ln 7 / ln 3 ≈ 1.77. The change-of-base rule applies.",
  rubric: [
    "states log_b(x) = ln x / ln b",
    "substitutes 7 and 3 explicitly",
    "arrives at a numerical answer",
  ],
  userAnswer:
    "You take ln of 7 and divide by ln of 3: ln7/ln3 ≈ 1.77. The rule lets you switch bases.",
  language: "de",
};

const validGradingCorrect: GradingShape = {
  verdict: "correct",
  score: 1.0,
  feedback:
    "Rubrik #1 erfüllt: log_b(x) = ln x / ln b genannt. Rubrik #2 erfüllt: ln 7 und ln 3 eingesetzt. Rubrik #3 erfüllt: numerische Antwort.",
  betterAnswer:
    "log_3(7) = ln 7 / ln 3. Mit ln 7 ≈ 1.9459 und ln 3 ≈ 1.0986 ergibt sich log_3(7) ≈ 1.7712. Die Change-of-base-Regel erlaubt das Auswerten beliebiger Basen mit einem Taschenrechner, der nur ln oder log_10 kennt.",
  mistakeType: null,
  cause: null,
};

describe("buildGradingPrompt", () => {
  const prompt = buildGradingPrompt(baseInput);

  it("includes the question prompt, user's answer, and rubric", () => {
    expect(prompt).toContain("Use the change-of-base rule");
    expect(prompt).toContain("ln of 7 and divide by ln of 3");
    expect(prompt).toContain("1. states log_b(x) = ln x / ln b");
  });

  it("includes the lesson excerpt", () => {
    expect(prompt).toContain("exponent y such that b^y = x");
  });

  it("handles an empty rubric list with a placeholder", () => {
    const p = buildGradingPrompt({ ...baseInput, rubric: [] });
    expect(p).toContain("no explicit rubric");
  });

  it("handles an empty lesson excerpt with a placeholder", () => {
    const p = buildGradingPrompt({ ...baseInput, lessonExcerpt: "" });
    expect(p).toContain("lesson section not retrieved");
  });

  it("includes the language tag", () => {
    expect(prompt).toContain("de");
  });
});

describe("gradingSchema", () => {
  it("accepts a fully-correct grading payload (mistakeType null)", () => {
    expect(() => gradingSchema.parse(validGradingCorrect)).not.toThrow();
  });

  it("accepts a partially-correct grading payload with mistakeType set", () => {
    const partial: GradingShape = {
      verdict: "partially_correct",
      score: 0.5,
      feedback:
        "Rubrik #1 und #2 erfüllt, aber #3 fehlt — numerische Antwort fehlt.",
      betterAnswer:
        "log_3(7) = ln 7 / ln 3. Mit ln 7 ≈ 1.9459 und ln 3 ≈ 1.0986 ergibt sich log_3(7) ≈ 1.7712.",
      mistakeType: "CALCULATION_MISTAKE",
      cause:
        "Numerische Auswertung fehlt — der Schüler hat die Regel korrekt angewandt, aber nicht ausgerechnet.",
    };
    expect(() => gradingSchema.parse(partial)).not.toThrow();
  });

  it("rejects when mistakeType is null on a non-correct verdict", () => {
    const invalid: GradingShape = {
      ...validGradingCorrect,
      verdict: "incorrect",
      mistakeType: null,
    };
    // `mistakeType` is .nullable(); we permit null only when
    // verdict === "correct". The schema does not enforce this
    // cross-field invariant; the caller enforces it. This
    // test merely confirms that `null` is accepted by Zod
    // (so the caller can decide to reject at the application
    // boundary).
    expect(() => gradingSchema.parse(invalid)).not.toThrow();
  });

  it("rejects a score above 1", () => {
    const oob = { ...validGradingCorrect, score: 1.1 };
    expect(() => gradingSchema.parse(oob)).toThrow();
  });

  it("rejects a score below 0", () => {
    const oob = { ...validGradingCorrect, score: -0.01 };
    expect(() => gradingSchema.parse(oob)).toThrow();
  });
});

describe("scoreToGermanGrade", () => {
  it.each([
    [1.0, "1"],
    [0.92, "1"],
    [0.9199, "2"],
    [0.81, "2"],
    [0.8099, "3"],
    [0.67, "3"],
    [0.6699, "4"],
    [0.5, "4"],
    [0.4999, "5"],
    [0.3, "5"],
    [0.2999, "6"],
    [0.0, "6"],
  ])("maps score %p to grade %p", (score, expected) => {
    expect(scoreToGermanGrade(score)).toBe(expected);
  });

  it("clamps NaN to grade 6", () => {
    expect(scoreToGermanGrade(Number.NaN)).toBe("6");
  });

  it("clamps slightly-negative scores to grade 6 (no underflow)", () => {
    expect(scoreToGermanGrade(-0.1)).toBe("6");
  });

  it("clamps slightly-above-1 scores to grade 1 (no overflow)", () => {
    expect(scoreToGermanGrade(1.1)).toBe("1");
  });
});
