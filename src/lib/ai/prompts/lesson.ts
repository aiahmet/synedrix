import { z } from "zod";

/**
 * lesson.ts.
 *
 * Schema + prompt builder for the AI-generated whole-topic
 * text (`generateCourseLesson` task). Used by both the
 * streaming route handler `/api/topics/lesson/stream` and
 * `regenerateTopicLesson` in `convex/topics.ts`.
 *
 * The lesson text is large (1–3k words). It is streamed
 * live to the client via Vercel AI SDK's `streamObject`
 * with the schema below as the validation surface —
 * AGENTS.md requires `streamObject` + Zod for structured
 * streaming output.
 *
 * Output shape:
 *  - `sections`:    3–12 `(heading, body)` pairs, in render order.
 *  - `glossary`:    up to 30 short `(term, definition)` pairs.
 * `body` is capped to 4000 chars (~one substantial
 * paragraph) so a section does not balloon into a
 * chapter. Total word count is computed from the
 * joined content when the lesson row is written.
 */

export const lessonSectionSchema = z.object({
  heading: z.string().min(1).max(80),
  body: z.string().min(20).max(4000),
});

export const lessonGlossaryEntrySchema = z.object({
  term: z.string().min(1).max(40),
  definition: z.string().min(5).max(300),
});

/**
 * Top-level schema for the AI-generated lesson object.
 *
 * Declared `.strict()` so unknown fields from the LLM
 * response FAIL THE validate step rather than silently
 * passing through to downstream renderers. The two
 * downstream consumers (`TopicWorkedExamples` and the
 * `VocabularyDeck` renderer in
 * `components/dashboard/`) both index by `sections` and
 * `glossary` only — a phantom extra `{"key_points":
 * "..."}` field from a model drift would be invisible in
 * tests but would inflate every lesson's serialized
 * size in Convex storage.
 */
export const lessonSchema = z.object({
  sections: z.array(lessonSectionSchema).min(3).max(12),
  glossary: z.array(lessonGlossaryEntrySchema).max(30),
}).strict();

/** Inferred type — the shape `streamObject` validates against. */
export type LessonShape = z.infer<typeof lessonSchema>;

export type LessonDepth = "simple" | "standard" | "rigorous";

export interface CourseLessonPromptInput {
  readonly subjectTitle: string;
  readonly subjectSlug: string;
  readonly topicTitle: string;
  /** Short free-text description the student typed into the form. */
  readonly brief: string;
  readonly objectives: readonly string[];
  readonly gradeLevel: string | null;
  readonly difficulty: "EASY" | "MEDIUM" | "HARD";
  readonly depth: LessonDepth;
  /** Always "de" for the German-Gymnasium target user. */
  readonly language: string;
}

/**
 * Single system-prompt builder. The route handler and the
 * Convex mutation both call this so the prompt text is
 * canonical. Adding depth-related phrasing? One edit point.
 */
export function buildCourseLessonPrompt(g: CourseLessonPromptInput): string {
  const objectivesBlock =
    g.objectives.length > 0
      ? g.objectives.map((o, i) => `  ${i + 1}. ${o}`).join("\n")
      : "  (no formal objectives — derive from the brief below)";

  const depthGuidance =
    g.depth === "simple"
      ? "Use everyday analogies, short paragraphs, and avoid jargon. A 10th-grader on their first read should be able to follow every sentence."
      : g.depth === "standard"
        ? "Balanced prose with one concrete example per section. Definition + method + a worked sample is the default shape per section."
        : "Tight, exam-grade exposition. State the result, prove or justify it, surface an edge case or two, and finish with the model's limit.";

  return `You are the Synedrix course lesson generator. The student is a German Gymnasium pupil ("${g.gradeLevel ?? "Grade level unspecified"}"), working language ${g.language}, working on subject "${g.subjectTitle}".

Topic: ${g.topicTitle}
Difficulty: ${g.difficulty}
Requested depth: ${g.depth}

Student's brief:
"""
${g.brief.trim()}
"""

Objectives the student wants to master:
${objectivesBlock}

Depth target:
${depthGuidance}

Output rules:
- Return ONE structured object: \`{ sections: [...], glossary: [...] }\`.
- 4–8 sections is the sweet spot. Stay between 3 and 12.
- Each section has a short \`heading\` (≤ 80 chars) and a \`body\` of prose (20–4000 chars). One to three substantial paragraphs is the sweet spot.
- The body is prose with light formatting allowed. Use whichever of these fits the content:
    - Inline math: \`\\( ... \\)\` (e.g. \`\\(x^2 + y^2 = 1\\)\`).
    - Block math on its own line: \`\\[ ... \\]\` (e.g. \`\\[ \\\\frac{a}{b} \\\\]\`).
    - Bold for emphasis: \`**term**\`.
    - Italic for nuance or technical terms: \`*term*\`.
    - Inline code for short identifiers or commands: \`variable_name\`.
  Do NOT use bullet lists, code fences, or headings inside the body — those break the rendered lesson page layout. Single \`$\` is NEVER math; if you want to write a price, write it verbatim so the parser does not mistake it for inline math.
- The \`glossary\` has up to 30 short entries. Each term is ≤ 40 chars; each definition is 5–300 chars. Cover domain vocabulary the body actually uses.
- Do not invent citations, dates, or numerical constants the brief did not supply. If the brief is under-specified, say so explicitly inside the section body and carry on.
- Work entirely in ${g.language}. Translate example sentences and natural-language phrases into ${g.language}.
- Do not include any chat preamble. Output only the structured object.
`;
}
