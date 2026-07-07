import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import type { StrategyState, TutorProfileLike } from "@/lib/ai/types/tutor";

/**
 * Shape of the non-nullable ChatContext returned by
 * `getContextForChat`. Defined here explicitly because
 * `typeof convex.query<typeof api.tutor.getContextForChat>`
 * cannot be used outside the route handler's closure.
 */
export type ChatContext = {
  readonly subject: { readonly title: string; readonly slug: string };
  readonly topic: {
    readonly title: string;
    readonly slug: string;
    readonly objectives: readonly string[];
    readonly difficulty: "EASY" | "MEDIUM" | "HARD";
    readonly gradeLevel: string | null;
  } | null;
  readonly mastery: number;
  readonly confidence: number;
  readonly recentMistakes: readonly {
    readonly question: string;
    readonly userAnswer: string;
    readonly correctAnswer: string;
    readonly mistakeType: string;
  }[];
};

export type ContextResult =
  | {
      kind: "ok";
      context: ChatContext & { tutorProfile: TutorProfileLike | null };
      strat: StrategyState | null;
      memoryChronicle: string | undefined;
    }
  | { kind: "error"; response: Response };

export async function loadChatContext(
  convex: ConvexHttpClient,
  params: {
    threadId: string;
    subjectId: string;
    topicId?: string;
    sessionId?: string;
    lastUserMessage?: { id: string; role: string } | null;
    userMessageText?: string | null;
  }
): Promise<ContextResult> {
  const {
    threadId,
    subjectId,
    topicId,
    sessionId,
    lastUserMessage,
    userMessageText,
  } = params;

  let context: (ChatContext & { readonly tutorProfile: TutorProfileLike | null }) | null =
    null;
  let strat: StrategyState | null = null;
  let memoryChronicle: string | undefined;

  try {
    const results = await Promise.all([
      convex.query(api.tutor.getContextForChat, {
        threadId: threadId as Id<"tutorThreads">,
        subjectId: subjectId as Id<"subjects">,
        ...(topicId ? { topicId: topicId as Id<"topics"> } : {}),
      }),
      convex
        .query(api.tutorProfile.getMine, {})
        .catch(() => null),
      (async () => {
        if (!lastUserMessage) return;
        if (!userMessageText || userMessageText.trim().length === 0) return;
        try {
          await convex.mutation(api.tutor.appendUserMessage, {
            threadId: threadId as Id<"tutorThreads">,
            content: userMessageText,
            clientId: lastUserMessage.id,
          });
        } catch (err) {
          console.warn("appendUserMessage (non-fatal):", err);
        }
      })(),
      // Phase 1 §3.2: load strategy state (best-effort).
      // `api.tutorStrategy.getStrategyState` returns
      // `v.union(v.object(...), v.null())`. Convex's
      // HTTP-client typing collapses that top-level
      // nullable union query return to `Promise<never>`,
      // which would propagate through `.catch(() => null)`
      // and the assignment below and force TypeScript's
      // Control Flow Analysis to narrow `strat` to
      // `never`. We cast the Promise itself to the
      // shape we want so the ternary evaluates to
      // `Promise<StrategyState | null>`.
      sessionId
        ? (convex
            .query(api.tutorStrategy.getStrategyState, {
              sessionId: sessionId as Id<"studySessions">,
            }) as unknown as Promise<StrategyState | null>)
            .catch(() => null)
        : Promise.resolve(null),
      // Phase 2 §4.1: load memory chronicle (best-effort).
      convex
        .query(api.tutorMemory.getMemoryChronicle, {
          subjectId: subjectId as Id<"subjects">,
          ...(topicId ? { topicId: topicId as Id<"topics"> } : {}),
        })
        .catch(() => null),
    ]);

    const chat = results[0];
    if (chat) {
      context = { ...chat, tutorProfile: (results[1] ?? null) as TutorProfileLike | null };
    }

    // Phase 2 §4.1: extract memory chronicle from the
    // parallel results. When the chronicle query returns
    // null (no progress yet), we leave the field
    // undefined so the system prompt omits the block.
    const chronicleResult = results[4] ?? null;
    if (chronicleResult && typeof chronicleResult === "object" && "narrative" in chronicleResult) {
      memoryChronicle = String((chronicleResult as { narrative: string }).narrative);
    }

    // Build strategy prompt block from the loaded state.
    // The cast to `StrategyState | null` is explicit
    // because `results[3]`'s element type is inferred
    // through `Promise.all`'s element union; without
    // the cast TypeScript CFA collapses `strat` to
    // `never` because the upstream query call carries
    // a `Promise<never>` element (see comment at the
    // `convex.query(...)` site above).
    strat = (results[3] ?? null) as StrategyState | null;
    if (!strat && sessionId) {
      // Phase 1 §3.2: first turn of the session —
      // initialise the strategy row and start with
      // the default "explaining" strategy.
      // `initStrategy` is idempotent; it skips when
      // a row already exists.
      convex
        .mutation(api.tutorStrategy.initStrategy, {
          sessionId: sessionId as Id<"studySessions">,
        })
        .catch((err) =>
          console.error("tutor route: initStrategy failed", err)
        );
    }
  } catch (err) {
    if (
      err instanceof ConvexError &&
      (err as { data: unknown }).data === "topic_not_found"
    ) {
      return { kind: "error", response: new Response("Topic not found", { status: 404 }) };
    }
    throw err;
  }

  if (!context) {
    return { kind: "error", response: new Response("Thread or context not found", { status: 404 }) };
  }

  return { kind: "ok", context, strat, memoryChronicle };
}
