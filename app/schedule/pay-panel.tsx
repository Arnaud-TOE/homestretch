'use client';

import { useState } from 'react';
import { shiftHours, shiftPay } from '@/lib/schedule/rules';
import type { Shift } from '@/lib/schedule/types';
import type { Board, View } from './board';
import { Ledger } from './ledger';

const usd = (amount: number) => `$${amount.toFixed(2)}`;

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', timeZone: 'UTC' });

export function PayPanel({
  board,
  view,
  open,
  onToggle,
  tab,
  onTab,
}: {
  board: Board;
  view: View;
  open: boolean;
  onToggle: () => void;
  tab: 'ready' | 'ledger';
  onTab: (tab: 'ready' | 'ledger') => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const people = new Set(view.ready.map((shift) => shift.workerId)).size;

  const choose = (next: 'ready' | 'ledger') => {
    onTab(next);
    if (!open) onToggle();
  };

  return (
    <section className="shrink-0 border-t border-[var(--line)] bg-white" aria-label="Payments">
      <div className="flex h-11 items-center gap-1 px-3">
        <TabButton active={open && tab === 'ready'} onClick={() => choose('ready')}>
          Ready to pay <Count value={view.ready.length} tone="amber" />
        </TabButton>
        <TabButton active={open && tab === 'ledger'} onClick={() => choose('ledger')}>
          PayPal ledger <Count value={view.ledger.length} />
        </TabButton>

        <div className="ml-auto flex items-center gap-3">
          {tab === 'ready' && open && view.ready.length > 1 && (
            <button type="button" className="approve-all rounded-md bg-[var(--brand)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[var(--brand-dark)]" onClick={() => setConfirming(true)}>
              Approve all: {usd(view.readyTotal)}
            </button>
          )}
          <button type="button" onClick={onToggle} className="grid size-8 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--wash)]" aria-label={open ? 'Collapse payments' : 'Expand payments'} aria-expanded={open}>
            <svg viewBox="0 0 20 20" className={`size-4 transition-transform ${open ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="m5 8 5 5 5-5" />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="h-52 overflow-auto border-t border-[var(--line)]">
          {tab === 'ready' ? <ReadyList board={board} view={view} /> : <Ledger entries={view.ledger} />}
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="w-[26rem] rounded-xl bg-white p-6 shadow-xl">
            <h2 id="confirm-title" className="font-display text-lg font-semibold">
              Pay {view.ready.length} shifts?
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {usd(view.readyTotal)} goes to {people} {people === 1 ? 'person' : 'people'} through PayPal Payouts, right now.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="rounded-md px-3 py-2 text-sm hover:bg-[var(--wash)]" onClick={() => setConfirming(false)}>
                Not yet
              </button>
              <button
                type="button"
                className="rounded-md bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-dark)]"
                onClick={() => {
                  setConfirming(false);
                  void board.approveAndPay(view.ready.map((shift) => shift.id));
                }}
              >
                Approve and pay
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium ${active ? 'bg-[var(--wash)] text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`} aria-pressed={active}>
      {children}
    </button>
  );
}

function Count({ value, tone }: { value: number; tone?: 'amber' }) {
  return <span className={`rounded-full px-1.5 text-xs tabular-nums ${tone === 'amber' && value > 0 ? 'bg-amber-100 text-amber-800' : 'bg-[var(--line)] text-[var(--muted)]'}`}>{value}</span>;
}

function ReadyList({ board, view }: { board: Board; view: View }) {
  if (view.ready.length === 0) {
    return <p className="grid h-full place-items-center text-sm text-[var(--muted)]">Nothing to approve. Finished shifts land here the moment they end.</p>;
  }
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 z-10 bg-white text-left text-xs text-[var(--muted)] shadow-[0_1px_0_var(--line)]">
        <tr>
          <th className="px-4 py-2 font-medium">Person</th>
          <th className="px-4 py-2 font-medium">Job</th>
          <th className="px-4 py-2 font-medium">Role</th>
          <th className="px-4 py-2 font-medium">Finished</th>
          <th className="px-4 py-2 text-right font-medium">Hours</th>
          <th className="px-4 py-2 text-right font-medium">Rate</th>
          <th className="px-4 py-2 text-right font-medium">Pay</th>
          <th className="px-4 py-2" />
        </tr>
      </thead>
      <tbody>
        {view.ready.map((shift) => (
          <ReadyRow key={shift.id} shift={shift} board={board} view={view} />
        ))}
      </tbody>
    </table>
  );
}

function ReadyRow({ shift, board, view }: { shift: Shift; board: Board; view: View }) {
  const worker = view.schedule.workers.find((w) => w.id === shift.workerId)!;
  return (
    <tr className="border-t border-[var(--line)] hover:bg-[var(--wash)]">
      <td className="px-4 py-1.5 font-medium">{worker.name}</td>
      <td className="px-4 py-1.5">{shift.job}</td>
      <td className="px-4 py-1.5">{shift.skill}</td>
      <td className="px-4 py-1.5 text-[var(--muted)]">{when(shift.end)}</td>
      <td className="px-4 py-1.5 text-right tabular-nums">{shiftHours(shift)}</td>
      <td className="px-4 py-1.5 text-right tabular-nums">${worker.hourlyRate}</td>
      <td className="px-4 py-1.5 text-right font-semibold tabular-nums">{usd(shiftPay(shift, worker))}</td>
      <td className="px-4 py-1.5 text-right">
        <button type="button" className="rounded-md border border-[var(--brand)] px-2.5 py-1 text-xs font-semibold text-[var(--brand)] hover:bg-[var(--brand)] hover:text-white" onClick={() => void board.approveAndPay([shift.id])} aria-label={`Approve and pay ${worker.name} for ${shift.job}`}>
          Approve and pay
        </button>
      </td>
    </tr>
  );
}
