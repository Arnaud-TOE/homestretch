import { describe, expect, it } from 'vitest';
import { AGENT_EXAMPLES } from '@/lib/schedule/agent-examples';
import { AGENT_TOOLS, findWorker } from '@/lib/schedule/agent';
import { ALLOWED_TOOLS } from '@/lib/assistant';
import { demoSchedule, WORKERS } from '@/lib/schedule/demo';
import { scheduleIssues } from '@/lib/schedule/rules';
import type { Schedule } from '@/lib/schedule/types';
import { toLocalDate, toWallIso, wallClock } from '@/lib/schedule/wall-clock';

const NOW = new Date('2026-11-06T13:00:00Z');
const day = (offset: number) => new Date(Date.UTC(2026, 10, 6 + offset)).toISOString().slice(0, 10);
const fresh = () => demoSchedule(NOW);

const run = (name: string, args: Record<string, unknown>, schedule: Schedule = fresh()) => AGENT_TOOLS[name].run(schedule, args, NOW);

/** Applies a tool's changes the way the board does, for checking the end result. */
function applied(schedule: Schedule, outcome: ReturnType<typeof run>): Schedule {
  const next: Schedule = { ...schedule, shifts: [...schedule.shifts, ...(outcome.effects?.newShifts ?? [])], blocked: [...schedule.blocked, ...(outcome.effects?.blocked ?? [])] };
  const moves = new Map((outcome.effects?.moves ?? []).map((move) => [move.shiftId, move.to]));
  next.shifts = next.shifts.map((shift) => (moves.has(shift.id) ? { ...shift, workerId: moves.get(shift.id) ?? null } : shift));
  return next;
}

describe('findWorker', () => {
  it('accepts an id, a full name or a first name', () => {
    expect(findWorker(WORKERS, 'lena')?.id).toBe('lena');
    expect(findWorker(WORKERS, 'Lena Ortiz')?.id).toBe('lena');
    expect(findWorker(WORKERS, 'LENA')?.id).toBe('lena');
    expect(findWorker(WORKERS, 'Ortiz')?.id).toBe('lena');
  });

  it('does not guess', () => {
    expect(findWorker(WORKERS, 'Someone')).toBeUndefined();
    expect(findWorker(WORKERS, '')).toBeUndefined();
    const twoSams = [{ ...WORKERS[0], id: 'w1', name: 'Sam Lee' }, { ...WORKERS[0], id: 'w2', name: 'Sam Park' }];
    expect(findWorker(twoSams, 'Sam')).toBeUndefined();
  });
});

describe('checkSchedule', () => {
  it('gives the model what it needs, with ids', () => {
    const facts = JSON.parse(run('checkSchedule', {}).reply);
    expect(facts.today).toBe('2026-11-06');
    expect(facts.crew).toHaveLength(WORKERS.length);
    expect(facts.jobs.map((job: { job: string }) => job.job)).toContain('Rivera wedding');
    expect(facts.jobs.flatMap((job: { shifts: { id: string }[] }) => job.shifts).every((shift: { id: string }) => shift.id)).toBe(true);
    expect(facts.brokenRules).toEqual([]);
    expect(facts.waitingForApproval).toEqual({ shifts: 9, total: '$919.00' });
  });
});

describe('addJob', () => {
  const args = { name: 'Dinner for 40', date: day(3), startHour: 17, endHour: 22, roles: [{ skill: 'Cook', count: 1 }, { skill: 'Server', count: 2 }] };

  it('adds one open shift per person needed', () => {
    const outcome = run('addJob', args);
    expect(outcome.failed).toBeUndefined();
    expect(outcome.effects?.newShifts).toHaveLength(3);
    expect(outcome.effects?.newShifts?.every((shift) => shift.workerId === null && shift.start === `${day(3)}T17:00:00.000Z`)).toBe(true);
  });

  it('gives each shift its own id, even for a second job of the same name', () => {
    const schedule = applied(fresh(), run('addJob', args));
    const again = run('addJob', args, schedule);
    const ids = [...schedule.shifts, ...(again.effects?.newShifts ?? [])].map((shift) => shift.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each([
    ['a job in the past', { date: day(-2) }],
    ['hours the timeline hides', { startHour: 5 }],
    ['an end before the start', { startHour: 20, endHour: 18 }],
    ['a date it cannot read', { date: 'next Saturday' }],
    ['no roles', { roles: [] }],
    ['a skill nobody has', { roles: [{ skill: 'Juggler', count: 1 }] }],
    ['an absurd number of people', { roles: [{ skill: 'Cook', count: 500 }] }],
  ])('refuses %s', (_label, change) => {
    const outcome = run('addJob', { ...args, ...change });
    expect(outcome.failed).toBe(true);
    expect(outcome.effects).toBeUndefined();
  });
});

describe('fillOpenShifts', () => {
  it('staffs the wedding without breaking a rule', () => {
    const outcome = run('fillOpenShifts', { job: 'rivera' });
    expect(outcome.effects?.moves).toHaveLength(7);
    const after = applied(fresh(), outcome);
    expect(after.shifts.filter((shift) => !shift.workerId)).toEqual([]);
    expect(scheduleIssues(after)).toEqual([]);
  });

  it('says so when there is nothing to do', () => {
    expect(run('fillOpenShifts', { job: 'Unknown job' }).reply).toContain('no open shifts');
  });
});

describe('reportAbsence', () => {
  it('covers the absence with the fewest moves, and blocks the time', () => {
    const outcome = run('reportAbsence', { worker: 'Lena', from: day(1), to: day(1), reason: 'Sick' });
    const facts = JSON.parse(outcome.reply);
    expect(facts.moves).toHaveLength(2);
    expect(facts.couldNotCover).toEqual([]);
    expect(outcome.effects?.blocked?.[0]).toMatchObject({ workerId: 'lena', start: `${day(1)}T00:00:00.000Z`, end: `${day(2)}T00:00:00.000Z`, reason: 'Sick' });
    expect(scheduleIssues(applied(fresh(), outcome))).toEqual([]);
  });

  it('counts only shifts still to come as having stayed put', () => {
    const facts = JSON.parse(run('reportAbsence', { worker: 'Lena', from: day(1), to: day(1) }).reply);
    expect(facts.shiftsThatStayedPut).toBe(6);
  });

  it('leaves a pinned shift for the owner', () => {
    const facts = JSON.parse(run('reportAbsence', { worker: 'Grace', from: day(1), to: day(1) }).reply);
    expect(facts.pinnedShiftsTheOwnerMustDecide).toHaveLength(1);
    expect(facts.moves).toEqual([]);
  });

  it('refuses a person or dates it cannot read', () => {
    expect(run('reportAbsence', { worker: 'Nobody', from: day(1), to: day(1) }).failed).toBe(true);
    expect(run('reportAbsence', { worker: 'Lena', from: 'tomorrow', to: 'tomorrow' }).failed).toBe(true);
    expect(run('reportAbsence', { worker: 'Lena', from: day(2), to: day(1) }).failed).toBe(true);
  });
});

describe('moveShift', () => {
  const findShift = (schedule: Schedule, job: string, skill: string) => schedule.shifts.find((shift) => shift.job.startsWith(job) && shift.skill === skill)!;

  it('moves a shift when the rules allow it', () => {
    const schedule = fresh();
    const outcome = run('moveShift', { shiftId: findShift(schedule, 'Rivera', 'Driver').id, to: 'Kofi' }, schedule);
    expect(outcome.effects?.moves?.[0]).toMatchObject({ to: 'kofi', from: null });
  });

  it('refuses a move that breaks a rule, and says which', () => {
    const schedule = fresh();
    const outcome = run('moveShift', { shiftId: findShift(schedule, 'Rivera', 'Bartender').id, to: 'Lena' }, schedule);
    expect(outcome.failed).toBe(true);
    expect(outcome.reply).toContain("isn't trained");
    expect(outcome.effects).toBeUndefined();
  });

  it('refuses to move a pinned shift', () => {
    const schedule = fresh();
    const outcome = run('moveShift', { shiftId: findShift(schedule, 'Mills', 'Bartender').id, to: 'Priya' }, schedule);
    expect(outcome.failed).toBe(true);
    expect(outcome.reply).toContain('pinned');
  });

  it('refuses to move a finished shift', () => {
    const schedule = fresh();
    const outcome = run('moveShift', { shiftId: findShift(schedule, 'Okafor', 'Cook').id, to: 'open' }, schedule);
    expect(outcome.failed).toBe(true);
    expect(outcome.reply).toContain('finished');
  });

  it('refuses a shift or a person that does not exist', () => {
    const schedule = fresh();
    expect(run('moveShift', { shiftId: 'nope', to: 'Lena' }, schedule).failed).toBe(true);
    expect(run('moveShift', { shiftId: findShift(schedule, 'Rivera', 'Driver').id, to: 'Nobody' }, schedule).failed).toBe(true);
  });

  it('can send a shift back to the open row', () => {
    const schedule = fresh();
    const outcome = run('moveShift', { shiftId: findShift(schedule, 'Mills', 'Driver').id, to: 'open' }, schedule);
    expect(outcome.effects?.moves?.[0]).toMatchObject({ from: 'theo', to: null });
  });
});

describe('whoCanTake', () => {
  it('names who can, and what stops the others', () => {
    const schedule = fresh();
    const shift = schedule.shifts.find((s) => s.job.startsWith('Rivera') && s.skill === 'Server')!;
    const facts = JSON.parse(run('whoCanTake', { shiftId: shift.id }, schedule).reply);
    expect(facts.canTakeIt).toContain('Malik Johnson');
    expect(facts.cannot.find((entry: { name: string }) => entry.name === 'Ana Ferreira').reasons[0]).toContain('family trip');
  });
});

describe('pinShift', () => {
  it('pins a shift to its person', () => {
    const schedule = fresh();
    const shift = schedule.shifts.find((s) => s.job.startsWith('Mills') && s.skill === 'Cook')!;
    expect(run('pinShift', { shiftId: shift.id }, schedule).effects?.pin).toEqual({ shiftId: shift.id, pinned: true });
    expect(run('pinShift', { shiftId: shift.id, pinned: false }, schedule).effects?.pin).toEqual({ shiftId: shift.id, pinned: false });
  });

  it('refuses an open shift', () => {
    const schedule = fresh();
    const open = schedule.shifts.find((s) => !s.workerId)!;
    expect(run('pinShift', { shiftId: open.id }, schedule).failed).toBe(true);
  });
});

describe('listReadyToPay', () => {
  it('adds up finished shifts, reminds the model it cannot pay and shows the list', () => {
    const outcome = run('listReadyToPay', {});
    const facts = JSON.parse(outcome.reply);
    expect(facts.shifts).toHaveLength(9);
    expect(facts.total).toBe('$919.00');
    expect(facts.note).toContain('cannot pay');
    expect(outcome.effects?.showPayments).toBe(true);
    expect(outcome.effects?.moves).toBeUndefined();
  });

  it('leaves out shifts that have been paid', () => {
    const schedule = fresh();
    const paid = schedule.shifts.find((s) => s.job.startsWith('Okafor'))!;
    paid.payment = { batchId: 'B', amount: 1, status: 'SUCCESS', paidAt: NOW.toISOString() };
    expect(JSON.parse(run('listReadyToPay', {}, schedule).reply).shifts).toHaveLength(8);
  });
});

describe('what the model is given', () => {
  it('offers every tool of ours through the server', () => {
    for (const name of Object.keys(AGENT_TOOLS)) expect(ALLOWED_TOOLS.has(name)).toBe(true);
  });

  it('has no tool about money that moves it', () => {
    const names = [...ALLOWED_TOOLS].join(' ').toLowerCase();
    expect(names).not.toMatch(/approve|payout|refund|transfer/);
  });

  it('only teaches tools the model can really call', () => {
    const taught = AGENT_EXAMPLES.flat().flatMap((message) => ('tool_calls' in message ? (message.tool_calls ?? []).map((call) => call.function.name) : []));
    expect(taught.length).toBeGreaterThan(0);
    for (const name of taught) expect(ALLOWED_TOOLS.has(name)).toBe(true);
  });
});

describe('wall clock', () => {
  it('keeps the hour on the wall, wherever the browser is', () => {
    const local = new Date(2026, 10, 7, 15, 30);
    expect(wallClock(local).toISOString()).toBe('2026-11-07T15:30:00.000Z');
    expect(toWallIso(local)).toBe('2026-11-07T15:30:00.000Z');
    const back = toLocalDate('2026-11-07T15:30:00.000Z');
    expect([back.getDate(), back.getHours(), back.getMinutes()]).toEqual([7, 15, 30]);
  });
});
