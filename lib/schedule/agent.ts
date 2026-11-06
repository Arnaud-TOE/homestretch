// The assistant's tools, as plain functions. Given the schedule and the model's arguments, each one
// says what to tell the model and what should change on the board; the board applies the changes.
// Nothing here can pay anyone, and nothing can break a rule, whatever the model asks for.

import { canMove, describeShift, isReadyToPay, scheduleIssues, shiftHours, shiftPay, upcomingHours, whyNot } from './rules';
import { coverAbsence, fillOpenShifts } from './solver';
import { SKILLS, type Blocked, type Change, type Schedule, type Shift, type Skill, type Worker } from './types';

export type Effects = {
  /** Shifts changing hands, in the order the owner should see them move. */
  moves?: Change[];
  newShifts?: Shift[];
  blocked?: Blocked[];
  pin?: { shiftId: string; pinned: boolean };
  /** Brings the list of shifts waiting for approval into view. */
  showPayments?: boolean;
};

export type Outcome = { reply: string; failed?: boolean; effects?: Effects };

type Property = { type: string; description: string; items?: Property; properties?: Record<string, Property>; required?: string[] };

/** What the tools know beyond the schedule. */
export type AgentContext = {
  /** The PayPal balance, if PayPal has answered. */
  balance: number | null;
};

export type AgentTool = {
  description: string;
  /** Shown in the chat panel while the tool runs. */
  status: string;
  properties: Record<string, Property>;
  required: string[];
  run(schedule: Schedule, args: Record<string, unknown>, now: Date, context?: AgentContext): Outcome;
};

const refuse = (reply: string): Outcome => ({ reply, failed: true });
const json = (value: unknown, effects?: Effects): Outcome => ({ reply: JSON.stringify(value), effects });

const money = (amount: number) => `$${amount.toFixed(2)}`;

/** Accepts an id, a full name or a first name, in any case. */
export function findWorker(workers: Worker[], text: unknown): Worker | undefined {
  const wanted = String(text ?? '').trim().toLowerCase();
  if (!wanted) return undefined;
  const exact = workers.find((w) => w.id === wanted || w.name.toLowerCase() === wanted);
  if (exact) return exact;
  const partial = workers.filter((w) => w.name.toLowerCase().split(' ').includes(wanted));
  return partial.length === 1 ? partial[0] : undefined;
}

const nameOf = (schedule: Schedule, workerId: string | null) => schedule.workers.find((w) => w.id === workerId)?.name ?? 'open';
const unknownWorker = (schedule: Schedule, text: unknown) => refuse(`No crew member called "${text}". The crew: ${schedule.workers.map((w) => w.name).join(', ')}.`);
const unknownShift = (id: unknown) => refuse(`No shift with id "${id}". Call checkSchedule for the ids.`);

const readableDate = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).replace(':00', '');

const unfilledText = (schedule: Schedule, unfilled: { shiftId: string; reasons: string[] }[]) =>
  unfilled.map(({ shiftId, reasons }) => {
    const shift = schedule.shifts.find((s) => s.id === shiftId);
    return { shift: shift ? describeShift(shift) : shiftId, reasons };
  });

const movesText = (schedule: Schedule, moves: Change[]) =>
  moves.map((move) => {
    const shift = schedule.shifts.find((s) => s.id === move.shiftId);
    return { shift: shift ? describeShift(shift) : move.shiftId, from: nameOf(schedule, move.from), to: nameOf(schedule, move.to), why: move.why };
  });

const payTotal = (schedule: Schedule, shifts: Shift[]) =>
  shifts.reduce((sum, shift) => {
    const worker = schedule.workers.find((w) => w.id === shift.workerId);
    return worker ? sum + shiftPay(shift, worker) : sum;
  }, 0);

function checkSchedule(schedule: Schedule, _args: Record<string, unknown>, now: Date): Outcome {
  const jobs = new Map<string, Shift[]>();
  for (const shift of [...schedule.shifts].sort((a, b) => a.start.localeCompare(b.start))) {
    jobs.set(shift.job, [...(jobs.get(shift.job) ?? []), shift]);
  }
  const ready = schedule.shifts.filter((s) => isReadyToPay(s, now));
  return json({
    now: readableDate(now.toISOString()),
    today: now.toISOString().slice(0, 10),
    crew: schedule.workers.map((w) => ({
      name: w.name,
      skills: w.skills,
      hoursBookedNext7Days: upcomingHours(schedule, w.id, now),
      weeklyLimit: w.maxWeeklyHours,
      unavailable: schedule.blocked.filter((b) => b.workerId === w.id).map((b) => `${b.reason}: ${readableDate(b.start)} to ${readableDate(b.end)}`),
    })),
    jobs: [...jobs].map(([job, shifts]) => ({
      job,
      when: `${readableDate(shifts[0].start)} to ${readableDate(shifts[0].end)}`,
      payForStaffedShifts: money(payTotal(schedule, shifts)),
      shifts: shifts.map((s) => ({
        id: s.id,
        skill: s.skill,
        worker: s.workerId ? nameOf(schedule, s.workerId) : null,
        ...(s.pinned && { pinned: true }),
        ...(s.payment ? { paid: true } : !canMove(s, now) && { finished: true }),
      })),
    })),
    brokenRules: scheduleIssues(schedule).map((p) => p.message),
    waitingForApproval: { shifts: ready.length, total: money(payTotal(schedule, ready)) },
  });
}

const FIRST_HOUR = 8;
const LAST_HOUR = 24;

function addJob(schedule: Schedule, args: Record<string, unknown>, now: Date): Outcome {
  const name = String(args.name ?? '').trim();
  const date = String(args.date ?? '');
  const startHour = Number(args.startHour);
  const endHour = Number(args.endHour);
  const roles = (Array.isArray(args.roles) ? args.roles : []) as { skill?: string; count?: number }[];

  if (!name) return refuse('A job needs a name.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return refuse('The date must look like 2026-11-14.');
  if (!(startHour >= FIRST_HOUR && endHour <= LAST_HOUR && startHour < endHour)) return refuse(`Hours must fall between ${FIRST_HOUR} and ${LAST_HOUR}, with the start before the end.`);
  if (Date.parse(date) + endHour * 3_600_000 <= now.getTime()) return refuse('That job would already be over.');
  if (roles.length === 0) return refuse('Say which roles the job needs.');

  const unknown = roles.find((role) => !SKILLS.includes(role.skill as Skill));
  if (unknown) return refuse(`Unknown skill "${unknown.skill}". The skills: ${SKILLS.join(', ')}.`);
  const total = roles.reduce((sum, role) => sum + Number(role.count ?? 1), 0);
  if (!(total >= 1 && total <= 20)) return refuse('A job can have between 1 and 20 shifts.');

  const base = Date.parse(date);
  const at = (hour: number) => new Date(base + hour * 3_600_000).toISOString();
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}-${base / 86_400_000}`;
  const taken = new Set(schedule.shifts.map((s) => s.id));
  let serial = 1;
  const nextId = () => {
    while (taken.has(`${slug}-${serial}`)) serial++;
    taken.add(`${slug}-${serial}`);
    return `${slug}-${serial}`;
  };

  const newShifts: Shift[] = roles.flatMap((role) =>
    Array.from({ length: Number(role.count ?? 1) }, () => ({ id: nextId(), job: name, skill: role.skill as Skill, start: at(startHour), end: at(endHour), workerId: null, pinned: false })),
  );
  return { reply: `Added ${newShifts.length} open shifts for ${name}, ${readableDate(at(startHour))}. Call fillOpenShifts to staff them.`, effects: { newShifts } };
}

function fill(schedule: Schedule, args: Record<string, unknown>): Outcome {
  const job = args.job ? String(args.job) : undefined;
  const result = fillOpenShifts(schedule, { job });
  if (result.changes.length === 0 && result.unfilled.length === 0) return { reply: job ? `There are no open shifts for "${job}".` : 'There are no open shifts.' };
  return json(
    { filled: movesText(result.schedule, result.changes), couldNotFill: unfilledText(result.schedule, result.unfilled), brokenRules: scheduleIssues(result.schedule).map((p) => p.message) },
    { moves: result.changes },
  );
}

function reportAbsence(schedule: Schedule, args: Record<string, unknown>, now: Date): Outcome {
  const worker = findWorker(schedule.workers, args.worker);
  if (!worker) return unknownWorker(schedule, args.worker);
  const from = Date.parse(String(args.from));
  const to = Date.parse(String(args.to ?? args.from));
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return refuse('Give the first and last day of the absence, like 2026-11-14.');

  const result = coverAbsence(
    schedule,
    {
      workerId: worker.id,
      start: new Date(from).toISOString(),
      // The last day counts in full.
      end: new Date(to + 86_400_000).toISOString(),
      reason: String(args.reason ?? 'Out'),
    },
    now,
  );
  return json(
    {
      moves: movesText(result.schedule, result.changes),
      shiftsThatStayedPut: result.untouched,
      couldNotCover: unfilledText(result.schedule, result.unfilled),
      pinnedShiftsTheOwnerMustDecide: result.pinnedConflicts.map((id) => describeShift(result.schedule.shifts.find((s) => s.id === id)!)),
      brokenRules: scheduleIssues(result.schedule).map((p) => p.message),
    },
    { blocked: [result.blocked], moves: result.changes },
  );
}

function whoCanTake(schedule: Schedule, args: Record<string, unknown>): Outcome {
  const shift = schedule.shifts.find((s) => s.id === args.shiftId);
  if (!shift) return unknownShift(args.shiftId);
  const answers = schedule.workers
    .filter((w) => w.id !== shift.workerId)
    .map((w) => ({ worker: w, reasons: whyNot(schedule, shift, w).map((v) => v.message) }));
  return json({
    shift: describeShift(shift),
    canTakeIt: answers.filter((a) => a.reasons.length === 0).map((a) => a.worker.name),
    cannot: answers.filter((a) => a.reasons.length > 0 && a.worker.skills.includes(shift.skill)).map((a) => ({ name: a.worker.name, reasons: a.reasons })),
  });
}

function moveShift(schedule: Schedule, args: Record<string, unknown>, now: Date): Outcome {
  const shift = schedule.shifts.find((s) => s.id === args.shiftId);
  if (!shift) return unknownShift(args.shiftId);
  if (!canMove(shift, now)) return refuse(`${describeShift(shift)} is finished, so it stays with ${nameOf(schedule, shift.workerId)}.`);
  if (shift.pinned) return refuse(`${describeShift(shift)} is pinned to ${nameOf(schedule, shift.workerId)}. Only the owner can change that.`);

  if (String(args.to ?? '').toLowerCase() === 'open') {
    const why = String(args.why ?? 'Sent back to the open row.');
    return { reply: `${describeShift(shift)} is open again.`, effects: { moves: [{ shiftId: shift.id, from: shift.workerId, to: null, why }] } };
  }

  const worker = findWorker(schedule.workers, args.to);
  if (!worker) return unknownWorker(schedule, args.to);
  const problems = whyNot(schedule, shift, worker);
  if (problems.length > 0) return refuse(`Not moved. ${problems.map((p) => p.message).join(' ')}`);
  const why = String(args.why ?? `${worker.name} is a ${shift.skill.toLowerCase()} and is free then.`);
  return { reply: `${describeShift(shift)} now belongs to ${worker.name}.`, effects: { moves: [{ shiftId: shift.id, from: shift.workerId, to: worker.id, why }] } };
}

function pinShift(schedule: Schedule, args: Record<string, unknown>): Outcome {
  const shift = schedule.shifts.find((s) => s.id === args.shiftId);
  if (!shift) return unknownShift(args.shiftId);
  if (!shift.workerId) return refuse('An open shift has nobody to be pinned to.');
  const pinned = args.pinned !== false;
  return { reply: `${describeShift(shift)} is ${pinned ? 'pinned to' : 'no longer pinned to'} ${nameOf(schedule, shift.workerId)}.`, effects: { pin: { shiftId: shift.id, pinned } } };
}

function listReadyToPay(schedule: Schedule, _args: Record<string, unknown>, now: Date, context?: AgentContext): Outcome {
  const ready = schedule.shifts.filter((s) => isReadyToPay(s, now));
  const balance = context?.balance ?? null;
  return json(
    {
      shifts: ready.map((s) => {
        const worker = schedule.workers.find((w) => w.id === s.workerId)!;
        return { worker: worker.name, shift: describeShift(s), hours: shiftHours(s), rate: worker.hourlyRate, pay: money(shiftPay(s, worker)) };
      }),
      total: money(payTotal(schedule, ready)),
      ...(balance === null ? {} : { payPalBalance: money(balance), balanceCoversIt: balance >= payTotal(schedule, ready) }),
      note: 'You cannot pay anyone. The owner approves these with the Approve and pay button, and PayPal then pays each person.',
    },
    { showPayments: true },
  );
}

export const AGENT_TOOLS: Record<string, AgentTool> = {
  checkSchedule: {
    description: 'Reads the whole schedule: today, the crew and their hours, every job and shift with its id, broken rules and pay waiting for approval. Call this first.',
    status: 'Reading the schedule',
    properties: {},
    required: [],
    run: checkSchedule,
  },
  addJob: {
    description: 'Adds a new job to the schedule as open shifts, one per role. It does not staff them.',
    status: 'Adding the job',
    properties: {
      name: { type: 'string', description: 'The job, like "Rivera wedding"' },
      date: { type: 'string', description: 'The day, as YYYY-MM-DD' },
      startHour: { type: 'number', description: 'Start, on a 24-hour clock, from 8' },
      endHour: { type: 'number', description: 'End, on a 24-hour clock, up to 24' },
      roles: {
        type: 'array',
        description: 'The people needed',
        items: {
          type: 'object',
          description: 'One role',
          properties: { skill: { type: 'string', description: `One of ${SKILLS.join(', ')}` }, count: { type: 'number', description: 'How many people' } },
          required: ['skill', 'count'],
        },
      },
    },
    required: ['name', 'date', 'startHour', 'endHour', 'roles'],
    run: addJob,
  },
  fillOpenShifts: {
    description: 'Staffs open shifts fairly without moving anything already assigned, and reports what it could not fill and why.',
    status: 'Staffing open shifts',
    properties: { job: { type: 'string', description: 'Only this job. Leave it out for every open shift.' } },
    required: [],
    run: fill,
  },
  reportAbsence: {
    description: 'Records that someone is out and repairs the schedule, moving as few shifts as possible. It reports each move, what stayed put and what it could not cover.',
    status: 'Repairing the schedule',
    properties: {
      worker: { type: 'string', description: 'Who is out' },
      from: { type: 'string', description: 'First day out, as YYYY-MM-DD' },
      to: { type: 'string', description: 'Last day out, as YYYY-MM-DD. Same as from for one day.' },
      reason: { type: 'string', description: 'Why, in a word or two' },
    },
    required: ['worker', 'from', 'to'],
    run: reportAbsence,
  },
  whoCanTake: {
    description: 'Says who could take a shift, and what stops each of the others with the right skill.',
    status: 'Checking who is free',
    properties: { shiftId: { type: 'string', description: 'The shift id' } },
    required: ['shiftId'],
    run: whoCanTake,
  },
  moveShift: {
    description: 'Gives one shift to someone, or sends it back to the open row. It refuses a move that breaks a rule, and says which rule.',
    status: 'Moving the shift',
    properties: {
      shiftId: { type: 'string', description: 'The shift id' },
      to: { type: 'string', description: 'A crew member, or "open"' },
      why: { type: 'string', description: 'One short sentence for the owner' },
    },
    required: ['shiftId', 'to'],
    run: moveShift,
  },
  pinShift: {
    description: 'Pins a shift to its person, so that you and the repairs leave it alone, or unpins it.',
    status: 'Updating the pin',
    properties: {
      shiftId: { type: 'string', description: 'The shift id' },
      pinned: { type: 'boolean', description: 'false to unpin' },
    },
    required: ['shiftId'],
    run: pinShift,
  },
  listReadyToPay: {
    description: 'Lists finished shifts waiting for the owner to approve, with the pay for each, and shows the list on screen. It cannot pay.',
    status: 'Adding up finished shifts',
    properties: {},
    required: [],
    run: listReadyToPay,
  },
};
