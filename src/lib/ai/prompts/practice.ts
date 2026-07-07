import { z } from "zod";
import { getSubjectBehavior } from "@/lib/ai/subjectBehaviors";


export const practiceItemSchema = z.object({
  prompt: z.string().min(10).max(400),
  expectedAnswer: z.string().min(10).max(800),
  skill: z.string().min(1).max(40),
  rubric: z.array(z.string().min(2).max(120)).min(1).max(4),
});

export const practiceItemsSchema = z.object({
  items: z.array(practiceItemSchema).min(3).max(8),
}).strict();

export type PracticeItemsShape = z.infer<typeof practiceItemsSchema>;

export interface PracticeFromLessonPromptInput {
  readonly lessonContent: string;
  readonly lessonSections: ReadonlyArray<{
    readonly heading: string;
    readonly body: string;
  }>;
  readonly topicTitle: string;
  readonly subjectSlug?: string;
  readonly count: number;
  readonly gradeLevel: string | null;
  readonly language: string;
}

export function buildPracticeFromLessonPrompt(
  g: PracticeFromLessonPromptInput
): string {
  const sectionList = g.lessonSections
    .map((s, i) => `Section ${i + 1} — "${s.heading}"\n${s.body}`)
    .join("\n\n");

  const HARD_CAP = 12_000;
  const trimmed =
    g.lessonContent.length > HARD_CAP
      ? `${g.lessonContent.slice(0, HARD_CAP)}\n\n[…truncated for length…]`
      : g.lessonContent;

  return `You are the Synedrix practice generator. The student is a ${g.gradeLevel ?? "Gymnasium"}-grade student working in ${g.language}. They just read a lesson on "${g.topicTitle}" and need ${g.count} open-prose practice questions that test understanding at the same depth the lesson was written.

${g.subjectSlug ? `Subject-specific guidance: ${getSubjectBehavior(g.subjectSlug).gradingEmphasis}\n` : ""}Lesson content:
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

export interface ConversationTurn {
  readonly role: "user" | "assistant";
  readonly text: string;
}

export interface PracticeFromConversationPromptInput {
  readonly turns: ReadonlyArray<ConversationTurn>;
  readonly topicTitle: string;
  readonly gradeLevel: string | null;
  readonly language: string;
  readonly count: number;
  readonly subjectSlug?: string;
}

function truncateSubjectInstruction(instruction: string, maxLen: number): string {
  if (instruction.length <= maxLen) return instruction;
  const truncated = instruction.slice(0, maxLen);
  const lastNewline = truncated.lastIndexOf("\n");
  if (lastNewline > maxLen * 0.5) return truncated.slice(0, lastNewline);
  return truncated + "…";
}

export function buildPracticeFromConversationPrompt(
  g: PracticeFromConversationPromptInput
): string {
  const PER_TURN_CAP = 1_500;
  const transcript = g.turns
    .map((t) => {
      const speaker = t.role === "user" ? "Student" : "Tutor";
      const text =
        t.text.length > PER_TURN_CAP
          ? `${t.text.slice(0, PER_TURN_CAP)}\n[…truncated…]`
          : t.text;
      return `${speaker}: ${text}`;
    })
    .join("\n\n");

  const subjectGuidance =
    g.subjectSlug
      ? `\nSubject-specific guidance for practice generation: ${truncateSubjectInstruction(getSubjectBehavior(g.subjectSlug).tutorInstructions, 800)}\n`
      : "";

  return `You are the Synedrix practice generator. The student is a ${g.gradeLevel ?? "Gymnasium"}-grade student working in ${g.language}. They have been studying "${g.topicTitle}" with the tutor in a live chat session and now need ${g.count} practice questions to test what they just learned. The questions must be derived from the conversation, not from invented material.${subjectGuidance}

Conversation transcript (most recent turns):
"""
${transcript}
"""

Output rules:
- Return ONE structured object: \`{ items: [...] }\`.
- ${g.count} items. Stay between 3 and 8.
- Each item has:
    - \`prompt\`: 10–400 chars. Open-prose question that elicits a written answer. Reference a specific claim or formula from the conversation when relevant — do not invent context the student never saw.
    - \`expectedAnswer\`: 10–800 chars. What a strong answer says. Grounded in what the tutor actually said in the transcript, not invented.
    - \`skill\`: 1–40 chars. The skill the question tests (e.g. "Sign-error detection", "Potenzregel anwenden").
    - \`rubric\`: 1–4 bullets (2–120 chars each). Each bullet is a check the grader uses — "names the rule", "applies it to the example without a sign error".
- Mix skills across items. Do not stack 4 items on the same skill.
- Do not include the tutor's exact wording verbatim in the prompts — the student should have to apply what they heard, not copy it.

Thin transcript fallback: if the transcript is too short or too thin to ground ${g.count} unique, non-invented questions (e.g. fewer than 2 distinct turns OR fewer than 200 chars of assistant content), do NOT pad with invented material. Return the best grounded subset you can produce AND the route handler will treat Zod rejection as a 502 so the system knows the LLM refused rather than hallucinated.
- Return only the structured object, no preamble.
`;
}
