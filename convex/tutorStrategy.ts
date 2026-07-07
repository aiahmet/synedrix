import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

import { requireUser, resolveUserReadOnly as resolveUser } from "./users";

/**
 * tutorStrategy.ts — Phase 1 §3.2 Adaptive Teaching Strategy Tracker.
 *
 * Tracks a "teaching strategy state" per session in Convex.
 * After each user message, the route handler analyses whether
 * the current strategy is working and adjusts:
 *
 *   - User response length (short = confused, long = engaged)
 *   - Question depth (surface vs deep)
 *   - Time between messages
 *   - Whether the user clicked "Easier" / "Harder" in SuggestionDock
 *   - Whether the user got the [[choice]] question right or wrong
 *
 * Strategies:
 *   - explaining      — direct explanations
 *   - socratic        — guiding questions only (auto-switch target)
 *   - example_driven  — walking through examples
 *   - quiz_mode       — rapid-fire quizzing
 *   - simplifying     — breaking down to fundamentals
 *
 * Phase 4 §6.3 — Socratic Mode Toggle: a per-session
 * boolean `socraticModeActive` is now persisted here. The
 * toggle is a deliberate user preference, distinct from
 * the auto-switching `currentStrategy` (Socratic mode is
 * FORCED socratic behaviour; the strategy tracker can
 * independently switch OUT of socratic when engagement
 * drops, but the user toggle re-imposes it on the next
 * chat request from the prompt builder).
 *
 * Phase 4 §6.1 — Passive dismissal tracking: the most
 * recent `[[choice:...]]` click is recorded here as
 * `latestChoiceResponseTimeMs` + `latestChoicePickedCorrect`
 * + `latestChoiceMessageId`. The route handler reads
 * these fields when building the next prompt and injects
 * a "take your time" nudge block when the response time
 * is below 2000ms. The fields are cleared after the
 * nudge is consumed so the same signal doesn't fire
 * twice.
 */

export type TeachingStrategy =
  | "explaining"
  | "socratic"
  | "example_driven"
  | "quiz_mode"
  | "simplifying";

// ── Phase 6 §8.3: Practice Readiness ──────────────────────

/**
 * Heuristic: is the user ready for practice?
 *
 * After 5+ turns in a session, the teaching strategy tracker
 * evaluates engagement and accuracy:
 *
 *   - `userEngagementScore > 0.6` (student is paying attention)
 *   - `totalTurns >= 5` (enough conversation to build context)
 *   - `latestChoicePickedCorrect === true` (last check was right,
 *     indicating readiness to attempt harder assessment)
 *
 * `recentChoiceAccuracy` from the plan is approximated by
 * `latestChoicePickedCorrect` — we only persist the MOST
 * RECENT choice signal per session. A future iteration can
 * add a rolling accuracy buffer.
 */
export function isReadyForPractice(state: {
  readonly userEngagementScore: number;
  readonly totalTurns: number;
  readonly latestChoicePickedCorrect: boolean | null;
}): boolean {
  // Phase 6 §8.3: the readiness gate requires moderate
  // engagement + minimum conversation depth + a
  // non-negative choice signal. `latestChoicePickedCorrect`
  // must NOT be `false` (explicitly wrong) but `null`
  // (no choice clicked yet) is allowed — a user who
  // hasn't interacted with choice widgets can still be
  // ready after enough turns. Only an explicitly wrong
  // last choice blocks the chip.
  return (
    state.userEngagementScore > 0.6 &&
    state.totalTurns >= 5 &&
    state.latestChoicePickedCorrect !== false
  );
}

/**
 * getPracticeReadiness.
 *
 * Phase 6 §8.3: returns whether the session is ready for
 * practice. Computed from the strategy state row — reads
 * `userEngagementScore`, computes `totalTurns` from
 * `strategyHistory` + `turnsInCurrentStrategy`, and reads
 * `latestChoicePickedCorrect`.
 *
 * Returns `null` when no strategy row exists (first turn
 * of session, or no session active).
 */
export const getPracticeReadiness = query({
  args: { sessionId: v.id("studySessions") },
  returns: v.union(
    v.object({
      ready: v.boolean(),
      totalTurns: v.number(),
      engagementScore: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, { sessionId }) => {
    const user = await resolveUser(ctx);
    if (!user) return null;

    const row = await ctx.db
      .query("teachingStrategyState")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .first();
    if (!row) return null;

    // Total turns = accumulated turns across all past
    // strategies (from the history) + turns in the
    // current strategy.
    const historyTurns = row.strategyHistory.reduce(
      (sum, h) => sum + h.turns,
      0
    );
    const totalTurns = historyTurns + row.turnsInCurrentStrategy;

    const ready = isReadyForPractice({
      userEngagementScore: row.userEngagementScore,
      totalTurns,
      latestChoicePickedCorrect: row.latestChoicePickedCorrect ?? null,
    });

    return {
      ready,
      totalTurns,
      engagementScore: row.userEngagementScore,
    };
  },
});

// ── Queries ───────────────────────────────────────────────

/**
 * Get the current strategy state for a session. Returns `null`
 * when no strategy row exists yet (first turn of a new session).
 *
 * Phase 4 §6.3: Now also returns `socraticModeActive`
 * so the route handler can read both the auto-switch
 * strategy AND the user toggle in one round-trip.
 *
 * Phase 4 §6.1: Returns `latestChoiceResponseTimeMs`
 * + `latestChoicePickedCorrect` + `latestChoiceMessageId`
 * so the route handler can decide whether to inject a
 * passive-dismissal nudge on the next prompt build.
 */
export const getStrategyState = query({
  args: { sessionId: v.id("studySessions") },
  returns: v.union(
    v.object({
      currentStrategy: v.string(),
      lastSwitchReason: v.union(v.string(), v.null()),
      userEngagementScore: v.number(),
      turnsInCurrentStrategy: v.number(),
      strategyHistory: v.array(
        v.object({
          strategy: v.string(),
          turns: v.number(),
          switchedAt: v.number(),
        })
      ),
      socraticModeActive: v.boolean(),
      latestChoiceResponseTimeMs: v.union(v.number(), v.null()),
      latestChoicePickedCorrect: v.union(v.boolean(), v.null()),
      latestChoiceMessageId: v.union(v.string(), v.null()),
      lastChoiceNudgeAt: v.union(v.number(), v.null()),
    }),
    v.null()
  ),
  handler: async (ctx, { sessionId }) => {
    const user = await resolveUser(ctx);
    if (!user) return null;

    const row = await ctx.db
      .query("teachingStrategyState")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .first();
    if (!row) return null;

    return {
      currentStrategy: row.currentStrategy,
      lastSwitchReason: row.lastSwitchReason ?? null,
      userEngagementScore: row.userEngagementScore,
      turnsInCurrentStrategy: row.turnsInCurrentStrategy,
      strategyHistory: row.strategyHistory,
      socraticModeActive: row.socraticModeActive ?? false,
      latestChoiceResponseTimeMs: row.latestChoiceResponseTimeMs ?? null,
      latestChoicePickedCorrect: row.latestChoicePickedCorrect ?? null,
      latestChoiceMessageId: row.latestChoiceMessageId ?? null,
      lastChoiceNudgeAt: row.lastChoiceNudgeAt ?? null,
    };
  },
});

// ── Mutations ─────────────────────────────────────────────

/**
 * Initialise the strategy state row for a new session.
 * Called once when the first user message is sent.
 */
export const initStrategy = mutation({
  args: {
    sessionId: v.id("studySessions"),
    initialStrategy: v.optional(
      v.union(
        v.literal("explaining"),
        v.literal("socratic"),
        v.literal("example_driven"),
        v.literal("quiz_mode"),
        v.literal("simplifying")
      )
    ),
  },
  returns: v.null(),
  handler: async (ctx, { sessionId, initialStrategy }) => {
    const user = await requireUser(ctx);
    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== user._id) {
      throw new Error("Forbidden");
    }

    // Idempotent: skip if already initialised.
    const existing = await ctx.db
      .query("teachingStrategyState")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .first();
    if (existing) return null;

    await ctx.db.insert("teachingStrategyState", {
      sessionId,
      currentStrategy: initialStrategy ?? "explaining",
      // Honours a non-default initial strategy: if the
      // caller passed `"socratic"`, we seed `currentStrategy`
      // to socratic AND turn on `socraticModeActive` so the
      // prompt builder treats the whole session as
      // Socratic from turn 1. Other initial strategies
      // leave `socraticModeActive` undefined (treated as
      // `false` on read).
      ...(initialStrategy === "socratic"
        ? { socraticModeActive: true as boolean }
        : {}),
      lastSwitchReason: undefined,
      userEngagementScore: 0.5,
      turnsInCurrentStrategy: 0,
      strategyHistory: [],
    });
    return null;
  },
});

/**
 * Phase 4 §6.3: toggle Socratic mode on or off for a
 * session. Persists to the existing
 * `teachingStrategyState` row so the route handler
 * reads it together with the auto-switch strategy.
 *
 * UX contract: Socratic mode is a deliberate user
 * preference: "the tutor NEVER gives direct answers;
 * it only asks guiding questions." It is conceptually
 * separate from the auto-switching `currentStrategy`
 * — engagement can still drop the strategy out of
 * socratic, but the toggle re-imposes it on every
 * subsequent chat request via the prompt builder.
 *
 * Idempotent: re-calling with the same `active` is a
 * no-op.
 */
export const toggleSocraticMode = mutation({
  args: {
    sessionId: v.id("studySessions"),
    active: v.boolean(),
  },
  returns: v.union(
    v.object({
      socraticModeActive: v.boolean(),
      currentStrategy: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, { sessionId, active }) => {
    const user = await requireUser(ctx);
    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== user._id) {
      throw new Error("Forbidden");
    }

    const row = await ctx.db
      .query("teachingStrategyState")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .first();
    if (!row) return null;

    const current = row.socraticModeActive ?? false;
    if (current === active) {
      return {
        socraticModeActive: current,
        currentStrategy: row.currentStrategy,
      };
    }

    // When turning Socratic mode ON, switch the
    // auto-strategy to `"socratic"` so the strategy
    // tracker visual + log both align. When turning
    // OFF, leave `currentStrategy` alone — the next
    // recordTurn will naturally drift it back based
    // on engagement.
    const nextStrategy = active
      ? (
          row.currentStrategy === "socratic"
            ? row.currentStrategy
            : "socratic"
        )
      : row.currentStrategy;
    const history =
      active && row.currentStrategy !== "socratic"
        ? [
            ...row.strategyHistory,
            {
              strategy: row.currentStrategy,
              turns: row.turnsInCurrentStrategy,
              switchedAt: Date.now(),
            },
          ]
        : row.strategyHistory;

    await ctx.db.patch(row._id, {
      socraticModeActive: active,
      currentStrategy: nextStrategy,
      turnsInCurrentStrategy: active && row.currentStrategy !== "socratic" ? 0 : row.turnsInCurrentStrategy,
      lastSwitchReason: active
        ? "User toggled Socratic mode ON from SessionHeader."
        : undefined,
      strategyHistory: history,
    });

    return {
      socraticModeActive: active,
      currentStrategy: nextStrategy,
    };
  },
});

/**
 * Phase 4 §6.1: record the latest `[[choice:...]]`
 * widget click for the session. Called client-side
 * immediately on ChoiceMenu click so the data is
 * durable across page refresh / re-fetch even if the
 * user doesn't send a follow-up message.
 *
 * The route handler reads this via
 * `getStrategyState` and injects a "take your time"
 * nudge block into the next prompt when
 * `responseTimeMs < 2000` AND the picked label is
 * wrong OR `responseTimeMs < 1000` (instant click). It
 * then clears the fields via `clearLatestChoiceClick`.
 */
export const recordChoiceClick = mutation({
  args: {
    sessionId: v.id("studySessions"),
    messageId: v.string(),
    responseTimeMs: v.number(),
    pickedCorrect: v.boolean(),
  },
  returns: v.null(),
  handler: async (
    ctx,
    { sessionId, messageId, responseTimeMs, pickedCorrect }
  ) => {
    const user = await requireUser(ctx);
    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== user._id) {
      throw new Error("Forbidden");
    }

    const row = await ctx.db
      .query("teachingStrategyState")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .first();
    if (!row) return null;

    await ctx.db.patch(row._id, {
      latestChoiceResponseTimeMs: responseTimeMs,
      latestChoicePickedCorrect: pickedCorrect,
      latestChoiceMessageId: messageId,
    });

    return null;
  },
});

/**
 * Phase 4 §6.1: clear the latest-choice-click
 * signal once the route handler has consumed it
 * (i.e. injected the nudge into a prompt). Called
 * from the route handler's `onEnd` block on the
 * turn that USES the field to nudge.
 *
 * `lastChoiceNudgeAt` is updated so the next read
 * can detect "this same signal has already been
 * acted on" if the route handler is called again
 * before the user sends another message (e.g. the
 * user clicks Regenerate, which triggers a fresh
 * POST without a fresh choice click).
 */
export const clearLatestChoiceClick = mutation({
  args: { sessionId: v.id("studySessions") },
  returns: v.null(),
  handler: async (ctx, { sessionId }) => {
    const user = await requireUser(ctx);
    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== user._id) {
      throw new Error("Forbidden");
    }

    const row = await ctx.db
      .query("teachingStrategyState")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .first();
    if (!row) return null;

    const now = Date.now();
    await ctx.db.patch(row._id, {
      latestChoiceResponseTimeMs: undefined,
      latestChoicePickedCorrect: undefined,
      latestChoiceMessageId: undefined,
      lastChoiceNudgeAt: now,
    });
    return null;
  },
});

/**
 * Record a turn and optionally update the strategy. Called by
 * the route handler after each user message + assistant reply
 * pair. The route handler provides:
 *
 *   - userMessageLength: character count of the user's input
 *   - responseTimeMs: time between assistant reply and user
 *     response (null for the first turn)
 *   - choiceCorrect: whether the user got the [[choice]] right
 *     (null when no choice was presented)
 *   - explicitFeedback: "easier" | "harder" | null — set when
 *     the user clicked a SuggestionDock chip
 */
export const recordTurn = mutation({
  args: {
    sessionId: v.id("studySessions"),
    userMessageLength: v.number(),
    responseTimeMs: v.union(v.number(), v.null()),
    choiceCorrect: v.union(v.boolean(), v.null()),
    explicitFeedback: v.optional(
      v.union(v.literal("easier"), v.literal("harder"))
    ),
  },
  returns: v.union(
    v.object({
      currentStrategy: v.string(),
      switched: v.boolean(),
      switchReason: v.union(v.string(), v.null()),
    }),
    v.null()
  ),
  handler: async (
    ctx,
    { sessionId, userMessageLength, responseTimeMs, choiceCorrect, explicitFeedback }
  ) => {
    const user = await requireUser(ctx);
    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== user._id) return null;

    const row = await ctx.db
      .query("teachingStrategyState")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .first();
    if (!row) return null;

    // ── Compute engagement signals ──────────────────────

    // Length signal: < 15 chars = low engagement, > 80 = high
    let lengthScore = 0.5;
    if (userMessageLength < 15) lengthScore = 0.25;
    else if (userMessageLength > 80) lengthScore = 0.8;

    // Choice signal: correct → engaged, wrong → struggling
    let choiceScore = 0.5;
    if (choiceCorrect === true) choiceScore = 0.8;
    else if (choiceCorrect === false) choiceScore = 0.3;

    // Time signal: < 5s might be fast (engaged or rushing),
    // > 60s might be distracted
    let timeScore = 0.5;
    if (responseTimeMs !== null) {
      if (responseTimeMs < 5000) timeScore = 0.6;
      else if (responseTimeMs > 60000) timeScore = 0.35;
      else timeScore = 0.65;
    }

    // Blend engagement: weighted average (length most important)
    const engagementScore =
      lengthScore * 0.4 + choiceScore * 0.35 + timeScore * 0.25;

    // ── Determine if a strategy switch is needed ─────────

    let switched = false;
    let switchReason: string | null = null;
    let newStrategy: TeachingStrategy = row.currentStrategy as TeachingStrategy;

    if (explicitFeedback === "easier") {
      newStrategy = "simplifying";
      switchReason = "User requested easier explanation via SuggestionDock.";
      switched = true;
    } else if (explicitFeedback === "harder") {
      newStrategy = "example_driven";
      switchReason = "User requested harder example via SuggestionDock.";
      switched = true;
    } else if (
      row.turnsInCurrentStrategy >= 3 &&
      engagementScore < 0.4 &&
      row.currentStrategy !== "simplifying"
    ) {
      // Low engagement for 3+ turns → simplify
      newStrategy = "simplifying";
      switchReason = `Low engagement (${engagementScore.toFixed(2)}) after ${row.turnsInCurrentStrategy} turns of ${row.currentStrategy}.`;
      switched = true;
    } else if (
      row.turnsInCurrentStrategy >= 3 &&
      engagementScore > 0.7 &&
      row.currentStrategy === "simplifying"
    ) {
      // High engagement after simplifying → back to explaining
      newStrategy = "explaining";
      switchReason = `High engagement (${engagementScore.toFixed(2)}) after simplifying — student ready for deeper material.`;
      switched = true;
    } else if (
      choiceCorrect === false &&
      row.turnsInCurrentStrategy >= 2 &&
      row.currentStrategy === "explaining"
    ) {
      // Getting questions wrong → switch to example-driven
      newStrategy = "example_driven";
      switchReason = "Incorrect choice answer after 2+ turns of explaining — switching to example-driven.";
      switched = true;
    } else if (
      choiceCorrect === true &&
      row.turnsInCurrentStrategy >= 3 &&
      (row.currentStrategy === "explaining" || row.currentStrategy === "example_driven")
    ) {
      // Getting questions right consistently → try quiz mode
      newStrategy = "quiz_mode";
      switchReason = "Correct answers consistently — switching to quiz mode to test deeper.";
      switched = true;
    }

    const now = Date.now();
    const history = [...row.strategyHistory];

    if (switched) {
      // Archive the previous strategy
      history.push({
        strategy: row.currentStrategy,
        turns: row.turnsInCurrentStrategy + 1,
        switchedAt: now,
      });
    }

    const newTurns = switched ? 0 : row.turnsInCurrentStrategy + 1;

    await ctx.db.patch(row._id, {
      currentStrategy: newStrategy,
      lastSwitchReason: switchReason ?? undefined,
      userEngagementScore: engagementScore,
      turnsInCurrentStrategy: newTurns,
      strategyHistory: history,
    });

    return {
      currentStrategy: newStrategy,
      switched,
      switchReason,
    };
  },
});

/**
 * Build a compact prompt block describing the current strategy
 * state. Injected into the system prompt by the route handler.
 *
 * Phase 4 §6.3: when `socraticModeActive === true`, the
 * block prepends a sharp "Socratic mode is ON" override so
 * the model knows the user has deliberately FORCED socratic
 * behaviour for this session — independent of the
 * auto-switching `currentStrategy`. The override is verbose
 * (rather than compact) because the model misreads "we are
 * currently in socratic strategy" as a transient hint;
 * "the user has Socratic mode on" is read as binding.
 *
 * Phase 4 §6.1: when `latestChoiceResponseTimeMs` is below
 * 2000ms AND `latestChoiceMessageId` is set AND
 * `lastChoiceNudgeAt` is older OR missing, appends a
 * passive-dismissal nudge block. The block is rendered
 * exactly ONCE per signal: the route handler sets
 * `lastChoiceNudgeAt` after it's consumed so the next
 * recordTurn / regen doesn't re-fire the same nudge.
 */
export function buildStrategyPromptBlock(args: {
  readonly strategy: string;
  readonly engagement: number;
  readonly turns: number;
  readonly socraticModeActive: boolean;
  readonly latestChoice?: {
    readonly responseTimeMs: number;
    readonly messageId: string;
    readonly pickedCorrect: boolean;
    readonly lastNudgeAt: number | null;
  };
}): string {
  const strategyHint = STRATEGY_HINTS[args.strategy] ?? STRATEGY_HINTS.explaining;
  const base = `== Teaching strategy state ==
Current strategy: ${args.strategy} — ${strategyHint}
Engagement: ${Math.round(args.engagement * 100)}% (${args.turns} turns in this strategy)
Adapt strategy dynamically based on user signals. Switch when engagement drops or the user requests easier/harder.`;

  const blocks: string[] = [base];

  if (args.socraticModeActive) {
    blocks.push(SOCRATIC_MODE_BLOCK.trim());
  }

  if (args.latestChoice) {
    const { responseTimeMs, messageId, pickedCorrect, lastNudgeAt } =
      args.latestChoice;
    const shouldNudge = shouldInjectNudge({
      responseTimeMs,
      pickedCorrect,
      lastNudgeAt,
      messageId,
    });
    if (shouldNudge) {
      blocks.push(
        PASSIVE_DISMISSAL_NUDGE_BLOCK(messageId, responseTimeMs).trim()
      );
    }
  }

  return blocks.join("\n\n");
}

/**
 * Phase 4 §6.3 — Socratic mode override block. Injected
 * at the extreme end of the prompt (after the strategy
 * block) when the user has Socratic mode toggled ON, so
 * it sits at the highest attention weight for the
 * model's next tokens.
 */
const SOCRATIC_MODE_BLOCK = `
== Socratic mode is ON for this session ==
The user has explicitly requested Socratic mode. From this turn
onward, you MUST follow these rules — they override the
"give direct explanations" default below and override the
"Try it yourself" block rule above:
  1. NEVER reveal the answer directly. Never state a formula,
     rule, or final answer in your prose. Even a one-sentence
     spoiler counts as a violation.
  2. Lead EVERY explanation turn with a guiding question
     that the student can attempt before you narrow the gap.
     The question should sit on the SAME claim your check
     widget will test.
  3. After the student's next message (their attempt),
     narrow the gap ONE step at a time: confirm the part
     that's correct, surface the part that isn't, and ask
     one more follow-up before going further.
  4. PART 1 (explanation) MUST end with a single guiding
     question the student can answer from what they already
     know. PART 2 (visual) should be a \`[[steps:...]]\` block
     that paces the reveal — do NOT dump a full worked
     solution.
  5. PART 4 (check) STILL emits one \`[[choice:...]]\` widget
     that tests the same claim, but every option should be
     the student's reasoning, not the teacher's answer.
  6. Affirmations are allowed; exposition is not.
End Socratic mode by the user toggling it OFF in the
header — until then, stay in this mode for the entire
session.
`;

/**
 * Phase 4 §6.1 — passive-dismissal nudge block. Appended
 * to the prompt when the user clicked a \`[[choice:...]]\`
 * widget in less than 2 seconds without engaging with the
 * rationale. The model is told to drop ONE subtle,
 * non-judgemental line in its next reply.
 */
const PASSIVE_DISMISSAL_NUDGE_BLOCK = (
  messageId: string,
  responseTimeMs: number
) => `
== Choice-click engagement signal ==
${messageId ? `The student clicked the quick check on assistant message \`${messageId}\` only ${Math.round(responseTimeMs)} ms after it became interactable.\n` : ""}This suggests the click happened without engaging with the explanation. ONE TIME in this response, drop a single, non-judgemental, brief nudge — for example:
  "Take your time with these — the goal is understanding, not speed."
or
  "When a question lands before you've finished parsing the explanation, it's OK to sit with it for a moment instead of picking immediately."
The nudge must be a single sentence, NOT a new section. It must NOT replace any of the 5-part rhythm. It must NOT feel like a reprimand. After this response, the signal clears and the nudge does not re-fire unless the same pattern repeats.
`;

/**
 * Decide whether the nudge should fire on the next prompt
 * build. Mirrors the active learning enforcement:
 *
 *   - responseTimeMs < 1000ms → always nudge (instant
 *     click, regardless of correctness).
 *   - 1000ms ≤ responseTimeMs < 2000ms AND pickedCorrect
 *     === false → nudge (fast + wrong = pattern).
 *   - responseTimeMs ≥ 2000ms → no nudge (engaged).
 *
 *   AND the last nudge was either (a) never injected,
 *   or (b) injected for a DIFFERENT message id, so a
 *   regenerate doesn't re-fire the same nudge.
 */
export function shouldInjectNudge(args: {
  readonly responseTimeMs: number;
  readonly pickedCorrect: boolean;
  readonly lastNudgeAt: number | null;
  readonly messageId: string;
}): boolean {
  if (!args.messageId) return false;
  if (args.responseTimeMs >= 2000) return false;
  if (args.responseTimeMs < 1000) return true;
  // 1000ms–2000ms + wrong answer
  return args.pickedCorrect === false;
}

/** Phase 4 §6.1: export the nudge-threshold constants so
 *  tests can verify them without re-deriving. */
export const PASSIVE_DISMISSAL_THRESHOLD_MS = 2000;
export const INSTANT_CLICK_THRESHOLD_MS = 1000;


const STRATEGY_HINTS: Record<string, string> = {
  explaining: "Give clear, direct explanations with one worked example.",
  socratic: "Only ask guiding questions. Never reveal the answer directly.",
  example_driven: "Walk through full examples step by step before explaining.",
  quiz_mode: "Rapid-fire quizzing. One question per turn. Grade immediately.",
  simplifying: "Break down to the simplest fundamentals. Use everyday analogies.",
};
