import { describe, expect, it } from "vitest";

import {
  buildPracticeFromLessonPrompt,
  buildPracticeFromConversationPrompt,
  practiceItemsSchema,
  type PracticeItemsShape,
} from "@/lib/ai/prompts/practice";

/**
 * Vitest unit tests for the practice prompt + schema.
 * Per plan §9.
 */

const baseInput = {
  lessonContent:
    "A logarithm is the inverse of an exponential. log_2(8) = 3 because 2^3 = 8. Five rules: product, quotient, power, change of base, identity.",
  lessonSections: [
    {
      heading: "What a logarithm is",
      body: "Inverse of an exponential. Concretely log_2(8) = 3 because 2^3 = 8.",
    },
    {
      heading: "Five rules",
      body: "Product, quotient, power, change of base, identity. Worked examples per rule.",
    },
  ],
  topicTitle: "Logarithms",
  count: 5,
  gradeLevel: "11",
  language: "de",
};

const validItems: PracticeItemsShape = {
  items: [
    {
      prompt: "Explain in your own words what it means for a logarithm to be the inverse of an exponential.",
      expectedAnswer: "A logarithm asks for the exponent y such that b^y = x. log_b(x) = y. It is the inverse of exponentiation, which builds x from a base b and an exponent y. Concrete anchor: log_2(8) = 3 because 2^3 = 8.",
      skill: "Definition verstehen",
      rubric: [
        "states that log returns the exponent y for which b^y = x",
        "gives at least one concrete example such as log_2(8)=3 or log_10(1000)=3",
      ],
    },
    {
      prompt: "Use the change-of-base rule to evaluate log_3(7) without a calculator — show the substitution.",
      expectedAnswer: "log_3(7) = ln 7 / ln 3 (or log_3(7) = log 7 / log 3). Plug the values in: ln 7 ≈ 1.9459, ln 3 ≈ 1.0986, so log_3(7) ≈ 1.771. The change-of-base rule unlocks any base from a calculator that knows ln or log_10.",
      skill: "Change of base anwenden",
      rubric: [
        "states the rule log_b(x) = ln x / ln b or log x / log b",
        "substitutes 7 and 3 into the formula explicitly",
        "arrives at a numerical answer and notes the unrounded estimate",
      ],
    },
    {
      prompt: "Apply the product rule to simplify log_2(8a). Show the intermediate step.",
      expectedAnswer: "log_2(8a) = log_2(8) + log_2(a). Since log_2(8) = 3, this simplifies to 3 + log_2(a). The product rule splits a single log of a product into the sum of two separate logs.",
      skill: "Produktregel anwenden",
      rubric: [
        "cites the product rule log(xy) = log x + log y explicitly",
        "separates into log_2(8) and log_2(a)",
        "evaluates log_2(8) = 3 and gives the final simplified form",
      ],
    },
  ],
};

describe("buildPracticeFromLessonPrompt", () => {
  const prompt = buildPracticeFromLessonPrompt(baseInput);

  it("includes the topic title and the requested count", () => {
    expect(prompt).toContain("Logarithms");
    expect(prompt).toContain("5");
  });

  it("includes a per-section view in the source material", () => {
    expect(prompt).toContain("Section 1");
    expect(prompt).toContain("Section 2");
  });

  it("truncates oversized lesson content with a sentinel", () => {
    const big = "y".repeat(15_000);
    const p = buildPracticeFromLessonPrompt({ ...baseInput, lessonContent: big });
    expect(p).toContain("[…truncated for length…]");
    // The full content should NOT make it through; the
    // 12 000-char cap is enforced.
    expect(p).not.toContain("y".repeat(15_000));
  });

  it("includes the working language", () => {
    expect(prompt).toContain("de");
  });
});

describe("practiceItemsSchema", () => {
  it("accepts a valid 3-item bundle", () => {
    expect(() => practiceItemsSchema.parse(validItems)).not.toThrow();
  });

  it("rejects a 2-item bundle (below the minimum)", () => {
    const tooFew = {
      items: validItems.items.slice(0, 2),
    };
    expect(() => practiceItemsSchema.parse(tooFew)).toThrow();
  });

  it("rejects a 9-item bundle (above the maximum)", () => {
    const filler = validItems.items[0];
    const tooMany = {
      items: [
        ...validItems.items,
        filler,
        { ...filler, prompt: "x".repeat(400), expectedAnswer: "y".repeat(800), rubric: ["z".repeat(120)] },
        { ...filler, prompt: "p".repeat(400), expectedAnswer: "q".repeat(800), rubric: ["r".repeat(120)] },
        { ...filler, prompt: "s".repeat(400), expectedAnswer: "t".repeat(800), rubric: ["u".repeat(120)] },
        { ...filler, prompt: "v".repeat(400), expectedAnswer: "w".repeat(800), rubric: ["a".repeat(120)] },
        { ...filler, prompt: "b".repeat(400), expectedAnswer: "c".repeat(800), rubric: ["d".repeat(120)] },
      ],
    };
    expect(() => practiceItemsSchema.parse(tooMany)).toThrow();
  });

  it("rejects a rubric with zero bullets", () => {
    const zero = {
      items: [{ ...validItems.items[0], rubric: [] }],
    };
    expect(() => practiceItemsSchema.parse(zero)).toThrow();
  });

describe("buildPracticeFromConversationPrompt", () => {
  const baseConvInput = {
    turns: [
      { role: "user" as const, text: "What is a logarithm?" },
      { role: "assistant" as const, text: "A logarithm asks for the exponent y such that b^y = x. For example, log_2(8) = 3 because 2^3 = 8." },
      { role: "user" as const, text: "Can you give me a practice problem?" },
    ],
    topicTitle: "Logarithms",
    gradeLevel: "11",
    language: "de",
    count: 3,
  };

  it("includes topic title and count", () => {
    const p = buildPracticeFromConversationPrompt(baseConvInput);
    expect(p).toContain("Logarithms");
    expect(p).toContain("3");
  });

  it("does NOT include subject-specific guidance when subjectSlug is undefined", () => {
    const p = buildPracticeFromConversationPrompt({
      ...baseConvInput,
      subjectSlug: undefined,
    });
    expect(p).not.toContain("Subject-specific guidance for practice generation");
  });

  it("includes Mathematics-specific teaching rules when subjectSlug is math", () => {
    const p = buildPracticeFromConversationPrompt({
      ...baseConvInput,
      subjectSlug: "math",
    });
    expect(p).toContain("Subject-specific guidance for practice generation");
    expect(p).toContain("Mathematics-specific teaching rules");
  });

  it("includes Language-specific teaching rules when subjectSlug is english", () => {
    const p = buildPracticeFromConversationPrompt({
      ...baseConvInput,
      subjectSlug: "english",
    });
    expect(p).toContain("Subject-specific guidance for practice generation");
    expect(p).toContain("Language-specific teaching rules");
  });

  it("includes student and tutor turns in the prompt", () => {
    const p = buildPracticeFromConversationPrompt(baseConvInput);
    expect(p).toContain("Student:");
    expect(p).toContain("Tutor:");
    expect(p).toContain("What is a logarithm?");
    expect(p).toContain("log_2(8) = 3");
  });

  it("includes the language", () => {
    const p = buildPracticeFromConversationPrompt(baseConvInput);
    expect(p).toContain("de");
  });
});

  it("rejects a rubric with five bullets", () => {
    const five = {
      items: [
        {
          ...validItems.items[0],
          rubric: [
            "first bullet that is long enough",
            "second bullet that is long enough",
            "third bullet that is long enough",
            "fourth bullet that is long enough",
            "fifth bullet that is long enough",
          ],
        },
      ],
    };
    expect(() => practiceItemsSchema.parse(five)).toThrow();
  });
});
