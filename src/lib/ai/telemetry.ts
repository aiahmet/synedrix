import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { telemetryEnabled } from "./models";

/**
 * AI call telemetry.
 *
 * Per AGENTS.md: "Wrap all AI calls via
 * src/lib/ai/telemetry.ts to log token usage and latency."
 *
 * The wrapper is intentionally small and dependency-free:
 * it takes the call duration + token counts and (when
 * telemetry is enabled) writes a row to the `aiGenerations`
 * table via a Convex HTTP client.
 *
 * The caller is expected to pass an already-authenticated
 * ConvexHttpClient (with the Clerk JWT set via setAuth). The
 * `aiGenerations` table mutation resolves the user from
 * `ctx.auth.getUserIdentity()`, so without a JWT the write
 * will fail with "Unauthenticated" — which is the bug this
 * signature exists to prevent.
 *
 * Failures inside the telemetry write are caught and logged
 * to stderr — they must never break the AI call itself.
 */

export interface AiCallMeta {
  // The Convex mutation resolves the user from ctx.auth via
  // the Clerk JWT, so the caller does not pass a Convex userId
  // — only the per-call metrics.
  readonly task: string; // e.g. "tutor.chat"
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly latencyMs: number;
  readonly relatedId?: string; // e.g. tutorThreadId
  readonly schemaValid?: boolean; // defaults to true for text tasks
}

export async function logAiGeneration(
  convex: ConvexHttpClient,
  meta: AiCallMeta
): Promise<void> {
  if (!telemetryEnabled()) return;
  try {
    await convex.mutation(api.telemetry.recordAiGeneration, {
      task: meta.task,
      model: meta.model,
      inputTokens: meta.inputTokens,
      outputTokens: meta.outputTokens,
      latencyMs: meta.latencyMs,
      schemaValid: meta.schemaValid ?? true,
      ...(meta.relatedId ? { relatedId: meta.relatedId } : {}),
    });
  } catch (err) {
    // Never let telemetry break the AI call.
    console.error("telemetry: failed to log ai generation", err);
  }
}

