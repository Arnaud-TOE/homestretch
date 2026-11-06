'use client';

import { useEffect, useRef, useState } from 'react';
import { Logo } from '@/components/logo';
import { BUSINESS, demoSchedule, WORKERS } from '@/lib/schedule/demo';
import { shiftHours, shiftPay, shiftState } from '@/lib/schedule/rules';
import { loadSaved, onSavedChange, withPayments, type LedgerEntry } from '@/lib/schedule/saved';
import type { Shift } from '@/lib/schedule/types';
import { dayKey, wallClock } from '@/lib/schedule/wall-clock';

const usd = (amount: number) => `$${amount.toFixed(2)}`;

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
  const first = worker.name.split(' ')[0];

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-[var(--paper)] pb-10 text-[var(--ink)]">
      {arrival && (
        <div className="phone-notice fixed inset-x-3 top-3 z-20 mx-auto flex max-w-[26rem] items-start gap-3 rounded-2xl border border-[var(--line)] bg-white p-3 shadow-xl" role="status">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--brand)] text-sm font-bold text-white">$</span>
          <span className="min-w-0 text-sm">
            <span className="block font-semibold">You just got {usd(arrival.amount)}</span>
            <span className="block text-[var(--muted)]">
              From {BUSINESS} through PayPal, for {arrival.job}.
            </span>
          </span>
        </div>
      )}

      <header className="flex items-center gap-2 px-5 pt-5 text-sm text-[var(--muted)]">
        <Logo className="size-5" />
        Homestretch
        <span className="ml-auto text-xs">Sandbox demo</span>
      </header>

      <section className="px-5 pt-6">
        <p className="font-display text-2xl font-semibold tracking-tight">Hi {first}</p>
        <div className="mt-4 rounded-2xl bg-[var(--brand)] p-5 text-white">
          <p className="text-sm opacity-85">Paid by {BUSINESS}</p>
          <p className="mt-1 font-display text-4xl font-semibold tabular-nums">{usd(paidTotal)}</p>
          <p className="mt-2 text-sm opacity-85">
            {waiting.length + onItsWay.length === 0 ? 'Nothing waiting.' : `${usd(sumPay(waiting.concat(onItsWay), worker.hourlyRate))} still to come for finished shifts.`}
          </p>
        </div>
      </section>

      <Group title="On its way" shifts={onItsWay} render={(shift) => <Row key={shift.id} shift={shift} right={usd(shift.payment?.amount ?? 0)} note="PayPal is processing it" />} />
      <Group title="Waiting for approval" shifts={waiting} render={(shift) => <Row key={shift.id} shift={shift} right={usd(shiftPay(shift, worker))} note={`${shiftHours(shift)} h at $${worker.hourlyRate}`} />} />
      <Group
        title="Paid"
        shifts={paid}
        render={(shift) => {
          const entry = ledger.find((e) => e.shiftId === shift.id);
          return <Row key={shift.id} shift={shift} right={usd(shift.payment?.amount ?? 0)} note={entry ? `Paid at ${sentAt(entry.sentAt)}${entry.transactionId ? ` · PayPal ${entry.transactionId}` : ''}` : 'Paid'} tone="paid" />;
        }}
      />
      <Group title="Coming up" shifts={upcoming} render={(shift) => <Row key={shift.id} shift={shift} right={usd(shiftPay(shift, worker))} note={shift.why} />} />
    </div>
  );
}

const sumPay = (shifts: Shift[], hourlyRate: number) => shifts.reduce((sum, shift) => sum + shiftPay(shift, { hourlyRate }), 0);

function Group({ title, shifts, render }: { title: string; shifts: Shift[]; render: (shift: Shift) => React.ReactNode }) {
  if (shifts.length === 0) return null;
  return (
    <section className="px-5 pt-6">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{title}</h2>
      <ul className="mt-2 divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)] bg-white">{shifts.map(render)}</ul>
    </section>
  );
}

function Row({ shift, right, note, tone }: { shift: Shift; right: string; note?: string; tone?: 'paid' }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3 text-sm">
      <span className="min-w-0 flex-1">
        <span className="block font-medium">
          {shift.skill} · {shift.job}
        </span>
        <span className="block text-[var(--muted)]">{dayAndHours(shift)}</span>
        {note && <span className="mt-0.5 block break-words text-xs text-[var(--muted)]">{note}</span>}
      </span>
      <span className={`shrink-0 font-semibold tabular-nums ${tone === 'paid' ? 'text-emerald-700' : ''}`}>{right}</span>
    </li>
  );
}
