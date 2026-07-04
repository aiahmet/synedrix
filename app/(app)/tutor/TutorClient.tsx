"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMutation, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { TutorHeader } from "@/components/tutor/TutorHeader";
import { TutorHistorySidebar } from "@/components/tutor/TutorHistorySidebar";
import { MessageList } from "@/components/tutor/MessageList";
import { MessageInput } from "@/components/tutor/MessageInput";

/**
 * TutorClient.
 *
 * Two-component split so React's rules of hooks stay
 * happy:
 *  - The outer component owns the Convex queries
 *    (`thread`, `listMessages`) and the lazy
 *    `ensureThread` side effect. It gates the inner
 *    component on `thread !== null && convexMessages !==
 *    undefined`.
 *  - `TutorChat` (inner) owns the single `useChat`
 *    instance, the composer input state, and the
 *    MessageList + MessageInput. It is only mounted
 *    when both Convex queries have settled, so useChat
 *    is always called with the real Convex history as
 *    its initial state.
 *
 * `sessionId` is optional — when null, the page is in
 * history-navigation mode (no active study session), the
 * end-session CTA is hidden, and the elapsed timer is
 * hidden.
 *
 * The chat session id is derived from the page inputs
 * (subject + topic), not the Convex threadId, so it stays
 * stable as the Convex queries resolve asynchronously.
 */
export function TutorClient({
  subjectId,
  topicId,
  subject,
  topic,
  sessionId,
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
}) {
  const ensureThread = useMutation(api.tutor.ensureThread);
  const markThreadRead = useMutation(api.tutor.markThreadRead);
  const thread = useQuery(
    api.tutor.getThread,
    { subjectId, topicId: topicId ?? undefined }
  );

  // Lazy thread creation on first mount.
  useEffect(() => {
    if (thread === null) {
      void ensureThread({ subjectId, topicId: topicId ?? undefined });
    }
  }, [thread, ensureThread, subjectId, topicId]);

  // Mark the thread read on first view AND when the user
  // navigates away from it. The sidebar's unread count
  // drops to zero via Convex reactivity. Capturing the
  // previous thread id in a ref lets the cleanup fire
  // the markThreadRead on the thread the user is leaving
  // (not the one they are entering).
  const prevThreadIdRef = useRef<Id<"tutorThreads"> | null>(null);
  useEffect(() => {
    if (thread) {
      // Mark the previous thread read on navigation away.
      const prev = prevThreadIdRef.current;
      if (prev && prev !== thread.id) {
        void markThreadRead({ threadId: prev });
      }
      // Mark the current thread read on arrival.
      void markThreadRead({ threadId: thread.id });
      prevThreadIdRef.current = thread.id;
    }
    // Cleanup: when the component unmounts (route
    // navigation away from /tutor entirely), mark the
    // current thread read so the sidebar's unread count
    // is honest.
    return () => {
      const current = prevThreadIdRef.current;
      if (current) {
        void markThreadRead({ threadId: current });
      }
    };
    // markThreadRead is stable from useMutation; we only
    // want this to fire when the thread id changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.id]);

  // Subscribe to the canonical message list once the
  // thread is known. Returns `undefined` while loading.
  const convexMessages = useQuery(
    api.tutor.listMessages,
    thread ? { threadId: thread.id } : "skip"
  );

  // The chat UI is only mounted when:
  //  - `thread` has resolved (and is not null), AND
  //  - `convexMessages` has resolved.
  const isReady = Boolean(thread) && convexMessages !== undefined;

  if (!isReady) {
    return (
      <div className="mx-auto flex h-[calc(100dvh-7rem)] max-w-6xl flex-col gap-4">
        <div className="grid h-full min-h-0 grid-cols-1 gap-4 md:grid-cols-[300px_1fr]">
          <div className="hidden h-full animate-pulse rounded-2xl bg-muted/30 md:block" />
          <div className="flex h-full min-h-0 flex-col gap-5 sm:gap-6">
            <div className="h-20 animate-pulse rounded-2xl bg-muted/30" />
            <div className="flex-1 animate-pulse rounded-2xl bg-muted/20" />
            <div className="h-14 animate-pulse rounded-2xl bg-muted/30" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-7rem)] max-w-6xl flex-col gap-4">
      <div className="grid h-full min-h-0 grid-cols-1 gap-4 md:grid-cols-[300px_1fr]">
        <TutorHistorySidebar
          currentSubjectId={subjectId}
          currentTopicId={topicId}
        />
        {/*
          The `key` forces a full remount of `TutorChat` when
          the (subject, topic) pair changes. This guarantees
          that the inner `useChat` hook re-initializes with
          the new Convex history as its initial state, which
          is not guaranteed by the hook's `id` change alone in
          ai@4 / @ai-sdk/react@4. Without this, switching
          between threads could leave stale messages from the
          previous chatId in the UI until the next stream.
        */}
        <TutorChat
          key={`${subjectId}-${topicId ?? "subject"}`}
          threadId={thread!.id}
          subjectId={subjectId}
          topicId={topicId}
          subject={subject}
          topic={topic}
          sessionId={sessionId}
          initialMessages={(convexMessages ?? []).map(toUIMessage)}
          initialMessageCount={convexMessages?.length ?? 0}
        />
      </div>
    </div>
  );
}

/**
 * Convert a Convex message into the Vercel AI SDK v5+
 * UIMessage shape. Convex stores content as a single
 * string; UIMessage uses `parts`.
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
 * Owns the single useChat instance + the composer input
 * state. Mounted by TutorClient only when the Convex
 * thread + history have resolved, so useChat is always
 * called (rules of hooks) and always with the real
 * Convex history as its initial state.
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
}) {
  // Stable id so useChat does not reset when something
  // else re-renders. The Convex threadId is sent via the
  // transport body, not used as the chat session key.
  // The outer `TutorClient` adds a `key={...}` to this
  // component that swaps on (subject, topic) change; that
  // remount guarantees the inner `useChat` re-initializes
  // with the new Convex history.
  const chatId = useMemo(
    () => `tutor-${subjectId}-${topicId ?? "subject"}`,
    [subjectId, topicId]
  );

  // The transport carries the body that the Route Handler
  // reads (threadId, subjectId, topicId).
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/tutor/chat",
        body: {
          threadId: threadId as string,
          subjectId: subjectId as string,
          ...(topicId ? { topicId: topicId as string } : {}),
        },
      }),
    [threadId, subjectId, topicId]
  );

  const { messages, sendMessage, status, stop, error } = useChat({
    id: chatId,
    transport,
    messages: [...initialMessages],
  });

  // Composer input state lives here so the controlled
  // form in MessageInput does not need its own hook tree.
  const [input, setInput] = useState("");

  const onSubmit = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    void sendMessage({ text: trimmed });
    setInput("");
  };

  return (
    <div className="flex min-h-0 flex-col gap-5 sm:gap-6">
      <TutorHeader
        subject={subject}
        topic={topic}
        sessionId={sessionId}
        threadMessageCount={Math.max(messages.length, initialMessageCount)}
      />
      <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-surface-elevated p-1.5 shadow-[var(--shadow-soft)]">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-xl bg-background px-4 sm:px-5">
          <MessageList messages={messages} status={status} />
        </div>
      </div>
      <MessageInput
        input={input}
        setInput={setInput}
        onSubmit={onSubmit}
        status={status}
        onStop={stop}
        error={error}
      />
    </div>
  );
}
