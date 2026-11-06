// The scheduling domain, independent of the Scheduler component that draws it. Dates are ISO strings
// here, so everything in lib/schedule can be tested without a browser.

export const SKILLS = ['Cook', 'Server', 'Bartender', 'Driver'] as const;
export type Skill = (typeof SKILLS)[number];

export type Worker = {
  id: string;
  name: string;
  skills: Skill[];
  hourlyRate: number;
  maxWeeklyHours: number;
};

export type Payment = {
  batchId: string;
  amount: number;
  status: string;
  paidAt: string;
};

export type Shift = {
  id: string;
  /** The job the shift is for: "Rivera wedding". */
  job: string;
  skill: Skill;
  start: string;
  end: string;
  /** null while the shift is open. */
  workerId: string | null;
  /** A pinned shift is never moved by the agent. */
  pinned: boolean;
  /** Why the assistant last put the shift here, in plain words. */
  why?: string;
  payment?: Payment;
};

/** Time a worker can't work: a class, a second job, an absence. */
export type Blocked = {
  id: string;
  workerId: string;
  start: string;
  end: string;
  reason: string;
};

export type Schedule = {
  workers: Worker[];
  shifts: Shift[];
  blocked: Blocked[];
};

/** One move on the schedule, as the agent reports it and the Scheduler applies it. */
export type Change = {
  shiftId: string;
  from: string | null;
  to: string | null;
  /** In plain words, for the manager. */
  why: string;
};

export type Unfilled = {
  shiftId: string;
  /** Why nobody could take it: each worker's blocker, for the agent to explain. */
  reasons: string[];
};
