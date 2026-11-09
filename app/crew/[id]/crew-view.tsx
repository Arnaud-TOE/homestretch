'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Logo } from '@/components/logo';
import { BUSINESS, demoSchedule, WORKERS } from '@/lib/schedule/demo';
import { shiftHours, shiftPay, shiftState } from '@/lib/schedule/rules';
import { loadSaved, onSavedChange, withPayments, type LedgerEntry } from '@/lib/schedule/saved';
import type { Shift } from '@/lib/schedule/types';
import { dayKey, wallClock } from '@/lib/schedule/wall-clock';

const usd = (amount: number) => `$${amount.toFixed(2)}`;

// A wallet at night, in the brand's green with an amber glow (app/fx.css).
const NIGHT = { '--night': '#06110e', '--glow-a': '#10b981', '--glow-b': '#f59e0b', '--glow-c': '#22d3ee' } as CSSProperties;

// The same colours as the crew column on the schedule.
const AVATAR_COLORS = ['#b4532a', '#1f6f8b', '#6b4fa0', '#2f7d4f', '#a13d63', '#8a6d1f', '#3c5ba9', '#0f766e'];
const initials = (name: string) => name.split(' ').map((part) => part[0]).join('').slice(0, 2);

const untilStart = (iso: string, now: Date) => {
  const hours = Math.round((Date.parse(iso) - now.getTime()) / 3_600_000);
  if (hours < 1) return 'starting soon';
  if (hours < 24) return `in ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'tomorrow' : `in ${days} days`;
};

const dayAndHours = (shift: Shift) => {
  const zone = { timeZone: 'UTC' } as const;
  const day = new Date(shift.start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...zone });
  const hour = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', ...zone });
  return `${day}, ${hour(shift.start)} to ${hour(shift.end)}`;
};

const sentAt = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

function read(workerId: string) {
  const now = wallClock();
  const saved = loadSaved();
  const current = saved?.day === dayKey(now) ? saved : null;
  const shifts = current?.shifts ?? demoSchedule(now).shifts;
  const ledger = saved?.ledger ?? [];
  const run = current?.run ?? 0;
  const mine = withPayments(shifts, ledger, run)
    .filter((shift) => shift.workerId === workerId)
    .sort((a, b) => a.start.localeCompare(b.start));
  return { now, mine, ledger: ledger.filter((entry) => entry.workerId === workerId && entry.run === run) };
}

/** One crew member's phone: what they've been paid, what's waiting and what's next. */
export default function CrewView({ workerId }: { workerId: string }) {
  const worker = WORKERS.find((w) => w.id === workerId)!;
  const [state, setState] = useState(() => read(workerId));
  const [arrival, setArrival] = useState<LedgerEntry | null>(null);
  const seenPaid = useRef(new Set(state.ledger.filter((entry) => entry.status === 'SUCCESS').map((entry) => entry.shiftId)));

  useEffect(() => {
    const refresh = () => {
      const next = read(workerId);
      setState(next);
      const fresh = next.ledger.find((entry) => entry.status === 'SUCCESS' && !seenPaid.current.has(entry.shiftId));
      if (fresh) {
        seenPaid.current.add(fresh.shiftId);
        setArrival(fresh);
      }
    };
    const stop = onSavedChange(refresh);
    const tick = setInterval(refresh, 30_000);
    return () => {
      stop();
      clearInterval(tick);
    };
  }, [workerId]);

  useEffect(() => {
    if (!arrival) return;
    const timer = setTimeout(() => setArrival(null), 9000);
    return () => clearTimeout(timer);
  }, [arrival]);

  const { now, mine, ledger } = state;
  const paid = mine.filter((shift) => shiftState(shift, now) === 'paid');
  const onItsWay = mine.filter((shift) => shiftState(shift, now) === 'paying');
  const waiting = mine.filter((shift) => shiftState(shift, now) === 'finished');
  const upcoming = mine.filter((shift) => shiftState(shift, now) === 'upcoming');
  const paidTotal = paid.reduce((sum, shift) => sum + (shift.payment?.amount ?? 0), 0);
  const toCome = sumPay(waiting.concat(onItsWay), worker.hourlyRate);
  const first = worker.name.split(' ')[0];
  const color = AVATAR_COLORS[WORKERS.indexOf(worker) % AVATAR_COLORS.length];
  const [next, ...later] = upcoming;
  const paidShare = paidTotal + toCome > 0 ? paidTotal / (paidTotal + toCome) : 0;

  return (
    <div className="night grain min-h-dvh overflow-hidden" style={NIGHT}>
      <div className="aurora opacity-70" aria-hidden>
        <i />
        <i />
        <i />
      </div>
      <div className="relative mx-auto max-w-md pb-10">
      {arrival && (
        <div className="phone-notice fixed inset-x-3 top-3 z-20 mx-auto flex max-w-[26rem] items-start gap-3 rounded-2xl border border-white/40 bg-white p-3 text-[var(--ink)] shadow-2xl shadow-emerald-500/40" role="status">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--brand)] text-sm font-bold text-white">$</span>
          <span className="min-w-0 text-sm">
            <span className="block font-semibold">You just got {usd(arrival.amount)}</span>
            <span className="block text-[var(--muted)]">
              From {BUSINESS} through PayPal, for {arrival.job}.
            </span>
          </span>
        </div>
      )}

      <header className="flex items-center gap-2 px-5 pt-5 text-sm text-white/70">
        <Logo className="size-5" />
        Homestretch
        <span className="glass ml-auto rounded-full px-2.5 py-0.5 text-xs">Sandbox demo</span>
      </header>

      <section className="rise-in px-5 pt-6">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-full text-base font-bold text-white shadow-lg ring-2 ring-white/20" style={{ background: color }}>
            {initials(worker.name)}
          </span>
          <div>
            <p className="font-display text-2xl font-semibold leading-tight tracking-tight">Hi {first}</p>
            <p className="text-sm text-white/55">
              {worker.skills.join(' · ')} at {BUSINESS}
            </p>
          </div>
        </div>

        <div className="pay-card relative mt-5 overflow-hidden rounded-3xl p-5 text-white shadow-2xl shadow-emerald-500/30 ring-1 ring-white/15">
          <p className="text-sm opacity-85">Paid to you through PayPal</p>
          <p className="mt-1 font-display text-5xl font-semibold tabular-nums">{usd(paidTotal)}</p>
          <span className="mt-4 block h-2 overflow-hidden rounded-full bg-white/20">
            <span className="block h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${Math.round(paidShare * 100)}%` }} />
          </span>
          <p className="mt-3 text-sm opacity-90">
            {toCome === 0 ? 'Nothing waiting. Every finished shift is paid.' : `${usd(toCome)} still to come for finished shifts.`}
          </p>
        </div>
      </section>

      {next && (
        <section className="rise-in px-5 pt-5">
          <div className="glass flex items-center gap-3 rounded-2xl p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-300" aria-hidden>
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </span>
            <span className="min-w-0 flex-1 text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wide text-amber-300">Next shift, {untilStart(next.start, now)}</span>
              <span className="block truncate font-semibold">
                {next.skill} · {next.job}
              </span>
              <span className="block text-white/55">{dayAndHours(next)}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums">{usd(shiftPay(next, worker))}</span>
          </div>
        </section>
      )}

      <Group title="On its way" shifts={onItsWay} render={(shift) => <Row key={shift.id} shift={shift} right={usd(shift.payment?.amount ?? 0)} note="PayPal is processing it" tone="paying" />} />
      <Group title="Waiting for approval" shifts={waiting} render={(shift) => <Row key={shift.id} shift={shift} right={usd(shiftPay(shift, worker))} note={`${shiftHours(shift)} h at $${worker.hourlyRate}`} tone="waiting" />} />
      <Group
        title="Paid"
        shifts={paid}
        render={(shift) => {
          const entry = ledger.find((e) => e.shiftId === shift.id);
          return <Row key={shift.id} shift={shift} right={usd(shift.payment?.amount ?? 0)} note={entry ? `Paid at ${sentAt(entry.sentAt)}${entry.transactionId ? ` · PayPal ${entry.transactionId}` : ''}` : 'Paid'} tone="paid" />;
        }}
      />
      <Group title="Coming up" shifts={later} render={(shift) => <Row key={shift.id} shift={shift} right={usd(shiftPay(shift, worker))} note={shift.why} tone="upcoming" />} />
      </div>
    </div>
  );
}

const sumPay = (shifts: Shift[], hourlyRate: number) => shifts.reduce((sum, shift) => sum + shiftPay(shift, { hourlyRate }), 0);

function Group({ title, shifts, render }: { title: string; shifts: Shift[]; render: (shift: Shift) => React.ReactNode }) {
  if (shifts.length === 0) return null;
  return (
    <section className="px-5 pt-6">
      <h2 className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-white/50">
        {title}
        <span className="rounded-full bg-white/10 px-2 py-0.5 tabular-nums">{shifts.length}</span>
      </h2>
      <ul className="glass mt-2 divide-y divide-white/10 overflow-hidden rounded-2xl">{shifts.map(render)}</ul>
    </section>
  );
}

const TONES = {
  paid: { mark: '✓', className: 'bg-emerald-400/15 text-emerald-300' },
  paying: { mark: '↗', className: 'bg-sky-400/15 text-sky-300' },
  waiting: { mark: '…', className: 'bg-amber-400/15 text-amber-300' },
  upcoming: { mark: '•', className: 'bg-white/10 text-white/60' },
} as const;

function Row({ shift, right, note, tone }: { shift: Shift; right: string; note?: string; tone: keyof typeof TONES }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3 text-sm">
      <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg text-sm font-bold ${TONES[tone].className}`} aria-hidden>
        {TONES[tone].mark}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">
          {shift.skill} · {shift.job}
        </span>
        <span className="block text-white/55">{dayAndHours(shift)}</span>
        {note && <span className="mt-0.5 block break-words text-xs text-white/45">{note}</span>}
      </span>
      <span className={`shrink-0 font-semibold tabular-nums ${tone === 'paid' ? 'text-emerald-300' : ''}`}>{right}</span>
    </li>
  );
}
