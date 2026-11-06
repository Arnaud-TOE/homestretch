// What the server accepts as a payment. The browser says which shift and how many hours; the rate
// and the amount come from here, so a tampered request can't name its own price or its own recipient.

import { z } from 'zod';
import { WORKERS } from './schedule/demo';
import { SKILLS } from './schedule/types';

export const MAX_SHIFT_HOURS = 14;
export const MAX_BATCH_ITEMS = 40;

export const payoutRequest = z.object({
  /** Chosen by the browser for one approval, so a retry can't pay twice. */
  batchKey: z.string().regex(/^[A-Za-z0-9-]{8,60}$/),
  shifts: z
    .array(
      z.object({
        shiftId: z.string().regex(/^[A-Za-z0-9-]{1,100}$/),
        workerId: z.string(),
        job: z.string().min(1).max(80),
        skill: z.enum(SKILLS),
        hours: z.number().positive().max(MAX_SHIFT_HOURS),
      }),
    )
    .min(1)
    .max(MAX_BATCH_ITEMS),
});

export type PayoutRequest = z.infer<typeof payoutRequest>;

export type PricedShift = { shiftId: string; workerName: string; amount: number; note: string };

/** Prices each shift from the server's own rates, or says which worker it doesn't know. */
export function priceShifts(request: PayoutRequest): { priced: PricedShift[] } | { error: string } {
  const priced: PricedShift[] = [];
  for (const shift of request.shifts) {
    const worker = WORKERS.find((w) => w.id === shift.workerId);
    if (!worker) return { error: `Unknown worker: ${shift.workerId}.` };
    if (!worker.skills.includes(shift.skill)) return { error: `${worker.name} isn't a ${shift.skill.toLowerCase()}.` };
    const amount = Math.round(shift.hours * worker.hourlyRate * 100) / 100;
    priced.push({
      shiftId: shift.shiftId,
      workerName: worker.name,
      amount,
      note: `${worker.name}: ${shift.skill}, ${shift.job}, ${shift.hours} h at $${worker.hourlyRate}. Thank you!`.slice(0, 200),
    });
  }
  return { priced };
}
