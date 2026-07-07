"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";

/**
 * TutorStorageCleanup.
 *
 * Plan §5.6: clears tutor-related `localStorage` keys
 * on sign-out. The keys live in the browser across
 * sessions because Clerk is the only auth signal — a
 * new user signing in on the same machine would
 * otherwise inherit the prior user's collapse-state,
 * last-read, and saved-items state.
 *
 * Mounted once in `app/(app)/layout.tsx` (next to the
 * `NavTutorBadge`). Pure effect-only component — no
 * rendered output. The component name starts with
 * "Tutor" so React's dev-tools makes the mount
 * obvious.
 *
 * The key list is exhaustive: a key that should be
 * cleared but is missing from this list will persist
 * across users. When you add a new `useLocalStorage`
 * key anywhere in `components/tutor/`, mirror it
 * here.
 */
export function TutorStorageCleanup() {
  const { isSignedIn, isLoaded } = useUser();
  const wasSignedInRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (wasSignedInRef.current === true && isSignedIn === false) {
      // User just signed out — wipe the keys. Exact-match
      // keys are removed directly; prefix keys (ending with
      // ".") iterate localStorage and remove every entry
      // matching the prefix.
      try {
        for (const key of TUTOR_STORAGE_KEYS) {
          if (key.endsWith(".")) {
            for (let i = window.localStorage.length - 1; i >= 0; i--) {
              const candidate = window.localStorage.key(i);
              if (candidate && candidate.startsWith(key)) {
                window.localStorage.removeItem(candidate);
              }
            }
          } else {
            window.localStorage.removeItem(key);
          }
        }
      } catch {
        // localStorage may be unavailable (private mode,
        // quota, etc). Skip silently — the keys are
        // advisory and the next sign-in will overwrite
        // them.
      }
    }
    wasSignedInRef.current = isSignedIn ?? false;
  }, [isSignedIn, isLoaded]);

  return null;
}

const TUTOR_STORAGE_KEYS: ReadonlyArray<string> = [
  "tutor.historyCollapsed",
  "tutor.memoryCollapsed",
  "v1:tutorSavedItems",
  "tutor.lastRead",
  // Convenience prefix used by `MessageList` to track
  // scroll-restoration state per thread. We clear the
  // whole prefix rather than enumerate every thread
  // id; the prefix is namespaced so this cannot wipe
  // unrelated localStorage entries.
  "tutor.lastRead.",
];
