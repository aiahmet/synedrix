import { describe, expect, it } from "vitest";

import {
  buildCourseLessonPrompt,
  lessonSchema,
  type LessonShape,
} from "@/lib/ai/prompts/lesson";

/**
 * Vitest unit tests for the lesson prompt + schema.
 * Per plan §9: prompt assertions (subject/topic/brief/
 * gradeLevel present) + Zod schema positive + negative
 * fixtures + hard-cap on body length.
 */

const baseInput = {
  subjectTitle: "Mathematics",
  subjectSlug: "math",
  topicTitle: "Logarithms",
  brief: "Cover the change-of-base rule and one worked example.",
  objectives: ["Define log as inverse of exponential.", "Apply change-of-base rule."],
  gradeLevel: "11",
  difficulty: "MEDIUM" as const,
  depth: "standard" as const,
  language: "de",
};

const validLesson: LessonShape = {
  sections: [
    { heading: "What a logarithm is", body: "A logarithm is the inverse of an exponential — the exponent y such that b^y = x. Concrete anchors: log_10(1000) = 3, log_5(125) = 3, log_3(1/27) = -3. Read it as the power that makes x." },
    { heading: "The five rules you actually need", body: "Five rules cover nearly every logarithm you will see. 1. Product: log(xy) = log x + log y. 2. Quotient: log(x/y) = log x - log y. 3. Power: log(x^k) = k log x. 4. Change of base: log_b(x) = ln x / ln b. 5. Identity: log_b(1) = 0 and log_b(b) = 1. Worked example: log_2(8a) = log_2(8) + log_2(a) = 3 + log_2(a)." },
    { heading: "Where logs meet upper-secondary", body: "Logs become powerful when paired with calculus. Three extensions: derivative of ln x is 1/x; chain rule gives d/dx[ln f(x)] = f'(x)/f(x); log scales appear in decibels and bit depth. When an exam hands you log_3(7), convert to ln 7 / ln 3 before evaluating — calculators only know ln and log_10." },
  ],
  glossary: [
    { term: "Logarithmus", definition: "Inverse der Exponentialfunktion: log_b(x) ist der Exponent y, für den b^y = x gilt." },
    { term: "Change of base", definition: "Regel, mit der man log_b(x) als ln x / ln b (oder log x / log b) ausdrückt." },
  ],
};

describe("buildCourseLessonPrompt", () => {
  const prompt = buildCourseLessonPrompt(baseInput);

  it("includes the subject title and topic title", () => {
    expect(prompt).toContain("Mathematics");
    expect(prompt).toContain("Logarithms");
  });

  it("includes the student's brief verbatim", () => {
    // The fixture's `brief` is "Cover the change-of-base..." with a
    // lowercase "c" after "Cover the ". Assert the substring that
    // is verbatim present in the brief (and therefore in the
    // generated prompt), rather than the title-cased form which
    // never substring-matches.
    expect(prompt).toContain("change-of-base rule and one worked example");
  });

  it("includes the grade level tag", () => {
    expect(prompt).toContain('"11"');
  });

  it("includes the working language", () => {
    expect(prompt).toContain("de");
  });

  it("renders the depth-specific guidance", () => {
    // simple/standard/rigorous each surface distinct guidance.
    const standard = buildCourseLessonPrompt({ ...baseInput, depth: "standard" });
    expect(standard).toContain("one concrete example per section");
    const simple = buildCourseLessonPrompt({ ...baseInput, depth: "simple" });
    expect(simple).toContain("everyday analogies");
    const rigorous = buildCourseLessonPrompt({ ...baseInput, depth: "rigorous" });
    expect(rigorous).toContain("exam-grade exposition");
  });

  it("serializes the objectives list numbered", () => {
    expect(prompt).toContain("1. Define log as inverse of exponential");
    expect(prompt).toContain("2. Apply change-of-base rule");
  });

  it("falls back to a placeholder when no objectives are supplied", () => {
    const p = buildCourseLessonPrompt({ ...baseInput, objectives: [] });
    expect(p).toContain("derive from the brief below");
  });
});

describe("lessonSchema", () => {
  it("accepts a valid lesson payload", () => {
    expect(() => lessonSchema.parse(validLesson)).not.toThrow();
  });

  it("rejects fewer than 3 sections", () => {
    const tooFew = {
      ...validLesson,
      sections: validLesson.sections.slice(0, 2),
    };
    expect(() => lessonSchema.parse(tooFew)).toThrow();
  });

  it("rejects more than 12 sections", () => {
    const tooMany: LessonShape = {
      ...validLesson,
      sections: [
        ...validLesson.sections,
        { heading: "Section 4", body: "Add a fourth section so we have valid base content for the rejection test below — extended to satisfy min-body length." },
        { heading: "Section 5", body: "Add a fourth section so we have valid base content for the rejection test below — extended to satisfy min-body length." },
        { heading: "Section 6", body: "Add a fourth section so we have valid base content for the rejection test below — extended to satisfy min-body length." },
        { heading: "Section 7", body: "Add a fourth section so we have valid base content for the rejection test below — extended to satisfy min-body length." },
        { heading: "Section 8", body: "Add a fourth section so we have valid base content for the rejection test below — extended to satisfy min-body length." },
        { heading: "Section 9", body: "Add a fourth section so we have valid base content for the rejection test below — extended to satisfy min-body length." },
        { heading: "Section 10", body: "Add a fourth section so we have valid base content for the rejection test below — extended to satisfy min-body length." },
        { heading: "Section 11", body: "Add a fourth section so we have valid base content for the rejection test below — extended to satisfy min-body length." },
        { heading: "Section 12", body: "Add a fourth section so we have valid base content for the rejection test below — extended to satisfy min-body length." },
        { heading: "Section 13", body: "Thirteenth section makes the array exceed the max-12 cap so the schema reject path fires when validating the fixture." },
      ],
    };
    expect(() => lessonSchema.parse(tooMany)).toThrow();
  });

  it("hard-caps body length at 4000 chars", () => {
    const tooLong = {
      ...validLesson,
      sections: [
        {
          heading: "Too long",
          body: "x".repeat(4001),
        },
        ...validLesson.sections.slice(1),
      ],
    };
    expect(() => lessonSchema.parse(tooLong)).toThrow();
  });

  it("rejects a body shorter than 20 chars", () => {
    const tooShort = {
      ...validLesson,
      sections: [
        { heading: "Too short", body: "tiny" },
        ...validLesson.sections.slice(1),
      ],
    };
    expect(() => lessonSchema.parse(tooShort)).toThrow();
  });
});
