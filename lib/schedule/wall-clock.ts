// The schedule keeps wall-clock times: "3 pm on Saturday" is 3 pm wherever the browser is, because a
// shift happens where the job is. An ISO string in the domain holds that time as if it were UTC, so
// the rules can compare and print it without knowing about time zones. These functions cross the border.

/** The time on the wall right now, as the domain holds it. */
export const wallClock = (date: Date = new Date()) =>
  new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()));

/** A domain time as a Date the Scheduler shows at the same hour. */
export function toLocalDate(iso: string) {
  const d = new Date(iso);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes());
}

/** A Date from the Scheduler as a domain time. */
export const toWallIso = (local: Date) => wallClock(local).toISOString();

/** The date part of a domain time, for telling days apart: "2026-11-07". */
export const dayKey = (date: Date) => date.toISOString().slice(0, 10);
