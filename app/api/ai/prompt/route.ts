import { BUDGET_USED_UP, DEFAULT_MODEL, dropForbiddenCalls, SCHEDULING_INSTRUCTIONS, shapeForModel } from '@/lib/assistant';
import { isSameOrigin, modelCallRefusal } from '@/lib/guard';

// The proxy behind the Scheduler's AI panel. Bryntum's OpenAI plugin posts a Chat Completions request
// here; this adds the key, which never reaches the browser, and our instructions, which the
// browser can't change, and passes the answer back.

const COMPLETIONS_URL = process.env.OPENAI_COMPLETIONS_URL ?? 'https://api.openai.com/v1/chat/completions';

const error = (status: number, message: string) => Response.json({ error: { message } }, { status });

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.AG_STUDIO_OPENAI_API_KEY;
  if (!apiKey) return error(503, 'The assistant is not configured: set OPENAI_API_KEY.');
  if (!isSameOrigin(request)) return error(403, 'This endpoint only serves the Homestretch schedule.');

  const refusal = modelCallRefusal(request);
  if (refusal) return error(429, refusal);

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.messages)) return error(400, 'Expected a Chat Completions request.');

  const upstream = await fetch(COMPLETIONS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(shapeForModel(body, process.env.OPENAI_MODEL ?? DEFAULT_MODEL, SCHEDULING_INSTRUCTIONS)),
    signal: request.signal,
  });

  const answer = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const code = answer?.error?.code;
    if (code === 'insufficient_quota' || code === 'credit_balance_exhausted') return error(429, BUDGET_USED_UP);
    return error(upstream.status, answer?.error?.message ?? `The model request failed (HTTP ${upstream.status}).`);
  }
  return Response.json(dropForbiddenCalls(answer));
}
