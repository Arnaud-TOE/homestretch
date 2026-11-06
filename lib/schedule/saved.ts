// What the demo keeps in the browser. There is no database: each visitor gets their own copy of the
// week, and the owner's screen and a crew member's phone view read the same record.

import type { Blocked, Payment, Shift, Skill } from './types';

const STORAGE_KEY = 'homestretch:v1';

export type LedgerEntry = {
  shiftId: string;
  workerId: string;
  workerName: string;
  job: string;
  skill: Skill;
  hours: number;
  rate: number;
  amount: number;
  fee: number | null;
  /** SENDING until PayPal has the batch, then PayPal's own status. */
  status: string;
  batchId: string;
  transactionId: string | null;
  sentAt: string;
  /** Which run of the demo it belongs to: resetting the demo makes its shifts payable again. */
  run: number;
};

export type Saved = {
  day: string;
  run: number;
  shifts: Shift[];
  blocked: Blocked[];
  ledger: LedgerEntry[];
};

/** Statuses after which PayPal won't change its mind. */
export const FINAL_STATUSES = new Set(['SUCCESS', 'FAILED', 'RETURNED', 'BLOCKED', 'REFUNDED', 'REVERSED', 'DENIED', 'CANCELED']);
/** Final statuses that mean the person did not get the money. */
export const NOT_PAID_STATUSES = new Set(['FAILED', 'RETURNED', 'BLOCKED', 'REFUNDED', 'REVERSED', 'DENIED', 'CANCELED']);

export function loadSaved(): Saved | null {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    return text ? (JSON.parse(text) as Saved) : null;
  } catch {
    return null;
  }
}

export function storeSaved(saved: Saved) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Private windows may refuse: the demo still works until the page closes.
  }
}

/** Calls back when another tab of this browser changes the record. */
export function onSavedChange(listener: () => void) {
  const handler = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

/**
 * Payments are facts, not edits: undoing a move must not unpay anyone. So they live in the ledger, and
 * a shift gets its payment from there.
 */
export function withPayments(shifts: Shift[], ledger: LedgerEntry[], run: number): Shift[] {
  const payments = new Map<string, Payment>();
  for (const entry of ledger) {
    if (entry.run !== run || NOT_PAID_STATUSES.has(entry.status)) continue;
    if (!payments.has(entry.shiftId)) payments.set(entry.shiftId, { batchId: entry.batchId, amount: entry.amount, status: entry.status, paidAt: entry.sentAt });
  }
  return shifts.map((shift) => (payments.has(shift.id) ? { ...shift, payment: payments.get(shift.id) } : shift));
}

/**
 * The balance as this browser can best tell: PayPal's figure lags behind, so payments sent after it was
 * taken come off it, fee included.
 */
export function balanceAfterPayments(reported: { available: number; asOf: string }, ledger: LedgerEntry[]) {
  const since = Date.parse(reported.asOf);
  const spent = ledger.filter((entry) => Date.parse(entry.sentAt) > since && !NOT_PAID_STATUSES.has(entry.status)).reduce((sum, entry) => sum + entry.amount + (entry.fee ?? 0), 0);
  return Math.round((reported.available - spent) * 100) / 100;
}
