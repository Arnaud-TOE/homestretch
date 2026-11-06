import { isSameOrigin, payoutRefusal } from '@/lib/guard';
import { createPayoutBatch, PayPalApiError } from '@/lib/paypal';
import { payoutRequest, priceShifts } from '@/lib/payouts';

// Pays approved shifts through PayPal Payouts. Only a person's click reaches this route: the agent
// has no tool for it. The workers are fictional, so every payment goes to one sandbox account.

const error = (status: number, message: string) => Response.json({ error: message }, { status });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return error(403, 'This endpoint only serves the Homestretch schedule.');

  const receiver = process.env.PAYOUT_SANDBOX_RECEIVER;
  if (!receiver) return error(503, 'Payouts are not configured: set PAYOUT_SANDBOX_RECEIVER.');

  const parsed = payoutRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error(400, 'That is not a valid payment request.');

  const priced = priceShifts(parsed.data);
  if ('error' in priced) return error(400, priced.error);

  const refusal = payoutRefusal(priced.priced.reduce((sum, shift) => sum + shift.amount, 0));
  if (refusal) return error(429, refusal);

  try {
    const { batchId, status } = await createPayoutBatch(parsed.data.batchKey, receiver, priced.priced);
    return Response.json({ batchId, status, items: priced.priced.map(({ shiftId, amount }) => ({ shiftId, amount })) });
  } catch (cause) {
    console.error('[payouts] PayPal refused the batch', cause instanceof PayPalApiError ? cause.body : cause);
    if (cause instanceof PayPalApiError && cause.body.includes('INSUFFICIENT_FUNDS')) return error(402, 'The sandbox account behind this demo is out of funds, so nobody was paid.');
    return error(502, 'PayPal could not send this payment. Nobody has been paid.');
  }
}
