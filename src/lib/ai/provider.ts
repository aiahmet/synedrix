import { createOpenAI } from "@ai-sdk/openai";

/**
 * OpenRouter provider instance.
 *
 * OpenRouter is OpenAI-API-compatible, so we point
 * `@ai-sdk/openai` at its base URL. The API key is read
 * server-side only; never expose it to the client.
 *
 * If the env var is missing, we throw a clear error at the
 * point of first use rather than at module load — that way
 * the app still boots in environments where AI is not
 * configured (e.g. a marketing deploy) and the failure is
 * scoped to the actual AI call.
 */
function readApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || key.length === 0) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to .env.local to enable the AI tutor."
    );
  }
  return key;
}

/**
 * Lazily-instantiated OpenRouter client. We use a getter
 * instead of a module-level constant so that environments
 * without the env var (CI, static prerender) don't crash
 * on import.
 */
let cached: ReturnType<typeof createOpenAI> | null = null;

export function openrouter() {
  if (cached) return cached;
  cached = createOpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: readApiKey(),
  });
  return cached;
}
