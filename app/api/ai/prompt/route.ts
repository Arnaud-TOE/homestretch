import { assistantSays, BUDGET_USED_UP, DEFAULT_MODEL, dropForbiddenCalls, SCHEDULING_INSTRUCTIONS, shapeForModel } from '@/lib/assistant';
import { isSameOrigin, modelCallRefusal } from '@/lib/guard';
import { logUsage } from '@/lib/model-usage';

// The proxy behind the Scheduler's AI panel. Bryntum's OpenAI plugin posts a Chat Completions request
// here; this adds the key, which never reaches the browser, and our instructions, which the
// browser can't change, and passes the answer back.

const COMPLETIONS_URL = process.env.OPENAI_COMPLETIONS_URL ?? 'https://api.openai.com/v1/chat/completions';

const error = (status: number, message: string) => Response.json({ error: { message } }, { status });
const say = (message: string) => Response.json(assistantSays(message));

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.AG_STUDIO_OPENAI_API_KEY;
  if (!apiKey) return say('The assistant is not configured on this server yet. You can still drag shifts by hand and pay finished ones.');
  if (!isSameOrigin(request)) return error(403, 'This endpoint only serves the Homestretch schedule.');

  const refusal = modelCallRefusal(request);
  if (refusal) return say(refusal);

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.messages)) return error(400, 'Expected a Chat Completions request.');

  const upstream = await fetch(COMPLETIONS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(shapeForModel(body, process.env.OPENAI_MODEL ?? DEFAULT_MODEL, SCHEDULING_INSTRUCTIONS)),
    signal: request.signal,
  }).catch(() => null);

  if (!upstream) return say("I couldn't reach the model just now. Please try again in a moment.");
  const answer = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const code = answer?.error?.code;
    if (code === 'insufficient_quota' || code === 'credit_balance_exhausted') return say(BUDGET_USED_UP);
    console.error('[assistant] the model request failed', upstream.status, answer?.error?.message);
    return say("The model didn't answer that one. Please try again in a moment.");
  }
  logUsage(answer?.usage);
  return Response.json(dropForbiddenCalls(answer));
}
