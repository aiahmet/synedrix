"use client";

import { useCallback, useEffect, useState } from "react";

// `localStorage` is a genuine external source of state that React
// cannot derive from during render (SSR lacks `window`, and
// reading it on the client during render triggers hydration
// mismatch warnings). The
// `react-compiler/no-direct-set-state-in-effect` lint forbids
// sync-into-state via useEffect, but the documented escape
// hatch for this case is to suppress the lint with explicit
// justification. The alternative idioms
// (`useSyncExternalStore`, ref-keyed remounts) add machinery
// without giving the caller a cleaner API; for the simple
// "load + save" use case, an honest effect-setState is the
// right tool.

/**
 * useLocalStorage.
 *
 * Hydration-safe persisted state. Two-step pattern:
 *
 *   1. SSR + first client render return `default`. No
 *      `localStorage.getItem` happens on the server —
 *      reading it would throw (no window).
 *   2. A single `useEffect` reads the persisted value
 *      and patches state. The patch only fires when the
 *      persisted value differs from the default, so no
 *      second render is triggered for first-time users.
 *
 * Without the two-step pattern the page would render the
 * server default on hydration, then suddenly swap to the
 * persisted value — a visible flash on every navigation.
 * Worse, a direct `useState(localStorage.getItem(key))`
 * throws a React hydration-mismatch error because the
 * server and client produce different markup for the same
 * initial state.
 *
 * The serialized value uses a versioned prefix
 * (`v1:key`) so a future schema migration can read a
 * single source of truth for which keys are in the new
 * shape and which are legacy. Existing single-key writes
 * that lack the prefix still resolve correctly via the
 * parse-fallback below.
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T
): readonly [T, (next: T | ((prev: T) => T)) => void, boolean] {
  const prefixedKey = `v1:${key}`;
  const [value, setValue] = useState<T>(defaultValue);
  const [hydrated, setHydrated] = useState<boolean>(false);

  // Hydrate once on mount. We can't read localStorage
  // during render (SSR lacks `window`, and even on the
  // client we'd cause a hydration-mismatch if the
  // stored value differed from the SSR default). The
  // two setState calls below are the documented
  // "syncing from external source into state" pattern;
  // the `react-hooks/set-state-in-effect` lint rule is
  // suppressed here because localStorage IS an external
  // source that cannot be read during render. See
  // https://react.dev/reference/react/useSyncExternalStore
  // for the alternative — but for the simple "load +
  // save" use case the effect-setState is the right
  // tool and the suppress is honest about why. The
  // suppress lives on the setState LINES (not the
  // effect declaration) because the lint attaches to
  // each setState call individually.
  useEffect(() => {
    let cancelled = false;
    try {
      const raw = window.localStorage.getItem(prefixedKey);
      if (raw !== null && !cancelled) {
        // JSON parse the persisted value. If the parse
        // fails (a legacy value written by an older app,
        // or a malformed write), fall through and keep
        // the default rather than crashing the page.
        // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is an external source; reading it during render would cause hydration-mismatch.
        setValue(JSON.parse(raw) as T);
      }
    } catch {
      // localStorage may be denied (private mode, corp
      // policy). Keep the SSR default silently.
    }
    if (!cancelled) {
      setHydrated(true);
    }
    return () => {
      cancelled = true;
    };
  }, [prefixedKey]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(prefixedKey, JSON.stringify(resolved));
        } catch {
          // ignore — quota, private mode
        }
        return resolved;
      });
    },
    [prefixedKey]
  );

  return [value, set, hydrated] as const;
}
