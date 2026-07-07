"use client";

import { useCallback, useRef, useState } from "react";
import type { UIMessage } from "@ai-sdk/react";
import { extractText } from "@/lib/ai/uiMessage";

export function useInlinePractice(
  threadId: string | undefined,
  subjectId: string | undefined,
  topicId: string | null,
  topicTitle: string,
  messages: readonly UIMessage[],
) {
  const requestingRef = useRef(false);
  const [isRequesting, setIsRequesting] = useState(false);

  const request = useCallback(() => {
    if (!topicId) return;
    if (requestingRef.current) return;
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant");
    if (!lastAssistant) return;
    requestingRef.current = true;
    setIsRequesting(true);
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
        threadId: threadId as string,
        subjectId: subjectId as string,
        topicId: topicId as string,
        topicTitle,
        anchorMessageId: lastAssistant.id,
        turns: recentTurns,
        gradeLevel: null,
        language: "en",
      }),
    })
      .catch((err) => console.error("[tutor] inline-practice fetch failed", err))
      .finally(() => {
        requestingRef.current = false;
        setIsRequesting(false);
      });
  }, [messages, topicId, topicTitle, threadId, subjectId]);

  return { request, isRequesting };
}
