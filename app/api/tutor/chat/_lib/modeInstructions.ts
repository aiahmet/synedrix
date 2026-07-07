/**
 * Mode-specific instruction builders for the tutor route.
 *
 * When a special mode (exam, compare, summarize) is active, the corresponding
 * instructions are appended to the system prompt to alter the model's behaviour.
 *
 * Each function reproduces the system prompt text from the original standalone
 * route handler verbatim, parameterizing dynamic values via the context object.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExamContext {
  subjectTitle: string;
  topicTitle?: string | null;
  mastery: number;
  topicDifficulty?: string | null;
  confidence: number;
  topicObjectives: string[];
  recentMistakes: Array<{ mistakeType: string; question: string }>;
  relatedTopics: Array<{ title: string; mastery: number }>;
  history: Array<{ role: string; content: string }>;
  profile?: {
    grade: number;
    curriculumName: string;
    communicationStyle: string;
  } | null;
}

export interface CompareContext {
  subjectTitle: string;
  currentTopic: {
    title: string;
    difficulty: string;
    mastery: number;
    objectives: string[];
  };
  siblingTopics: Array<{
    title: string;
    difficulties: string;
    mastery: number;
  }>;
  history: Array<{ role: string; content: string }>;
  profile?: {
    grade: number;
    curriculumName: string;
  } | null;
}

export interface SummarizeContext {
  subjectTitle: string;
  topicTitle?: string | null;
  messageCount: number;
  keyObjectives: string[];
  recentMistakes: Array<{
    mistakeType: string;
    question: string;
    userAnswer: string;
    correctAnswer: string;
  }>;
  history: Array<{ role: string; content: string }>;
  profile?: {
    grade: number;
    curriculumName: string;
    preferredExplanationStyle: string;
  } | null;
}

// ---------------------------------------------------------------------------
// Exam instructions
// ---------------------------------------------------------------------------

/**
 * Build the exam-mode system-prompt block.
 */
export function buildExamInstructions(
  context: ExamContext,
  taskCount: number = 4,
): string {
  const subjectTitle = context.subjectTitle;
  const topicTitle = context.topicTitle;
  const masteryPct = Math.round(context.mastery * 100);
  const topicDifficulty = context.topicDifficulty ?? "standard";
  const confidencePct = Math.round(context.confidence * 100);

  const objectivesBlock =
    context.topicObjectives.length > 0
      ? context.topicObjectives.map((o) => `- ${o}`).join("\n")
      : "(no objectives recorded)";

  const mistakesBlock =
    context.recentMistakes.length > 0
      ? context.recentMistakes
          .map((m) => `- ${m.mistakeType}: ${m.question}`)
          .join("\n")
      : "(no recent mistakes)";

  const relatedBlock =
    context.relatedTopics.length > 0
      ? context.relatedTopics
          .map(
            (t) =>
              `- ${t.title} (mastery: ${Math.round(t.mastery * 100)}%)`,
          )
          .join("\n")
      : "(no related topics)";

  const historyBlock =
    context.history.length > 0
      ? context.history
          .map((m) => `[${m.role}]: ${m.content.slice(0, 400)}`)
          .join("\n\n")
      : "(no conversation history)";

  const profileBlock = context.profile
    ? `Student profile: grade ${context.profile.grade}, ${context.profile.curriculumName}. Communication: ${context.profile.communicationStyle}.`
    : "";

  return `You are an exam preparation tutor for a German Gymnasium student studying ${subjectTitle}${topicTitle ? ` — ${topicTitle}` : ""}.

Generate ${taskCount} exam-style tasks with markdown formatted answer keys. Tasks should be authentic to German Gymnasium Oberstufe (grade 11-12) exams.

Current mastery: ${masteryPct}%.
Topic difficulty: ${topicDifficulty}.
Confidence: ${confidencePct}%.

Learning objectives:
${objectivesBlock}

Recent mistakes (focus these areas):
${mistakesBlock}

Related topics the student knows:
${relatedBlock}

Conversation context:
${historyBlock}

${profileBlock}

Output format — each task must use this exact structure:
## Task 1: [short label]
**Type:** [multiple-choice | short-answer | problem-solving | essay-outline]
**Time:** [estimated minutes]
**Points:** [estimated points out of 15]

[Task prompt — 1-3 sentences]

**Answer key:**
[Correct answer, marking scheme, and 1-sentence explanation]

---
(repeat for all tasks)

After all tasks, add:
## Exam summary
- **Total points:** [sum]
- **Total time:** [sum minutes]
- **Key focus areas:** [1-2 sentences about what this exam tests]

No introductory preamble. Start directly with ## Task 1.`;
}

// ---------------------------------------------------------------------------
// Compare instructions
// ---------------------------------------------------------------------------

/**
 * Build the compare-mode system-prompt block.
 */
export function buildCompareInstructions(context: CompareContext): string {
  const subjectTitle = context.subjectTitle;
  const topicTag = context.currentTopic.title;
  const topicDifficulty = context.currentTopic.difficulty;
  const topicMastery = Math.round(context.currentTopic.mastery * 100);

  const objectivesBlock =
    context.currentTopic.objectives.length > 0
      ? context.currentTopic.objectives.map((o) => `- ${o}`).join("\n")
      : "(no objectives recorded)";

  const siblingsBlock =
    context.siblingTopics.length > 0
      ? context.siblingTopics
          .map(
            (t) =>
              `- ${t.title} (difficulty: ${t.difficulties}, mastery: ${Math.round(t.mastery * 100)}%)`,
          )
          .join("\n")
      : "(no sibling topics in this chapter)";

  const historyBlock =
    context.history.length > 0
      ? context.history
          .map((m) => `[${m.role}]: ${m.content.slice(0, 400)}`)
          .join("\n\n")
      : "(no conversation history)";

  const profileBlock = context.profile
    ? `Student profile: grade ${context.profile.grade}, ${context.profile.curriculumName}.`
    : "";

  return `You are a comparison tutor for a German Gymnasium student studying ${subjectTitle}.

The student is currently studying "${topicTag}" (difficulty: ${topicDifficulty}, mastery: ${topicMastery}%).
They want you to compare it with similar concepts from the same chapter, so they can understand the differences and know when to apply which concept.

Learning objectives for "${topicTag}":
${objectivesBlock}

Sibling topics in this chapter (for comparison):
${siblingsBlock}

${profileBlock}

Thread context:
${historyBlock}

Your task: compare "${topicTag}" with the most relevant sibling topic(s). Use this structure:

## Comparing [Concept A] and [Concept B]

### What they share
[2-3 sentences about common ground — the underlying principle or domain]

### Key differences
| Aspect | ${topicTag} | [Sibling Topic] |
|---|---|---|
| Definition | ... | ... |
| When to use | ... | ... |
| Key formula/rule | ... | ... |
| Common mistake | ... | ... |

### Quick decision guide
- Use **${topicTag}** when...
- Use **[Sibling Topic]** when...

### Study tip
[1 sentence about how to practice telling them apart]

No introductory preamble. No closing remarks. Start directly with the comparison content.`;
}

// ---------------------------------------------------------------------------
// Summarize instructions
// ---------------------------------------------------------------------------

/**
 * Build the summarize-mode system-prompt block.
 *
 * @param mode - One of `"cheat_sheet"`, `"revision_notes"`, or omitted (defaults
 *   to summary paragraph). Maps to the modeInstruction embedded in the prompt.
 */
export function buildSummarizeInstructions(
  context: SummarizeContext,
  mode?: string,
): string {
  const subjectTitle = context.subjectTitle;
  const topicTitle = context.topicTitle;

  const modeInstruction =
    mode === "cheat_sheet"
      ? `Produce a compact one-page cheat sheet for revision. Include key formulas, rules, definitions, and a quick-reference section. Format as markdown with clear headings. Keep it scannable.`
      : mode === "revision_notes"
        ? `Produce structured revision notes. Group concepts by theme. Include worked examples and common pitfalls. Use clear markdown headings.`
        : `Produce a concise 3-4 paragraph summary of the key concepts covered in this thread. Highlight the most important takeaways for revision.`;

  const objectivesBlock =
    context.keyObjectives.length > 0
      ? context.keyObjectives.map((o) => `- ${o}`).join("\n")
      : "(no objectives recorded)";

  const mistakesBlock =
    context.recentMistakes.length > 0
      ? context.recentMistakes
          .map(
            (m) =>
              `- ${m.mistakeType}: ${m.question} (answered: ${m.userAnswer}, correct: ${m.correctAnswer})`,
          )
          .join("\n")
      : "(no recent mistakes)";

  const historyBlock =
    context.history.length > 0
      ? context.history
          .map((m) => `[${m.role}]: ${m.content.slice(0, 500)}`)
          .join("\n\n")
      : "(no conversation history)";

  const profileBlock = context.profile
    ? `Student profile: grade ${context.profile.grade}, ${context.profile.curriculumName}. Preferred explanation: ${context.profile.preferredExplanationStyle}.`
    : "";

  return `You are a revision tutor for a German Gymnasium student studying ${subjectTitle}${topicTitle ? ` — ${topicTitle}` : ""}.

${modeInstruction}

Thread context: ${context.messageCount} messages exchanged. The student wants a revision-ready summary.

Learning objectives:
${objectivesBlock}

Recent mistakes to address:
${mistakesBlock}

Conversation history (summarize from this):
${historyBlock}

${profileBlock}

Output pure markdown — no intro preamble, no closing remarks, no "here is your summary" wrapper. Start directly with the content. Use clear headings (##), bold key terms, and compact paragraphs. Between major sections, insert a horizontal rule (---). Include at the end a 1-2 line "Key takeaway" callout in bold.`;
}
