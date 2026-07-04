/**
 * Model routing.
 *
 * Picks the default model from env, with a safe fallback
 * when env is not set. The OpenRouter model id is the full
 * `provider/model` string (e.g. `openai/gpt-4o`,
 * `anthropic/claude-sonnet-4`). We never hardcode a model
 * id at the call site — always go through this file so a
 * single env change retargets the entire app.
 *
 * Adding a new task? Add a new function that returns the
 * model id for that task. For MVP every task uses the same
 * default; per-task overrides are a followup.
 */

const DEFAULT_MODEL = "openai/gpt-4o-mini";

/** Default model for the tutor chat task. */
export function chatModel(): string {
  return process.env.OPENROUTER_DEFAULT_MODEL || DEFAULT_MODEL;
}

/** Whether AI telemetry is enabled (logs to aiGenerations). */
export function telemetryEnabled(): boolean {
  return process.env.AI_TELEMETRY_ENABLED === "true";
}
