import { describe, expect, it } from 'vitest';
import { costOf, usageOf } from '@/lib/model-usage';

describe('usageOf', () => {
  it('reads Chat Completions usage', () => {
    const usage = usageOf({ prompt_tokens: 8000, completion_tokens: 600, prompt_tokens_details: { cached_tokens: 6000 }, completion_tokens_details: { reasoning_tokens: 400 } });
    expect(usage).toEqual({ input: 8000, cached: 6000, output: 600, reasoning: 400 });
  });

  it('reads Responses API usage', () => {
    const usage = usageOf({ input_tokens: 9000, output_tokens: 900, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 700 } });
    expect(usage).toEqual({ input: 9000, cached: 0, output: 900, reasoning: 700 });
  });

  it('gives up on anything else', () => {
    expect(usageOf(undefined)).toBeNull();
    expect(usageOf({ total_tokens: 12 })).toBeNull();
  });
});

describe('costOf', () => {
  it('bills cached input at a tenth of the price, and reasoning as output', () => {
    // 2,000 fresh at $0.75/M, 6,000 cached at $0.075/M, 600 out at $4.50/M
    expect(costOf({ input: 8000, cached: 6000, output: 600, reasoning: 400 })).toBeCloseTo(0.0015 + 0.00045 + 0.0027, 10);
  });

  it('costs a million output tokens $4.50', () => {
    expect(costOf({ input: 0, cached: 0, output: 1_000_000, reasoning: 0 })).toBeCloseTo(4.5, 10);
  });
});
