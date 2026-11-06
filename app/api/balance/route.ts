import { getAvailableBalance } from '@/lib/paypal';

// The PayPal balance payroll draws from, from the Balances API, for the owner and the assistant.
export async function GET() {
  try {
    return Response.json(await getAvailableBalance(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (cause) {
    console.error('[balance] PayPal did not answer', cause);
    return Response.json({ error: 'PayPal did not answer.' }, { status: 502 });
  }
}
