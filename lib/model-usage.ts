// What each model call cost, from the usage OpenAI sends back with it. The server logs it, so the demo's
// real spend can be checked against its prepaid budget instead of guessed. Prices: gpt-5.4-mini.

const DOLLARS_PER_MILLION = { input: 0.75, cachedInput: 0.075, output: 4.5 };

export type ModelUsage = { input: number; cached: number; output: number; reasoning: number };

type RawUsage = {
  // Chat Completions
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
  completion_tokens_details?: { reasoning_tokens?: number };
  // Responses API
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: { cached_tokens?: number };
  output_tokens_details?: { reasoning_tokens?: number };
};

/** Reads usage in either shape OpenAI returns it: Chat Completions or the Responses API. */
export function usageOf(raw: unknown): ModelUsage | null {
  if (!raw || typeof raw !== 'object') return null;
  const u = raw as RawUsage;
  const input = u.prompt_tokens ?? u.input_tokens;
  const output = u.completion_tokens ?? u.output_tokens;
  if (typeof input !== 'number' || typeof output !== 'number') return null;
  return {
    input,
    cached: u.prompt_tokens_details?.cached_tokens ?? u.input_tokens_details?.cached_tokens ?? 0,
    output,
    reasoning: u.completion_tokens_details?.reasoning_tokens ?? u.output_tokens_details?.reasoning_tokens ?? 0,
  };
}

/** In dollars. Cached input is billed at a tenth of the price; reasoning is part of the output. */
export function costOf(usage: ModelUsage): number {
  const fresh = Math.max(0, usage.input - usage.cached);
  return (
    (fresh * DOLLARS_PER_MILLION.input + usage.cached * DOLLARS_PER_MILLION.cachedInput + usage.output * DOLLARS_PER_MILLION.output) /
    1_000_000
  );
}

let calls = 0;
let spent = 0;

/** One line per model call, with the running total since this server instance started. */
export function logUsage(raw: unknown): void {
  const usage = usageOf(raw);
  if (!usage) return;
  const cost = costOf(usage);
  calls += 1;
  spent += cost;
  console.log(
    `[model] ${usage.input} in (${usage.cached} cached), ${usage.output} out (${usage.reasoning} reasoning): $${cost.toFixed(4)}; ` +
      `$${spent.toFixed(4)} over ${calls} calls since start`,
  );
}
