"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMutation, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useInlinePractice } from "@/lib/hooks/useInlinePractice";
import { useStableMessages } from "@/lib/hooks/useStableMessages";
import type { ChatGrounding } from "@/lib/ai/prompts/chat";
import { useAutoRetry } from "@/lib/hooks/useAutoRetry";
import { HistoryPanel } from "@/components/tutor/HistoryPanel";
import { Composer } from "@/components/tutor/Composer";
import { MessageList } from "@/components/tutor/MessageList";
import { TutorTopBar } from "@/components/tutor/TutorTopBar";
import { TutorDrawer } from "@/components/tutor/TutorDrawer";
import { EmptyChatArea } from "@/components/tutor/EmptyChatArea";

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
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 sm:px-6">
          <EmptyChatArea state="loading" />
        </main>
        <div className="sticky bottom-0 z-20 -mx-4 border-t border-border bg-background/85 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md sm:-mx-6 sm:px-6">
          <div className="h-24 animate-pulse rounded-2xl bg-muted/20" />
        </div>
      </div>
    );
  }

  const conversationKey = `${props.subjectId}-${props.topicId ?? "subject"}${props.lessonContext ? "-lesson" : ""}`;

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
        convexMessages={convexMessages}
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
  const markThreadRead = useMutation(api.tutorComposer.markThreadRead);
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
  readonly convexMessages: ReadonlyArray<{
    readonly id: Id<"tutorMessages">;
    readonly role: "user" | "assistant";
    readonly content: string;
    readonly structuredContent?: string;
  }>;
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

  useAutoRetry(status, wrappedRegenerate);

  const stableMessages = useStableMessages(props.convexMessages, messages);

  const topicSuggestions = useQuery(
    api.tutorSessions.getSubjectTopicsForEmptyState,
    props.topicId ? "skip" : { subjectId: props.subjectId, limit: 6 }
  );

  const {
    request: handleInlinePracticeRequested,
    isRequesting: inlinePracticeRequestingLocal,
  } = useInlinePractice(
    props.threadId as string,
    props.subjectId as string,
    props.topicId,
    props.topic?.title ?? "",
    messages,
  );

  const { setInput } = props;

  const onSubmit = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    void sendMessage({ text: trimmed });
    setInput("");
  };

  const onSubmitMode = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length === 0) return;
      void sendMessage({ text: trimmed });
      setInput("");
    },
    [sendMessage, setInput],
  );

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
        {stableMessages.length > 0 ? (
          <div className="flex-1 py-4">
            <MessageList
              messages={stableMessages}
              status={status}
              topicTitle={props.topic?.title ?? null}
              onRegenerate={
                stableMessages.some((m) => m.role === "assistant")
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
          <EmptyChatArea
            state={props.topicId ? "new_thread" : "subject_only"}
            topicSuggestions={topicSuggestions}
            subject={props.subject}
          />
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
              stableMessages.some((m) => m.role === "assistant")
                ? wrappedRegenerate
                : undefined
            }
            onInlinePracticeRequested={
              props.topicId ? handleInlinePracticeRequested : undefined
            }
            inlinePracticeRequesting={inlinePracticeRequestingLocal}
            onSubmitMode={onSubmitMode}
            fallbackLessonHref={fallbackLessonHref}
            subject={props.subject}
            topic={props.topic}
            hasMessages={stableMessages.length > 0}
          />
        </div>
      </div>
    </main>
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
