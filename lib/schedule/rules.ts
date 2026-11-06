// The rules a schedule has to follow. One source of truth: dragging a shift by hand, the agent's
// moves and the schedule's health check all ask here, and get the same plain-English answer.

import type { Schedule, Shift, Worker } from './types';

const HOUR_MS = 3_600_000;

/** Time a person needs between two shifts. */
export const MIN_REST_HOURS = 10;

export type RuleCode = 'skill' | 'blocked' | 'overlap' | 'rest' | 'hours';

export type Violation = {
  code: RuleCode;
  message: string;
  shiftId?: string;
  workerId?: string;
};

const ms = (iso: string) => Date.parse(iso);

export const shiftHours = (shift: Pick<Shift, 'start' | 'end'>) => (ms(shift.end) - ms(shift.start)) / HOUR_MS;

const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }) => ms(a.start) < ms(b.end) && ms(b.start) < ms(a.end);

const dayAndTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).replace(':00', '');

export const describeShift = (shift: Pick<Shift, 'skill' | 'job' | 'start' | 'end'>) =>
  `${shift.skill} at ${shift.job}, ${dayAndTime(shift.start)} to ${dayAndTime(shift.end).split(' ').slice(1).join(' ')}`;

/** Hours a worker is scheduled for in the seven days ending when `shift` ends, not counting `shift` itself. */
function hoursInWeekOf(schedule: Schedule, workerId: string, shift: Pick<Shift, 'id' | 'end'>, ignoring: ReadonlySet<string>) {
  const windowEnd = ms(shift.end);
  const windowStart = windowEnd - 7 * 24 * HOUR_MS;
  return schedule.shifts
    .filter((s) => s.workerId === workerId && s.id !== shift.id && !ignoring.has(s.id))
    .filter((s) => ms(s.start) >= windowStart && ms(s.start) < windowEnd)
    .reduce((sum, s) => sum + shiftHours(s), 0);
}

/**
 * Why `worker` can't take `shift`: an empty list means they can. `ignoring` leaves out shifts that are
 * about to move, when the solver looks at a swap.
 */
export function whyNot(schedule: Schedule, shift: Shift, worker: Worker, ignoring: ReadonlySet<string> = new Set()): Violation[] {
  const problems: Violation[] = [];
  const base = { shiftId: shift.id, workerId: worker.id };

  if (!worker.skills.includes(shift.skill)) {
    problems.push({ ...base, code: 'skill', message: `${worker.name} isn't trained as a ${shift.skill.toLowerCase()}.` });
  }

  const blocked = schedule.blocked.find((b) => b.workerId === worker.id && overlaps(b, shift));
  if (blocked) {
    problems.push({ ...base, code: 'blocked', message: `${worker.name} is unavailable then (${blocked.reason.toLowerCase()}).` });
  }

  const others = schedule.shifts.filter((s) => s.workerId === worker.id && s.id !== shift.id && !ignoring.has(s.id));

  const clash = others.find((s) => overlaps(s, shift));
  if (clash) {
    problems.push({ ...base, code: 'overlap', message: `${worker.name} is already on ${clash.job} at that time.` });
  }

  const tooClose = others.find((s) => !overlaps(s, shift) && gapHours(s, shift) < MIN_REST_HOURS);
  if (tooClose) {
    problems.push({ ...base, code: 'rest', message: `${worker.name} would get under ${MIN_REST_HOURS} hours of rest around ${tooClose.job}.` });
  }

  const week = hoursInWeekOf(schedule, worker.id, shift, ignoring);
  if (week + shiftHours(shift) > worker.maxWeeklyHours) {
    problems.push({ ...base, code: 'hours', message: `${worker.name} would go over ${worker.maxWeeklyHours} hours this week (${Math.round(week)} already).` });
  }

  return problems;
}

const gapHours = (a: Shift, b: Shift) => (ms(a.end) <= ms(b.start) ? ms(b.start) - ms(a.end) : ms(a.start) - ms(b.end)) / HOUR_MS;

/** Every rule the schedule breaks as it stands. Each pair of clashing shifts is reported once. */
export function scheduleIssues(schedule: Schedule): Violation[] {
  const workers = new Map(schedule.workers.map((w) => [w.id, w]));
  const issues: Violation[] = [];
  const seen = new Set<string>();
  for (const shift of schedule.shifts) {
    const worker = shift.workerId ? workers.get(shift.workerId) : undefined;
    if (!worker) continue;
    for (const problem of whyNot(schedule, shift, worker)) {
      const key = problem.code === 'overlap' || problem.code === 'rest' ? `${problem.code}:${worker.id}` : `${problem.code}:${shift.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      issues.push(problem);
    }
  }
  return issues;
}

/** Hours a worker is booked for over the coming week, for the meter next to their name. */
export function upcomingHours(schedule: Schedule, workerId: string, now: Date) {
  const until = now.getTime() + 7 * 24 * HOUR_MS;
  return schedule.shifts
    .filter((s) => s.workerId === workerId && ms(s.end) > now.getTime() && ms(s.start) < until)
    .reduce((sum, s) => sum + shiftHours(s), 0);
}

export type ShiftState = 'open' | 'upcoming' | 'finished' | 'paying' | 'paid';

/** Where a shift stands, as the board colours it. */
export function shiftState(shift: Shift, now: Date): ShiftState {
  if (shift.payment) return shift.payment.status === 'SUCCESS' ? 'paid' : 'paying';
  if (!shift.workerId) return 'open';
  return ms(shift.end) <= now.getTime() ? 'finished' : 'upcoming';
}

/** Finished and paid shifts are history: nobody moves those, by hand or otherwise. */
export const canMove = (shift: Shift, now: Date) => !shift.payment && ms(shift.end) > now.getTime();

/** What a finished shift costs: hours at the worker's rate, to the cent. */
export const shiftPay = (shift: Pick<Shift, 'start' | 'end'>, worker: Pick<Worker, 'hourlyRate'>) =>
  Math.round(shiftHours(shift) * worker.hourlyRate * 100) / 100;

/** A shift that has ended, with someone on it, and that nobody has paid yet. */
export const isReadyToPay = (shift: Shift, now: Date) => Boolean(shift.workerId) && !shift.payment && ms(shift.end) <= now.getTime();
