"use client";

import { useState, useCallback } from "react";
import { FirstAid } from "@phosphor-icons/react";

export function RescuePlanButton({
  hasRescuePlanEligible,
}: {
  readonly hasRescuePlanEligible: boolean;
}) {
  const [rescueState, setRescueState] = useState<
    "idle" | "loading" | "error"
  >("idle");

  const handleRescuePlan = useCallback(() => {
    setRescueState("loading");
    fetch("/api/review/rescue-plan", { method: "POST" })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Rescue plan generation failed");
        }
        const result = (await res.json()) as { redirectUrl: string };
        window.location.href = result.redirectUrl;
      })
      .catch(() => setRescueState("error"));
  }, []);

  if (!hasRescuePlanEligible) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleRescuePlan}
        disabled={rescueState === "loading"}
        className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-[13px] font-medium text-accent-foreground transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {rescueState === "loading" ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent-foreground border-t-transparent" />
            Generating...
          </>
        ) : (
          <>
            <FirstAid className="h-3.5 w-3.5" weight="duotone" />
            Generate rescue plan
          </>
        )}
      </button>
      {rescueState === "error" && (
        <p className="text-[11.5px] text-destructive">
          Could not generate plan — try again
        </p>
      )}
    </div>
  );
}
