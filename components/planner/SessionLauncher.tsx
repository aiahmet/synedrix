"use client";

import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { FocusMode } from "@/components/planner/FocusMode";

export function SessionLauncher({
  subjectId,
  subjectTitle,
  topicId,
  topicTitle,
  goalLabel,
  templateIntention,
  children,
}: {
  readonly subjectId: Id<"subjects">;
  readonly subjectTitle?: string;
  readonly topicId?: Id<"topics">;
  readonly topicTitle?: string;
  readonly goalLabel?: string;
  readonly templateIntention?: string;
  readonly children: React.ReactNode;
}) {
  const [focusOpen, setFocusOpen] = useState(false);
  const startSession = useMutation(api.studySessions.start);
  const completeSession = useMutation(api.studySessions.complete);

  const handleOpen = useCallback(() => {
    setFocusOpen(true);
  }, []);

  const handleSessionEnd = useCallback(
    (durationSec: number, reflection: string) => {
      void startSession({
        subjectId,
        ...(topicId ? { topicId } : {}),
        ...(templateIntention ? { intention: templateIntention } : {}),
      }).then((sessionId) => {
        void completeSession({
          sessionId,
          durationSec,
          ...(reflection ? { reflection } : {}),
        });
      });
    },
    [subjectId, topicId, templateIntention, startSession, completeSession]
  );

  return (
    <>
      <button type="button" onClick={handleOpen} className="contents">
        {children}
      </button>
      <FocusMode
        open={focusOpen}
        onClose={() => setFocusOpen(false)}
        subjectTitle={subjectTitle}
        topicTitle={topicTitle}
        goalLabel={goalLabel}
        onSessionEnd={handleSessionEnd}
      />
    </>
  );
}
