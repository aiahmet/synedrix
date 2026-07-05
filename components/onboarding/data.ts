/**
 * onboarding/data.ts.
 *
 * Vocabulary for the 11-question onboarding flow. Every
 * option label, helper text, and Accel-style behavioral
 * instruction the screens (and the AI tutor prompt) need
 * lives in one file so a single edit changes the wording
 * everywhere.
 *
 * Slugs match the `tutorProfiles` schema unions in
 * `convex/schema.ts`. Keep them in sync if you add a
 * variant.
 */

import type { Id } from "@/convex/_generated/dataModel";

// ---------- Grades ----------
export interface GradeOption {
  readonly value: number;
  readonly label: string;
  readonly hint: string;
}
export const GRADE_OPTIONS: ReadonlyArray<GradeOption> = [
  { value: 5, label: "Grade 5", hint: "Younger secondary" },
  { value: 6, label: "Grade 6", hint: "Lower secondary" },
  { value: 7, label: "Grade 7", hint: "Lower secondary" },
  { value: 8, label: "Grade 8", hint: "Lower secondary" },
  { value: 9, label: "Grade 9", hint: "Foundation year" },
  { value: 10, label: "Grade 10", hint: "MID-SEK / MSA prep" },
  { value: 11, label: "Grade 11", hint: "Oberstufe start" },
  { value: 12, label: "Grade 12", hint: "Abitur year" },
  { value: 13, label: "University", hint: "Undergrad or higher" },
];

// ---------- Curriculum ----------
export type CurriculumKey =
  | "german_gymnasium"
  | "ib"
  | "a_level"
  | "ap"
  | "other";

export interface CurriculumOption {
  readonly key: CurriculumKey;
  readonly name: string;
  readonly blurb: string;
  /** When `key === "other"`, the user supplies a freetext name. */
  readonly freeform?: boolean;
}
export const CURRICULUM_OPTIONS: ReadonlyArray<CurriculumOption> = [
  {
    key: "german_gymnasium",
    name: "German Gymnasium",
    blurb: "Abitur path — Literatur, Mathematik, Naturwissenschaften.",
  },
  {
    key: "ib",
    name: "International Baccalaureate",
    blurb: "IB Higher or Standard Level. Globally portable curriculum.",
  },
  {
    key: "a_level",
    name: "A-Level (UK)",
    blurb: "A2 / AS modules. Focused subject depth.",
  },
  {
    key: "ap",
    name: "AP (US)",
    blurb: "College Board Advanced Placement courses.",
  },
  {
    key: "other",
    name: "Something else",
    blurb: "Tell us in one line — we'll adapt.",
    freeform: true,
  },
];

// ---------- Explanation style ----------
export type ExplanationStyle =
  | "simple"
  | "standard"
  | "rigorous"
  | "examples"
  | "step_by_step"
  | "visual";

export interface ExplanationStyleOption {
  readonly value: ExplanationStyle;
  readonly label: string;
  readonly description: string;
  readonly accent: string; // CSS variable for the accent ring
}
export const EXPLANATION_OPTIONS: ReadonlyArray<ExplanationStyleOption> = [
  {
    value: "simple",
    label: "Like I'm a beginner",
    description: "Everyday analogies. Define every term on first use.",
    accent: "var(--subject-chemistry)",
  },
  {
    value: "standard",
    label: "Normal school level",
    description: "Balanced prose. The default depth.",
    accent: "var(--subject-physics)",
  },
  {
    value: "rigorous",
    label: "Detailed and rigorous",
    description: "Tight, exam-grade. Prove the result, surface edge cases.",
    accent: "var(--subject-math)",
  },
  {
    value: "examples",
    label: "With real-life examples",
    description: "Anchor everything in concrete situations.",
    accent: "var(--subject-french)",
  },
  {
    value: "step_by_step",
    label: "Step-by-step",
    description: "One move at a time. Slow down at each pivot.",
    accent: "var(--subject-english)",
  },
  {
    value: "visual",
    label: "Visual intuition first",
    description: "Picture before algebra. Diagrams over equations.",
    accent: "var(--subject-german)",
  },
];

// ---------- Feedback style ----------
export type FeedbackStyle =
  | "immediate"
  | "hint_first"
  | "socratic"
  | "patient";

export interface FeedbackStyleOption {
  readonly value: FeedbackStyle;
  readonly label: string;
  readonly description: string;
  readonly accent: string;
}
export const FEEDBACK_OPTIONS: ReadonlyArray<FeedbackStyleOption> = [
  {
    value: "immediate",
    label: "Tell me immediately",
    description: "When I'm wrong, name it and explain why.",
    accent: "var(--subject-physics)",
  },
  {
    value: "hint_first",
    label: "Give hints first",
    description: "Lead me to the gap. Let me finish the answer.",
    accent: "var(--subject-chemistry)",
  },
  {
    value: "socratic",
    label: "Let me discover it",
    description: "Ask before you tell. Let me work it out.",
    accent: "var(--subject-math)",
  },
  {
    value: "patient",
    label: "Don't reveal too fast",
    description: "Walk the wrong path with me before correcting course.",
    accent: "var(--subject-german)",
  },
];

// ---------- Learning preference ----------
export type LearningPreference =
  | "practice"
  | "reading"
  | "visual"
  | "teaching"
  | "mixed";

export interface LearningPreferenceOption {
  readonly value: LearningPreference;
  readonly label: string;
  readonly description: string;
  readonly accent: string;
}
export const LEARNING_OPTIONS: ReadonlyArray<LearningPreferenceOption> = [
  {
    value: "practice",
    label: "Practice problems",
    description: "Generate, attempt, correct.",
    accent: "var(--subject-math)",
  },
  {
    value: "reading",
    label: "Reading explanations",
    description: "Long-form prose with examples.",
    accent: "var(--subject-german)",
  },
  {
    value: "visual",
    label: "Visual diagrams",
    description: "Sketches, schematics, graphs.",
    accent: "var(--subject-physics)",
  },
  {
    value: "teaching",
    label: "Teaching back",
    description: "Quiz me — explain it back to you.",
    accent: "var(--subject-english)",
  },
  {
    value: "mixed",
    label: "Mixed",
    description: "Switch it up based on the topic.",
    accent: "var(--accent)",
  },
];

// ---------- Biggest obstacle ----------
export type Obstacle =
  | "procrastination"
  | "forgetfulness"
  | "exam_panic"
  | "no_starting_point"
  | "distraction"
  | "no_improvement";

export interface ObstacleOption {
  readonly value: Obstacle;
  readonly label: string;
  readonly description: string;
  readonly accent: string;
}
export const OBSTACLE_OPTIONS: ReadonlyArray<ObstacleOption> = [
  {
    value: "procrastination",
    label: "I procrastinate",
    description: "I'll start tomorrow, and tomorrow, and tomorrow.",
    accent: "var(--subject-french)",
  },
  {
    value: "forgetfulness",
    label: "I forget everything",
    description: "I studied then and remember none of it now.",
    accent: "var(--subject-english)",
  },
  {
    value: "exam_panic",
    label: "I panic in exams",
    description: "Staring at the clock. Knowing the answer. Long after.",
    accent: "var(--subject-physics)",
  },
  {
    value: "no_starting_point",
    label: "I don't know where to begin",
    description: "The syllabus is 200 pages. Where do I open?",
    accent: "var(--subject-chemistry)",
  },
  {
    value: "distraction",
    label: "I get distracted",
    description: "Tab open. Phone nearby. Context switches every minute.",
    accent: "var(--subject-german)",
  },
  {
    value: "no_improvement",
    label: "I study but don't improve",
    description: "Hours in. Same results. What's missing?",
    accent: "var(--subject-math)",
  },
];

// ---------- Primary goal ----------
export type Goal =
  | "pass_classes"
  | "improve_grades"
  | "top_of_class"
  | "university_prep"
  | "master_everything";

export interface GoalOption {
  readonly value: Goal;
  readonly label: string;
  readonly description: string;
  readonly accent: string;
}
export const GOAL_OPTIONS: ReadonlyArray<GoalOption> = [
  {
    value: "pass_classes",
    label: "Pass my classes",
    description: "Stay on track. No surprises.",
    accent: "var(--subject-english)",
  },
  {
    value: "improve_grades",
    label: "Improve my grades",
    description: "Bump from a 3 to a 2. From a 2 to a 1.",
    accent: "var(--subject-physics)",
  },
  {
    value: "top_of_class",
    label: "Become top of my class",
    description: "Push for the top of the bell curve.",
    accent: "var(--subject-math)",
  },
  {
    value: "university_prep",
    label: "Prepare for university",
    description: "Build the foundation before I leave school.",
    accent: "var(--subject-chemistry)",
  },
  {
    value: "master_everything",
    label: "Master every subject",
    description: "I want fluency, not just coverage.",
    accent: "var(--subject-german)",
  },
];

// ---------- Communication style ----------
export type CommunicationStyle =
  | "teacher"
  | "private_tutor"
  | "coach"
  | "challenge";

export interface CommunicationStyleOption {
  readonly value: CommunicationStyle;
  readonly label: string;
  readonly description: string;
  readonly preview: string;
  readonly accent: string;
}
export const COMMUNICATION_OPTIONS: ReadonlyArray<CommunicationStyleOption> = [
  {
    value: "teacher",
    label: "Like a teacher",
    description: "Formal, structured, every step named.",
    preview: "“Let's examine why this equation works the way it does.”",
    accent: "var(--subject-english)",
  },
  {
    value: "private_tutor",
    label: "Like a private tutor",
    description: "Patient, one-on-one, walking through together.",
    preview: "“Let's solve this one together. Where would you start?”",
    accent: "var(--subject-chemistry)",
  },
  {
    value: "coach",
    label: "Like a coach",
    description: "Encouraging. Short. Action-oriented.",
    preview: "“You've got this. One more step. Try again.”",
    accent: "var(--subject-physics)",
  },
  {
    value: "challenge",
    label: "Challenge me",
    description: "Push back. I'll earn the answer.",
    preview: "“I won't give it to you. What do you have so far?”",
    accent: "var(--subject-math)",
  },
];

// ---------- Screen script ----------
/**
 * The 11-question plan. Each entry maps to one screen in
 * `screens.tsx`. The `kind` field discriminates the
 * rendering contract:
 *   - `singlePick`: pick exactly one (autop-advance)
 *   - `multiPick`:  pick at least one (explicit Continue)
 *   - `multiPickCapped`: multi-pick with a hard cap
 *   - `welcome`:    hero "Get Started" — no field write
 *   - `building`:   animated loading
 *   - `finish`:     personalized greeting + Start Learning
 *
 * `scriptIndex` (1..11) drives the progress bar so the user
 * sees concrete progress on every screen. Welcome is 0;
 * Building/Finish render their own copy.
 */
export type ScriptEntry =
  | {
      readonly id: "grade";
      readonly kind: "singlePick";
      readonly scriptIndex: 1;
      readonly title: string;
      readonly subtitle: string;
    }
  | {
      readonly id: "curriculum";
      readonly kind: "singlePick";
      readonly scriptIndex: 2;
      readonly title: string;
      readonly subtitle: string;
    }
  | {
      readonly id: "subjects";
      readonly kind: "multiPick";
      readonly scriptIndex: 3;
      readonly title: string;
      readonly subtitle: string;
      readonly min: number;
    }
  | {
      readonly id: "weakest";
      readonly kind: "multiPickCapped";
      readonly scriptIndex: 4;
      readonly title: string;
      readonly subtitle: string;
      readonly max: number;
    }
  | {
      readonly id: "explanation";
      readonly kind: "singlePick";
      readonly scriptIndex: 5;
      readonly title: string;
      readonly subtitle: string;
    }
  | {
      readonly id: "feedback";
      readonly kind: "singlePick";
      readonly scriptIndex: 6;
      readonly title: string;
      readonly subtitle: string;
    }
  | {
      readonly id: "learning";
      readonly kind: "singlePick";
      readonly scriptIndex: 7;
      readonly title: string;
      readonly subtitle: string;
    }
  | {
      readonly id: "obstacle";
      readonly kind: "singlePick";
      readonly scriptIndex: 8;
      readonly title: string;
      readonly subtitle: string;
    }
  | {
      readonly id: "goal";
      readonly kind: "singlePick";
      readonly scriptIndex: 9;
      readonly title: string;
      readonly subtitle: string;
    }
  | {
      readonly id: "communication";
      readonly kind: "singlePick";
      readonly scriptIndex: 10;
      readonly title: string;
      readonly subtitle: string;
    };

export const SCRIPT: ReadonlyArray<ScriptEntry> = [
  {
    id: "grade",
    kind: "singlePick",
    scriptIndex: 1,
    title: "What grade are you in?",
    subtitle:
      "Calibrates topic difficulty and the Abitur / exam format references.",
  },
  {
    id: "curriculum",
    kind: "singlePick",
    scriptIndex: 2,
    title: "Which curriculum?",
    subtitle:
      "So the AI tutor speaks in the right register and references the right exams.",
  },
  {
    id: "subjects",
    kind: "multiPick",
    scriptIndex: 3,
    title: "Which subjects can I help you with?",
    subtitle:
      "Pick everything you'll study. You can change this later.",
    min: 1,
  },
  {
    id: "weakest",
    kind: "multiPickCapped",
    scriptIndex: 4,
    title: "Which subjects feel hardest?",
    subtitle:
      "Pick up to three — these get extra attention from your tutor and the dashboard.",
    max: 3,
  },
  {
    id: "explanation",
    kind: "singlePick",
    scriptIndex: 5,
    title: "When you're learning something new…",
    subtitle: "How should I explain it to you?",
  },
  {
    id: "feedback",
    kind: "singlePick",
    scriptIndex: 6,
    title: "When you make a mistake…",
    subtitle: "How should I correct you?",
  },
  {
    id: "learning",
    kind: "singlePick",
    scriptIndex: 7,
    title: "How do you learn best?",
    subtitle: "I'll lean the AI tutor's pace toward your preferred mode.",
  },
  {
    id: "obstacle",
    kind: "singlePick",
    scriptIndex: 8,
    title: "What's your biggest challenge?",
    subtitle:
      "I'll structure your sessions to push back against this specifically.",
  },
  {
    id: "goal",
    kind: "singlePick",
    scriptIndex: 9,
    title: "What's your goal?",
    subtitle: "I'm aiming the curriculum at this target.",
  },
  {
    id: "communication",
    kind: "singlePick",
    scriptIndex: 10,
    title: "How should I talk to you?",
    subtitle:
      "Pick the teacher voice that makes you most comfortable.",
  },
];

// ---------- Building messages ----------
export const BUILDING_MESSAGES: ReadonlyArray<{
  readonly label: string;
  readonly body: string;
}> = [
  {
    label: "Curriculum",
    body: "Mapping topics against your grade and curriculum.",
  },
  {
    label: "Focus",
    body: "Prioritizing your three weakest subjects.",
  },
  {
    label: "Tone",
    body: "Calibrating explanation depth and feedback pacing.",
  },
  {
    label: "Loop",
    body: "Wiring the dashboard, tutor, and review systems together.",
  },
  {
    label: "Profile",
    body: "Saving your study profile.",
  },
];

// ---------- Type-safe draft shape ----------
/**
 * The in-flight draft. Hydrated from localStorage on mount
 * and cleared on successful save.
 *
 * Reflects the `tutorProfiles` Convex shape (minus the
 * server-managed `userId` / `completedAt`).
 */
export interface OnboardingDraft {
  readonly grade: number | null;
  readonly curriculum: CurriculumKey | null;
  readonly curriculumOtherText: string;
  readonly subjectIds: ReadonlyArray<Id<"subjects">>;
  readonly weakestSubjectIds: ReadonlyArray<Id<"subjects">>;
  readonly explanationStyle: ExplanationStyle | null;
  readonly feedbackStyle: FeedbackStyle | null;
  readonly learningPreference: LearningPreference | null;
  readonly biggestObstacle: Obstacle | null;
  readonly primaryGoal: Goal | null;
  readonly communicationStyle: CommunicationStyle | null;
}

export const EMPTY_DRAFT: OnboardingDraft = {
  grade: null,
  curriculum: null,
  curriculumOtherText: "",
  subjectIds: [],
  weakestSubjectIds: [],
  explanationStyle: null,
  feedbackStyle: null,
  learningPreference: null,
  biggestObstacle: null,
  primaryGoal: null,
  communicationStyle: null,
};

/** Returns a deep clone of the empty draft, suitable for
 *  state mutations. */
export function freshDraft(): OnboardingDraft {
  return {
    grade: null,
    curriculum: null,
    curriculumOtherText: "",
    subjectIds: [],
    weakestSubjectIds: [],
    explanationStyle: null,
    feedbackStyle: null,
    learningPreference: null,
    biggestObstacle: null,
    primaryGoal: null,
    communicationStyle: null,
  };
}
