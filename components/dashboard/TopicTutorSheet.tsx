"use client";

import { useCallback, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { TutorDrawer } from "@/components/tutor/TutorDrawer";
import { CockpitCard, CockpitCardHeader } from "@/components/dashboard/CockpitCard";
import { PaperPlaneTilt } from "@phosphor-icons/react/dist/ssr";
import { useRouter } from "next/navigation";

export function TopicTutorSheet({
  subject,
  topic,
  initialOpen,
  onOpenChange,
}: {
  readonly subject: {
    readonly id: Id<"subjects">;
    readonly slug: string;
    readonly title: string;
    readonly color?: string;
  };
  readonly topic: {
    readonly id: Id<"topics">;
    readonly slug: string;
    readonly title: string;
  };
  readonly initialOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const startSession = useMutation(api.studySessions.start);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onStartTutorSession = useCallback(async () => {
    const trimmed = input.trim();
    if (trimmed.length === 0) return;
    setSubmitting(true);

    let combined = trimmed;
    if (typeof window !== "undefined") {
      const sel = window.getSelection()?.toString().trim() ?? "";
      if (sel.length > 0 && sel.length < 800) {
        const truncated =
          sel.length > 600 ? `${sel.slice(0, 600)}…` : sel;
        combined = `About "${truncated}": ${trimmed}`;
      }
    }

    try {
      await startSession({
        subjectId: subject.id,
        topicId: topic.id,
        intention: `Tutor question about ${topic.title}`,
      });
    } catch {
      // Session start is optional for the tutor flow
    }

    const params = new URLSearchParams({
      subject: subject.slug,
      topic: topic.slug,
      q: combined,
      from: `/subjects/${subject.slug}/${topic.slug}`,
    });
    router.push(`/tutor?${params.toString()}`);
  }, [input, router, startSession, subject, topic]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void onStartTutorSession();
  };

  return (
    <TutorDrawer
      side="right"
      open={initialOpen}
      onOpenChange={onOpenChange}
      label="Ask the tutor"
      widthClassName="w-[min(420px,calc(100vw-2.5rem))]"
    >
      <div className="flex flex-col gap-4 p-4">
        <CockpitCard>
          <CockpitCardHeader
            label={`About ${topic.title}`}
            trailing={
              <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
                {subject.title}
              </span>
            }
          />
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            Ask a question about this topic. The tutor knows the subject, the
            lesson content, and your recent mistakes. Highlight text in the
            lesson to quote it automatically.
          </p>
        </CockpitCard>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="tutor-sheet-input"
              className="text-[11px] font-medium text-muted-foreground"
            >
              Your question
            </label>
            <textarea
              id="tutor-sheet-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={3}
              placeholder={`Ask anything about ${topic.title}…`}
              className="resize-y rounded-md border border-border bg-surface-elevated px-3 py-2.5 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground/40"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim().length > 0 && !submitting) {
                    void onStartTutorSession();
                  }
                }
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">
              Selection is quoted automatically
            </p>
            <button
              type="submit"
              disabled={input.trim().length === 0 || submitting}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-4 text-[12px] font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PaperPlaneTilt className="h-3.5 w-3.5" weight="fill" />
              {submitting ? "Starting..." : "Ask the tutor"}
            </button>
          </div>
        </form>

        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-elevated p-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            Quick prompts
          </p>
          <button
            type="button"
            onClick={() => setInput("Explain this as if I had never seen it.")}
            className="text-left text-[12px] leading-relaxed text-foreground transition-colors hover:text-accent"
          >
            Explain this as if I had never seen it.
          </button>
          <button
            type="button"
            onClick={() => setInput("Give me a worked example for this concept.")}
            className="text-left text-[12px] leading-relaxed text-foreground transition-colors hover:text-accent"
          >
            Give me a worked example for this concept.
          </button>
          <button
            type="button"
            onClick={() => setInput("What are the most common mistakes on this topic?")}
            className="text-left text-[12px] leading-relaxed text-foreground transition-colors hover:text-accent"
          >
            What are the most common mistakes on this topic?
          </button>
          <button
            type="button"
            onClick={() => setInput("Quiz me on what I just learned.")}
            className="text-left text-[12px] leading-relaxed text-foreground transition-colors hover:text-accent"
          >
            Quiz me on what I just learned.
          </button>
        </div>
      </div>
    </TutorDrawer>
  );
}
