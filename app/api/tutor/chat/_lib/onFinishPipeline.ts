import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { logAiGeneration } from "@/lib/ai/telemetry";
import type { StrategyState } from "@/lib/ai/types/tutor";
import type { OnFinishPayload } from "@/lib/ai/types/tutor";

/**
 * Creates the `onFinish` handler for the tutor chat stream.
 *
 * The returned closure:
 * 1. Persists the assistant message (with structured content
 *    parsed from the AI output per Phase 1 §3.1).
 * 2. Logs the AI generation to the telemetry table.
 * 3. Records the strategy turn (Phase 1 §3.2).
 * 4. Clears the latest choice click if a nudge is active.
 */
export function createOnFinishHandler(
  convex: ConvexHttpClient,
  params: {
    threadId: string;
    sessionId?: string;
    modelId: string;
    startMs: number;
    userMessageText?: string | null;
    strat?: StrategyState | null;
    mode?: "default" | "summarize" | "exam" | "compare";
  }
): (result: OnFinishPayload) => Promise<void> {
  const {
    threadId,
    sessionId,
    modelId,
    startMs,
    userMessageText,
    strat,
    mode,
  } = params;

  // Compute the passive-dismissal nudge from strategy state
  // so we know whether to clear the latest choice click.
  const activeLearningNudge = computeActiveLearningNudge(strat ?? null);

  return async ({ text, usage }) => {
    try {
      const trimmed = text.trim();
      if (trimmed.length > 0) {
        let structuredContent: string | undefined;
        try {
          const parsed = parseStructuredFromText(trimmed);
          if (parsed) {
            // Inject mode tag for specialized UI rendering
            if (mode && mode !== "default") {
              (parsed as Record<string, unknown>).mode = mode;
            }
            structuredContent = JSON.stringify(parsed);
          }
        } catch {
          // Parsing failed — raw text is still valid.
        }
        await convex.mutation(api.tutor.recordAssistantMessage, {
          threadId: threadId as Id<"tutorThreads">,
          content: trimmed,
          ...(structuredContent ? { structuredContent } : {}),
        });
      }

      await logAiGeneration(convex, {
        task: "tutor.chat",
        model: modelId,
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        latencyMs: Date.now() - startMs,
        relatedId: threadId,
        schemaValid: true,
      });

      if (sessionId) {
        const userMsgLen = userMessageText?.length ?? 0;
        convex
          .mutation(api.tutorStrategy.recordTurn, {
            sessionId: sessionId as Id<"studySessions">,
            userMessageLength: userMsgLen,
            responseTimeMs: null,
            choiceCorrect: null,
          })
          .catch((err) =>
            console.error("tutor route: strategy recordTurn failed", err)
          );

        if (activeLearningNudge) {
          convex
            .mutation(api.tutorStrategy.clearLatestChoiceClick, {
              sessionId: sessionId as Id<"studySessions">,
            })
            .catch((err) =>
              console.error(
                "tutor route: clearLatestChoiceClick failed",
                err
              )
            );
        }
      }
    } catch (err) {
      console.error("tutor route: onFinish persistence failed", err);
    }
  };
}

/**
 * Compute the passive-dismissal nudge from strategy state.
 */
function computeActiveLearningNudge(
  strat: StrategyState | null
):
  | {
      assistantMessageId: string;
      responseTimeMs: number;
      pickedCorrect: boolean;
    }
  | undefined {
  if (strat && strat.latestChoiceMessageId !== null) {
    const ms = strat.latestChoiceResponseTimeMs;
    if (typeof ms === "number") {
      const pickedCorrect = strat.latestChoicePickedCorrect ?? false;
      if (
        strat.latestChoiceMessageId &&
        (ms < 1000 || (ms < 2000 && pickedCorrect === false))
      ) {
        return {
          assistantMessageId: strat.latestChoiceMessageId,
          responseTimeMs: ms,
          pickedCorrect,
        };
      }
    }
  }
  return undefined;
}

// ===========================================================================
// Helpers
// ===========================================================================

/**
 * Phase 1 §3.1: parse the AI's text output into a structured
 * object. The AI emits sections delimited by markdown
 * conventions (blank lines, bold insight, choice widgets,
 * italic next). Returns `null` when the text cannot be
 * parsed into the 5-part structure.
 */
function parseStructuredFromText(
  text: string
): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const blocks = trimmed
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (blocks.length < 2) return null;

  const explanation = blocks[0] ?? "";

  let keyInsight = "";
  let nextSuggestion = "";
  let nextActionPrompt = "";
  let affirmation: string | null = null;

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i] ?? "";
    if (block.startsWith("**💡 Key insight:")) {
      keyInsight = block.replace(/^\*\*💡 Key insight:\*\*\s*/u, "").trim();
      continue;
    }
    if (block.startsWith("_Next:") && block.endsWith("_")) {
      const inner = block.slice(6, -1).trim();
      const tryIdx = inner.indexOf('— try: "');
      if (tryIdx > 0) {
        nextSuggestion = inner.slice(0, tryIdx).trim();
        nextActionPrompt = inner
          .slice(tryIdx + 8)
          .replace(/"$/, "")
          .trim();
      } else {
        nextSuggestion = inner;
      }
      continue;
    }
    if (block.startsWith("> ")) {
      affirmation = block.slice(2).trim();
      continue;
    }
  }

  if (!explanation || !keyInsight) return null;

  return {
    explanation,
    keyInsight,
    nextSuggestion: nextSuggestion || "Continue studying",
    nextActionPrompt:
      nextActionPrompt || "Let's keep going with the next concept.",
    ...(affirmation ? { affirmation } : {}),
    _rawText: trimmed,
    _hasCheck: blocks.some((b) => b.startsWith("[[choice:")),
    _hasVisual: blocks.some(
      (b) =>
        b.startsWith("[[formula:") ||
        b.startsWith("[[steps:") ||
        b.startsWith("[[diagram:") ||
        b === "(no visual needed)"
    ),
  };
}
