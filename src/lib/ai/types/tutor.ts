/** Mirror of the tutorProfiles table row shape used in the chat route. */
export type TutorProfileLike = {
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
};

/** Per-session teaching strategy state (mirrors teachingStrategyState table). */
export type StrategyState = {
  readonly currentStrategy: string;
  readonly lastSwitchReason: string | null;
  readonly userEngagementScore: number;
  readonly turnsInCurrentStrategy: number;
  readonly strategyHistory: ReadonlyArray<{
    readonly strategy: string;
    readonly turns: number;
    readonly switchedAt: number;
  }>;
  readonly socraticModeActive: boolean;
  readonly latestChoiceResponseTimeMs: number | null;
  readonly latestChoicePickedCorrect: boolean | null;
  readonly latestChoiceMessageId: string | null;
  readonly lastChoiceNudgeAt: number | null;
};

/** Supported special mode types. */
export type ModeType = "summarize" | "exam" | "compare";

/** Options for special modes. */
export type ModeOptions = {
  readonly taskCount?: number;
};

/** Payload passed to the onFinish callback after streaming completes. */
export type OnFinishPayload = {
  readonly text: string;
  readonly usage: {
    readonly inputTokens: number | undefined;
    readonly outputTokens: number | undefined;
  };
};

/** Shape of the chat request body (Zod schema output). */
export type ChatRequestShape = {
  readonly threadId: string;
  readonly subjectId: string;
  readonly topicId?: string;
  readonly sessionId?: string;
  readonly lessonContext?: {
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
  readonly messages: ReadonlyArray<unknown>;
};
