// PayPal Payouts over REST, on the server only: it reads the client secret from the environment.
// Sandbox only: the base URL is fixed.

const BASE_URL = 'https://api-m.sandbox.paypal.com';
const MAX_ATTEMPTS = 4;

export class PayPalApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    readonly body: string,
  ) {
    super(`PayPal answered ${status} on ${path}`);
  }
}

let cachedToken: { value: string; expiresAt: number } | undefined;

async function accessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;
  const { PAYPAL_CLIENT_ID: id, PAYPAL_SECRET: secret } = process.env;
  if (!id || !secret) throw new Error('PAYPAL_CLIENT_ID and PAYPAL_SECRET must be set.');
  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}` },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
    cache: 'no-store',
  });
  if (!res.ok) throw new PayPalApiError(res.status, '/v1/oauth2/token', await res.text());
  const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: access_token, expiresAt: Date.now() + (expires_in - 60) * 1000 };
  return access_token;
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown, { safeToRepeat = method === 'GET' } = {}): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
    if (res.ok) {
      const text = await res.text();
      return (text ? JSON.parse(text) : {}) as T;
    }
    if (res.status === 401 && attempt === 1) {
      cachedToken = undefined;
      continue;
    }
    // A write that failed with a 5xx may still have gone through, so only what can safely be repeated retries those.
    const retriable = res.status === 429 || (safeToRepeat && res.status >= 500);
    if (retriable && attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 250));
      continue;
    }
    throw new PayPalApiError(res.status, path, await res.text());
  }
}

export type PayoutItem = {
  shiftId: string;
  amount: number;
  /** What the worker sees on the payment. */
  note: string;
};

/** Sends one batch: one click can pay several people. PayPal refuses a repeated `batchKey`, so a retry can't pay twice. */
export async function createPayoutBatch(batchKey: string, receiver: string, items: PayoutItem[]): Promise<{ batchId: string; status: string }> {
  const { batch_header: header } = await request<{ batch_header: { payout_batch_id: string; batch_status: string } }>('POST', '/v1/payments/payouts', {
    sender_batch_header: {
      sender_batch_id: batchKey,
      email_subject: 'You just got paid for your shift',
      email_message: 'Your manager approved your shift, and here is your pay.',
    },
    items: items.map((item) => ({
      recipient_type: 'EMAIL',
      receiver,
      sender_item_id: item.shiftId,
      note: item.note,
      amount: { value: item.amount.toFixed(2), currency: 'USD' },
    })),
  }, { safeToRepeat: true });
  return { batchId: header.payout_batch_id, status: header.batch_status };
}

export type PayoutStatus = {
  shiftId: string;
  status: string;
  amount: number;
  fee: number;
  transactionId: string | null;
  processedAt: string | null;
};

type BatchResponse = {
  batch_header: { batch_status: string };
  items?: {
    transaction_id?: string;
    transaction_status?: string;
    time_processed?: string;
    payout_item_fee?: { value?: string };
    payout_item?: { sender_item_id?: string; amount?: { value?: string } };
  }[];
};

export async function getPayoutBatch(batchId: string): Promise<{ status: string; items: PayoutStatus[] }> {
  const batch = await request<BatchResponse>('GET', `/v1/payments/payouts/${encodeURIComponent(batchId)}?page_size=100`);
  return {
    status: batch.batch_header.batch_status,
    items: (batch.items ?? []).map((item) => ({
      shiftId: item.payout_item?.sender_item_id ?? '',
      status: item.transaction_status ?? batch.batch_header.batch_status,
      amount: Number(item.payout_item?.amount?.value ?? 0),
      fee: Number(item.payout_item_fee?.value ?? 0),
      transactionId: item.transaction_id ?? null,
      processedAt: item.time_processed ?? null,
    })),
  };
}

// PayPal's Balances API adds up from what a sandbox account started with and ignores a balance edited by hand
// on the sandbox site. The demo account was set to $100,000 there from its original $5,000, so the API stays
// exactly this much below the account page. Added back for this one account only, and said so on screen.
const SANDBOX_TOP_UPS: Readonly<Record<string, number>> = { FAVR2H6TABYWL: 95_000 };

type BalancesAnswer = { account_id?: string; as_of_time?: string; balances?: { currency: string; available_balance?: { value?: string } }[] };
export type AvailableBalance = { available: number; asOf: string; toppedUp: number };

export function readBalance(answer: BalancesAnswer, now = new Date()): AvailableBalance {
  const toppedUp = SANDBOX_TOP_UPS[answer.account_id ?? ''] ?? 0;
  return {
    available: Number(answer.balances?.find((b) => b.currency === 'USD')?.available_balance?.value ?? 0) + toppedUp,
    asOf: answer.as_of_time ?? now.toISOString(),
    toppedUp,
  };
}

/** What the account can pay out, in dollars. PayPal refreshes this figure every so often: `asOf` says when it last did. */
export async function getAvailableBalance(): Promise<AvailableBalance> {
  return readBalance(await request<BalancesAnswer>('GET', '/v1/reporting/balances?currency_code=USD'));
}

/** Whether PayPal answers with these credentials, for the health check. */
export async function canReachPayPal(): Promise<boolean> {
  await accessToken();
  return true;
}
