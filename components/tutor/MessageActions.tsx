"use client";

import { useState } from "react";
import {
  ArrowClockwise,
  Cards,
  Check,
  Clipboard,
  GraduationCap,
  Heart,
  Note,
  Share,
} from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils/cn";

/**
 * MessageActions.
 *
 * Compact icon-button toolbar rendered under each
 * assistant message. Each button performs one of:
 *
 *   copy — copies the message text to clipboard
 *   helpful — saves a "helpful" heart to localStorage
 *   regenerate — re-rolls the assistant reply through
 *              the AI SDK's `regenerate()`
 *   flashcards — pipes the message to a (placeholder)
 *              flashcard creation flow
 *   notes — saves the message text into a (placeholder)
 *              note
 *   practice — opens the canonical topic's practice
 *              set in a new tab
 *   share — copies a sharable text snippet
 *
 * Saved items (helpful, notes, flashcards) currently
 * write to localStorage rather than the Convex
 * `notes` / `flashcards` tables. The architecture
 * contract here is intentionally thin: if the user
 * truly uses these features, a follow-up wires up
 * the durable mutation. For v1 the localStorage
 * persistence path proves the UX is right before
 * we commit to schema.
 */
export function MessageActions({
  messageText,
  topicId,
  onRegenerate,
  canRegenerate,
}: {
  readonly messageText: string;
  readonly topicId: string | null;
  readonly onRegenerate: (() => void) | undefined;
  /**
   * Whether the regenerate button is currently
   * enabled. The parent (MessageBubble) gates this on
   * the chat status so we never try to regen mid-stream.
   */
  readonly canRegenerate: boolean;
}) {
  const [copiedRecently, setCopiedRecently] = useState<"copy" | "share" | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopiedRecently("copy");
      setTimeout(() => setCopiedRecently((v) => (v === "copy" ? null : v)), 2000);
    } catch {
      // ignore — clipboard may be unavailable
    }
  };

  const handleHelpful = () => {
    appendLocalSaved("helpful", messageText);
  };

  const handleSaveNote = () => {
    appendLocalSaved("note", messageText);
  };

  const handleMakeFlashcards = () => {
    appendLocalSaved("flashcards", messageText);
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(
        `${messageText}\n\n— from Synedrix tutor`
      );
      setCopiedRecently("share");
      setTimeout(() => setCopiedRecently((v) => (v === "share" ? null : v)), 2000);
    } catch {
      // ignore
    }
  };

  const handlePractice = () => {
    if (typeof window !== "undefined" && topicId) {
      // The topic-scoped practice route is /subjects/[subject]/[chapter]/[topic]/practice
      // We only have a topicId at this layer; the parent
      // hands the resolved href as a data attribute so
      // we don't need to refetch. We approximate by
      // navigating to the topic's index page instead for
      // the MVP — the dashboard offers the practice
      // launcher there.
      window.open("/dashboard", "_blank", "noopener,noreferrer");
    } else {
      window.open("/dashboard", "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      className="mt-1.5 hidden flex-wrap items-center gap-0.5 group-hover:flex"
      role="group"
      aria-label="Message actions"
    >
      <ActionButton
        icon={
          copiedRecently === "copy" ? (
            <Check className="h-3 w-3 text-accent" weight="bold" />
          ) : (
            <Clipboard className="h-3 w-3" weight="duotone" />
          )
        }
        label={copiedRecently === "copy" ? "Copied" : "Copy"}
        onClick={handleCopy}
      />
      <ActionButton
        icon={<Heart className="h-3 w-3" weight="duotone" />}
        label="Helpful"
        onClick={handleHelpful}
      />
      <ActionButton
        icon={<ArrowClockwise className="h-3 w-3" weight="duotone" />}
        label="Re-roll"
        onClick={onRegenerate ?? noopHandler}
        disabled={!canRegenerate || !onRegenerate}
      />
      <ActionButton
        icon={<Cards className="h-3 w-3" weight="duotone" />}
        label="Flashcards"
        onClick={handleMakeFlashcards}
      />
      <ActionButton
        icon={<Note className="h-3 w-3" weight="duotone" />}
        label="Note"
        onClick={handleSaveNote}
      />
      <ActionButton
        icon={<GraduationCap className="h-3 w-3" weight="duotone" />}
        label="Practice"
        onClick={handlePractice}
      />
      <ActionButton
        icon={
          copiedRecently === "share" ? (
            <Check className="h-3 w-3 text-accent" weight="bold" />
          ) : (
            <Share className="h-3 w-3" weight="duotone" />
          )
        }
        label={copiedRecently === "share" ? "Copied" : "Share"}
        onClick={handleShare}
      />
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "group/btn inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground focus-visible:bg-surface-elevated focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
      )}
    >
      {icon}
    </button>
  );
}

function noopHandler(): void {}

const SAVED_KEY = "v1:tutorSavedItems";

type SavedItem = { kind: "helpful" | "note" | "flashcards"; text: string; at: number };
function appendLocalSaved(
  kind: SavedItem["kind"],
  text: string
): void {
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    const arr = raw ? (JSON.parse(raw) as SavedItem[]) : [];
    arr.unshift({ kind, text, at: Date.now() });
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(arr.slice(0, 200)));
  } catch {
    // ignore — quota / private mode
  }
}
