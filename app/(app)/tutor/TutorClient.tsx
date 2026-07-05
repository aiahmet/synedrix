"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMutation, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLocalStorage } from "@/lib/utils/useLocalStorage";
import type { ChatGrounding } from "@/lib/ai/prompts/chat";
import { SessionHeader } from "@/components/tutor/SessionHeader";
import { HistoryPanel } from "@/components/tutor/HistoryPanel";
import { MemoryPanel } from "@/components/tutor/MemoryPanel";
import { Composer } from "@/components/tutor/Composer";
import { MessageList } from "@/components/tutor/MessageList";

/**
 * TutorClient.
 *
 * The single client island on /tutor. Owns the
 * 3-pane layout (collapsible history | AI Copilot
 * | Memory panel), the top SessionHeader, and the
 * bottom Composer.
 *
 * Layout:
 *
 *   ┌────────────────────────────────────────────────────────┐
 *   │  SessionHeader                                          │
 *   ├──────────┬─────────────────────────────────┬────────────┤
 *   │ History  │   AI Copilot                    │  Memory    │
 *   │ (left)   │   (chat + composer)             │  (right)   │
 *   └──────────┴─────────────────────────────────┴────────────┘
 *
 * On widths below the `lg` Tailwind breakpoint the
 * right Memory panel collapses; below `md` the left
 * History panel also collapses to a rail. The collapse
 * states are persisted via `useLocalStorage`.
 *
 * Note about Convex reactivity: the chat stream
 * triggers useChat re-renders on every token, but
 * `MemoryPanel` is rendered in a separate pane and
 * subscribes to its OWN query (`getMemorySnapshot`),
 * so Convex reactivity flows independently of the
 * chat stream. The panel therefore updates its
 * mastery ring + weaknesses block the moment a
 * mastery bump lands — even mid-stream.
 *
 * Two-component split: the outer component owns
 * Convex thread + reads; the inner TutorChat owns
 * the useChat instance. The split is required by
 * React's rules-of-hooks (useChat must always be
 * called, never conditionally) and the inner
 * component is keyed on (subjectId, topicId) so a
 * thread change remounts with a clean state init.
 */
export function TutorClient({
  subjectId,
  topicId,
  subject,
  topic,
  sessionId,
  composerInitialText,
  lessonContext,
}: {
  readonly subjectId: Id<"subjects">;
  readonly topicId: Id<"topics"> | null;
  readonly subject: {
    readonly slug: string;
    readonly title: string;
    readonly color?: string;
  };
  readonly topic: { readonly slug: string; readonly title: string } | null;
  readonly sessionId: string | null;
  readonly composerInitialText: string | null;
  readonly lessonContext: ChatGrounding["lessonContext"] | undefined;
}) {
  // Persisted collapse state. We read the third tuple
  // slot (`hydrated`) from `useLocalStorage` so we can
  // gate the inner shell render until localStorage has
  // resolved — this avoids the visible "+ collapse
  // jump" on a returning user where SSR renders the
  // default (expanded) state and the client's first
  // effect flips it to the persisted value. Gating the
  // whole shell on `hydrated` makes the swap invisible
  // to the user even though the persisted state differs
  // from the server default.
  const [historyCollapsed, setHistoryCollapsed, historyHydrated] =
    useLocalStorage<boolean>("tutor.historyCollapsed", false);
  const [memoryCollapsed, setMemoryCollapsed, memoryHydrated] =
    useLocalStorage<boolean>("tutor.memoryCollapsed", false);
  const uiHydrated = historyHydrated && memoryHydrated;

  const ensureThread = useMutation(api.tutor.ensureThread);
  const markThreadRead = useMutation(api.tutor.markThreadRead);
  const thread = useQuery(
    api.tutor.getThread,
    { subjectId, topicId: topicId ?? undefined }
  );

  useEffect(() => {
    if (thread === null) {
      void ensureThread({ subjectId, topicId: topicId ?? undefined });
    }
  }, [thread, ensureThread, subjectId, topicId]);

  // Mark the thread read on first view AND when the
  // user navigates away from it. The previous
  // thread id is captured in a ref so the cleanup
  // fires `markThreadRead` on the thread the user is
  // leaving, not the one they are entering.
  const prevThreadIdRef = useRef<Id<"tutorThreads"> | null>(null);
  useEffect(() => {
    if (thread) {
      const prev = prevThreadIdRef.current;
      if (prev && prev !== thread.id) {
        void markThreadRead({ threadId: prev });
      }
      void markThreadRead({ threadId: thread.id });
      prevThreadIdRef.current = thread.id;
    }
    return () => {
      const current = prevThreadIdRef.current;
      if (current) {
        void markThreadRead({ threadId: current });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.id]);

  const convexMessages = useQuery(
    api.tutor.listMessages,
    thread ? { threadId: thread.id } : "skip"
  );

  const memorySnapshot = useQuery(api.tutorMemory.getMemorySnapshot, {
    subjectId,
    topicId: topicId ?? undefined,
  });

  const isReady = Boolean(thread) && convexMessages !== undefined;

  // Gate both the shell render AND the inner TutorChat
  // mount on (a) Convex thread + history resolved AND
  // (b) localStorage hydration complete. The second
  // constraint prevents a hydration mismatch on the
  // first paint when the persisted collapse state
  // differs from the server default. We render the
  // same `ShellSkeleton` until both are ready so SSR
  // markup and the first client render agree exactly.
  if (!isReady || !uiHydrated) {
    return <ShellSkeleton />;
  }

  return (
    <TutorChat
      key={`${subjectId}-${topicId ?? "subject"}${lessonContext ? "-lesson" : ""}`}
      threadId={thread!.id}
      subjectId={subjectId}
      topicId={topicId}
      subject={subject}
      topic={topic}
      sessionId={sessionId}
      initialMessages={(convexMessages ?? []).map(toUIMessage)}
      initialMessageCount={convexMessages?.length ?? 0}
      composerInitialText={composerInitialText}
      lessonContext={lessonContext}
      historyCollapsed={historyCollapsed}
      memoryCollapsed={memoryCollapsed}
      onToggleHistory={() => setHistoryCollapsed((v) => !v)}
      onToggleMemory={() => setMemoryCollapsed((v) => !v)}
      memorySnapshot={memorySnapshot}
    />
  );
}

/**
 * ShellSkeleton.
 *
 * Faithful skeleton for the new 3-pane layout so the
 * page does not flash a raw spinner on first paint.
 */
function ShellSkeleton() {
  return (
    <div className="mx-auto flex h-[calc(100dvh-7rem)] max-w-[1480px] flex-col gap-3.5">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-20 animate-pulse rounded-full bg-muted/30" />
          <div className="h-5 w-24 animate-pulse rounded-full bg-muted/30" />
          <div className="h-5 w-32 animate-pulse rounded-full bg-muted/30" />
        </div>
        <div className="h-7 w-72 animate-pulse rounded bg-muted/30" />
        <div className="flex gap-2">
          <div className="h-6 w-24 animate-pulse rounded-full bg-muted/30" />
          <div className="h-6 w-32 animate-pulse rounded-full bg-muted/30" />
          <div className="h-6 w-28 animate-pulse rounded-full bg-muted/30" />
        </div>
      </div>
      <div className="grid h-full min-h-0 flex-1 grid-cols-1 gap-3.5 md:grid-cols-[18rem_1fr] xl:grid-cols-[18rem_1fr_22rem]">
        <div className="hidden h-full animate-pulse rounded-2xl bg-muted/20 md:block" />
        <div className="flex h-full min-h-0 flex-col gap-4">
          <div className="flex-1 animate-pulse rounded-2xl bg-muted/15" />
          <div className="h-24 animate-pulse rounded-2xl bg-muted/30" />
        </div>
        <div className="hidden h-full animate-pulse rounded-2xl bg-muted/20 xl:block" />
      </div>
    </div>
  );
}

/**
 * Convert a Convex tutorMessage row into a UIMessage.
 */
function toUIMessage(m: {
  id: Id<"tutorMessages">;
  role: "user" | "assistant";
  content: string;
}): UIMessage {
  return {
    id: m.id as string,
    role: m.role,
    parts: [{ type: "text", text: m.content }],
  };
}

/**
 * TutorChat.
 *
 * Owns the useChat instance + composer state. Mounted
 * by TutorClient once the Convex thread + history have
 * resolved. Renders the 3-pane shell + SessionHeader
 * and routes the chat surface through the new
 * rich-message MessageList.
 */
function TutorChat({
  threadId,
  subjectId,
  topicId,
  subject,
  topic,
  sessionId,
  initialMessages,
  initialMessageCount,
  composerInitialText,
  lessonContext,
  historyCollapsed,
  memoryCollapsed,
  onToggleHistory,
  onToggleMemory,
  memorySnapshot,
}: {
  readonly threadId: Id<"tutorThreads">;
  readonly subjectId: Id<"subjects">;
  readonly topicId: Id<"topics"> | null;
  readonly subject: {
    readonly slug: string;
    readonly title: string;
    readonly color?: string;
  };
  readonly topic: { readonly slug: string; readonly title: string } | null;
  readonly sessionId: string | null;
  readonly initialMessages: readonly UIMessage[];
  readonly initialMessageCount: number;
  readonly composerInitialText: string | null;
  readonly lessonContext: ChatGrounding["lessonContext"] | undefined;
  readonly historyCollapsed: boolean;
  readonly memoryCollapsed: boolean;
  readonly onToggleHistory: () => void;
  readonly onToggleMemory: () => void;
  /**
   * Memory snapshot pulled by the parent shell. Passed
   * down so the SessionHeader / MemoryPanel use the
   * same value and avoid two `useQuery` subscriptions.
   */
  readonly memorySnapshot:
    | NonNullable<
        (typeof api.tutorMemory.getMemorySnapshot)["_returnType"]
      >
    | null
    | undefined;
}) {
  const chatId = useMemo(
    () =>
      `tutor-${subjectId}-${topicId ?? "subject"}${lessonContext ? "-lesson" : ""}`,
    [subjectId, topicId, lessonContext]
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/tutor/chat",
        body: {
          threadId: threadId as string,
          subjectId: subjectId as string,
          ...(topicId ? { topicId: topicId as string } : {}),
          ...(lessonContext ? { lessonContext } : {}),
        },
      }),
    [threadId, subjectId, topicId, lessonContext]
  );

  const { messages, sendMessage, status, stop, error, regenerate } = useChat({
    id: chatId,
    transport,
    messages: [...initialMessages],
    experimental_throttle: 50,
    onError: (err) => {
      if (process.env.NODE_ENV !== "production") {
         
        console.error("[tutor] useChat stream error:", err);
      }
    },
  });
  const wrappedRegenerate = (): void => {
    // The AI SDK's regenerate returns a Promise; we
    // forward without awaiting so the consumer's
    // `() => void` requirement stays honored. Errors
    // here are logged but never propagated to the UI
    // because the underlying SDK will surface them
    // through its own status state.
    regenerate().catch((err) => {
       
      console.error("[tutor] regenerate failed", err);
    });
  };

  const [input, setInput] = useState("");

  const initialTextRef = useRef<string | null>(composerInitialText);
  useEffect(() => {
    if (
      initialTextRef.current &&
      initialTextRef.current.length > 0 &&
      input.length === 0
    ) {
      setInput(initialTextRef.current);
      initialTextRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    void sendMessage({ text: trimmed });
    setInput("");
  };

  const onPickSuggestion = (text: string) => {
    setInput(text);
  };

  // Derived state from the memory snapshot. We
  // tolerate `undefined` (loading) and `null` (no
  // user row) without crashing — the SessionHeader
  // falls back to neutral defaults.
  const mastery = (memorySnapshot && memorySnapshot.topic?.mastery) ?? 0;
  const confidence = (memorySnapshot && memorySnapshot.topic?.confidence) ?? 0;
  const focusGoal = memorySnapshot?.focusGoal ?? null;
  const estimatedMinutesToMastery =
    memorySnapshot?.estimatedMinutesToMastery ?? null;
  const difficulty = memorySnapshot?.topic?.difficulty ?? null;
  const objectiveSummary =
    (memorySnapshot &&
      memorySnapshot.topic &&
      (lessonContext?.topicTitle
        ? `Discussing your last practice — ${lessonContext.topicTitle} (graded ${lessonContext.grade}).`
        : null)) ||
    null;

  const fallbackLessonHref = topic
    ? `/subjects/${subject.slug}/${topic.slug}`
    : `/subjects/${subject.slug}`;

  return (
    <div className="mx-auto flex h-[calc(100dvh-7rem)] w-full max-w-[1480px] flex-col gap-3.5">
      {lessonContext ? <LessonContextBanner context={lessonContext} /> : null}
      {/*
        `key={sessionId ?? "none"}` forces a full remount of
        `SessionHeader` when the active session changes. The
        header's `startedAt` initialiser is `Date.now()`, so
        remounting re-anchors the elapsed-time counter against
        the new mount — replacing the prior
        setState-in-useEffect workaround. The sub-tree is thin
        (no expensive local state), so the remount cost is
        negligible; the win is removing the
        `react-hooks/set-state-in-effect` lint disable.
      */}
      <SessionHeader
        key={sessionId ?? "none"}
        subject={subject}
        topic={topic}
        subjectColor={subject.color}
        sessionId={sessionId}
        threadMessageCount={Math.max(messages.length, initialMessageCount)}
        focusGoal={focusGoal}
        mastery={mastery}
        confidence={confidence}
        estimatedMinutesToMastery={estimatedMinutesToMastery}
        difficulty={difficulty}
        objectiveSummary={objectiveSummary}
      />

      <div className="grid h-full min-h-0 flex-1 grid-cols-1 gap-3.5 md:grid-cols-[18rem_1fr] xl:grid-cols-[18rem_1fr_22rem]">
        <HistoryPanel
          currentSubjectId={subjectId}
          currentTopicId={topicId}
          collapsed={historyCollapsed}
          onToggleCollapse={onToggleHistory}
        />
        <section
          aria-label="AI Copilot"
          className="flex h-full min-h-0 flex-col gap-3.5"
        >
          <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-surface-elevated p-1.5 shadow-[var(--shadow-soft)]">
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-xl bg-background px-3 sm:px-5">
              <MessageList
                messages={messages}
                status={status}
                topicTitle={topic?.title ?? null}
                onPickSuggestion={onPickSuggestion}
                onRegenerate={
                  messages.some((m) => m.role === "assistant")
                    ? wrappedRegenerate
                    : undefined
                }
                topicId={topicId ?? null}
              />
            </div>
          </div>
          <Composer
            input={input}
            setInput={setInput}
            onSubmit={onSubmit}
            status={status}
            onStop={stop}
            error={error}
            onRegenerate={
              messages.some((m) => m.role === "assistant")
                ? wrappedRegenerate
                : undefined
            }
            fallbackLessonHref={fallbackLessonHref}
          />
        </section>
        <MemoryPanel
          subjectId={subjectId}
          topicId={topicId}
          collapsed={memoryCollapsed}
          onToggleCollapse={onToggleMemory}
        />
      </div>
    </div>
  );
}

/**
 * LessonContextBanner.
 *
 * Quiet banner shown above the title when the user
 * arrived here from the results page (`?lesson=<runId>`).
 * Mirrors the prior banner but rendered narrower to
 * match the new shell.
 */
function LessonContextBanner({
  context,
}: {
  readonly context: NonNullable<ChatGrounding["lessonContext"]>;
}) {
  const gradeTone =
    context.grade === "1" || context.grade === "2"
      ? "var(--subject-chemistry)"
      : context.grade === "3"
        ? "var(--subject-german)"
        : "var(--subject-french)";
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-accent-border/40 bg-accent-subtle/30 px-3.5 py-2.5"
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
        style={{
          backgroundColor: `color-mix(in srgb, ${gradeTone} 14%, transparent)`,
          borderColor: `color-mix(in srgb, ${gradeTone} 36%, transparent)`,
        }}
        aria-hidden
      >
        <span
          className="text-[15px] font-semibold leading-none tracking-[-0.02em]"
          style={{ color: gradeTone }}
        >
          {context.grade}
        </span>
      </span>
      <p className="text-[12.5px] leading-relaxed text-foreground/90">
        Discussing your last practice on{" "}
        <span className="font-semibold tracking-tight text-foreground">
          {context.topicTitle}
        </span>{" "}
        (grade {context.grade} on the German 1–6 scale). The tutor can refer
        to per-item feedback and stronger answers — drop any follow-up below.
      </p>
    </div>
  );
}
