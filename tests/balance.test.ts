import { describe, expect, it } from 'vitest';
import { readBalance } from '@/lib/paypal';

const answer = (accountId: string, value: string) => ({
  account_id: accountId,
  as_of_time: '2026-11-08T22:59:59Z',
  balances: [{ currency: 'USD', available_balance: { value } }],
});

describe('readBalance', () => {
  it('adds the manual top-up back for the demo account, and says how much', () => {
    expect(readBalance(answer('FAVR2H6TABYWL', '4884.75'))).toEqual({ available: 99_884.75, asOf: '2026-11-08T22:59:59Z', toppedUp: 95_000 });
  });

  it('leaves any other account alone', () => {
    expect(readBalance(answer('SOMEONEELSE', '120.50'))).toEqual({ available: 120.5, asOf: '2026-11-08T22:59:59Z', toppedUp: 0 });
  });

  it('copes with an answer that has no dollar balance', () => {
    expect(readBalance({ balances: [] }, new Date('2026-11-09T00:00:00Z'))).toEqual({ available: 0, asOf: '2026-11-09T00:00:00.000Z', toppedUp: 0 });
  });
});
