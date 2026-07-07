"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowClockwise,
  Cards,
  Check,
  Clipboard,
  DotsThreeVertical,
  GraduationCap,
  Heart,
  Lightning,
  Note,
  Share,
  Spinner,
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
 *   3 quick questions — Phase 3 §5.2 inline practice;
 *              inserts an InlinePractice tile into the
 *              chat surface anchored to this message.
 *
 * Plan §2.5: the previous "Practice" action hard-coded
 * `/dashboard`. It now reads a `practiceHref` prop
 * supplied by the parent (`TutorClient`) which the
 * server-side `TutorPage` resolves from the
 * (subject, topic) tuple. For canonical topics the
 * href points to `/subjects/[subject]/[chapter]/[topic]/practice`
 * (the canonical practice route); for user-owned
 * topics the href points to
 * `/my-topics/[topic]/practice`. The fix removes the
 * long-standing "Practice button always sends me to
 * the dashboard" bug.
 *
 * Saved items (helpful, notes, flashcards) currently
 * write to localStorage rather than the Convex
 * `notes` / `flashcards` tables. Per Phase 5.2/5.3
 * the wiring is deferred until those Convex functions
 * land — see plan §6 "Out of scope".
 */
export function MessageActions({
  messageText,
  topicId,
  onRegenerate,
  canRegenerate,
  practiceHref,
  onInlinePracticeRequested,
  subjectId,
  topicTitle,
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
  /**
   * The href the "Practice" action routes to. When
   * null, the button is disabled. The parent
   * (`MessageList` → `TutorClient`) resolves this
   * from the (subject, topic) tuple. Replaces the
   * previous `/dashboard` hard-code (Phase 2.5).
   */
  readonly practiceHref: string | null;
  /**
   * Phase 3 §5.2: opens an inline practice runner
   * inline in the chat surface. Wired by
   * `TutorClient` to a POST `/api/tutor/practice`
   * call followed by a Convex subscription; the new
   * `inlineTutorSessions` row drives an
   * `InlinePractice` tile in `MessageList`.
   */
  readonly onInlinePracticeRequested?: () => void;
  /**
   * Phase 6 §8.2: subjectId for flashcard generation.
   * When both `subjectId` and `topicId` are present,
   * the "Flashcards" button calls the new
   * `/api/tutor/flashcards` route instead of
   * writing to localStorage.
   */
  readonly subjectId?: string | null;
  /**
   * Phase 6 §8.2: topic title for flashcard deck naming.
   */
  readonly topicTitle?: string | null;
}) {
  const [copiedRecently, setCopiedRecently] = useState<"copy" | "share" | null>(
    null
  );
  // Phase-3 polish: secondary actions (Helpful / Note /
  // Flashcards / Share) get folded into a tiny More
  // popover on `<sm` so the primary row
  // (Copy / Re-roll / Practice / 3 quick questions) fits
  // on a single line at 360px. On `sm+` all actions
  // render inline; the popover is hidden.
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const onPointerDown = (e: MouseEvent) => {
      if (!moreRef.current) return;
      if (e.target instanceof Node && !moreRef.current.contains(e.target)) {
        setMoreOpen(false);
      }
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [moreOpen]);

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
    setMoreOpen(false);
  };

  const handleSaveNote = () => {
    appendLocalSaved("note", messageText);
    setMoreOpen(false);
  };

  // Phase 6 §8.2: flashcards generation state.
  // `flashcardsStatus` cycles: null → "generating" →
  // "saved:N" (confirmation with card count) → null
  // (cleared after 4s). The ref prevents double-fire.
  const flashcardsRequestingRef = useRef(false);
  const [flashcardsStatus, setFlashcardsStatus] = useState<
    | { kind: "generating" }
    | { kind: "saved"; cardCount: number }
    | { kind: "error" }
    | null
  >(null);

  useEffect(() => {
    if (flashcardsStatus?.kind === "saved") {
      const id = setTimeout(() => setFlashcardsStatus(null), 4000);
      return () => clearTimeout(id);
    }
    if (flashcardsStatus?.kind === "error") {
      const id = setTimeout(() => setFlashcardsStatus(null), 3000);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [flashcardsStatus]);

  const handleMakeFlashcards = useCallback(() => {
    // Phase 6 §8.2: when subjectId + topicId are
    // available, call the new flashcards API instead
    // of saving to localStorage.
    if (subjectId && topicId) {
      if (flashcardsRequestingRef.current) return;
      flashcardsRequestingRef.current = true;
      setFlashcardsStatus({ kind: "generating" });
      setMoreOpen(false);

      void fetch("/api/tutor/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId,
          topicTitle: topicTitle ?? "Tutor topic",
          messageText,
        }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as { cardCount: number };
          setFlashcardsStatus({
            kind: "saved",
            cardCount: data.cardCount,
          });
        })
        .catch((err) => {
          console.error("[tutor] flashcards generation failed", err);
          setFlashcardsStatus({ kind: "error" });
        })
        .finally(() => {
          flashcardsRequestingRef.current = false;
        });
    } else {
      // Legacy: save to localStorage when no backend
      // context is available (subject-only threads or
      // pre-Phase 6 clients).
      appendLocalSaved("flashcards", messageText);
      setMoreOpen(false);
    }
  }, [messageText, subjectId, topicId, topicTitle]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(
        `${messageText}\n\nShared from Synedrix tutor.`
      );
      setCopiedRecently("share");
      setTimeout(() => setCopiedRecently((v) => (v === "share" ? null : v)), 2000);
      setMoreOpen(false);
    } catch {
      // ignore
    }
  };

  const handlePractice = () => {
    if (typeof window === "undefined") return;
    if (practiceHref) {
      // Open in a new tab so the chat surface stays
      // mounted. The user can pop back to the tutor
      // after the practice run completes.
      window.open(practiceHref, "_blank", "noopener,noreferrer");
    } else if (topicId) {
      // Fallback for the rare case where the parent
      // did not pass a practiceHref but a topicId is
      // still known. We open the canonical /subjects
      // index so the user can navigate from there.
      window.open("/subjects", "_blank", "noopener,noreferrer");
    }
  };

  return (
    // Always visible: the row used to hide behind a
    // `group-hover` reveal which stranded users mid-
    // stream when auto-scroll moved the hover away.
    <div
      className="mt-1.5 flex flex-wrap items-center gap-0.5"
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
      {/* Secondary actions: visible inline on `sm+`,
          behind the More popover on `<sm`. */}
      <ActionButton
        icon={<Heart className="h-3 w-3" weight="duotone" />}
        label="Helpful"
        onClick={handleHelpful}
        className="hidden sm:inline-flex"
      />
      <ActionButton
        icon={<ArrowClockwise className="h-3 w-3" weight="duotone" />}
        label="Re-roll"
        onClick={onRegenerate ?? noopHandler}
        disabled={!canRegenerate || !onRegenerate}
      />
      <ActionButton
        icon={
          flashcardsStatus?.kind === "generating" ? (
            <Spinner className="h-3 w-3 animate-spin" weight="duotone" />
          ) : flashcardsStatus?.kind === "saved" ? (
            <Check className="h-3 w-3 text-accent" weight="bold" />
          ) : (
            <Cards className="h-3 w-3" weight="duotone" />
          )
        }
        label={
          flashcardsStatus?.kind === "generating"
            ? "Generating…"
            : flashcardsStatus?.kind === "saved"
              ? `${flashcardsStatus.cardCount} cards saved`
              : flashcardsStatus?.kind === "error"
                ? "Failed"
                : "Flashcards"
        }
        onClick={flashcardsStatus ? noopHandler : handleMakeFlashcards}
        disabled={flashcardsStatus?.kind === "generating"}
        className="hidden sm:inline-flex"
      />
      <ActionButton
        icon={<Note className="h-3 w-3" weight="duotone" />}
        label="Note"
        onClick={handleSaveNote}
        className="hidden sm:inline-flex"
      />
      <ActionButton
        icon={<GraduationCap className="h-3 w-3" weight="duotone" />}
        label="Practice"
        onClick={handlePractice}
        disabled={!practiceHref && !topicId}
      />
      {onInlinePracticeRequested && (
        <ActionButton
          icon={<Lightning className="h-3 w-3" weight="duotone" />}
          label="3 quick questions"
          onClick={onInlinePracticeRequested}
        />
      )}
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
        className="hidden sm:inline-flex"
      />
      {/* More popover: collapsed on `sm+`, opens a tiny
          menu on `<sm` for the secondary actions we
          hid above (Helpful / Flashcards / Note / Share). */}
      <div ref={moreRef} className="relative sm:hidden">
        <ActionButton
          icon={<DotsThreeVertical className="h-3 w-3" weight="duotone" />}
          label="More"
          onClick={() => setMoreOpen((v) => !v)}
        />
        {moreOpen ? (
          <div
            role="menu"
            aria-label="More message actions"
            className="absolute right-0 top-full z-20 mt-1 flex min-w-[10rem] flex-col gap-0.5 rounded-lg border border-border bg-surface-elevated p-1 shadow-[var(--shadow-soft)]"
          >
            <MenuItem
              icon={<Heart className="h-3 w-3" weight="duotone" />}
              label="Helpful"
              onClick={handleHelpful}
            />
            <MenuItem
              icon={
                flashcardsStatus?.kind === "generating" ? (
                  <Spinner className="h-3 w-3 animate-spin" weight="duotone" />
                ) : flashcardsStatus?.kind === "saved" ? (
                  <Check className="h-3 w-3 text-accent" weight="bold" />
                ) : (
                  <Cards className="h-3 w-3" weight="duotone" />
                )
              }
              label={
                flashcardsStatus?.kind === "generating"
                  ? "Generating…"
                  : flashcardsStatus?.kind === "saved"
                    ? `${flashcardsStatus.cardCount} cards saved`
                    : flashcardsStatus?.kind === "error"
                      ? "Failed"
                      : "Flashcards"
              }
              onClick={flashcardsStatus ? noopHandler : handleMakeFlashcards}
            />
            <MenuItem
              icon={<Note className="h-3 w-3" weight="duotone" />}
              label="Note"
              onClick={handleSaveNote}
            />
            <MenuItem
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
        ) : null}
      </div>
    </div>
  );
}

/**
 * MenuItem — used by the More popover. Visually a
 * menu row, NOT an icon button; the icon button pattern
 * (ActionButton) is too dense for a 4-item menu.
 */
function MenuItem({
  icon,
  label,
  onClick,
}: {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-[11.5px] font-medium text-foreground transition-colors hover:bg-surface"
    >
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled = false,
  className,
}: {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  /**
   * Optional className passthrough so callers can
   * hide / show / re-position individual buttons
   * (`hidden sm:inline-flex` on the secondary
   * actions is the canonical usage here).
   */
  readonly className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "group/btn inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground focus-visible:bg-surface-elevated focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40 disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
    >
      {icon}
    </button>
  );
}

function noopHandler(): void {}

const SAVED_KEY = "v1:tutorSavedItems";

type SavedItem = {
  kind: "helpful" | "note" | "flashcards";
  text: string;
  at: number;
};

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
