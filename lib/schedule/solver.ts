// The part of the agent that must not guess: who can take which shift. The model decides what to do
// and explains it; these functions work out the moves, so a broken rule can't slip through a
// plausible-sounding answer.

import { canMove, describeShift, shiftHours, whyNot } from './rules';
import type { Blocked, Change, Schedule, Shift, Unfilled, Worker } from './types';

const clone = (schedule: Schedule): Schedule => ({
  workers: schedule.workers,
  blocked: [...schedule.blocked],
  shifts: schedule.shifts.map((s) => ({ ...s })),
});

const hoursOf = (schedule: Schedule, workerId: string) =>
  schedule.shifts.filter((s) => s.workerId === workerId).reduce((sum, s) => sum + shiftHours(s), 0);

const candidatesFor = (schedule: Schedule, shift: Shift, except?: string) =>
  schedule.workers.filter((w) => w.id !== except && whyNot(schedule, shift, w).length === 0);

// Whoever has the fewest hours so far, then the lowest rate, then by name, so results are repeatable.
function fairest(schedule: Schedule, workers: Worker[]) {
  return [...workers].sort(
    (a, b) => hoursOf(schedule, a.id) - hoursOf(schedule, b.id) || a.hourlyRate - b.hourlyRate || a.name.localeCompare(b.name),
  )[0];
}

/** What stands in the way for each worker who has the skill; skill mismatches would only be noise. */
function blockers(schedule: Schedule, shift: Shift, except?: string): string[] {
  return schedule.workers
    .filter((w) => w.id !== except && w.skills.includes(shift.skill))
    .flatMap((w) => whyNot(schedule, shift, w).map((v) => v.message));
}

export type FillOptions = {
  /** Only shifts of this job (case-insensitive, partial match). */
  job?: string;
};

export type FillResult = { changes: Change[]; unfilled: Unfilled[]; schedule: Schedule };

/**
 * Assigns open shifts without moving anything already assigned. The hardest shift goes first, the one
 * fewest people can take, so an easy one doesn't use up the only person who could cover it.
 */
export function fillOpenShifts(schedule: Schedule, options: FillOptions = {}): FillResult {
  const next = clone(schedule);
  const wanted = options.job?.toLowerCase();
  let open = next.shifts.filter((s) => !s.workerId && (!wanted || s.job.toLowerCase().includes(wanted)));
  const changes: Change[] = [];
  const unfilled: Unfilled[] = [];

  while (open.length > 0) {
    const ranked = open
      .map((shift) => ({ shift, candidates: candidatesFor(next, shift) }))
      .sort((a, b) => a.candidates.length - b.candidates.length || a.shift.start.localeCompare(b.shift.start) || a.shift.id.localeCompare(b.shift.id));
    const { shift, candidates } = ranked[0];
    open = open.filter((s) => s !== shift);

    if (candidates.length === 0) {
      unfilled.push({ shiftId: shift.id, reasons: blockers(next, shift) });
      continue;
    }
    const worker = fairest(next, candidates);
    shift.workerId = worker.id;
    changes.push({
      shiftId: shift.id,
      from: null,
      to: worker.id,
      why: `${worker.name} is a ${shift.skill.toLowerCase()}, is free then and stays within ${worker.maxWeeklyHours} hours.`,
    });
  }
  return { changes, unfilled, schedule: next };
}

export type AbsenceResult = FillResult & {
  blocked: Blocked;
  /** Shifts still to come that stayed exactly as they were. */
  untouched: number;
  /** Pinned shifts of the absent worker: the manager has to decide those. */
  pinnedConflicts: string[];
};

/**
 * Records an absence and repairs the schedule, changing as little as possible. Each affected shift
 * goes to someone free; if nobody is, one other shift may move to free someone up. Anything else stays
 * where it is, and what can't be covered goes back to the open row, with the reasons.
 */
export function coverAbsence(schedule: Schedule, absence: Omit<Blocked, 'id'> & { id?: string }, now: Date): AbsenceResult {
  const next = clone(schedule);
  const absent = next.workers.find((w) => w.id === absence.workerId);
  if (!absent) throw new Error(`No worker ${absence.workerId}.`);

  const blocked: Blocked = { id: absence.id ?? `absence-${absence.workerId}-${absence.start}`, workerId: absence.workerId, start: absence.start, end: absence.end, reason: absence.reason };
  next.blocked.push(blocked);

  const isFuture = (s: Shift) => Date.parse(s.end) > now.getTime();
  const during = (s: Shift) => s.workerId === absent.id && Date.parse(s.start) < Date.parse(absence.end) && Date.parse(absence.start) < Date.parse(s.end);
  const affected = next.shifts.filter((s) => during(s) && isFuture(s)).sort((a, b) => a.start.localeCompare(b.start));

  const changes: Change[] = [];
  const unfilled: Unfilled[] = [];
  const pinnedConflicts: string[] = [];

  for (const shift of affected) {
    if (shift.pinned) {
      pinnedConflicts.push(shift.id);
      continue;
    }
    shift.workerId = null;

    const direct = candidatesFor(next, shift, absent.id);
    if (direct.length > 0) {
      const worker = fairest(next, direct);
      shift.workerId = worker.id;
      changes.push({
        shiftId: shift.id,
        from: absent.id,
        to: worker.id,
        why: `${absent.name} is out; ${worker.name} is a ${shift.skill.toLowerCase()} and is free then.`,
      });
      continue;
    }

    const swap = findSwap(next, shift, absent.id, now);
    if (swap) {
      const { helper, moved, other } = swap;
      moved.workerId = other.id;
      shift.workerId = helper.id;
      changes.push({ shiftId: moved.id, from: helper.id, to: other.id, why: `This frees ${helper.name} for ${shift.job}; ${other.name} can take ${describeShift(moved)}.` });
      changes.push({ shiftId: shift.id, from: absent.id, to: helper.id, why: `${absent.name} is out; ${helper.name} is the only ${shift.skill.toLowerCase()} who can cover it.` });
      continue;
    }

    changes.push({ shiftId: shift.id, from: absent.id, to: null, why: `${absent.name} is out and nobody can cover it.` });
    unfilled.push({ shiftId: shift.id, reasons: blockers(next, shift, absent.id) });
  }

  const moved = new Set(changes.map((c) => c.shiftId));
  return { changes, unfilled, pinnedConflicts, blocked, untouched: next.shifts.filter((s) => s.workerId && isFuture(s) && !moved.has(s.id)).length, schedule: next };
}

/** One other shift to move, so that its worker can take `shift`. Never a pinned or a finished one. */
function findSwap(schedule: Schedule, shift: Shift, absentId: string, now: Date) {
  const skilled = schedule.workers.filter((w) => w.id !== absentId && w.skills.includes(shift.skill));
  for (const helper of skilled) {
    const inTheWay = schedule.shifts.filter(
      (s) => s.workerId === helper.id && !s.pinned && canMove(s, now) && !isClear(schedule, shift, helper, s),
    );
    for (const moved of inTheWay) {
      if (whyNot(schedule, shift, helper, new Set([moved.id])).length > 0) continue;
      const others = schedule.workers.filter((w) => w.id !== helper.id && w.id !== absentId);
      const free = others.filter((w) => whyNot(schedule, moved, w).length === 0);
      if (free.length > 0) return { helper, moved, other: fairest(schedule, free) };
    }
  }
  return null;
}

// Whether `helper` could take `shift` even with `other` where it is, so moving `other` wouldn't help.
const isClear = (schedule: Schedule, shift: Shift, helper: Worker, other: Shift) =>
  whyNot(schedule, shift, helper).length === whyNot(schedule, shift, helper, new Set([other.id])).length;
