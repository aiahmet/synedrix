/**
 * Model routing.
 *
 * Picks the default model from env, with a safe fallback
 * when env is not set. The model id is a DeepSeek model
 * name (e.g. `deepseek-v4-flash`, `deepseek-v4-pro`).
 * We never hardcode a model id at the call site —
 * always go through this file so a single env change
 * retargets the entire app.
 *
 * DeepSeek model lineage (DeepSeek API docs, 2026):
 *
 *  STABLE:
 *  - `deepseek-v4-flash` — non-thinking mode of V4.
 *                           Fast, cheap. Default. Best
 *                           for tutor chat, lesson
 *                           generation, and grading.
 *  - `deepseek-v4-pro`   — thinking mode of V4.
 *                           Slower, more capable,
 *                           better for multi-step math
 *                           and proofs. Override via
 *                           `DEEPSEEK_DEFAULT_MODEL`
 *                           when a task needs the
 *                           extra depth.
 *
 *  DEPRECATED (will sunset 2026-07-24):
 *  - `deepseek-chat`     → maps to non-thinking v4-flash
 *  - `deepseek-reasoner` → maps to thinking v4-pro
 *
 * Reasoning-heavy task? Set `DEEPSEEK_DEFAULT_MODEL=deepseek-v4-pro`
 * in `.env.local`. We do not expose a second helper
 * here so this file stays free of dead exports.
 *
 * Adding a new task? Add a function that returns a
 * task-specific model id. For MVP every task uses the
 * same default; per-task overrides are a followup.
 */

const DEFAULT_MODEL = "deepseek-v4-flash";

/** Default model for chat / lesson / grading tasks. */
export function chatModel(): string {
  return process.env.DEEPSEEK_DEFAULT_MODEL || DEFAULT_MODEL;
}

/** Whether AI telemetry is enabled (logs to aiGenerations). */
export function telemetryEnabled(): boolean {
  return process.env.AI_TELEMETRY_ENABLED === "true";
}
