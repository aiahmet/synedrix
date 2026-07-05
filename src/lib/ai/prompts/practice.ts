import { z } from "zod";

/**
 * practice.ts.
 *
 * Schema + prompt builder for the AI-generated
 * text-only practice items derived from a lesson
 * (`generatePracticeFromLesson` task). Consumed by
 * `startLessonPractice` in `convex/practice.ts`.
 *
 * The output is small (3–8 items) and atomic. Per plan
 * decision D9, we use `generateObject` (not streaming)
 * so the entire validation surface succeeds or fails
 * together — no half-delivered practice sets.
 *
 * Each item is an open-prose prompt with a model-
 * authored expected answer, a skill tag, and a 1–4
 * bullet rubric the grader consumes downstream.
 */

export const practiceItemSchema = z.object({
  prompt: z.string().min(10).max(400),
  expectedAnswer: z.string().min(10).max(800),
  skill: z.string().min(1).max(40),
  rubric: z.array(z.string().min(2).max(120)).min(1).max(4),
});

/**
 * Top-level schema for the AI-generated practice bundle.
 *
 * `.strict()` rejects unknown LLM-emitted keys so a
 * future model with a new field — say `{"difficulty":
 * "HARD"}` — fails validation cleanly instead of being
 * silently dropped on the way to `startLessonPractice`.
 * The downstream `startLessonPractice` mutation reads
 * ONLY `items`, so any extra field would be silent
 * storage bloat at minimum and a schema drift
 * fingerprint at worst. Transitioning to `.passthrough()`
 * here is the right move only when the consumer
 * contract is finalized; until then `.strict()` is the
 * safer default.
 */
export const practiceItemsSchema = z.object({
  items: z.array(practiceItemSchema).min(3).max(8),
}).strict();

export type PracticeItemsShape = z.infer<typeof practiceItemsSchema>;

export interface PracticeFromLessonPromptInput {
  /** Joined sections — what the student just read. */
  readonly lessonContent: string;
  /** Per-section headings + bodies. Used to keep prompts anchored. */
  readonly lessonSections: ReadonlyArray<{
    readonly heading: string;
    readonly body: string;
  }>;
  readonly topicTitle: string;
  /** Item count requested by the student (capped 3–8). */
  readonly count: number;
  readonly gradeLevel: string | null;
  readonly language: string;
}

/**
 * Prompt builder. We pass the full lesson content plus
 * the per-section view so the model can quote sections
 * directly into prompts ("Explain the role of X as
 * described in `Section 2`…"), which makes grading
 * more reliable downstream.
 */
export function buildPracticeFromLessonPrompt(
  g: PracticeFromLessonPromptInput
): string {
  const sectionList = g.lessonSections
    .map((s, i) => `Section ${i + 1} — "${s.heading}"\n${s.body}`)
    .join("\n\n");

  // Cap what we send in. A 5k-word lesson does not need
  // every section in the prompt; the model overgenerates
  // when fed too much. We send the full joined text up to
  // a hard ceiling and prefer the structured per-section
  // view when shorter.
  const HARD_CAP = 12_000;
  const trimmed =
    g.lessonContent.length > HARD_CAP
      ? `${g.lessonContent.slice(0, HARD_CAP)}\n\n[…truncated for length…]`
      : g.lessonContent;

  return `You are the Synedrix practice generator. The student is a ${g.gradeLevel ?? "Gymnasium"}-grade student working in ${g.language}. They just read a lesson on "${g.topicTitle}" and need ${g.count} open-prose practice questions that test understanding at the same depth the lesson was written.

Lesson content:
"""
${trimmed}
"""

Per-section view:
${sectionList.length > 0 ? sectionList : "(none — pure prose)"}

Output rules:
- Return ONE structured object: \`{ items: [...] }\`.
- ${g.count} items. Stay between 3 and 8.
- Each item has:
    - \`prompt\`: 10–400 chars. A question that elicits an open-prose answer (no multiple-choice, no numeric fill-in-the-blank). Reference a section of the lesson by name when relevant.
    - \`expectedAnswer\`: 10–800 chars. What a strong answer says. Grounded in the lesson, not invented.
    - \`skill\`: 1–40 chars. The skill the question tests (e.g. "Erzählperspektive erkennen").
    - \`rubric\`: 1–4 bullets (2–120 chars each). Each bullet is a check the grader uses — "states that perspective shifts in line X", "uses the German subjunctive trigger bien que".
- Mix skills across items. Do not stack 4 items on the same skill.
- Do not include the lesson titles verbatim as prompts. The student should have to apply the lesson, not copy it.
- Return only the structured object, no preamble.
`;
}
