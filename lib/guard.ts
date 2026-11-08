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

// The assistant calls the model several times per question, so these count model calls. The demo runs on
// a small prepaid budget: a full tour (the three suggestions and a few more questions) takes about 18 calls.
const modelPerVisitor = new CallLimiter(Number(process.env.AI_CALLS_PER_VISITOR) || 40, WINDOW_MS);
const modelPerDay = new CallLimiter(Number(process.env.AI_CALLS_PER_DAY) || 80, DAY_MS);

export function modelCallRefusal(request: Request): string | null {
  if (!modelPerVisitor.hit(visitorOf(request))) return 'The demo limits how much one visitor can ask the assistant in ten minutes. Please try again in a few minutes.';
  if (!modelPerDay.hit('all')) return "The demo's AI budget for today is used up. It resets within a day; the demo video shows the assistant at work.";
  return null;
}

/** Keeps one day of visitors from emptying the sandbox account that the demo's payments come from. */
export class DailyBudget {
  private day = '';
  private spent = 0;

  constructor(private readonly limit: number) {}

  /** Takes `amount` from today's budget, or says no and takes nothing. */
  spend(amount: number, now = new Date()): boolean {
    const today = now.toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.spent = 0;
    }
    if (this.spent + amount > this.limit) return false;
    this.spent += amount;
    return true;
  }
}

const payoutBudget = new DailyBudget(Number(process.env.PAYOUT_DOLLARS_PER_DAY) || 2500);

export function payoutRefusal(amount: number): string | null {
  return payoutBudget.spend(amount) ? null : "The demo's sandbox budget for today is used up, so nobody was paid. It resets tomorrow; the demo video shows payments at work.";
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
