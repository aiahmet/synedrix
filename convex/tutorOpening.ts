/**
 * tutorOpening.ts — Phase 1 §3.3 Proactive Session Start.
 *
 * Generates an AI-quality opening message when a tutor thread
 * is created. Instead of a templated string, this module
 * builds a lightweight prompt from Convex data that surfaces:
 *
 *   1. Where the user is in the curriculum (topic + mastery)
 *   2. The most recent mistake or gap
 *   3. One concrete next action
 *   4. Ends with a question that invites participation
 *
 * The opening is built locally (no AI call) because the
 * latency cost of a model round-trip on thread creation
 * is not worth it for a 2-sentence opening — the model's
 * first actual reply after the opening does the heavy
 * lifting.
 *
 * Phase 7 §9.1 — Context-Aware Greeting Tone: the opening
 * tone adapts to the student's state. Four tones:
 *
 *   - warm (returning after a good session / high mastery)
 *   - gentle (returning after a struggling session / low
 *     mastery with mistakes)
 *   - curious (first time on this topic)
 *   - calm_exam (profile `biggestObstacle === "exam_panic"`
 *     — structured, timed, exam-day rhythm)
 */
export function buildProactiveOpening(args: {
  readonly topicTitle: string;
  readonly masteryPct: number;
  readonly recentMistakes: ReadonlyArray<{
    readonly type: string;
    readonly cause: string;
  }>;
  readonly hasLessonContext: boolean;
  readonly lessonGrade: string | null;
  readonly focusItemPrompt: string | null;
  readonly focusItemVerdict: string | null;
  /**
   * Phase 7 §9.1: tone context derived from the user's
   * profile and prior session signals. When omitted,
   * the opening uses the existing mastery-driven logic
   * (backward-compatible).
   */
  readonly toneContext?: {
    /** `true` when the user's last session on this
     *  topic ended with a positive mastery delta
     *  (≥ +0.05) AND the user is returning within
     *  7 days. */
    readonly returningAfterGoodSession: boolean;
    /** `true` when the user's last session on this
     *  topic ended with a negligible or negative
     *  mastery delta (< +0.05) AND the user has
     *  recent mistakes. */
    readonly returningAfterStrugglingSession: boolean;
    /** `true` when the user's profile has
     *  `biggestObstacle === "exam_panic"`. Triggers
     *  the calm, structured exam-prep tone. */
    readonly hasExamPanicProfile: boolean;
    /** The user's first name for a personal touch.
     *  When `null`, the opening uses the topic title
     *  as the greeting anchor (existing behaviour). */
    readonly studentFirstName: string | null;
  };
}): string {
  const {
    topicTitle,
    masteryPct,
    recentMistakes,
    hasLessonContext,
    lessonGrade,
    focusItemPrompt,
    focusItemVerdict,
    toneContext,
  } = args;

  const cleanTitle = topicTitle.replace(/[^a-zA-Z0-9 äöüßÄÖÜ]/g, "").trim();

  // ── Lesson-context opening (practice results CTA) ──────
  // Phase 7 §9.1: lesson-context openings still use the
  // existing per-item logic — the tone is already grounded
  // in the specific question/grade. Tone context does not
  // re-structure this path because the lesson context IS
  // the emotional signal (grade + per-item verdict).
  if (hasLessonContext && lessonGrade) {
    const gradeLine = `I just looked over your last practice on **${cleanTitle}** — grade **${lessonGrade}** on the German 1–6 scale.`;

    if (focusItemPrompt && focusItemVerdict) {
      const verdictLabel = focusItemVerdict.replace(/_/g, " ");
      return `${gradeLine}

You asked about the question: *"${focusItemPrompt}"* — your answer was marked **${verdictLabel}**.

Let's walk through it. Where would you like to start — your original approach, or should I break down the correct solution step by step?`;
    }

    const firstMistake = recentMistakes[0];
    if (firstMistake) {
      const mistakeLabel = firstMistake.type.replace(/_/g, " ").toLowerCase();
      return `${gradeLine}

Your most recent gap: **${mistakeLabel}** — ${firstMistake.cause || "let's work through it together"}.

Want me to walk through an example that targets this specific pattern, or would you prefer to start from the concept?`;
    }

    return `${gradeLine}

All items were correct — that's solid. Let's push for transfer: would you like a harder set of questions, or should we connect this topic to the next one in the curriculum?`;
  }

  // ── Phase 7 §9.1: exam-panic tone (topic-scoped highest priority) ─
  // Topic-scoped tone with highest priority. Lesson-context
  // openings bypass ALL tone paths above — the lesson
  // context IS the emotional signal (grade + per-item
  // verdict). The student explicitly
  // flagged exam pressure as their biggest obstacle — the
  // opening should model exam-day calm and structure.
  if (toneContext?.hasExamPanicProfile) {
    return buildExamPanicOpening({
      cleanTitle,
      masteryPct,
      recentMistakes,
      studentFirstName: toneContext.studentFirstName,
    });
  }

  // ── Topic-scoped opening ───────────────────────────────
  if (masteryPct > 0) {
    // Phase 7 §9.1: returning-after-good tone
    if (toneContext?.returningAfterGoodSession) {
      return buildWarmReturnOpening({
        cleanTitle,
        masteryPct,
        recentMistakes,
        studentFirstName: toneContext.studentFirstName,
      });
    }

    // Phase 7 §9.1: returning-after-struggling tone
    if (toneContext?.returningAfterStrugglingSession) {
      return buildGentleReturnOpening({
        cleanTitle,
        masteryPct,
        recentMistakes,
        studentFirstName: toneContext.studentFirstName,
      });
    }

    // ── Existing mastery-driven openings (no tone context,
    //    or neutral tone) ─────────────────────────────────
    const firstMistake = recentMistakes[0];
    if (firstMistake) {
      const mistakeLabel = firstMistake.type.replace(/_/g, " ").toLowerCase();
      return `You're on **${cleanTitle}** — currently at **${masteryPct}%** mastery. I noticed a recurring pattern: **${mistakeLabel}** — ${firstMistake.cause || "it keeps showing up in your recent attempts"}.

Want to tackle this gap head-on with a worked example, or should we start by reviewing the fundamentals?`;
    }

    if (masteryPct < 40) {
      return `Welcome to **${cleanTitle}**. You're at **${masteryPct}%** mastery — still building the foundations. I'll ground every answer in your current level and your recent work.

What's the first thing you'd like to understand better?`;
    }

    if (masteryPct < 70) {
      return `You're making progress on **${cleanTitle}** — **${masteryPct}%** mastery so far. The middle third is where the connections start to click.

What's the concept that still feels fuzzy? Start there and I'll connect it to what you already know.`;
    }

    return `Solid ground on **${cleanTitle}** at **${masteryPct}%** mastery. At this level the best progress comes from transfer — applying the concept in new contexts and harder problems.

Where do you want to push next?`;
  }

  // ── Phase 7 §9.1: first-time-ever tone (curious) ──────
  if (toneContext?.studentFirstName) {
    return `I've read your profile, ${toneContext.studentFirstName} — I know how you learn best and where your curriculum is heading. This is your first session on **${cleanTitle}**, so I'll start from zero and build up step by step.

What's the first concept you'd like to tackle?`;
  }

  // ── First-time opening (fallback, no tone context) ─────
  return `This is your first session on **${cleanTitle}** — I'll start from zero and build up step by step. I've read your profile and your work on related topics, so I know where you're coming from.

What's the first concept you'd like to tackle?`;
}

// ── Phase 7 §9.1: tone-specific builders ─────────────────

/**
 * Warm return — the user's last session went well and they're
 * back within a week. Encouraging, forward-looking, specific.
 */
function buildWarmReturnOpening(args: {
  readonly cleanTitle: string;
  readonly masteryPct: number;
  readonly recentMistakes: ReadonlyArray<{
    readonly type: string;
    readonly cause: string;
  }>;
  readonly studentFirstName: string | null;
}): string {
  const { cleanTitle, masteryPct, recentMistakes, studentFirstName } = args;
  const greeting = studentFirstName ? `Great to see you back, ${studentFirstName}.` : "Great to see you back.";

  const firstMistake = recentMistakes[0];
  if (firstMistake) {
    const mistakeLabel = firstMistake.type.replace(/_/g, " ").toLowerCase();
    return `${greeting} Your mastery on **${cleanTitle}** held strong at **${masteryPct}%**. The pattern I'm watching is **${mistakeLabel}** — ${firstMistake.cause || "it's the next layer to lock in"}.

Want to clean that up in one go, or would you rather push into the next concept and circle back?`;
  }

  if (masteryPct >= 70) {
    return `${greeting} **${cleanTitle}** is solid at **${masteryPct}%** — your last session moved the needle. At this level the best progress comes from transfer.

What's the next concept you want to connect this to?`;
  }

  return `${greeting} You're climbing on **${cleanTitle}** — **${masteryPct}%** and the trend is up. Let's keep that momentum.

Where do you want to pick up?`;
}

/**
 * Gentle return — the user's last session didn't move mastery
 * much and they have unresolved mistakes. Reassuring, patient,
 * one concrete thing to focus on.
 */
function buildGentleReturnOpening(args: {
  readonly cleanTitle: string;
  readonly masteryPct: number;
  readonly recentMistakes: ReadonlyArray<{
    readonly type: string;
    readonly cause: string;
  }>;
  readonly studentFirstName: string | null;
}): string {
  const { cleanTitle, masteryPct, recentMistakes, studentFirstName } = args;
  const greeting = studentFirstName
    ? `No rush, ${studentFirstName}.`
    : "No rush.";

  const firstMistake = recentMistakes[0];
  if (firstMistake) {
    const mistakeLabel = firstMistake.type.replace(/_/g, " ").toLowerCase();
    return `${greeting} You're at **${masteryPct}%** on **${cleanTitle}** and the last session surfaced a pattern: **${mistakeLabel}**. Let's pick just that one thing and nail it today.

Want me to walk through an example that isolates this specific gap?`;
  }

  return `${greeting} **${cleanTitle}** is at **${masteryPct}%** — no rush, we'll build it one layer at a time. Let's start with whatever feels closest to clicking.

What's the single concept you'd most like to untangle today?`;
}

/**
 * Exam-panic tone — the student's profile says exam pressure
 * is their biggest obstacle. Calm, structured, timed-rhythm.
 * Every opening reinforces: "you have a plan, you have time."
 */
function buildExamPanicOpening(args: {
  readonly cleanTitle: string;
  readonly masteryPct: number;
  readonly recentMistakes: ReadonlyArray<{
    readonly type: string;
    readonly cause: string;
  }>;
  readonly studentFirstName: string | null;
}): string {
  const { cleanTitle, masteryPct, recentMistakes, studentFirstName } = args;
  const greeting = studentFirstName
    ? `Calm and structured, ${studentFirstName}.`
    : "Calm and structured.";

  const firstMistake = recentMistakes[0];

  if (masteryPct === 0) {
    // First time + exam panic — the pressure is from the
    // subject as a whole, not this specific topic.
    if (firstMistake) {
      const mistakeLabel = firstMistake.type.replace(/_/g, " ").toLowerCase();
      return `${greeting} This is your first session on **${cleanTitle}**, and your profile says exam rhythm matters. We'll build this topic in timed, bite-sized passes — each session targets exactly one layer.

Your most recent gap across related topics is **${mistakeLabel}** — we'll front-load that pattern so it doesn't follow you into the exam. Ready for the first layer?`;
    }
    return `${greeting} This is your first session on **${cleanTitle}**, and your profile says exam rhythm matters. We'll build this topic in timed, bite-sized passes — each session targets exactly one layer, no cramming.

Ready for layer one?`;
  }

  if (firstMistake) {
    const mistakeLabel = firstMistake.type.replace(/_/g, " ").toLowerCase();
    return `${greeting} You're at **${masteryPct}%** on **${cleanTitle}** and your last session surfaced a gap: **${mistakeLabel}**. Instead of broad review, let's isolate that pattern in a 15-minute focused pass — exam pace, one gap at a time.

Want me to set the timer and walk you through it?`;
  }

  if (masteryPct < 50) {
    return `${greeting} **${cleanTitle}** is at **${masteryPct}%** — still in the foundation layer. We'll build exam-ready understanding in structured blocks: explain → attempt → review → next. No cramming, no panic.

Which part of this topic feels the most time-sensitive before the exam?`;
  }

  if (masteryPct < 80) {
    return `${greeting} **${cleanTitle}** is at **${masteryPct}%** — solid middle ground. At this level the best exam prep is targeted retrieval: pull a concept from memory, apply it cold, then review. We'll model that rhythm today.

Ready to run a retrieval pass?`;
  }

  return `${greeting} **${cleanTitle}** is strong at **${masteryPct}%**. Exam-day confidence comes from knowing the patterns cold — let's test transfer under time pressure today.

What would you like to stress-test first?`;
}
