"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMutation, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { extractText } from "@/lib/ai/uiMessage";
import type { ChatGrounding } from "@/lib/ai/prompts/chat";
import { HistoryPanel } from "@/components/tutor/HistoryPanel";
import { Composer } from "@/components/tutor/Composer";
import { MessageList } from "@/components/tutor/MessageList";
import { TutorTopBar } from "@/components/tutor/TutorTopBar";
import { TutorDrawer } from "@/components/tutor/TutorDrawer";

/**
 * TutorClient.
 *
 * The single client island on /tutor. Subscribes
 * to the Convex thread + messages + inline-
 * practice queries and composes:
 *
 *   - TutorTopBar (subject + history trigger)
 *   - chat column (empty space when no messages;
 *     MessageList when there is a thread)
 *   - sticky Composer at the bottom
 *   - HistoryDrawer (Threads) on the left
 *
 * On a fresh /tutor load, the only visible chrome
 * above the input is the top bar. The composer
 * input is the empty state. The chat itself is the
 * resume surface — there is no separate end-
 * session panel, no per-session mode indicator,
 * and no Memory drawer. History is the only drawer
 * the user can open from the top bar.
 */
export function TutorClient(props: {
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
  readonly backHref: string | null;
  readonly focusItemId: string | null;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [input, setInput] = useState<string>(
    () => props.composerInitialText ?? ""
  );

  const thread = useQuery(api.tutor.getThread, {
    subjectId: props.subjectId,
    topicId: props.topicId ?? undefined,
  });
  const convexMessages = useQuery(
    api.tutor.listMessages,
    thread ? { threadId: thread.id } : "skip"
  );
  const inlinePractices = useQuery(
    api.tutorPractice.getInlineSessionsForThread,
    thread ? { threadId: thread.id } : "skip"
  );

  useEnsureThread(thread?.id ?? null, props);
  useMarkThreadReadOnFocus(thread?.id ?? null);

  const isReady = Boolean(thread) && convexMessages !== undefined;

  if (!isReady) {
    return <ShellSkeleton />;
  }

  const conversationKey = `${props.subjectId}-${
    props.topicId ?? "subject"
  }${props.lessonContext ? "-lesson" : ""}`;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <TutorTopBar
        subject={props.subject}
        {...(props.topic ? { topic: props.topic } : {})}
        {...(props.subject.color !== undefined
          ? { subjectColor: props.subject.color }
          : {})}
        backHref={props.backHref}
        onToggleHistory={() => setHistoryOpen(true)}
        historyUnreadCount={0}
      />
      <TutorChat
        key={conversationKey}
        input={input}
        setInput={setInput}
        threadId={thread!.id}
        subjectId={props.subjectId}
        topicId={props.topicId}
        subject={props.subject}
        topic={props.topic}
        sessionId={props.sessionId}
        initialMessages={(convexMessages ?? []).map(toUIMessage)}
        composerInitialText={props.composerInitialText}
        lessonContext={
          props.lessonContext
            ? props.focusItemId
              ? { ...props.lessonContext, focusItemId: props.focusItemId }
              : props.lessonContext
            : undefined
        }
        inlinePractices={inlinePractices ?? []}
      />
      <TutorDrawer
        side="left"
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        label="Threads"
      >
        <HistoryPanel
          currentSubjectId={props.subjectId}
          currentTopicId={props.topicId}
          collapsed={false}
          onToggleCollapse={() => setHistoryOpen(false)}
        />
      </TutorDrawer>
    </div>
  );
}

function useEnsureThread(
  threadId: Id<"tutorThreads"> | null,
  props: {
    readonly subjectId: Id<"subjects">;
    readonly topicId: Id<"topics"> | null;
    readonly lessonContext: ChatGrounding["lessonContext"] | undefined;
    readonly focusItemId: string | null;
  }
) {
  const ensureThread = useMutation(api.tutor.ensureThread);
  const inflightRef = useRef(false);
  useEffect(() => {
    if (threadId !== null) return;
    if (inflightRef.current) return;
    inflightRef.current = true;
    const ctx = props.lessonContext
      ? {
          ...props.lessonContext,
          items: [...props.lessonContext.items],
          mistakes: [...props.lessonContext.mistakes],
          ...(props.focusItemId ? { focusItemId: props.focusItemId } : {}),
        }
      : undefined;
    void ensureThread({
      subjectId: props.subjectId,
      topicId: props.topicId ?? undefined,
      ...(ctx ? { lessonContext: ctx } : {}),
    })
      .catch((err) => console.error("[tutor] ensureThread failed", err))
      .finally(() => {
        inflightRef.current = false;
      });
  }, [threadId, ensureThread, props]);
}

function useMarkThreadReadOnFocus(threadId: Id<"tutorThreads"> | null) {
  const markThreadRead = useMutation(api.tutor.markThreadRead);
  const lastIdRef = useRef<Id<"tutorThreads"> | null>(null);
  useEffect(() => {
    if (threadId === null) return;
    const prev = lastIdRef.current;
    if (prev && prev !== threadId) {
      void markThreadRead({ threadId: prev }).catch((err) => {
        console.error("[tutor] markThreadRead cleanup failed", err);
      });
    }
    void markThreadRead({ threadId }).catch((err) => {
      console.error("[tutor] markThreadRead failed", err);
    });
    lastIdRef.current = threadId;
  }, [threadId, markThreadRead]);
}

function TutorChat(props: {
  readonly input: string;
  readonly setInput: React.Dispatch<React.SetStateAction<string>>;
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
  readonly composerInitialText: string | null;
  readonly lessonContext: ChatGrounding["lessonContext"] | undefined;
  readonly inlinePractices: ReadonlyArray<{
    readonly id: Id<"inlineTutorSessions">;
    readonly anchorMessageId: string;
    readonly startedAt: number;
    readonly subjectId: Id<"subjects">;
    readonly topicId: Id<"topics"> | null;
    readonly completedAt: number | null;
  }>;
}) {
  const chatId = useMemo(
    () =>
      `tutor-${props.subjectId}-${props.topicId ?? "subject"}${
        props.lessonContext ? "-lesson" : ""
      }`,
    [props.subjectId, props.topicId, props.lessonContext]
  );
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/tutor/chat",
        body: {
          threadId: props.threadId as string,
          subjectId: props.subjectId as string,
          ...(props.topicId ? { topicId: props.topicId as string } : {}),
          ...(props.lessonContext ? { lessonContext: props.lessonContext } : {}),
          ...(props.sessionId ? { sessionId: props.sessionId } : {}),
        },
      }),
    [
      props.threadId,
      props.subjectId,
      props.topicId,
      props.lessonContext,
      props.sessionId,
    ]
  );

  const composerRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, status, stop, error, regenerate } = useChat({
    id: chatId,
    transport,
    messages: [...props.initialMessages],
    experimental_throttle: 50,
    onError: (err) => {
      if (process.env.NODE_ENV !== "production") {
        console.error("[tutor] useChat stream error:", err);
      }
    },
  });
  const wrappedRegenerate = useCallback((): void => {
    regenerate().catch((err) => {
      console.error("[tutor] regenerate failed", err);
    });
  }, [regenerate]);

  const autoRetryAttemptedRef = useRef(false);
  useEffect(() => {
    if (status === "error" && !autoRetryAttemptedRef.current) {
      autoRetryAttemptedRef.current = true;
      wrappedRegenerate();
    }
    if (status === "ready") {
      autoRetryAttemptedRef.current = false;
    }
  }, [status, wrappedRegenerate]);

  const inlinePracticeRequestingRef = useRef(false);
  const [inlinePracticeRequestingLocal, setInlinePracticeRequestingLocal] =
    useState(false);
  const handleInlinePracticeRequested = useCallback(() => {
    if (!props.topicId) return;
    if (inlinePracticeRequestingRef.current) return;
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant");
    if (!lastAssistant) return;
    inlinePracticeRequestingRef.current = true;
    setInlinePracticeRequestingLocal(true);
    const recentTurns = messages.slice(-12).flatMap((m) => {
      const text = extractText(m);
      if (text.length === 0) return [];
      const role = m.role === "user" ? ("user" as const) : ("assistant" as const);
      return [{ role, text }];
    });
    fetch("/api/tutor/practice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId: props.threadId as string,
        subjectId: props.subjectId as string,
        topicId: props.topicId as string,
        topicTitle: props.topic?.title ?? "",
        anchorMessageId: lastAssistant.id,
        turns: recentTurns,
        gradeLevel: null,
        language: "en",
      }),
    })
      .catch((err) => console.error("[tutor] inline-practice fetch failed", err))
      .finally(() => {
        inlinePracticeRequestingRef.current = false;
        setInlinePracticeRequestingLocal(false);
      });
  }, [
    messages,
    props.topicId,
    props.topic,
    props.threadId,
    props.subjectId,
  ]);

  const { setInput } = props;
  const handleSummarizeRequested = useCallback(() => {
    setInput(
      "Summarize the key concepts we covered in this thread so far, in 3-4 sentences."
    );
  }, [setInput]);

  const onSubmit = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    void sendMessage({ text: trimmed });
    props.setInput("");
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = (document.activeElement?.tagName ?? "").toLowerCase();
        const isEditable =
          tag === "input" ||
          tag === "textarea" ||
          tag === "select" ||
          document.activeElement?.getAttribute("contenteditable") === "true";
        if (!isEditable) {
          e.preventDefault();
          composerRef.current?.focus();
        }
        return;
      }
      if (e.key === "Escape" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (status === "submitted" || status === "streaming") {
          e.preventDefault();
          stop();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [status, stop]);

  const fallbackLessonHref = props.topic
    ? `/subjects/${props.subject.slug}/${props.topic.slug}`
    : `/subjects/${props.subject.slug}`;
  const practiceHref = props.topic
    ? `/subjects/${props.subject.slug}/${props.topic.slug}/practice`
    : null;

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 sm:px-6">
        {messages.length > 0 ? (
          <div className="flex-1 py-4">
            <MessageList
              messages={messages}
              status={status}
              topicTitle={props.topic?.title ?? null}
              onRegenerate={
                messages.some((m) => m.role === "assistant")
                  ? wrappedRegenerate
                  : undefined
              }
              topicId={props.topicId ?? null}
              subjectId={props.subjectId}
              practiceHref={practiceHref}
              threadId={props.threadId as string}
              inlinePractices={props.inlinePractices}
              onInlinePracticeRequested={
                props.topicId ? handleInlinePracticeRequested : undefined
              }
            />
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <div className="sticky bottom-0 z-20 -mx-4 border-t border-border bg-background/85 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md sm:-mx-6 sm:px-6">
          <Composer
            ref={composerRef}
            input={props.input}
            setInput={props.setInput}
            onSubmit={onSubmit}
            status={status}
            onStop={stop}
            error={error}
            onRegenerate={
              messages.some((m) => m.role === "assistant")
                ? wrappedRegenerate
                : undefined
            }
            onInlinePracticeRequested={
              props.topicId ? handleInlinePracticeRequested : undefined
            }
            inlinePracticeRequesting={inlinePracticeRequestingLocal}
            onSummarizeRequested={handleSummarizeRequested}
            fallbackLessonHref={fallbackLessonHref}
            subject={props.subject}
            topic={props.topic}
            hasMessages={messages.length > 0}
          />
        </div>
      </div>
    </main>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center border-b border-border px-4">
        <div className="h-6 w-16 animate-pulse rounded bg-muted/30" />
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 px-4 py-6">
        <div className="h-7 w-3/4 animate-pulse rounded bg-muted/30" />
        <div className="flex flex-col gap-2">
          <div className="h-4 w-full animate-pulse rounded bg-muted/20" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-muted/20" />
          <div className="h-4 w-4/6 animate-pulse rounded bg-muted/20" />
        </div>
        <div className="mt-auto h-24 animate-pulse rounded-2xl bg-muted/20" />
      </main>
    </div>
  );
}

function toUIMessage(m: {
  id: Id<"tutorMessages">;
  role: "user" | "assistant";
  content: string;
  structuredContent?: string;
}): UIMessage {
  return {
    id: m.id as string,
    role: m.role,
    parts: [{ type: "text", text: m.content }],
    ...(m.structuredContent
      ? { metadata: { structured: m.structuredContent } }
      : {}),
  };
}
