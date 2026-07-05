import { createDeepSeek } from "@ai-sdk/deepseek";

/**
 * DeepSeek provider instance.
 *
 * Uses the official Vercel AI SDK `@ai-sdk/deepseek`
 * provider instead of `createOpenAI` + a custom baseURL.
 * The official package is the recommended path because
 * it is tuned for DeepSeek's quirks:
 *
 *  - **SSE parsing** handles DeepSeek's `: keep-alive`
 *    comment lines correctly (DeepSeek emits these as
 *    part of its OpenAI-compatible stream). A bare
 *    OpenAI fetch would silently skip them; the official
 *    provider parses them as proper SSE comments per
 *    spec.
 *  - **JSON mode** wires `response_format: { type:
 *    "json_object" }` provider-side, plus injects the
 *    literal word "json" into the prompt automatically
 *    when `generateObject` / `streamObject` is used
 *    with a Zod schema. DeepSeek's docs explicitly warn
 *    that without `json` in the prompt, the model can
 *    emit an unending stream of whitespace when asked
 *    for structured output.
 *  - **429 retry** handles DeepSeek's concurrency-limit
 *    errors with exponential backoff (DeepSeek rates
 *    by concurrency, not RPM).
 *
 * The API key is read server-side only; never expose
 * it to the client. If the env var is missing, we
 * throw a clear error at the point of first use
 * rather than at module load — that way the app still
 * boots in environments where AI is not configured
 * (e.g. a marketing deploy).
 *
 * Default model is `deepseek-v4-flash` (non-thinking
 * mode of V4, fast + cheap). Override via
 * `DEEPSEEK_DEFAULT_MODEL` env var — set it to
 * `deepseek-v4-pro` for the slower but more capable
 * thinking variant.
 */
function readApiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key || key.length === 0) {
    throw new Error(
      "DEEPSEEK_API_KEY is not set. Add it to .env.local to enable the AI tutor."
    );
  }
  return key;
}

/**
 * Lazily-instantiated DeepSeek client. A getter keeps
 * environments without the env var (CI, static
 * prerender) from crashing on import. The provider
 * is a singleton per process — subsequent calls
 * return the cached instance, so the env read +
 * `createDeepSeek` only run once.
 */
let cached: ReturnType<typeof createDeepSeek> | null = null;

export function deepseek() {
  if (cached) return cached;
  cached = createDeepSeek({
    apiKey: readApiKey(),
  });
  return cached;
}
