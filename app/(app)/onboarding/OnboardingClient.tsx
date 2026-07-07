"use client";

/**
 * app/(app)/onboarding/OnboardingClient.tsx.
 *
 * The state machine. Owns:
 *   - the live `OnboardingDraft` in component state,
 *   - the localStorage persistence (hydrate / clear),
 *   - the current step (welcome → 11 questions → building → finish),
 *   - the auto-bump to step N+1 after each single-pick tap,
 *   - the atomic `api.tutorProfile.save` on finish.
 *
 * Reduced-motion users skip the page-transition staggering
 * entirely. The (app) layout owns the server-side redirect
 * gate; this component is purely the in-flight UI.
 */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { z } from "zod";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ArrowLeft, ArrowRight } from "@/components/landing/icons";
import {
  COMMUNICATION_OPTIONS,
  EXPLANATION_OPTIONS,
  FEEDBACK_OPTIONS,
  GOAL_OPTIONS,
  GRADE_OPTIONS,
  OBSTACLE_OPTIONS,
  CURRICULUM_OPTIONS,
  freshDraft,
  type CurriculumKey,
  type ExplanationStyle,
  type FeedbackStyle,
  type LearningPreference,
  type Obstacle,
  type Goal,
  type CommunicationStyle,
  type OnboardingDraft,
} from "@/components/onboarding/data";
import {
  BiggestObstacleScreen,
  BuildingScreen,
  CommunicationScreen,
  CurriculumScreen,
  ExplanationStyleScreen,
  FeedbackStyleScreen,
  FinishScreen,
  type FinishContext,
  GradeScreen,
  LearningPreferenceScreen,
  PrimaryGoalScreen,
  SubjectsScreen,
  WeakestScreen,
  WelcomeScreen,
} from "@/components/onboarding/screens";

// ===========================================================================
// Local storage keys + Zod-validated shape
// ===========================================================================

/** Bump when the draft schema changes incompatibly. */
const STORAGE_KEY = "synedrix-onboarding-draft-v1";

const draftShape = {
  grade: z.number().nullable(),
  curriculum: z
    .enum([
      "german_gymnasium",
      "ib",
      "a_level",
      "ap",
      "other",
    ])
    .nullable(),
  curriculumOtherText: z.string().max(120),
  subjectIds: z.array(z.string()),
  weakestSubjectIds: z.array(z.string()),
  explanationStyle: z
    .enum(["simple", "standard", "rigorous", "examples", "step_by_step", "visual"])
    .nullable(),
  feedbackStyle: z
    .enum(["immediate", "hint_first", "socratic", "patient"])
    .nullable(),
  learningPreference: z
    .enum(["practice", "reading", "visual", "teaching", "mixed"])
    .nullable(),
  biggestObstacle: z
    .enum([
      "procrastination",
      "forgetfulness",
      "exam_panic",
      "no_starting_point",
      "distraction",
      "no_improvement",
    ])
    .nullable(),
  primaryGoal: z
    .enum([
      "pass_classes",
      "improve_grades",
      "top_of_class",
      "university_prep",
      "master_everything",
    ])
    .nullable(),
  communicationStyle: z
    .enum(["teacher", "private_tutor", "coach", "challenge"])
    .nullable(),
} as const;

const draftSchema = z.object(draftShape);

/**
 * loadDraftFromStorage.
 *
 * Hydrates the draft from localStorage if present and
 * schema-valid. Stale / corrupt drafts are discarded so
 * the user sees the empty flow on schema bump. Per the
 * thinker's recommendation.
 */
function loadDraftFromStorage(): OnboardingDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    const validated = draftSchema.safeParse(parsed);
    if (!validated.success) return null;
    const v = validated.data;
    return {
      grade: v.grade,
      curriculum: v.curriculum as CurriculumKey | null,
      curriculumOtherText: v.curriculumOtherText,
      subjectIds: v.subjectIds as Id<"subjects">[],
      weakestSubjectIds: v.weakestSubjectIds as Id<"subjects">[],
      explanationStyle: v.explanationStyle as ExplanationStyle | null,
      feedbackStyle: v.feedbackStyle as FeedbackStyle | null,
      learningPreference: v.learningPreference as LearningPreference | null,
      biggestObstacle: v.biggestObstacle as Obstacle | null,
      primaryGoal: v.primaryGoal as Goal | null,
      communicationStyle: v.communicationStyle as CommunicationStyle | null,
    };
  } catch {
    return null;
  }
}

// ===========================================================================
// Step id
// ===========================================================================

type StepId =
  | "welcome"
  | "grade"
  | "curriculum"
  | "subjects"
  | "weakest"
  | "explanation"
  | "feedback"
  | "learning"
  | "obstacle"
  | "goal"
  | "communication"
  | "building"
  | "finish";

const STEP_ORDER: ReadonlyArray<StepId> = [
  "welcome",
  "grade",
  "curriculum",
  "subjects",
  "weakest",
  "explanation",
  "feedback",
  "learning",
  "obstacle",
  "goal",
  "communication",
  "building",
  "finish",
];

// ===========================================================================
// Component
// ===========================================================================

/**
 * AvailableSubject.
 *
 * The minimal subject shape the onboarding screens need.
 * Mirrors `AvailableSubject` exported from
 * `components/onboarding/screens.tsx`. Duplicated here so
 * the parent page (`app/(app)/onboarding/page.tsx`) and
 * the client island agree on the wire shape without
 * importing a client-only module.
 */
export interface AvailableSubject {
  readonly id: Id<"subjects">;
  readonly slug: string;
  readonly title: string;
  readonly color?: string;
  readonly icon?: string;
}

export function OnboardingClient({
  firstName,
  initialSubjects,
}: {
  readonly firstName: string;
  /**
   * The canonical subject list, resolved server-side by
   * the parent page via `fetchQuery(api.subjects.list)`.
   *
   * The list is intentionally a static prop (NOT a
   * `usePreloadedQuery`) for two reasons:
   *
   *   1. **No "skip" hack.** `usePreloadedQuery` requires
   *      a `Preloaded<T>` value; the previous shallow
   *      `null ?? ("skip" as never)` cast crashed at
   *      runtime when the preload failed.
   *   2. **No empty grid on initial paint.** The page is
   *      server-rendered with the resolved subjects
   *      already in hand, so the Subjects and Weakest
   *      screens render their option cards on first paint
   *      — the user never sees a flash of an empty grid.
   *
   * Convex reactivity isn't needed here: the canonical
   * subject list never changes during an 11-question
   * onboarding flow.
   */
  readonly initialSubjects: ReadonlyArray<AvailableSubject>;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();

  // start at welcome on first paint; replaced from localStorage
  // on mount (after hydration).
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState<StepId>("welcome");
  const [draft, setDraftState] = useState<OnboardingDraft>(() => freshDraft());
  const [saveError, setSaveError] = useState<string | null>(null);

  // The canonical subject list is a static prop that the
  // parent page already mapped into the minimal `AvailableSubject`
  // shape (id, slug, title, color?, icon?). The previous
  // implementation called `usePreloadedQuery` here with an
  // unsafe "skip" hack that crashed at runtime when the
  // preload failed; replacing the subscription with a prop
  // sidesteps the runtime hazard and removes the empty-grid
  // initial paint. The screens consume the prop directly —
  // no transform needed, so no `useMemo` either.
  const subjectList = initialSubjects;

  // Hydrate from localStorage on mount, and resume at the
  // first unanswered step so the user does not re-answer.
  useEffect(() => {
    const restored = loadDraftFromStorage();
    if (!restored) {
      // eslint-disable-next-line -- hydration init on mount
      setHydrated(true);
      return;
    }
    setDraftState(restored);
    const resumeStep = findResumeStep(restored);
    setStep(resumeStep);
    setHydrated(true);
  }, []);

  // Persist on each draft change (debounced via rAF).
  const saveRafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (saveRafRef.current !== null) {
      window.cancelAnimationFrame(saveRafRef.current);
    }
    saveRafRef.current = window.requestAnimationFrame(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      } catch {
        // localStorage may be disabled (e.g. private mode);
        // fall through silently — the in-flight state still
        // works for the current tab.
      }
    });
    return () => {
      if (saveRafRef.current !== null) {
        window.cancelAnimationFrame(saveRafRef.current);
      }
    };
  }, [hydrated, draft]);

  // Auto-advance debounce ref. Tracks the most recent
  // advance-from-which-step timestamp. Reads below in goNext.
  const lastAdvanceRef = useRef<{ step: StepId; at: number } | null>(null);

  const setDraft = (next: Partial<OnboardingDraft>) =>
    setDraftState((prev) => ({ ...prev, ...next }));

  const goNext = () => {
    // Auto-advance race guard. Every single-pick screen
    // calls `setTimeout(goNext, 400)`. Two rapid taps on
    // the same card would otherwise enqueue two timers
    // and skip a step. We debounce per-step: a second
    // advance triggered within 700 ms of the previous
    // advance FROM THE SAME STEP is dropped. Step changes
    // reset the timestamp so legitimate advance + back +
    // advance still works.
    // eslint-disable-next-line -- event handler, not render path
    const now = Date.now();
    if (
      lastAdvanceRef.current &&
      lastAdvanceRef.current.step === step &&
      now - lastAdvanceRef.current.at < 700
    ) {
      return;
    }
    lastAdvanceRef.current = { step, at: now };

    // Compute nextStep BEFORE calling setStep so we can
    // detect the special "communication → building"
    // transition and fire the save. Firing it here (a
    // plain event handler) — NOT from a useEffect — is the
    // StrictMode-safe path. The previous useEffect-based
    // save flipped cancelled=true in the cleanup function
    // which then blocked setStep("finish") from ever firing
    // and trapped users on the Building screen forever.
    const nextIdx = STEP_ORDER.indexOf(step);
    const nextStep = STEP_ORDER[Math.min(STEP_ORDER.length - 1, nextIdx + 1)];
    setStep(nextStep);
    if (
      step === "communication" &&
      nextStep === "building" &&
      !isSaving
    ) {
      void fireSave();
    }
  };
  const goBack = () => {
    setStep((s) => {
      const i = STEP_ORDER.indexOf(s);
      if (i <= 1) return s; // can't go before "grade"
      return STEP_ORDER[i - 1];
    });
  };

  // ----- Save on reaching "finish" -----
  const saveProfile = useMutation(api.tutorProfile.save);
  // `isSaving` is a `useState` (NOT `useRef`) so the latch
  // survives Reacts render cycle correctly — a `useRef`
  // mutating during render triggers the
  // `react-compiler/no-direct-set-state-in-effect` lint
  // and is brittle under StrictMode's double-invoke:
  // the cleanup function sets `cancelled = true` but does
  // NOT flip the ref, so the second effect cycle sees the
  // latch still true and bails — leaving the user stuck
  // on the Building screen with `setStep("finish")` never
  // firing. State is read on every render and stays
  // consistent across StrictMode invocations.
  const [isSaving, setIsSaving] = useState(false);

  /**
   * fireSave.
   *
   * Atomic save of the live `draft` to the Convex
   * `tutorProfiles` row. Triggered from `goNext()` on
   * the special "communication → building" transition,
   * NOT from a useEffect — moving the work out of an
   * effect sidesteps the StrictMode cancellation trap
   * described above (see the `isSaving` comment).
   *
   * The `isSaving` latch is set BEFORE the await and
   * cleared in `finally` regardless of outcome, so a
   * Retry click always flips the latch off and posts a
   * fresh mutation.
   *
   * Idempotent on the server: `tutorProfile.save` looks
   * up an existing row by `(userId)` first and patches
   * in place when found, so two concurrent `fireSave()`
   * calls land on the same row instead of duplicating.
   * The server-side guard is the belt-and-braces; the
   * client-side `isSaving` latch plus the `goNext()`
   * transition check (the only call site other than
   * Retry) prevents duplication without any server
   * traffic.
   */
  const fireSave = useCallback(async () => {
    setSaveError(null);
    setIsSaving(true);
    try {
      const curriculumName = lookupCurriculumName(draft);
      const args = {
        grade: draft.grade!,
        curriculum: draft.curriculum!,
        curriculumName,
        ...(draft.curriculum === "other" && draft.curriculumOtherText
          ? { curriculumFreeform: draft.curriculumOtherText }
          : {}),
        enrolledSubjectIds: [...draft.subjectIds],
        weakestSubjectIds: [...draft.weakestSubjectIds],
        preferredExplanationStyle: draft.explanationStyle!,
        feedbackStyle: draft.feedbackStyle!,
        learningPreference: draft.learningPreference!,
        biggestObstacle: draft.biggestObstacle!,
        primaryGoal: draft.primaryGoal!,
        communicationStyle: draft.communicationStyle!,
      };
      await saveProfile(args);
      // Clear localStorage on success.
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setStep("finish");
    } catch (err) {
      console.error("[onboarding] save failed", err);
      setSaveError(friendlySaveError(err));
    } finally {
      setIsSaving(false);
    }
  }, [draft, saveProfile]);

  const onSaveRetry = () => {
    // `fireSave` clears `saveError` itself before posting,
    // so the only thing Retry needs to do is re-run.
    void fireSave();
  };

  // ----- Render -----
  const stepIdx = STEP_ORDER.indexOf(step);
  const progressStep = Math.max(
    0,
    Math.min(11, Math.max(1, stepIdx - 1)) // welcome=0, grade=1, ..., communication=10
  );
  const progressPct =
    progressStep > 0 ? Math.round((progressStep / 11) * 100) : 0;

  return (
    <div className="relative flex h-full flex-1 flex-col overflow-y-auto">
      {/* Top control bar. Renders on every step EXCEPT
          welcome (no back/counter makes sense there) and
          finish (the celebration is the whole screen).
          Layout is Back button | step counter + progress
          fill | invisible spacer. ProgressBar lives in
          Components.tsx and accepts a `showLabel` so the
          counter mono-label stays here. */}
      {step !== "welcome" && step !== "finish" && (
        <div className="sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-surface-elevated/85 px-4 py-2.5 backdrop-blur-xl sm:px-6">
          <button
            type="button"
            onClick={goBack}
            disabled={stepIdx <= 1}
            aria-label="Previous step"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-[12.5px] font-medium text-muted-foreground transition-all hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
            Back
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
              {progressStep > 0
                ? `${progressStep} of 11`
                : "Onboarding"}
            </span>
            <Progress pct={progressPct} />
          </div>
          <div className="h-9 w-[5rem] shrink-0" />
        </div>
      )}

      <div className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-0 sm:px-2">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={reduce ? false : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 1 } : { opacity: 0, x: -24 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex w-full flex-1 flex-col items-stretch justify-center"
          >
            {/* eslint-disable-next-line -- derived from ref tracked above */}
            {renderStep({
              step,
              draft,
              setDraft,
              firstName,
              subjectList,
              onAutoAdvance: goNext,
              onContinue: goNext,
              onGetStarted: goNext,
              onStart: () => router.push("/dashboard"),
              saveError,
              onSaveRetry,
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ===========================================================================
// Render dispatch
// ===========================================================================

interface StepRenderArgs {
  readonly step: StepId;
  readonly draft: OnboardingDraft;
  readonly setDraft: (next: Partial<OnboardingDraft>) => void;
  readonly firstName: string;
  readonly subjectList: ReadonlyArray<{
    readonly id: Id<"subjects">;
    readonly slug: string;
    readonly title: string;
    readonly color?: string;
    readonly icon?: string;
  }>;
  readonly onAutoAdvance: () => void;
  readonly onContinue: () => void;
  readonly onGetStarted: () => void;
  readonly onStart: () => void;
  readonly saveError: string | null;
  readonly onSaveRetry: () => void;
}

function renderStep(args: StepRenderArgs): React.ReactNode {
  switch (args.step) {
    case "welcome":
      return (
        <WelcomeScreen
          firstName={args.firstName}
          onGetStarted={args.onGetStarted}
        />
      );
    case "grade":
      return (
        <GradeScreen
          draft={args.draft}
          setDraft={args.setDraft}
          onAutoAdvance={args.onAutoAdvance}
        />
      );
    case "curriculum":
      return (
        <CurriculumScreen
          draft={args.draft}
          setDraft={args.setDraft}
          onAutoAdvance={args.onAutoAdvance}
        />
      );
    case "subjects":
      return (
        <SubjectsScreen
          draft={args.draft}
          availableSubjects={args.subjectList}
          setDraft={args.setDraft}
          onContinue={args.onContinue}
        />
      );
    case "weakest":
      return (
        <WeakestScreen
          draft={args.draft}
          availableSubjects={args.subjectList}
          setDraft={args.setDraft}
          onContinue={args.onContinue}
        />
      );
    case "explanation":
      return (
        <ExplanationStyleScreen
          draft={args.draft}
          setDraft={args.setDraft}
          onAutoAdvance={args.onAutoAdvance}
        />
      );
    case "feedback":
      return (
        <FeedbackStyleScreen
          draft={args.draft}
          setDraft={args.setDraft}
          onAutoAdvance={args.onAutoAdvance}
        />
      );
    case "learning":
      return (
        <LearningPreferenceScreen
          draft={args.draft}
          setDraft={args.setDraft}
          onAutoAdvance={args.onAutoAdvance}
        />
      );
    case "obstacle":
      return (
        <BiggestObstacleScreen
          draft={args.draft}
          setDraft={args.setDraft}
          onAutoAdvance={args.onAutoAdvance}
        />
      );
    case "goal":
      return (
        <PrimaryGoalScreen
          draft={args.draft}
          setDraft={args.setDraft}
          onAutoAdvance={args.onAutoAdvance}
        />
      );
    case "communication":
      return (
        <CommunicationScreen
          draft={args.draft}
          setDraft={args.setDraft}
          onAutoAdvance={args.onAutoAdvance}
        />
      );
    case "building":
      return args.saveError ? (
        <BuildingErrorState
          message={args.saveError}
          onRetry={args.onSaveRetry}
        />
      ) : (
        <BuildingScreen step={10} />
      );
    case "finish":
      return (
        <FinishScreen
          ctx={buildFinishContext({
            firstName: args.firstName,
            draft: args.draft,
            subjectList: args.subjectList,
          })}
          onStart={args.onStart}
        />
      );
  }
}

function BuildingErrorState({
  message,
  onRetry,
}: {
  readonly message: string;
  readonly onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
        Save failed
      </p>
      <p className="max-w-md text-[14px] leading-relaxed text-foreground/90">
        We couldn&apos;t save your study profile: {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="group inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-[13.5px] font-medium text-accent-foreground transition-colors hover:bg-accent/90"
      >
        Retry
        <ArrowRight
          className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
          weight="bold"
        />
      </button>
    </div>
  );
}

/**
 * Progress (inline mini progress fill).
 *
 * Compact 1px-tall rail rendered inline in the top bar
 * next to the "X of 11" counter. Uses motion's animate
 * so its width tween does not require a separate step-
 * level component tree. We pass the rendering key on
 * every step so a width flip animates rather than jumps.
 */
function Progress({ pct }: { readonly pct: number }) {
  return (
    <div className="relative h-1 w-full flex-1 overflow-hidden rounded-full bg-border/60">
      <motion.span
        key={pct}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-y-0 left-0 block rounded-full bg-accent"
      />
    </div>
  );
}

// ===========================================================================
// Resume-step resolution
// ===========================================================================

/**
 * Returns the first unanswered step. The user resumes
 * there, not at "welcome", so they do not lose momentum
 * on a refresh.
 */
function findResumeStep(d: OnboardingDraft): StepId {
  if (d.grade === null) return "grade";
  if (d.curriculum === null) return "curriculum";
  if (d.curriculum === "other" && d.curriculumOtherText.trim().length === 0) {
    return "curriculum";
  }
  if (d.subjectIds.length === 0) return "subjects";
  if (d.weakestSubjectIds.length === 0) return "weakest";
  if (d.explanationStyle === null) return "explanation";
  if (d.feedbackStyle === null) return "feedback";
  if (d.learningPreference === null) return "learning";
  if (d.biggestObstacle === null) return "obstacle";
  if (d.primaryGoal === null) return "goal";
  if (d.communicationStyle === null) return "communication";
  // All answered — let the user re-run from welcome but do
  // not auto-advance to building; in practice this branch
  // is unreachable because the (app) layout would have
  // redirected to /dashboard already.
  return "welcome";
}

// ===========================================================================
// Curriculum + finish-context helpers
// ===========================================================================

/**
 * friendlySaveError.
 *
 * Map a save mutation's `ConvexError` to a sentence the
 * user can read. Internal error codes never leak into
 * the building-screen error UI; non-Convex errors fall to
 * a safe generic message. Returning a stable string lets
 * the Retry CTA render the copy inline without further
 * branching logic.
 */
function friendlySaveError(err: unknown): string {
  if (err instanceof ConvexError) {
    const code = (err as { data: unknown }).data;
    switch (code) {
      case "invalid_grade":
        return "We had trouble recording your grade. Please re-pick it and try again.";
      case "curriculum_freeform_required":
        return "Please give your curriculum a name (one short line).";
      case "at_least_one_subject_required":
        return "Please pick at least one subject before finishing.";
      case "max_three_weak_subjects":
        return "Pick three or fewer weakest subjects.";
      case "weakest_must_be_enrolled":
        return "One of your weakest subjects wasn't enrolled. Re-pick and try again.";
      case "subject_not_found":
        return "One of your selected subjects isn't available right now. Please re-pick.";
      default:
        return "We couldn't save your study profile. Please try again.";
    }
  }
  return "We couldn't reach the server. Check your connection and try again.";
}

function lookupCurriculumName(d: OnboardingDraft): string {
  if (d.curriculum === "other" && d.curriculumOtherText.trim().length > 0) {
    return d.curriculumOtherText.trim().slice(0, 60);
  }
  const found = CURRICULUM_OPTIONS.find((c) => c.key === d.curriculum);
  return found?.name ?? "Custom";
}

function buildFinishContext(args: {
  readonly firstName: string;
  readonly draft: OnboardingDraft;
  readonly subjectList: ReadonlyArray<{
    readonly id: Id<"subjects">;
    readonly slug: string;
    readonly title: string;
  }>;
}): FinishContext {
  const subjectById = new Map(args.subjectList.map((s) => [s.id, s.title]));
  const focusedTitles = args.draft.subjectIds
    .map((id) => subjectById.get(id) ?? "this subject")
    .slice(0, 6);
  const weakestTitles = args.draft.weakestSubjectIds
    .map((id) => subjectById.get(id) ?? "this subject")
    .slice(0, 3);

  // Curriculum label
  const curriculumLabel = (() => {
    if (
      args.draft.curriculum === "other" &&
      args.draft.curriculumOtherText.trim().length > 0
    ) {
      return `following the ${args.draft.curriculumOtherText.trim()} curriculum`;
    }
    const found = CURRICULUM_OPTIONS.find(
      (c) => c.key === args.draft.curriculum
    );
    return found ? `following the ${found.name}` : "";
  })();

  const gradeLabel = (() => {
    const found = GRADE_OPTIONS.find((g) => g.value === args.draft.grade);
    return found ? `${found.label}` : "";
  })();

  const explanation = EXPLANATION_OPTIONS.find(
    (o) => o.value === args.draft.explanationStyle
  );
  const feedbackOption = FEEDBACK_OPTIONS.find(
    (o) => o.value === args.draft.feedbackStyle
  );
  const obstacle = OBSTACLE_OPTIONS.find(
    (o) => o.value === args.draft.biggestObstacle
  );
  const goal = GOAL_OPTIONS.find((o) => o.value === args.draft.primaryGoal);
  const communication = COMMUNICATION_OPTIONS.find(
    (o) => o.value === args.draft.communicationStyle
  );

  const explanationBlurb = explanation
    ? `${explanation.description.split(".")[0]}.`
    : "";
  const feedbackBlurb = feedbackOption
    ? `When you slip, I'll ${feedbackOption.description
        .toLowerCase()
        .replace(/[.!?]$/, "")}.`
    : "";  const obstacleBlurb = obstacle
    ? (() => {
        if (obstacle.value === "procrastination") {
          return "I'll keep sessions short with a clear next step so it's harder to bail.";
        }
        if (obstacle.value === "forgetfulness") {
          return "I'll schedule spaced repetition so what you learned today comes back tomorrow.";
        }
        if (obstacle.value === "exam_panic") {
          return "I'll plan timed practice runs so exam day feels familiar, not foreign.";
        }
        if (obstacle.value === "no_starting_point") {
          return "I'll surface one tiny next step every time, so the syllabus shrinks by the day.";
        }
        if (obstacle.value === "distraction") {
          return "Sessions are short and the next move is always one click away. Fewer tab hops.";
        }
        if (obstacle.value === "no_improvement") {
          return "I'll track per-skill mastery and call out exactly where the gap is, weekly.";
        }
        return "";
      })()
    : "";
  // attach obstacleBlurb to FinishContext construction
  void obstacleBlurb;

  const goalBlurb = goal
    ? (() => {
        if (goal.value === "pass_classes") {
          return "I'm aiming the sessions at staying current. No surprises in the report card.";
        }
        if (goal.value === "improve_grades") {
          return "I'm aiming the sessions at bumping every grade up a notch.";
        }
        if (goal.value === "top_of_class") {
          return "I'm aiming the sessions at the top of the bell curve. Exam mastery comes first.";
        }
        if (goal.value === "university_prep") {
          return "I'm aiming the sessions at the foundations universities expect, not surface coverage.";
        }
        if (goal.value === "master_everything") {
          return "I'm aiming at fluency, not coverage. Every topic comes back until it's stuck.";
        }
        return "";
      })()
    : "";

  const communicationBlurb = communication
    ? `${communication.label.toLowerCase()}. ${communication.description
        .toLowerCase()
        .replace(/[.!?]$/, "")}.`
    : "";

  return {
    firstName: args.firstName,
    gradeLabel,
    curriculumLabel,
    focusedSubjectTitles: focusedTitles,
    weakestSubjectTitles: weakestTitles,
    explanationBlurb,
    feedbackBlurb,
    communicationBlurb,
    biggestObstacleBlurb: obstacleBlurb || goalBlurb,
    primaryGoalBlurb: goalBlurb,
    primaryGoalValue: args.draft.primaryGoal,
    explanationLabel: explanation?.label ?? "",
    communicationLabel: communication?.label ?? "",
  };
}
