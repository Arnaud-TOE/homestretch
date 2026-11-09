import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL, dropForbiddenCalls, keepToEnglish, shapeForModel } from '@/lib/assistant';
import { CallLimiter, DailyBudget, isSameOrigin } from '@/lib/guard';
import { payoutRequest, priceShifts } from '@/lib/payouts';
import { balanceAfterPayments, withPayments, type LedgerEntry } from '@/lib/schedule/saved';
import type { Shift } from '@/lib/schedule/types';

const shift = { shiftId: 'okafor-1', workerId: 'lena', job: 'Okafor dinner', skill: 'Cook' as const, hours: 6 };

describe('payoutRequest', () => {
  it('accepts a well-formed approval', () => {
    expect(payoutRequest.safeParse({ batchKey: 'abc12345', shifts: [shift] }).success).toBe(true);
  });

  it('refuses an impossible shift', () => {
    expect(payoutRequest.safeParse({ batchKey: 'abc12345', shifts: [{ ...shift, hours: 40 }] }).success).toBe(false);
    expect(payoutRequest.safeParse({ batchKey: 'abc12345', shifts: [{ ...shift, hours: -1 }] }).success).toBe(false);
  });

  it('refuses an amount or a recipient sent by the browser, by ignoring them', () => {
    const parsed = payoutRequest.parse({ batchKey: 'abc12345', shifts: [{ ...shift, amount: 9999, receiver: 'me@example.com' }] });
    expect(parsed.shifts[0]).not.toHaveProperty('amount');
    expect(parsed.shifts[0]).not.toHaveProperty('receiver');
  });
});

describe('priceShifts', () => {
  it("prices a shift from the server's own rate", () => {
    const result = priceShifts({ batchKey: 'abc12345', shifts: [shift] });
    expect(result).toMatchObject({ priced: [{ shiftId: 'okafor-1', workerName: 'Lena Ortiz', amount: 144 }] });
  });

  it('refuses a worker it does not know', () => {
    expect(priceShifts({ batchKey: 'abc12345', shifts: [{ ...shift, workerId: 'nobody' }] })).toEqual({ error: 'Unknown worker: nobody.' });
  });

  it('refuses a skill the worker does not have', () => {
    expect(priceShifts({ batchKey: 'abc12345', shifts: [{ ...shift, skill: 'Bartender' }] })).toEqual({ error: "Lena Ortiz isn't a bartender." });
  });
});

describe('shapeForModel', () => {
  it('asks for no reasoning, the only setting gpt-5.4-mini takes with tools on Chat Completions', () => {
    expect(shapeForModel({ messages: [{ role: 'user', content: 'Hi' }] }, DEFAULT_MODEL, 'Rules.').reasoning_effort).toBe('none');
  });

  const body = { model: 'gpt-4-1', temperature: 0, max_tokens: 99999, messages: [{ role: 'system', content: 'From the plugin.' }, { role: 'user', content: 'Hi' }], tools: [{ type: 'function' }] };

  it('uses the configured model, whatever the browser asks for', () => {
    expect(shapeForModel(body, DEFAULT_MODEL, 'Rules.').model).toBe(DEFAULT_MODEL);
  });

  it('puts our instructions first, keeping the plugin’s', () => {
    expect(shapeForModel(body, DEFAULT_MODEL, 'Rules.').messages[0].content).toBe('Rules.\n\nFrom the plugin.');
  });

  it('adds a system message when there is none', () => {
    const shaped = shapeForModel({ messages: [{ role: 'user', content: 'Hi' }] }, DEFAULT_MODEL, 'Rules.');
    expect(shaped.messages.map((m) => m.role)).toEqual(['system', 'user']);
  });

  it('caps the answer, and leaves out what current models refuse', () => {
    const shaped = shapeForModel(body, DEFAULT_MODEL, 'Rules.');
    expect(shaped.max_completion_tokens).toBeLessThanOrEqual(6000);
    expect(shaped).not.toHaveProperty('temperature');
    expect(shaped).not.toHaveProperty('max_tokens');
  });
});

describe('the tools the model gets', () => {
  const offered = ['fillOpenShifts', 'deleteShifts', 'updateShifts', 'askUser'].map((name) => ({ type: 'function', function: { name } }));

  it('offers only the tools that respect the rules', () => {
    const shaped = shapeForModel({ messages: [{ role: 'user', content: 'Hi' }], tools: offered }, DEFAULT_MODEL, 'Rules.');
    expect(shaped.tools?.map((tool) => tool.function?.name)).toEqual(['fillOpenShifts', 'askUser']);
  });

  it('has no tool that can pay', () => {
    const shaped = shapeForModel({ messages: [], tools: [{ function: { name: 'approveAndPay' } }, { function: { name: 'createPayout' } }] }, DEFAULT_MODEL, 'Rules.');
    expect(shaped.tools).toEqual([]);
  });

  it('drops a call to a tool it never offered', () => {
    const answer = dropForbiddenCalls({ choices: [{ finish_reason: 'tool_calls', message: { content: null, tool_calls: [{ function: { name: 'deleteShifts' } }] } }] });
    expect(answer.choices[0].message.tool_calls).toBeUndefined();
    expect(answer.choices[0].finish_reason).toBe('stop');
    expect(answer.choices[0].message.content).toContain("can't");
  });

  it('keeps the allowed calls of a mixed answer', () => {
    const answer = dropForbiddenCalls({ choices: [{ message: { tool_calls: [{ function: { name: 'deleteShifts' } }, { function: { name: 'checkSchedule' } }] } }] });
    expect(answer.choices[0].message.tool_calls?.map((call) => call.function?.name)).toEqual(['checkSchedule']);
  });
});

describe('keepToEnglish', () => {
  const said = (content: string | null) => keepToEnglish({ choices: [{ message: { content } }] }).choices[0].message.content;

  it('takes out a word of another script and the space before it', () => {
    expect(said('Staffed the Rivera wedding بالكامل.\nFilled:')).toBe('Staffed the Rivera wedding.\nFilled:');
  });

  it('leaves English alone, accents and dashes included', () => {
    expect(said('Zoë Renée — 2 shifts moved, $144.00')).toBe('Zoë Renée — 2 shifts moved, $144.00');
  });

  it('leaves a tool call without text alone', () => {
    expect(said(null)).toBeNull();
  });
});

describe('the record of payments', () => {
  const entry = (over: Partial<LedgerEntry>): LedgerEntry => ({
    shiftId: 's1',
    workerId: 'lena',
    workerName: 'Lena Ortiz',
    job: 'Dinner',
    skill: 'Cook',
    hours: 6,
    rate: 24,
    amount: 144,
    fee: 0.25,
    status: 'SUCCESS',
    batchId: 'B1',
    transactionId: 'T1',
    sentAt: '2026-11-06T12:00:00.000Z',
    run: 1,
    ...over,
  });
  const shift: Shift = { id: 's1', job: 'Dinner', skill: 'Cook', start: '2026-11-05T16:00:00.000Z', end: '2026-11-05T22:00:00.000Z', workerId: 'lena', pinned: false };

  it('gives a shift its payment from the ledger', () => {
    expect(withPayments([shift], [entry({})], 1)[0].payment).toMatchObject({ batchId: 'B1', amount: 144, status: 'SUCCESS' });
  });

  it('makes a shift payable again when PayPal failed to pay it', () => {
    expect(withPayments([shift], [entry({ status: 'FAILED' })], 1)[0].payment).toBeUndefined();
  });

  it('forgets payments from before the demo was reset, without losing them', () => {
    expect(withPayments([shift], [entry({ run: 1 })], 2)[0].payment).toBeUndefined();
  });

  it('takes payments sent since PayPal last counted off the balance', () => {
    const reported = { available: 1000, asOf: '2026-11-06T10:00:00.000Z' };
    expect(balanceAfterPayments(reported, [entry({})])).toBe(855.75);
    expect(balanceAfterPayments(reported, [entry({ status: 'SENDING', fee: null })])).toBe(856);
    expect(balanceAfterPayments(reported, [entry({ status: 'FAILED' })])).toBe(1000);
    expect(balanceAfterPayments({ ...reported, asOf: '2026-11-06T13:00:00.000Z' }, [entry({})])).toBe(1000);
  });
});

describe('guards', () => {
  it('limits calls per key, and frees them with time', () => {
    const limiter = new CallLimiter(1, 1000);
    expect(limiter.hit('a', 0)).toBe(true);
    expect(limiter.hit('a', 10)).toBe(false);
    expect(limiter.hit('b', 10)).toBe(true);
    expect(limiter.hit('a', 1000)).toBe(true);
  });

  it('stops spending at the daily limit, and starts again the next day', () => {
    const budget = new DailyBudget(100);
    const today = new Date('2026-11-06T12:00:00Z');
    expect(budget.spend(60, today)).toBe(true);
    expect(budget.spend(60, today)).toBe(false);
    expect(budget.spend(40, today)).toBe(true);
    expect(budget.spend(1, today)).toBe(false);
    expect(budget.spend(100, new Date('2026-11-07T00:01:00Z'))).toBe(true);
  });

  const request = (headers: Record<string, string>) => new Request('https://homestretch.example/api', { method: 'POST', headers });

  it('accepts only pages of the same site', () => {
    expect(isSameOrigin(request({ origin: 'https://homestretch.example', host: 'homestretch.example' }))).toBe(true);
    expect(isSameOrigin(request({ origin: 'https://elsewhere.example', host: 'homestretch.example' }))).toBe(false);
    expect(isSameOrigin(request({ host: 'homestretch.example' }))).toBe(false);
  });
});
