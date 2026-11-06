// The demo's world: a small catering company, its crew and a week of jobs. Everything is dated
// relative to today, so the demo always has shifts just finished and shifts still to come, whenever
// someone opens it. All names are fictional.

import type { Blocked, Schedule, Shift, Skill, Worker } from './types';

export const BUSINESS = 'Juniper & Rye Catering';

export const WORKERS: Worker[] = [
  { id: 'lena', name: 'Lena Ortiz', skills: ['Cook', 'Server'], hourlyRate: 24, maxWeeklyHours: 40 },
  { id: 'theo', name: 'Theo Nakamura', skills: ['Cook', 'Driver'], hourlyRate: 23, maxWeeklyHours: 40 },
  { id: 'diego', name: 'Diego Ramos', skills: ['Cook', 'Server'], hourlyRate: 21, maxWeeklyHours: 32 },
  { id: 'grace', name: 'Grace Liu', skills: ['Bartender', 'Server'], hourlyRate: 22, maxWeeklyHours: 32 },
  { id: 'priya', name: 'Priya Sandhu', skills: ['Server', 'Bartender'], hourlyRate: 19, maxWeeklyHours: 24 },
  { id: 'malik', name: 'Malik Johnson', skills: ['Server'], hourlyRate: 18, maxWeeklyHours: 30 },
  { id: 'ana', name: 'Ana Ferreira', skills: ['Server'], hourlyRate: 18, maxWeeklyHours: 24 },
  { id: 'kofi', name: 'Kofi Mensah', skills: ['Driver', 'Server'], hourlyRate: 20, maxWeeklyHours: 40 },
];

/** Midnight UTC, `days` from today. The demo keeps its times in UTC, so they read the same everywhere. */
function day(today: Date, days: number) {
  return Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + days);
}

const at = (base: number, hour: number) => new Date(base + hour * 3_600_000).toISOString();

type Role = { skill: Skill; worker?: string; pinned?: boolean };

function job(name: string, base: number, from: number, to: number, roles: Role[]): Shift[] {
  return roles.map((role, i) => ({
    id: `${name.toLowerCase().replace(/[^a-z]+/g, '-')}-${base / 86_400_000}-${i + 1}`,
    job: name,
    skill: role.skill,
    start: at(base, from),
    end: at(base, to),
    workerId: role.worker ?? null,
    pinned: role.pinned ?? false,
  }));
}

/** The first day the timeline shows, and how many it shows. */
export const TIMELINE = { firstDay: -3, days: 9 };

export function demoSchedule(now: Date = new Date()): Schedule {
  const d = (n: number) => day(now, n);

  const shifts: Shift[] = [
    // Done and waiting to be paid: the reason the manager opens the app.
    ...job('Harbor Books launch', d(-3), 16, 21, [
      { skill: 'Cook', worker: 'theo' },
      { skill: 'Server', worker: 'malik' },
      { skill: 'Server', worker: 'ana' },
    ]),
    ...job('Tideline team lunch', d(-2), 10, 14, [
      { skill: 'Cook', worker: 'diego' },
      { skill: 'Server', worker: 'priya' },
      { skill: 'Driver', worker: 'kofi' },
    ]),
    ...job('Okafor anniversary dinner', d(-1), 16, 22, [
      { skill: 'Cook', worker: 'lena' },
      { skill: 'Bartender', worker: 'grace' },
      { skill: 'Server', worker: 'malik' },
    ]),

    // Already staffed.
    ...job('Mills & Co. holiday party', d(1), 15, 22, [
      { skill: 'Cook', worker: 'lena' },
      { skill: 'Cook', worker: 'diego' },
      { skill: 'Bartender', worker: 'grace', pinned: true },
      { skill: 'Server', worker: 'ana' },
      { skill: 'Driver', worker: 'theo' },
    ]),
    ...job('Beacon Clinic breakfast', d(3), 9, 13, [
      { skill: 'Cook', worker: 'lena' },
      { skill: 'Server', worker: 'priya' },
      { skill: 'Driver', worker: 'kofi' },
    ]),

    // Still open, for the agent.
    ...job('Rivera wedding', d(2), 14, 23, [
      { skill: 'Cook' },
      { skill: 'Cook' },
      { skill: 'Bartender' },
      { skill: 'Server' },
      { skill: 'Server' },
      { skill: 'Server' },
      { skill: 'Driver' },
    ]),
  ];

  const blocked: Blocked[] = [
    { id: 'priya-class', workerId: 'priya', start: at(d(1), 17), end: at(d(1), 21), reason: 'Evening class' },
    { id: 'malik-job', workerId: 'malik', start: at(d(2), 8), end: at(d(2), 14), reason: 'Second job' },
    { id: 'ana-trip', workerId: 'ana', start: at(d(2), 0), end: at(d(4), 0), reason: 'Family trip' },
    { id: 'kofi-school', workerId: 'kofi', start: at(d(1), 8), end: at(d(1), 12), reason: 'School run' },
  ];

  return { workers: WORKERS, shifts, blocked };
}
