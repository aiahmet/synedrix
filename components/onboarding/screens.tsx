"use client";

/**
 * components/onboarding/screens.tsx.
 *
 * Redesigned per the design-taste-frontend audit:
 *   - WelcomeScreen: removed the 3-column equal feature
 *     cards (a banned pattern per Section 4.7). Replaced
 *     with a single cinematic hero plus a horizontal
 *     "11-step journey" preview strip that visibly tapers
 *     to 11 numbered tiles, communicating the flow length
 *     without duplicating paragraph copy.
 *   - QuestionLayout: drop the inline ProgressBar (the
 *     shared top bar in OnboardingClient carries it).
 *   - SubjectOption: replaced the generic `Books` icon
 *     with a per-subject glyph from SUBJECT_ICON_MAP. Each
 *     subject tile now carries its own visual identity.
 *   - BuildingScreen: replaced the 5-row list with one
 *     constrained vertical timeline rail that lights up
 *     stage by stage. Communicates "system executing" in
 *     a single reading glance.
 *   - FinishScreen: replaced the text-only SummaryCard
 *     with an asymmetrical 3-cell bento (subjects spans
 *     full width; voice + goal split the bottom row).
 *
 * Reduced-motion users skip the building-screen stage
 * ticker, the confetti burst, and the option-card
 * press micro-animation.
 */

import { motion } from "motion/react";
import { useEffect, useState } from "react";

import { type Id } from "@/convex/_generated/dataModel";
import {
  ArrowRight,
  Books,
  ChatCircleText,
  Compass,
  Flame,
  Gauge,
  GraduationCap,
  Pulse,
  SubjectGlyph,
  Rocket,
  ShieldCheck,
  Sparkle,
  Target,
} from "@/components/landing/icons";

import {
  BUILDING_MESSAGES,
  COMMUNICATION_OPTIONS,
  CURRICULUM_OPTIONS,
  EXPLANATION_OPTIONS,
  FEEDBACK_OPTIONS,
  GOAL_OPTIONS,
  GRADE_OPTIONS,
  LEARNING_OPTIONS,
  OBSTACLE_OPTIONS,
  type Goal,
  type OnboardingDraft,
} from "@/components/onboarding/data";
import {
  ConfettiBurst,
  ContinueBar,
  OptionCard,
  ScreenHeader,
} from "@/components/onboarding/Components";

// ===========================================================================
// Setter types
// ===========================================================================

type SetDraft = (next: Partial<OnboardingDraft>) => void;

export interface AvailableSubject {
  readonly id: Id<"subjects">;
  readonly slug: string;
  readonly title: string;
  readonly color?: string;
  readonly icon?: string;
}

// ===========================================================================
// Journey strip (Welcome only)
// ===========================================================================

/**
 * The 11-step plan as a single horizontal strip. Each
 * tile is a small number-on-disc; the strip tapers toward
 * the right edge so the user's eye traces the screen
 * from "1: Grade" to "11: Voice" in one motion. Late
 * tiles fade down to ~40% opacity to convey momentum
 * without false precision.
 */
const JOURNEY_STEPS: ReadonlyArray<{
  readonly index: number;
  readonly label: string;
  readonly Icon: React.ComponentType<{
    className?: string;
    weight?: "duotone" | "bold" | "regular" | "fill";
  }>;
}> = [
  { index: 1, label: "Grade", Icon: GraduationCap },
  { index: 2, label: "Track", Icon: Compass },
  { index: 3, label: "Subjects", Icon: Books },
  { index: 4, label: "Weak spots", Icon: Target },
  { index: 5, label: "Explanations", Icon: ChatCircleText },
  { index: 6, label: "Feedback", Icon: ShieldCheck },
  { index: 7, label: "Learning mode", Icon: Pulse },
  { index: 8, label: "Challenge", Icon: Flame },
  { index: 9, label: "Goal", Icon: Rocket },
  { index: 10, label: "Pace", Icon: Gauge },
  { index: 11, label: "Voice", Icon: ChatCircleText },
];

function JourneyStrip() {
  return (
    <div className="w-full max-w-3xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
          What I&apos;ll ask
        </span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
          11 quick questions
        </span>
      </div>
      <ol className="flex w-full items-stretch gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {JOURNEY_STEPS.map((step, i) => {
          const distanceFromFront = i;
          const opacity =
            distanceFromFront < 3
              ? 1
              : distanceFromFront < 6
                ? 0.7
                : distanceFromFront < 9
                  ? 0.5
                  : 0.38;
          return (
            <li
              key={step.index}
              className="flex min-w-[44px] flex-1 flex-col items-center gap-1"
              style={{ opacity }}
            >
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-elevated text-muted-foreground"
              >
                <step.Icon className="h-3 w-3" weight="duotone" />
              </span>
              <span
                className="w-full truncate text-center font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground"
                title={`${step.index}. ${step.label}`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ===========================================================================
// WelcomeScreen
// ===========================================================================

export function WelcomeScreen({
  firstName,
  onGetStarted,
}: {
  readonly firstName: string;
  readonly onGetStarted: () => void;
}) {
  return (
    <div className="relative flex w-full flex-col items-center gap-8 px-4 py-8 sm:py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground"
      >
        Setup · 11 questions · about 90 seconds
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-4 text-center"
      >
        <h1 className="max-w-3xl text-balance text-[clamp(2.2rem,4.5vw+1rem,3.4rem)] font-semibold leading-[1.04] tracking-[-0.025em] text-foreground">
          {firstName
            ? `Meet your Tutor, ${firstName}.`
            : "Meet your Tutor."}
        </h1>
        <p className="max-w-xl text-pretty text-[14.5px] leading-relaxed text-muted-foreground">
          Eleven quick questions tune your curriculum,
          explanation depth, feedback pace, and tutor voice.
          Auto-saved, resume any time.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
      >
        <JourneyStrip />
      </motion.div>

      <motion.button
        type="button"
        onClick={onGetStarted}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.97 }}
        className="group relative inline-flex h-14 items-center gap-3 overflow-hidden rounded-2xl bg-accent px-8 text-[15px] font-semibold text-accent-foreground shadow-[0_8px_32px_-12px_color-mix(in_srgb,var(--accent)_45%,transparent)] transition-all hover:shadow-[0_12px_40px_-12px_color-mix(in_srgb,var(--accent)_55%,transparent)]"
      >
        <span>Get started</span>
        <ArrowRight
          className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
          weight="bold"
        />
      </motion.button>
    </div>
  );
}

// ===========================================================================
// Question screens
// ===========================================================================

export function GradeScreen({
  draft,
  setDraft,
  onAutoAdvance,
}: {
  readonly draft: OnboardingDraft;
  readonly setDraft: SetDraft;
  readonly onAutoAdvance: () => void;
}) {
  return (
    <QuestionLayout
      question="What grade are you in?"
      hint="We use it to calibrate topic difficulty and the Abitur / exam format references."
    >
      <div className="grid w-full max-w-3xl grid-cols-2 gap-2.5 sm:grid-cols-3">
        {GRADE_OPTIONS.map((g) => (
          <OptionCard
            key={g.value}
            value={g.value}
            label={g.label}
            description={g.hint}
            selected={draft.grade === g.value}
            onSelect={(v) => {
              setDraft({ grade: v });
              window.setTimeout(onAutoAdvance, 400);
            }}
            dense
          />
        ))}
      </div>
    </QuestionLayout>
  );
}

export function CurriculumScreen({
  draft,
  setDraft,
  onAutoAdvance,
}: {
  readonly draft: OnboardingDraft;
  readonly setDraft: SetDraft;
  readonly onAutoAdvance: () => void;
}) {
  return (
    <QuestionLayout
      question="Which curriculum?"
      hint="So the tutor speaks in the right register and references the right exams."
    >
      <div className="flex w-full max-w-3xl flex-col gap-2.5">
        {CURRICULUM_OPTIONS.map((c) => {
          const selected = draft.curriculum === c.key;
          return (
            <div key={c.key} className="flex flex-col gap-2">
              <OptionCard
                value={c.key}
                label={c.name}
                description={c.blurb}
                selected={selected}
                onSelect={(v) => {
                  setDraft({ curriculum: v });
                  if (v !== "other") {
                    window.setTimeout(onAutoAdvance, 400);
                  }
                }}
              />
              {selected && c.freeform && (
                <div className="ml-12 mr-1.5">
                  <input
                    type="text"
                    value={draft.curriculumOtherText}
                    onChange={(e) =>
                      setDraft({ curriculumOtherText: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        draft.curriculumOtherText.trim().length > 0
                      ) {
                        e.preventDefault();
                        onAutoAdvance();
                      }
                    }}
                    placeholder="e.g. Swiss Matura"
                    maxLength={60}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {draft.curriculum === "other" && (
        <ContinueBar
          label="Continue"
          disabled={draft.curriculumOtherText.trim().length === 0}
          onContinue={onAutoAdvance}
          hint={
            <span>
              {draft.curriculumOtherText.trim().length > 0
                ? "Looks good. Continue."
                : "Type your curriculum name above."}
            </span>
          }
        />
      )}
    </QuestionLayout>
  );
}

export function SubjectsScreen({
  draft,
  availableSubjects,
  setDraft,
  onContinue,
}: {
  readonly draft: OnboardingDraft;
  readonly availableSubjects: ReadonlyArray<AvailableSubject>;
  readonly setDraft: SetDraft;
  readonly onContinue: () => void;
}) {
  const toggle = (id: Id<"subjects">) => {
    const set = new Set(draft.subjectIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    setDraft({ subjectIds: Array.from(set) });
  };
  const enough = draft.subjectIds.length >= 1;

  return (
    <QuestionLayout
      question="Which subjects can I help you with?"
      hint="Pick everything you will study. You can change this anytime."
    >
      <div className="grid w-full max-w-3xl grid-cols-1 gap-2.5 sm:grid-cols-2">
        {availableSubjects.map((s) => (
          <SubjectOption
            key={s.id}
            subject={s}
            selected={draft.subjectIds.includes(s.id)}
            onToggle={() => toggle(s.id)}
          />
        ))}
      </div>
      <ContinueBar
        label="Continue"
        disabled={!enough}
        onContinue={onContinue}
        hint={
          <span>
            <span className="font-medium text-foreground">
              {draft.subjectIds.length}
            </span>{" "}
            selected · pick at least 1
          </span>
        }
      />
    </QuestionLayout>
  );
}

export function WeakestScreen({
  draft,
  availableSubjects,
  setDraft,
  onContinue,
}: {
  readonly draft: OnboardingDraft;
  readonly availableSubjects: ReadonlyArray<AvailableSubject>;
  readonly setDraft: SetDraft;
  readonly onContinue: () => void;
}) {
  const selectedSet = new Set(draft.subjectIds);
  const candidates = availableSubjects.filter((s) => selectedSet.has(s.id));
  const toggle = (id: Id<"subjects">) => {
    if (
      !draft.weakestSubjectIds.includes(id) &&
      draft.weakestSubjectIds.length >= 3
    ) {
      return;
    }
    const set = new Set(draft.weakestSubjectIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    setDraft({ weakestSubjectIds: Array.from(set) });
  };
  const ready = draft.weakestSubjectIds.length >= 1;

  return (
    <QuestionLayout
      question="Which subjects feel hardest?"
      hint="Pick up to three. These get extra attention from your tutor and on the dashboard."
    >
      <div className="grid w-full max-w-3xl grid-cols-1 gap-2.5 sm:grid-cols-2">
        {candidates.map((s) => {
          const disabled =
            !draft.weakestSubjectIds.includes(s.id) &&
            draft.weakestSubjectIds.length >= 3;
          return (
            <SubjectOption
              key={s.id}
              subject={s}
              selected={draft.weakestSubjectIds.includes(s.id)}
              disabled={disabled}
              onToggle={() => toggle(s.id)}
            />
          );
        })}
      </div>
      <ContinueBar
        label="Continue"
        disabled={!ready}
        onContinue={onContinue}
        hint={
          <span>
            <span className="font-medium text-foreground">
              {draft.weakestSubjectIds.length} of 3
            </span>{" "}
            picked · choose up to 3
          </span>
        }
      />
    </QuestionLayout>
  );
}

export function ExplanationStyleScreen({
  draft,
  setDraft,
  onAutoAdvance,
}: {
  readonly draft: OnboardingDraft;
  readonly setDraft: SetDraft;
  readonly onAutoAdvance: () => void;
}) {
  return (
    <QuestionLayout
      question="When you are learning something new"
      hint="How should I explain it to you?"
    >
      <div className="grid w-full max-w-3xl grid-cols-1 gap-2.5 sm:grid-cols-2">
        {EXPLANATION_OPTIONS.map((o) => (
          <OptionCard
            key={o.value}
            value={o.value}
            label={o.label}
            description={o.description}
            accent={o.accent}
            selected={draft.explanationStyle === o.value}
            onSelect={(v) => {
              setDraft({ explanationStyle: v });
              window.setTimeout(onAutoAdvance, 400);
            }}
          />
        ))}
      </div>
    </QuestionLayout>
  );
}

export function FeedbackStyleScreen({
  draft,
  setDraft,
  onAutoAdvance,
}: {
  readonly draft: OnboardingDraft;
  readonly setDraft: SetDraft;
  readonly onAutoAdvance: () => void;
}) {
  return (
    <QuestionLayout
      question="When you make a mistake"
      hint="How should I correct you?"
    >
      <div className="grid w-full max-w-3xl grid-cols-1 gap-2.5 sm:grid-cols-2">
        {FEEDBACK_OPTIONS.map((o) => (
          <OptionCard
            key={o.value}
            value={o.value}
            label={o.label}
            description={o.description}
            accent={o.accent}
            selected={draft.feedbackStyle === o.value}
            onSelect={(v) => {
              setDraft({ feedbackStyle: v });
              window.setTimeout(onAutoAdvance, 400);
            }}
          />
        ))}
      </div>
    </QuestionLayout>
  );
}

export function LearningPreferenceScreen({
  draft,
  setDraft,
  onAutoAdvance,
}: {
  readonly draft: OnboardingDraft;
  readonly setDraft: SetDraft;
  readonly onAutoAdvance: () => void;
}) {
  return (
    <QuestionLayout
      question="How do you learn best?"
      hint="I will lean the tutor's pace toward your preferred mode."
    >
      <div className="grid w-full max-w-3xl grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {LEARNING_OPTIONS.map((o) => (
          <OptionCard
            key={o.value}
            value={o.value}
            label={o.label}
            description={o.description}
            accent={o.accent}
            selected={draft.learningPreference === o.value}
            onSelect={(v) => {
              setDraft({ learningPreference: v });
              window.setTimeout(onAutoAdvance, 400);
            }}
          />
        ))}
      </div>
    </QuestionLayout>
  );
}

export function BiggestObstacleScreen({
  draft,
  setDraft,
  onAutoAdvance,
}: {
  readonly draft: OnboardingDraft;
  readonly setDraft: SetDraft;
  readonly onAutoAdvance: () => void;
}) {
  return (
    <QuestionLayout
      question="What is your biggest challenge?"
      hint="I will shape your sessions to push back against this specifically."
    >
      <div className="grid w-full max-w-3xl grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {OBSTACLE_OPTIONS.map((o) => (
          <OptionCard
            key={o.value}
            value={o.value}
            label={o.label}
            description={o.description}
            accent={o.accent}
            selected={draft.biggestObstacle === o.value}
            onSelect={(v) => {
              setDraft({ biggestObstacle: v });
              window.setTimeout(onAutoAdvance, 400);
            }}
          />
        ))}
      </div>
    </QuestionLayout>
  );
}

export function PrimaryGoalScreen({
  draft,
  setDraft,
  onAutoAdvance,
}: {
  readonly draft: OnboardingDraft;
  readonly setDraft: SetDraft;
  readonly onAutoAdvance: () => void;
}) {
  return (
    <QuestionLayout
      question="What is your goal?"
      hint="I am aiming the curriculum at this target."
    >
      <div className="grid w-full max-w-3xl grid-cols-1 gap-2.5 sm:grid-cols-2">
        {GOAL_OPTIONS.map((o) => (
          <OptionCard
            key={o.value}
            value={o.value}
            label={o.label}
            description={o.description}
            accent={o.accent}
            selected={draft.primaryGoal === o.value}
            onSelect={(v) => {
              setDraft({ primaryGoal: v });
              window.setTimeout(onAutoAdvance, 400);
            }}
          />
        ))}
      </div>
    </QuestionLayout>
  );
}

export function CommunicationScreen({
  draft,
  setDraft,
  onAutoAdvance,
}: {
  readonly draft: OnboardingDraft;
  readonly setDraft: SetDraft;
  readonly onAutoAdvance: () => void;
}) {
  return (
    <QuestionLayout
      question="How should I talk to you?"
      hint="Pick the teacher voice that makes you most comfortable."
    >
      <div className="flex w-full max-w-3xl flex-col gap-2.5">
        {COMMUNICATION_OPTIONS.map((o) => (
          <OptionCard
            key={o.value}
            value={o.value}
            label={o.label}
            description={o.description}
            preview={o.preview}
            accent={o.accent}
            selected={draft.communicationStyle === o.value}
            onSelect={(v) => {
              setDraft({ communicationStyle: v });
              window.setTimeout(onAutoAdvance, 400);
            }}
          />
        ))}
      </div>
    </QuestionLayout>
  );
}

// ===========================================================================
// Building + Finish
// ===========================================================================

export function BuildingScreen({
  step: _step,
}: {
  readonly step: number;
}) {
  void _step;
  // We tick the index once per stage. Pure CSS / Motion
  // would be cheaper, but a single state-driven animation
  // is more legible when something stalls. The total
  // duration (~5s) covers the realistic mutation time.
  const [messageIdx, setMessageIdx] = useState(0);
  useEffect(() => {
    const tick = () =>
      setMessageIdx((i) =>
        Math.min(BUILDING_MESSAGES.length - 1, i + 1)
      );
    const ids = [700, 1500, 2300, 3200, 4100].map((ms) =>
      window.setTimeout(tick, ms)
    );
    return () => {
      ids.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  return (
    <div className="flex w-full flex-col items-center gap-8 px-4 py-10 sm:py-16">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-3 text-center"
      >
        <span
          aria-hidden
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-accent-subtle/60"
        >
          <span className="absolute inset-0 rounded-full bg-accent/20 blur-xl" />
          <ChatCircleText
            className="relative h-7 w-7 text-accent"
            weight="duotone"
          />
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-accent"
            animate={{ scale: [1, 1.35], opacity: [0.6, 0] }}
            transition={{
              duration: 1.4,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeOut",
            }}
          />
        </span>
        <h1 className="text-balance text-[clamp(1.6rem,2.6vw+0.5rem,2.1rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
          Building your Tutor
        </h1>
        <p className="max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
          Wiring your selections together so the AI speaks in
          your voice, focuses on your weak spots, and explains
          things the way you need them explained.
        </p>
      </motion.div>

      <Timeline messageIdx={messageIdx} />
    </div>
  );
}

/**
 * Timeline.
 *
 * A single vertical rail with 5 nodes. Each node is a
 * 6px disc that lights up in sequence: muted before its
 * stage, accent-bordered while running, filled with the
 * accent once done. The connecting rail fills with a
 * matching accent gradient as stages complete. Reads in
 * one glance: 5 things, 3 done, 2 in flight.
 */
function Timeline({ messageIdx }: { readonly messageIdx: number }) {
  return (
    <ol className="relative flex w-full max-w-md flex-col gap-1 border-l border-border pl-7">
      {BUILDING_MESSAGES.map((m, i) => {
        const done = i < messageIdx;
        const active = i === messageIdx;
        const pct =
          i < messageIdx
            ? 100
            : i === messageIdx
              ? 50
              : 0;
        return (
          <motion.li
            key={m.label}
            initial={{ opacity: 0.45 }}
            animate={{ opacity: i <= messageIdx ? 1 : 0.45 }}
            transition={{ duration: 0.4 }}
            aria-label={`Stage ${m.label}: ${
              done ? "Done" : active ? "Running" : "Queued"
            }. ${m.body}`}
            className="relative flex items-start gap-4 py-3 pr-2"
          >
            <span
              aria-hidden
              className="absolute -left-[34px] top-4 flex h-3 w-3 items-center justify-center rounded-full border-2"
              style={{
                borderColor: done || active ? "var(--accent)" : "var(--border)",
                backgroundColor: done
                  ? "var(--accent)"
                  : active
                    ? "var(--surface-elevated)"
                    : "var(--background)",
              }}
            >
              {active && (
                <span className="block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className="font-mono text-[10.5px] uppercase tracking-[0.18em]"
                style={{
                  color:
                    done || active ? "var(--accent)" : "var(--muted-foreground)",
                }}
              >
                {m.label}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-foreground/90">
                {m.body}
              </p>
            </div>
            <span
              aria-hidden
              className="mt-2 inline-flex items-center justify-center font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground"
              style={{ minWidth: 28 }}
            >
              {done ? "Done" : active ? "Running" : "Queued"}
            </span>
            {/* Local fill rail from the previous node. We render
                a small absolute segment so the global rail keeps
                a consistent 1px width regardless of the local
                node spacing. */}
            {i < BUILDING_MESSAGES.length - 1 && (
              <span
                aria-hidden
                className="absolute -left-[27px] top-7 h-[calc(100%-12px)] w-[2px] bg-border"
              >
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 block bg-accent transition-all duration-500"
                  style={{ height: `${pct}%` }}
                />
              </span>
            )}
          </motion.li>
        );
      })}
    </ol>
  );
}

export interface FinishContext {
  readonly firstName: string;
  readonly gradeLabel: string;
  readonly curriculumLabel: string;
  readonly focusedSubjectTitles: ReadonlyArray<string>;
  readonly weakestSubjectTitles: ReadonlyArray<string>;
  readonly explanationBlurb: string;
  readonly feedbackBlurb: string;
  readonly communicationBlurb: string;
  readonly biggestObstacleBlurb: string;
  readonly primaryGoalBlurb: string;
  readonly primaryGoalValue: Goal | null;
  readonly explanationLabel: string;
  readonly communicationLabel: string;
}

export function FinishScreen({
  ctx,
  onStart,
}: {
  readonly ctx: FinishContext;
  readonly onStart: () => void;
}) {
  const goalAccent = (() => {
    switch (ctx.primaryGoalValue) {
      case "pass_classes":
        return "var(--subject-english)";
      case "improve_grades":
        return "var(--subject-physics)";
      case "top_of_class":
        return "var(--subject-math)";
      case "university_prep":
        return "var(--subject-chemistry)";
      case "master_everything":
        return "var(--subject-german)";
      default:
        return "var(--accent)";
    }
  })();

  return (
    <div className="relative flex w-full flex-col items-center gap-7 px-4 py-8 sm:py-12">
      <ConfettiBurst />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-3 text-center"
      >
        <span
          aria-hidden
          className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[0_10px_40px_-12px_color-mix(in_srgb,var(--accent)_50%,transparent)]"
        >
          <Sparkle className="h-7 w-7" weight="fill" />
        </span>
        <h1 className="max-w-3xl text-balance text-[clamp(2rem,3.6vw+0.6rem,2.6rem)] font-semibold leading-[1.06] tracking-[-0.02em] text-foreground">
          {ctx.firstName
            ? `Hi ${ctx.firstName}. Your Tutor is ready.`
            : "Your Tutor is ready."}
        </h1>
      </motion.div>

      <SummaryBento ctx={ctx} goalAccent={goalAccent} />

      <motion.button
        type="button"
        onClick={onStart}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.6 }}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.97 }}
        className="group inline-flex h-14 items-center gap-3 rounded-2xl bg-accent px-7 text-[15px] font-semibold text-accent-foreground shadow-[0_8px_32px_-12px_color-mix(in_srgb,var(--accent)_45%,transparent)]"
      >
        <Rocket className="h-4 w-4" weight="duotone" />
        Start learning
        <ArrowRight
          className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
          weight="bold"
        />
      </motion.button>

      <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
        Day 1 of focused studying
      </p>
    </div>
  );
}

// ===========================================================================
// QuestionLayout (shared wrapper so screens are tiny)
// ===========================================================================

function QuestionLayout({
  question,
  hint,
  children,
}: {
  readonly question: string;
  readonly hint?: string;
  readonly children: React.ReactNode;
}) {
  // The shared top bar in OnboardingClient.tsx already
  // carries the step counter and progress fill, so this
  // layout never re-renders its own. Keeping the ScreenHeader
  // centered ensures the question reads as a single focal
  // piece above the option grid.
  return (
    <div className="flex w-full flex-col items-center gap-8 px-4 py-8 sm:py-10">
      <ScreenHeader question={question} hint={hint} />
      <div className="flex w-full flex-col items-center gap-6">{children}</div>
    </div>
  );
}

// ===========================================================================
// SubjectOption
// ===========================================================================

function resolveAccent(color?: string): string {
  switch (color) {
    case "subject-math":
      return "var(--subject-math)";
    case "subject-physics":
      return "var(--subject-physics)";
    case "subject-chemistry":
      return "var(--subject-chemistry)";
    case "subject-french":
      return "var(--subject-french)";
    case "subject-german":
      return "var(--subject-german)";
    case "subject-english":
      return "var(--subject-english)";
    default:
      return "var(--accent)";
  }
}

function SubjectOption({
  subject,
  selected,
  disabled,
  onToggle,
}: {
  readonly subject: AvailableSubject;
  readonly selected: boolean;
  readonly disabled?: boolean;
  readonly onToggle: () => void;
}) {
  const accent = resolveAccent(subject.color);
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={selected}
      className="group relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border bg-surface-elevated p-4 pl-6 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none sm:p-4.5 sm:pl-7"
      style={{
        borderColor: selected ? accent : undefined,
        backgroundColor: selected
          ? `color-mix(in srgb, ${accent} 6%, var(--surface-elevated))`
          : undefined,
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 h-full w-[3px] origin-top transition-opacity duration-200"
        style={{
          backgroundColor: accent,
          opacity: selected ? 1 : 0,
        }}
      />
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
        style={{
          backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`,
          borderColor: `color-mix(in srgb, ${accent} 32%, transparent)`,
          color: accent,
        }}
      >
        <SubjectGlyph icon={subject.icon} className="h-4 w-4" fillVar={accent} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-[14.5px] font-semibold tracking-tight text-foreground">
            {subject.title}
          </h3>
          {selected && (
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em]"
              style={{
                backgroundColor: `color-mix(in srgb, ${accent} 16%, transparent)`,
                color: accent,
              }}
            >
              <Sparkle className="h-2.5 w-2.5" weight="fill" />
              Picked
            </span>
          )}
        </div>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {selected ? "1 of your topics" : "Tap to enroll"}
        </p>
      </div>
    </button>
  );
}

// ===========================================================================
// SummaryBento (Finish screen)
// ===========================================================================

/**
 * SummaryBento.
 *
 * Asymmetrical 3-cell bento. Subjects spans the full top
 * row as a wide tile containing chips. Voice and Goal
 * split the bottom row into two equal-width tiles. Each
 * tile carries its own accent: the subject tile uses
 * the primary accent because it is the broad collection;
 * voice + goal use their accent token (data-driven).
 */
function SummaryBento({
  ctx,
  goalAccent,
}: {
  readonly ctx: FinishContext;
  readonly goalAccent: string;
}) {
  const voiceAccent = (() => {
    switch (ctx.communicationLabel) {
      case "Like a teacher":
        return "var(--subject-english)";
      case "Like a private tutor":
        return "var(--subject-chemistry)";
      case "Like a coach":
        return "var(--subject-physics)";
      case "Challenge me":
        return "var(--subject-math)";
      default:
        return "var(--accent)";
    }
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="w-full max-w-2xl"
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {/* Subjects tile spans both columns at the top. */}
        <BentoCell
          accent="var(--accent)"
          label="Your subjects"
          span={2}
          delay={0.32}
        >
          <div className="flex flex-wrap gap-1.5">
            {ctx.focusedSubjectTitles.length === 0 ? (
              <span className="text-[13px] text-muted-foreground">
                No subjects picked yet.
              </span>
            ) : (
              ctx.focusedSubjectTitles.map((t, i) => {
                const isWeak = ctx.weakestSubjectTitles.includes(t);
                return (
                  <span
                    key={`${t}-${i}`}
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium"
                    style={{
                      borderColor: isWeak
                        ? "color-mix(in srgb, var(--accent) 45%, transparent)"
                        : "var(--border)",
                      backgroundColor: isWeak
                        ? "color-mix(in srgb, var(--accent) 10%, transparent)"
                        : "var(--background)",
                      color: isWeak ? "var(--accent)" : "var(--foreground)",
                    }}
                  >
                    {isWeak && (
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: "var(--accent)" }}
                      />
                    )}
                    {t}
                  </span>
                );
              })
            )}
          </div>
        </BentoCell>

        {/* Voice + Goal tiles split the bottom row. */}
        <BentoCell
          accent={voiceAccent}
          label="Tutor voice"
          delay={0.4}
        >
          <p className="text-[13.5px] font-semibold tracking-tight text-foreground">
            {ctx.communicationLabel || "Default"}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            {ctx.communicationBlurb || "Reserved."}
          </p>
        </BentoCell>

        <BentoCell
          accent={goalAccent}
          label="Your target"
          delay={0.46}
        >
          <p className="text-[13.5px] font-semibold tracking-tight text-foreground">
            {ctx.primaryGoalBlurb || "Pick a goal."}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            {ctx.biggestObstacleBlurb || ""}
          </p>
        </BentoCell>
      </div>
    </motion.div>
  );
}

/**
 * BentoCell.
 *
 * The base unit of the finish-screen summary. Thin
 * hairline border, the accent as a 2px left edge, a tiny
 * mono-cap label at the top. Composition is flexible so
 * the cell renders any content stack passed to it.
 */
function BentoCell({
  accent,
  label,
  children,
  span,
  delay = 0,
}: {
  readonly accent: string;
  readonly label: string;
  readonly children: React.ReactNode;
  /** Tailwind grid-column span. Omit on the row's narrower cells. */
  readonly span?: 1 | 2;
  readonly delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-2xl border border-border bg-surface-elevated/70 p-5 backdrop-blur-sm"
      style={{
        // Span mapped to Tailwind class. We key off the prop
        // here so the grid layout stays declarative.
        ...(span === 2 ? { gridColumn: "1 / -1" } : {}),
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 h-full w-[3px]"
        style={{ backgroundColor: accent }}
      />
      <p
        className="font-mono text-[10.5px] uppercase tracking-[0.18em]"
        style={{ color: accent }}
      >
        {label}
      </p>
      <div className="mt-2">{children}</div>
    </motion.div>
  );
}

// (All Phosphor icons used by this file are imported
// at the top and referenced by the screens themselves.)
