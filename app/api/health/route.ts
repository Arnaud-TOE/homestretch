import { canReachPayPal } from '@/lib/paypal';

// For checking that a deployment is configured and PayPal answers. Says what is set up, never the values.
export async function GET() {
  const ai = Boolean(process.env.OPENAI_API_KEY ?? process.env.AG_STUDIO_OPENAI_API_KEY);
  const payouts = Boolean(process.env.PAYOUT_SANDBOX_RECEIVER);
  const paypal = await canReachPayPal().catch(() => false);
  return Response.json({ status: paypal ? 'ok' : 'degraded', paypal, payouts, ai }, { status: paypal ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
