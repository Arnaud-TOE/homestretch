import { describe, expect, it } from 'vitest';
import { demoSchedule } from '@/lib/schedule/demo';
import { isReadyToPay, scheduleIssues, shiftPay, whyNot } from '@/lib/schedule/rules';
import { coverAbsence, fillOpenShifts } from '@/lib/schedule/solver';
import type { Schedule, Shift, Worker } from '@/lib/schedule/types';

const NOW = new Date('2026-11-10T12:00:00Z');

const worker = (id: string, extra: Partial<Worker> = {}): Worker => ({
  id,
  name: id,
  skills: ['Server'],
  hourlyRate: 20,
  maxWeeklyHours: 40,
  ...extra,
});

const shift = (id: string, start: string, end: string, workerId: string | null = null, extra: Partial<Shift> = {}): Shift => ({
  id,
  job: `Job ${id}`,
  skill: 'Server',
  start: `2026-11-${start}:00:00.000Z`,
  end: `2026-11-${end}:00:00.000Z`,
  workerId,
  pinned: false,
  ...extra,
});

const schedule = (workers: Worker[], shifts: Shift[], blocked: Schedule['blocked'] = []): Schedule => ({ workers, shifts, blocked });

describe('whyNot', () => {
  it('accepts a free worker with the skill', () => {
    const open = shift('a', '12T10', '12T14');
    expect(whyNot(schedule([worker('w')], [open]), open, worker('w'))).toEqual([]);
  });

  it('refuses a worker without the skill', () => {
    const open = shift('a', '12T10', '12T14', null, { skill: 'Cook' });
    expect(whyNot(schedule([worker('w')], [open]), open, worker('w')).map((v) => v.code)).toEqual(['skill']);
  });

  it('refuses blocked time, and says what it is', () => {
    const open = shift('a', '12T10', '12T14');
    const blocked = [{ id: 'b', workerId: 'w', start: '2026-11-12T13:00:00.000Z', end: '2026-11-12T15:00:00.000Z', reason: 'Evening class' }];
    const [problem] = whyNot(schedule([worker('w')], [open], blocked), open, worker('w'));
    expect(problem.code).toBe('blocked');
    expect(problem.message).toContain('evening class');
  });

  it('refuses a shift that overlaps another', () => {
    const open = shift('a', '12T10', '12T14');
    const other = shift('b', '12T13', '12T17', 'w');
    expect(whyNot(schedule([worker('w')], [open, other]), open, worker('w')).map((v) => v.code)).toContain('overlap');
  });

  it('refuses less than ten hours of rest', () => {
    const open = shift('a', '13T06', '13T10');
    const late = shift('b', '12T18', '12T23', 'w');
    expect(whyNot(schedule([worker('w')], [open, late]), open, worker('w')).map((v) => v.code)).toEqual(['rest']);
  });

  it('allows exactly ten hours of rest', () => {
    const open = shift('a', '13T09', '13T12');
    const late = shift('b', '12T18', '12T23', 'w');
    expect(whyNot(schedule([worker('w')], [open, late]), open, worker('w'))).toEqual([]);
  });

  it('refuses going over the weekly limit', () => {
    const open = shift('a', '12T10', '12T18');
    const before = shift('b', '10T10', '10T18', 'w');
    const limited = worker('w', { maxWeeklyHours: 12 });
    expect(whyNot(schedule([limited], [open, before]), open, limited).map((v) => v.code)).toEqual(['hours']);
  });
});

describe('fillOpenShifts', () => {
  it('gives the scarce shift to the only person who can do it first', () => {
    const both = worker('both', { skills: ['Cook', 'Server'] });
    const server = worker('server');
    const cook = shift('cook', '12T10', '12T14', null, { skill: 'Cook' });
    const serve = shift('serve', '12T10', '12T14');
    const { schedule: filled, unfilled } = fillOpenShifts(schedule([both, server], [serve, cook]));
    expect(unfilled).toEqual([]);
    expect(filled.shifts.find((s) => s.id === 'cook')?.workerId).toBe('both');
    expect(filled.shifts.find((s) => s.id === 'serve')?.workerId).toBe('server');
  });

  it('reports what it cannot fill, and why', () => {
    const open = shift('a', '12T10', '12T14');
    const blocked = [{ id: 'b', workerId: 'w', start: '2026-11-12T00:00:00.000Z', end: '2026-11-13T00:00:00.000Z', reason: 'Trip' }];
    const { unfilled, changes } = fillOpenShifts(schedule([worker('w')], [open], blocked));
    expect(changes).toEqual([]);
    expect(unfilled[0].reasons[0]).toContain('trip');
  });

  it('only touches the job it is asked about', () => {
    const a = shift('a', '12T10', '12T14', null, { job: 'Rivera wedding' });
    const b = shift('b', '13T10', '13T14', null, { job: 'Other' });
    const { changes } = fillOpenShifts(schedule([worker('w')], [a, b]), { job: 'rivera' });
    expect(changes.map((c) => c.shiftId)).toEqual(['a']);
  });

  it('does not change the schedule it was given', () => {
    const open = shift('a', '12T10', '12T14');
    fillOpenShifts(schedule([worker('w')], [open]));
    expect(open.workerId).toBeNull();
  });
});

describe('coverAbsence', () => {
  const absence = { workerId: 'out', start: '2026-11-12T00:00:00.000Z', end: '2026-11-13T00:00:00.000Z', reason: 'Sick' };

  it('moves only the affected shift to someone free', () => {
    const affected = shift('a', '12T10', '12T14', 'out');
    const later = shift('b', '15T10', '15T14', 'out');
    const result = coverAbsence(schedule([worker('out'), worker('free')], [affected, later]), absence, NOW);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toMatchObject({ shiftId: 'a', from: 'out', to: 'free' });
    expect(result.schedule.shifts.find((s) => s.id === 'b')?.workerId).toBe('out');
    expect(result.untouched).toBe(1);
  });

  it('frees someone up with one extra move when nobody is free', () => {
    const affected = shift('a', '12T10', '12T14', 'out', { skill: 'Cook' });
    const inTheWay = shift('b', '12T09', '12T13', 'cook');
    const cook = worker('cook', { skills: ['Cook', 'Server'] });
    const result = coverAbsence(schedule([worker('out', { skills: ['Cook'] }), cook, worker('server')], [affected, inTheWay]), absence, NOW);
    expect(result.changes.map((c) => [c.shiftId, c.to])).toEqual([
      ['b', 'server'],
      ['a', 'cook'],
    ]);
    expect(scheduleIssues(result.schedule)).toEqual([]);
  });

  it('never moves a pinned shift, and flags it instead', () => {
    const pinned = shift('a', '12T10', '12T14', 'out', { pinned: true });
    const result = coverAbsence(schedule([worker('out'), worker('free')], [pinned]), absence, NOW);
    expect(result.changes).toEqual([]);
    expect(result.pinnedConflicts).toEqual(['a']);
    expect(result.schedule.shifts[0].workerId).toBe('out');
  });

  it('does not move a pinned shift to free someone up', () => {
    const affected = shift('a', '12T10', '12T14', 'out', { skill: 'Cook' });
    const pinned = shift('b', '12T09', '12T13', 'cook', { pinned: true });
    const cook = worker('cook', { skills: ['Cook', 'Server'] });
    const result = coverAbsence(schedule([worker('out', { skills: ['Cook'] }), cook, worker('server')], [affected, pinned]), absence, NOW);
    expect(result.schedule.shifts.find((s) => s.id === 'b')?.workerId).toBe('cook');
    expect(result.schedule.shifts.find((s) => s.id === 'a')?.workerId).toBeNull();
    expect(result.unfilled[0].shiftId).toBe('a');
  });

  it('leaves shifts already finished alone', () => {
    const past = shift('a', '10T06', '10T10', 'out');
    const result = coverAbsence(schedule([worker('out'), worker('free')], [past]), { ...absence, start: '2026-11-10T00:00:00.000Z' }, NOW);
    expect(result.changes).toEqual([]);
  });

  it('adds the absence, so later moves respect it', () => {
    const result = coverAbsence(schedule([worker('out')], []), absence, NOW);
    expect(result.schedule.blocked).toHaveLength(1);
    expect(result.blocked.reason).toBe('Sick');
  });
});

describe('payments', () => {
  it('pays hours at the rate, to the cent', () => {
    expect(shiftPay(shift('a', '12T10', '12T14'), { hourlyRate: 19.5 })).toBe(78);
  });

  it('is ready once it has ended, has a worker and has not been paid', () => {
    expect(isReadyToPay(shift('a', '09T10', '09T14', 'w'), NOW)).toBe(true);
    expect(isReadyToPay(shift('a', '09T10', '09T14'), NOW)).toBe(false);
    expect(isReadyToPay(shift('a', '12T10', '12T14', 'w'), NOW)).toBe(false);
    expect(isReadyToPay(shift('a', '09T10', '09T14', 'w', { payment: { batchId: 'x', amount: 1, status: 'SUCCESS', paidAt: '' } }), NOW)).toBe(false);
  });
});

describe('the demo week', () => {
  const week = demoSchedule(NOW);

  it('breaks no rule as it stands', () => {
    expect(scheduleIssues(week)).toEqual([]);
  });

  it('has shifts waiting to be paid and shifts waiting to be filled', () => {
    expect(week.shifts.filter((s) => isReadyToPay(s, NOW)).length).toBeGreaterThanOrEqual(6);
    expect(week.shifts.filter((s) => !s.workerId).length).toBeGreaterThanOrEqual(5);
  });

  it('can fill the Rivera wedding, with the rules intact', () => {
    const { unfilled, schedule: filled } = fillOpenShifts(week, { job: 'Rivera' });
    expect(unfilled).toEqual([]);
    expect(scheduleIssues(filled)).toEqual([]);
  });

  it("can cover Lena's absence with a small number of moves", () => {
    const tomorrow = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate() + 1));
    const dayAfter = new Date(tomorrow.getTime() + 86_400_000);
    const result = coverAbsence(week, { workerId: 'lena', start: tomorrow.toISOString(), end: dayAfter.toISOString(), reason: 'Sick' }, NOW);
    expect(result.changes.length).toBeGreaterThanOrEqual(1);
    expect(result.changes.length).toBeLessThanOrEqual(3);
    expect(result.unfilled).toEqual([]);
    expect(scheduleIssues(result.schedule)).toEqual([]);
  });

  it('stays valid on any day of the month, near a month end too', () => {
    for (const date of ['2026-11-30T23:30:00Z', '2026-12-01T00:30:00Z', '2026-12-15T12:00:00Z', '2027-01-01T06:00:00Z']) {
      expect(scheduleIssues(demoSchedule(new Date(date)))).toEqual([]);
    }
  });
});
