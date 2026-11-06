// The link between the Scheduler's stores and everything else. The stores hold the schedule, so that
// dragging, the assistant's tools and undo all act on one thing. This class reads them as a plain
// `Schedule` for the rules, applies the assistant's changes, keeps the record of payments and
// tells React when something changed.

import { EventModel, ResourceModel, type ColumnStore, type ResourceTimeRangeStore, type Scheduler, type StateTrackingManager } from '@bryntum/scheduler';
import type { Effects } from '@/lib/schedule/agent';
import { demoSchedule, TIMELINE, WORKERS } from '@/lib/schedule/demo';
import { isReadyToPay, shiftHours, shiftPay } from '@/lib/schedule/rules';
import { balanceAfterPayments, FINAL_STATUSES, loadSaved, NOT_PAID_STATUSES, storeSaved, withPayments, type LedgerEntry } from '@/lib/schedule/saved';
import type { Blocked, Schedule, Shift, Skill, Worker } from '@/lib/schedule/types';
import { dayKey, toLocalDate, toWallIso, wallClock } from '@/lib/schedule/wall-clock';

/** The row at the top of the Scheduler for shifts nobody has yet. */
export const OPEN_ROW = 'open';

export class ShiftEvent extends EventModel {
  static $name = 'Shift';
  static fields = [
    { name: 'job', type: 'string' },
    { name: 'skill', type: 'string' },
    { name: 'pinned', type: 'boolean', defaultValue: false },
    { name: 'why', type: 'string' },
  ];
  declare job: string;
  declare skill: Skill;
  declare pinned: boolean;
  declare why: string | null;
}

export class CrewMember extends ResourceModel {
  static $name = 'CrewMember';
  static fields = [
    { name: 'skills', type: 'array' },
    { name: 'hourlyRate', type: 'number' },
    { name: 'maxWeeklyHours', type: 'number' },
  ];
  declare skills: Skill[];
  declare hourlyRate: number;
  declare maxWeeklyHours: number;
}

const POLL_MS = 2500;
const POLL_FOR_MS = 3 * 60_000;
const MOVE_PAUSE_MS = 280;
const GLOW_MS = 7000;

export type { LedgerEntry };

export type View = {
  schedule: Schedule;
  ready: Shift[];
  readyTotal: number;
  open: number;
  ledger: LedgerEntry[];
  /** The PayPal balance that pays for all this, once PayPal has answered. */
  balance: number | null;
  now: Date;
};

export type Notice = { id: number; tone: 'paid' | 'error' | 'info'; text: string };

export const payFor = (shift: Shift, worker: Pick<Worker, 'hourlyRate'>) => shiftPay(shift, worker);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function withoutPayment(shift: Shift): Shift {
  const copy = { ...shift };
  delete copy.payment;
  return copy;
}

// Bryntum types these as "the store or its config"; on a live Scheduler they are always the store.
const rangesOf = (scheduler: Scheduler) => scheduler.project.resourceTimeRangeStore as ResourceTimeRangeStore;
const stmOf = (scheduler: Scheduler) => scheduler.project.stm as StateTrackingManager;

export class Board {
  scheduler?: Scheduler;
  ledger: LedgerEntry[];
  run: number;
  private reportedBalance: { available: number; asOf: string } | null = null;
  /** Shifts the assistant has just moved: they glow for a moment. */
  readonly glowing = new Set<string>();
  /** What the Scheduler starts with. */
  readonly initial: { shifts: Shift[]; blocked: Blocked[] };
  readonly timeline: { start: Date; end: Date; today: Date };

  private listeners = new Set<() => void>();
  private noticeListeners = new Set<(notice: Notice) => void>();
  private panelListeners = new Set<() => void>();
  private view: View;
  private notices = 0;
  private watching = new Set<string>();

  constructor() {
    const now = wallClock();
    const today = dayKey(now);
    const saved = loadSaved();
    const fresh = demoSchedule(now);
    const current = saved?.day === today ? saved : null;
    this.initial = current ? { shifts: current.shifts, blocked: current.blocked } : { shifts: fresh.shifts, blocked: fresh.blocked };
    this.ledger = saved?.ledger ?? [];
    this.run = current?.run ?? (saved?.run ?? 0) + 1;

    const dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const dayAt = (offset: number) => toLocalDate(new Date(dayStart + offset * 86_400_000).toISOString());
    this.timeline = { start: dayAt(TIMELINE.firstDay), end: dayAt(TIMELINE.firstDay + TIMELINE.days), today: dayAt(0) };

    this.view = this.buildView({ workers: WORKERS, shifts: this.withPayments(this.initial.shifts), blocked: this.initial.blocked });
  }

  get balance() {
    return this.reportedBalance && balanceAfterPayments(this.reportedBalance, this.ledger);
  }

  // ---------------- for React

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getView = () => this.view;

  onNotice(listener: (notice: Notice) => void) {
    this.noticeListeners.add(listener);
    return () => {
      this.noticeListeners.delete(listener);
    };
  }

  onShowPayments(listener: () => void) {
    this.panelListeners.add(listener);
    return () => {
      this.panelListeners.delete(listener);
    };
  }

  private notify() {
    this.view = this.buildView(this.snapshot());
    this.persist();
    this.listeners.forEach((listener) => listener());
  }

  private tell(tone: Notice['tone'], text: string) {
    const notice = { id: ++this.notices, tone, text };
    this.noticeListeners.forEach((listener) => listener(notice));
  }

  private buildView(schedule: Schedule): View {
    const now = wallClock();
    const ready = schedule.shifts.filter((s) => isReadyToPay(s, now)).sort((a, b) => a.end.localeCompare(b.end));
    return {
      schedule,
      now,
      ready,
      readyTotal: ready.reduce((sum, shift) => sum + shiftPay(shift, schedule.workers.find((w) => w.id === shift.workerId)!), 0),
      open: schedule.shifts.filter((s) => !s.workerId).length,
      ledger: this.ledger,
      balance: this.balance,
    };
  }

  private persist() {
    const { shifts, blocked } = this.view.schedule;
    storeSaved({ day: dayKey(this.view.now), run: this.run, shifts: shifts.map(withoutPayment), blocked, ledger: this.ledger });
  }

  // ---------------- the Scheduler

  attach(scheduler: Scheduler) {
    this.scheduler = scheduler;
    if (process.env.NODE_ENV === 'development') (window as unknown as { board: Board }).board = this;
    const changed = () => {
      if (scheduler.isDestroying || scheduler.isDestroyed) return;
      this.notify();
      // The crew column shows hours booked, which depend on the shifts.
      const crew = (scheduler.columns as ColumnStore).getById('crew');
      if (crew) scheduler.refreshColumn(crew as never);
    };
    scheduler.eventStore.on('change', changed);
    rangesOf(scheduler).on('change', changed);
    this.notify();
    void this.refreshBalance();
    for (const batchId of new Set(this.ledger.filter((e) => e.batchId && !FINAL_STATUSES.has(e.status)).map((e) => e.batchId))) void this.watch(batchId);

    // A shift that ends while the page is open becomes payable.
    const tick = setInterval(() => {
      this.notify();
      this.repaint();
    }, 60_000);
    return () => {
      clearInterval(tick);
      this.scheduler = undefined;
      // React may have destroyed it first, and its stores with it.
      if (scheduler.isDestroyed) return;
      scheduler.eventStore.un('change', changed);
      rangesOf(scheduler).un('change', changed);
    };
  }

  /** The schedule as the rules see it. */
  snapshot(): Schedule {
    const scheduler = this.scheduler;
    if (!scheduler) return this.view.schedule;
    const shifts: Shift[] = (scheduler.eventStore.allRecords as ShiftEvent[]).map((record) => ({
      id: String(record.id),
      job: record.job,
      skill: record.skill,
      start: toWallIso(record.startDate as Date),
      end: toWallIso(record.endDate as Date),
      workerId: String(record.resourceId) === OPEN_ROW ? null : String(record.resourceId),
      pinned: record.pinned,
      ...(record.why ? { why: record.why } : {}),
    }));
    const blocked: Blocked[] = rangesOf(scheduler).allRecords.map((record) => {
      const range = record as unknown as { id: string; resourceId: string; startDate: Date; endDate: Date; name: string };
      return { id: String(range.id), workerId: String(range.resourceId), start: toWallIso(range.startDate), end: toWallIso(range.endDate), reason: range.name };
    });
    return { workers: WORKERS, shifts: this.withPayments(shifts), blocked };
  }

  private withPayments(shifts: Shift[]) {
    return withPayments(shifts, this.ledger, this.run);
  }

  private repaint() {
    this.scheduler?.refreshRows();
  }

  // ---------------- the assistant's changes

  async apply(effects: Effects | undefined) {
    const scheduler = this.scheduler;
    if (!scheduler || !effects) return;

    for (const blocked of effects.blocked ?? []) rangesOf(scheduler).add(toRangeData(blocked));
    if (effects.newShifts?.length) {
      scheduler.eventStore.add(effects.newShifts.map(toEventData));
      await scheduler.scrollEventIntoView(scheduler.eventStore.getById(effects.newShifts[0].id) as EventModel, { block: 'center', animate: true }).catch(() => undefined);
    }
    if (effects.pin) {
      const record = scheduler.eventStore.getById(effects.pin.shiftId) as ShiftEvent | undefined;
      if (record) record.pinned = effects.pin.pinned;
    }
    if (effects.moves?.length) {
      const first = scheduler.eventStore.getById(effects.moves[0].shiftId) as EventModel | undefined;
      if (first) await scheduler.scrollEventIntoView(first, { block: 'center', animate: true }).catch(() => undefined);
    }
    for (const move of effects.moves ?? []) {
      const record = scheduler.eventStore.getById(move.shiftId) as ShiftEvent | undefined;
      if (!record) continue;
      this.glowing.add(move.shiftId);
      record.why = move.why;
      record.resourceId = move.to ?? OPEN_ROW;
      await sleep(MOVE_PAUSE_MS);
    }
    if (effects.moves?.length) {
      const moved = effects.moves.map((m) => m.shiftId);
      setTimeout(() => {
        moved.forEach((id) => this.glowing.delete(id));
        this.repaint();
      }, GLOW_MS);
    }
    if (effects.showPayments) this.panelListeners.forEach((listener) => listener());
  }

  /** The owner dropped a shift on someone: the assistant's reason no longer applies. */
  clearWhy(record: ShiftEvent) {
    record.why = null;
  }

  // ---------------- paying

  /**
   * Pays finished shifts in one PayPal batch. Only the Approve buttons call this: the assistant has no
   * way to reach it.
   */
  async approveAndPay(shiftIds: string[]) {
    const schedule = this.snapshot();
    const now = wallClock();
    const shifts = shiftIds.map((id) => schedule.shifts.find((s) => s.id === id)).filter((s): s is Shift => Boolean(s && isReadyToPay(s, now)));
    if (shifts.length === 0) return;

    const entries: LedgerEntry[] = shifts.map((shift) => {
      const worker = schedule.workers.find((w) => w.id === shift.workerId)!;
      return {
        shiftId: shift.id,
        workerId: worker.id,
        workerName: worker.name,
        job: shift.job,
        skill: shift.skill,
        hours: shiftHours(shift),
        rate: worker.hourlyRate,
        amount: shiftPay(shift, worker),
        fee: null,
        status: 'SENDING',
        batchId: '',
        transactionId: null,
        sentAt: new Date().toISOString(),
        run: this.run,
      };
    });
    this.ledger = [...entries, ...this.ledger];
    this.notify();
    this.repaint();

    const removeEntries = () => {
      this.ledger = this.ledger.filter((entry) => !entries.includes(entry));
      this.notify();
      this.repaint();
    };

    try {
      const response = await fetch('/api/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchKey: `hs-${crypto.randomUUID()}`,
          shifts: shifts.map((shift) => ({ shiftId: shift.id, workerId: shift.workerId, job: shift.job, skill: shift.skill, hours: shiftHours(shift) })),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        removeEntries();
        this.tell('error', body.error ?? 'PayPal could not send this payment. Nobody has been paid.');
        return;
      }
      const sent = entries.map((entry) => ({ ...entry, batchId: body.batchId, status: body.status ?? 'PENDING' }));
      this.ledger = this.ledger.map((entry) => sent[entries.indexOf(entry)] ?? entry);
      this.notify();
      this.repaint();
      void this.watch(body.batchId);
    } catch {
      removeEntries();
      this.tell('error', "Couldn't reach the server, so nobody has been paid. Try again.");
    }
  }

  /** Follows a batch until PayPal has settled every payment in it. */
  private async watch(batchId: string) {
    if (this.watching.has(batchId)) return;
    this.watching.add(batchId);
    const giveUpAt = Date.now() + POLL_FOR_MS;
    while (Date.now() < giveUpAt && this.scheduler) {
      await sleep(POLL_MS);
      const response = await fetch(`/api/payouts/${batchId}`).catch(() => null);
      if (!response?.ok) continue;
      const batch = (await response.json()) as { items: { shiftId: string; status: string; fee: number; transactionId: string | null }[] };
      const before = new Map(this.ledger.map((entry) => [`${entry.batchId}:${entry.shiftId}`, entry.status]));
      this.ledger = this.ledger.map((entry) => {
        if (entry.batchId !== batchId) return entry;
        const item = batch.items.find((i) => i.shiftId === entry.shiftId);
        return item ? { ...entry, status: item.status, fee: item.fee, transactionId: item.transactionId } : entry;
      });
      const settled = this.ledger.filter((e) => e.batchId === batchId);
      const justPaid = settled.filter((e) => e.status === 'SUCCESS' && before.get(`${e.batchId}:${e.shiftId}`) !== 'SUCCESS');
      const justFailed = settled.filter((e) => NOT_PAID_STATUSES.has(e.status) && !NOT_PAID_STATUSES.has(before.get(`${e.batchId}:${e.shiftId}`) ?? ''));
      this.notify();
      this.repaint();
      if (justPaid.length === 1) this.tell('paid', `${justPaid[0].workerName} just got $${justPaid[0].amount.toFixed(2)} through PayPal.`);
      if (justPaid.length > 1) this.tell('paid', `${justPaid.length} payments just landed through PayPal: $${justPaid.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}.`);
      for (const entry of justFailed) this.tell('error', `PayPal could not pay ${entry.workerName} (${entry.status.toLowerCase()}). The shift is waiting for approval again.`);
      if (settled.length > 0 && settled.every((e) => FINAL_STATUSES.has(e.status))) break;
    }
    this.watching.delete(batchId);
  }

  private async refreshBalance() {
    const response = await fetch('/api/balance').catch(() => null);
    if (!response?.ok) return;
    this.reportedBalance = (await response.json()) as { available: number; asOf: string };
    this.notify();
  }

  // ---------------- starting over

  /** Puts the schedule back as it was. The ledger stays: those payments really happened in the sandbox. */
  reset() {
    const scheduler = this.scheduler;
    if (!scheduler) return;
    const fresh = demoSchedule(wallClock());
    this.run += 1;
    const stm = stmOf(scheduler);
    const wasRecording = !stm.disabled;
    if (wasRecording) stm.disable();
    scheduler.eventStore.removeAll();
    rangesOf(scheduler).removeAll();
    scheduler.eventStore.add(fresh.shifts.map(toEventData));
    rangesOf(scheduler).add(fresh.blocked.map(toRangeData));
    stm.resetQueue();
    if (wasRecording) stm.enable();
    this.glowing.clear();
    // The conversation is about the week that's gone: the assistant shouldn't remember it, and its undo no longer applies.
    (scheduler.features.ai as unknown as { chatPanel?: { tools?: { clearChat?: { element?: HTMLElement } } } }).chatPanel?.tools?.clearChat?.element?.click();
    this.notify();
    this.repaint();
  }
}

export const toEventData = (shift: Shift) => ({
  id: shift.id,
  name: `${shift.skill}: ${shift.job}`,
  job: shift.job,
  skill: shift.skill,
  pinned: shift.pinned,
  why: shift.why ?? null,
  startDate: toLocalDate(shift.start),
  endDate: toLocalDate(shift.end),
  resourceId: shift.workerId ?? OPEN_ROW,
});

export const toRangeData = (blocked: Blocked) => ({
  id: blocked.id,
  resourceId: blocked.workerId,
  name: blocked.reason,
  startDate: toLocalDate(blocked.start),
  endDate: toLocalDate(blocked.end),
});
