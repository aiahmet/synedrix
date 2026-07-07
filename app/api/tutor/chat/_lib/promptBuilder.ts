import { buildChatSystemPrompt } from "@/lib/ai/prompts/chat";
import { buildStrategyPromptBlock } from "@/convex/tutorStrategy";
import type { StrategyState } from "@/lib/ai/types/tutor";
import type { ChatContext } from "./contextLoader";
import {
  buildExamInstructions,
  buildCompareInstructions,
  buildSummarizeInstructions,
} from "./modeInstructions";

/**
 * Assembles the full system prompt for the tutor chat route.
 * Combines the grounded system prompt (context, profile, memory)
 * with the dynamic strategy block appended at the end.
 *
 * Strategy-block ownership (Phase 4 §6.1): the strategy block is
 * the SINGLE source of truth for the passive-dismissal nudge.
 * The nudge is computed here from `strat` and forwarded to
 * `buildStrategyPromptBlock` via the `latestChoice` option.
 */
export function buildFullSystemPrompt(params: {
  context: ChatContext & {
    tutorProfile: {
      readonly id: string;
      readonly userId: string;
      readonly grade: number;
      readonly curriculum:
        | "german_gymnasium"
        | "ib"
        | "a_level"
        | "ap"
        | "other";
      readonly curriculumName: string;
      readonly curriculumFreeform: string | null;
      readonly enrolledSubjectIds: ReadonlyArray<string>;
      readonly weakestSubjectIds: ReadonlyArray<string>;
      readonly preferredExplanationStyle:
        | "simple"
        | "standard"
        | "rigorous"
        | "examples"
        | "step_by_step"
        | "visual";
      readonly feedbackStyle:
        | "immediate"
        | "hint_first"
        | "socratic"
        | "patient";
      readonly learningPreference:
        | "practice"
        | "reading"
        | "visual"
        | "teaching"
        | "mixed";
      readonly biggestObstacle:
        | "procrastination"
        | "forgetfulness"
        | "exam_panic"
        | "no_starting_point"
        | "distraction"
        | "no_improvement";
      readonly primaryGoal:
        | "pass_classes"
        | "improve_grades"
        | "top_of_class"
        | "university_prep"
        | "master_everything";
      readonly communicationStyle:
        | "teacher"
        | "private_tutor"
        | "coach"
        | "challenge";
      readonly completedAt: number;
    } | null;
  };
  strat: StrategyState | null;
  memoryChronicle?: string;
  sessionId?: string;
  lessonContext?: {
    readonly topicTitle: string;
    readonly lessonSummary: string;
    readonly grade: "1" | "2" | "3" | "4" | "5" | "6";
    readonly items: ReadonlyArray<{
      readonly prompt: string;
      readonly userAnswer: string;
      readonly verdict: "correct" | "partially_correct" | "incorrect";
      readonly score: number;
      readonly feedback: string;
      readonly betterAnswer: string;
    }>;
    readonly mistakes: ReadonlyArray<{
      readonly type: string;
      readonly cause: string;
    }>;
    readonly focusItemId?: string;
  };
  mode?: "default" | "summarize" | "exam" | "compare";
  modeOptions?: { taskCount?: number };
}): string {
  const { context, strat, memoryChronicle, sessionId, lessonContext } = params;

  // Phase 4 §6.1 — compute the passive-dismissal nudge from
  // strategy state signals so it can be forwarded to the
  // strategy block (the SINGLE source of truth for the nudge).
  let activeLearningNudge:
    | {
        assistantMessageId: string;
        responseTimeMs: number;
        pickedCorrect: boolean;
      }
    | undefined;
  if (strat && strat.latestChoiceMessageId !== null) {
    const ms = strat.latestChoiceResponseTimeMs;
    if (typeof ms === "number") {
      const pickedCorrect = strat.latestChoicePickedCorrect ?? false;
      if (
        strat.latestChoiceMessageId &&
        (ms < 1000 || (ms < 2000 && pickedCorrect === false))
      ) {
        activeLearningNudge = {
          assistantMessageId: strat.latestChoiceMessageId,
          responseTimeMs: ms,
          pickedCorrect,
        };
      }
    }
  }

  // Build the grounded system prompt.
  const systemPrompt = buildChatSystemPrompt({
    subjectTitle: context.subject.title,
    subjectSlug: context.subject.slug,
    topicTitle: context.topic?.title ?? null,
    topicSlug: context.topic?.slug ?? null,
    objectives: context.topic?.objectives ?? [],
    difficulty: context.topic?.difficulty ?? null,
    gradeLevel: context.topic?.gradeLevel ?? null,
    language: deriveWorkingLanguage(context.tutorProfile ?? null),
    mastery: context.mastery,
    confidence: context.confidence,
    recentMistakes: context.recentMistakes,
    ...(memoryChronicle ? { memoryChronicle } : {}),
    ...(context.tutorProfile
      ? {
          tutorProfile: {
            grade: context.tutorProfile.grade,
            curriculum: context.tutorProfile.curriculum,
            curriculumName: context.tutorProfile.curriculumName,
            curriculumFreeform: context.tutorProfile.curriculumFreeform ?? null,
            enrolledSubjectIds: context.tutorProfile.enrolledSubjectIds,
            weakestSubjectIds: context.tutorProfile.weakestSubjectIds,
            preferredExplanationStyle:
              context.tutorProfile.preferredExplanationStyle,
            feedbackStyle: context.tutorProfile.feedbackStyle,
            learningPreference: context.tutorProfile.learningPreference,
            biggestObstacle: context.tutorProfile.biggestObstacle,
            primaryGoal: context.tutorProfile.primaryGoal,
            communicationStyle: context.tutorProfile.communicationStyle,
          },
        }
      : {}),
    ...(lessonContext ? { lessonContext } : {}),
    // Phase 4 §6.3: Socratic mode toggle.
    ...(strat && strat.socraticModeActive
      ? { socraticModeActive: true as const }
      : {}),
    // Phase 7 §9.2: forward the current turn count.
    ...(strat ? { turnsInCurrentStrategy: strat.turnsInCurrentStrategy } : {}),
  });

  // Build the strategy block at the extreme end of the prompt.
  const fullStrategyBlock = buildStrategyPromptBlock({
    strategy:
      strat?.currentStrategy ?? (sessionId ? "explaining" : "explaining"),
    engagement: strat?.userEngagementScore ?? 0.5,
    turns: strat?.turnsInCurrentStrategy ?? 0,
    socraticModeActive: Boolean(strat?.socraticModeActive),
    ...(activeLearningNudge
      ? {
          latestChoice: {
            responseTimeMs: activeLearningNudge.responseTimeMs,
            messageId: activeLearningNudge.assistantMessageId,
            pickedCorrect: activeLearningNudge.pickedCorrect,
            lastNudgeAt: strat?.lastChoiceNudgeAt ?? null,
          },
        }
      : {}),
  });

  let fullSystemPrompt = systemPrompt + "\n" + fullStrategyBlock;

  // Append mode-specific instructions when a non-default mode is active.
  if (params.mode && params.mode !== "default") {
    const ctx = params.context;

    let modeBlock = "";
    switch (params.mode) {
      case "exam":
        modeBlock = buildExamInstructions(
          {
            subjectTitle: ctx.subject.title,
            topicTitle: ctx.topic?.title ?? null,
            mastery: ctx.mastery,
            topicDifficulty: ctx.topic?.difficulty ?? null,
            confidence: ctx.confidence,
            topicObjectives: [...(ctx.topic?.objectives ?? [])],
            recentMistakes: ctx.recentMistakes.map((m) => ({
              mistakeType: m.mistakeType,
              question: m.question,
            })),
            relatedTopics: [],
            history: [],
            profile: ctx.tutorProfile
              ? {
                  grade: ctx.tutorProfile.grade,
                  curriculumName: ctx.tutorProfile.curriculumName,
                  communicationStyle: ctx.tutorProfile.communicationStyle,
                }
              : null,
          },
          params.modeOptions?.taskCount ?? 4,
        );
        break;
      case "compare":
        modeBlock = buildCompareInstructions({
          subjectTitle: ctx.subject.title,
          currentTopic: {
            title: ctx.topic?.title ?? "",
            difficulty: ctx.topic?.difficulty ?? "MEDIUM",
            mastery: ctx.mastery,
            objectives: [...(ctx.topic?.objectives ?? [])],
          },
          siblingTopics: [],
          history: [],
          profile: ctx.tutorProfile
            ? {
                grade: ctx.tutorProfile.grade,
                curriculumName: ctx.tutorProfile.curriculumName,
              }
            : null,
        });
        break;
      case "summarize":
        modeBlock = buildSummarizeInstructions({
          subjectTitle: ctx.subject.title,
          topicTitle: ctx.topic?.title ?? null,
          messageCount: 0,
          keyObjectives: [...(ctx.topic?.objectives ?? [])],
          recentMistakes: ctx.recentMistakes.map((m) => ({
            mistakeType: m.mistakeType,
            question: m.question,
            userAnswer: m.userAnswer,
            correctAnswer: m.correctAnswer,
          })),
          history: [],
          profile: ctx.tutorProfile
            ? {
                grade: ctx.tutorProfile.grade,
                curriculumName: ctx.tutorProfile.curriculumName,
                preferredExplanationStyle: ctx.tutorProfile.preferredExplanationStyle,
              }
            : null,
        });
        break;
    }

    if (modeBlock) {
      fullSystemPrompt += "\n" + modeBlock;
    }
  }

  return fullSystemPrompt;
}

/**
 * Derives the working language from a tutor profile's
 * curriculum setting. Returns "de" for German Gymnasium,
 * "en" for all other curricula.
 */
function deriveWorkingLanguage(
  profile:
    | {
        readonly curriculum:
          | "german_gymnasium"
          | "ib"
          | "a_level"
          | "ap"
          | "other";
      }
    | null
): string {
  if (!profile) return "de";
  switch (profile.curriculum) {
    case "german_gymnasium":
      return "de";
    case "ib":
    case "a_level":
    case "ap":
    case "other":
      return "en";
    default:
      return "de";
  }
}
