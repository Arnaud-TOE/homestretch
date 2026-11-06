// Keeps a public demo honest about what it spends. Counters live in memory, per server instance: they
// stop a runaway tab or a casual script, and the prepaid accounts behind them are the hard ceiling.

const WINDOW_MS = 10 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

/** A sliding-window counter: `hit` says whether one more call fits. */
export class CallLimiter {
  private calls = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  hit(key: string, now = Date.now()): boolean {
    const recent = (this.calls.get(key) ?? []).filter((at) => now - at < this.windowMs);
    const allowed = recent.length < this.limit;
    if (allowed) recent.push(now);
    this.calls.set(key, recent);
    if (this.calls.size > 5000) {
      for (const [k, times] of this.calls) if (times.every((at) => now - at >= this.windowMs)) this.calls.delete(k);
    }
    return allowed;
  }
}

const visitorOf = (request: Request) => request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';

// The assistant calls the model several times per question, so these count model calls.
const modelPerVisitor = new CallLimiter(Number(process.env.AI_CALLS_PER_VISITOR) || 120, WINDOW_MS);
const modelPerDay = new CallLimiter(Number(process.env.AI_CALLS_PER_DAY) || 600, DAY_MS);

export function modelCallRefusal(request: Request): string | null {
  if (!modelPerVisitor.hit(visitorOf(request))) return 'The demo limits how much one visitor can ask the assistant in ten minutes. Please try again in a few minutes.';
  if (!modelPerDay.hit('all')) return "The demo's AI budget for today is used up. It resets within a day; the demo video shows the assistant at work.";
  return null;
}

const payoutsPerDay = new CallLimiter(Number(process.env.PAYOUTS_PER_DAY) || 120, DAY_MS);

export function payoutRefusal(request: Request, batches = 1): string | null {
  void request;
  for (let i = 0; i < batches; i++) {
    if (!payoutsPerDay.hit('all')) return "The demo's sandbox payouts for today are used up. They reset within a day.";
  }
  return null;
}

/** Whether the request comes from a page of this site. Browsers always send Origin on a POST. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
