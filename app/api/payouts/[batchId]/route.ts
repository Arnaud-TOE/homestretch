import { getPayoutBatch } from '@/lib/paypal';

// Where a batch has got to, and what PayPal charged: the ledger polls this until each payment settles.
export async function GET(_request: Request, { params }: RouteContext<'/api/payouts/[batchId]'>) {
  const { batchId } = await params;
  if (!/^[A-Z0-9]{8,40}$/.test(batchId)) return Response.json({ error: 'Invalid batch id.' }, { status: 400 });

  try {
    return Response.json(await getPayoutBatch(batchId), { headers: { 'Cache-Control': 'no-store' } });
  } catch (cause) {
    console.error('[payouts] could not read batch', batchId, cause);
    return Response.json({ error: 'PayPal did not answer.' }, { status: 502 });
  }
}
