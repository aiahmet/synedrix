"use client";

import { useEffect, useRef } from "react";

/**
 * Auto-retries once when the AI stream errors.
 * Watches `status`, calls `regenerate()` once on first "error" state,
 * resets the guard on "ready".
 */
export function useAutoRetry(
  status: "submitted" | "streaming" | "ready" | "error",
  regenerate: () => void,
) {
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (status === "error" && !attemptedRef.current) {
      attemptedRef.current = true;
      regenerate();
    }
    if (status === "ready") {
      attemptedRef.current = false;
    }
  }, [status, regenerate]);
}
