'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { BUSINESS } from '@/lib/schedule/demo';
import { Logo } from '@/components/logo';
import { Board, type Notice } from './board';
import { PayPanel } from './pay-panel';

const ShiftScheduler = dynamic(() => import('./shift-scheduler'), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-[var(--muted)]">Loading the schedule…</div>,
});

const usd = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: amount % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;

export default function ScheduleApp() {
  const [board] = useState(() => new Board());
  const view = useSyncExternalStore(board.subscribe, board.getView, board.getView);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [panelOpen, setPanelOpen] = useState(true);
  const [tab, setTab] = useState<'ready' | 'ledger'>('ready');
  // The assistant's panel lives beside the schedule, so the Scheduler needs this element when it starts.
  const [dock, setDock] = useState<HTMLElement | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(true);

  const addNotice = useCallback((notice: Notice) => {
    setNotices((current) => [...current.slice(-3), notice]);
    setTimeout(() => setNotices((current) => current.filter((n) => n.id !== notice.id)), 6000);
  }, []);

  useEffect(() => board.onNotice(addNotice), [board, addNotice]);
  useEffect(
    () =>
      board.onShowPayments(() => {
        setPanelOpen(true);
        setTab('ready');
      }),
    [board],
  );

  const pay = useCallback((shiftId: string) => void board.approveAndPay([shiftId]), [board]);
  const say = useCallback((text: string) => addNotice({ id: Date.now(), tone: 'info', text }), [addNotice]);

  const paidToday = view.ledger.filter((entry) => entry.status === 'SUCCESS' && entry.sentAt.slice(0, 10) === new Date().toISOString().slice(0, 10));

  return (
    <div className="flex h-dvh flex-col bg-[var(--paper)] text-[var(--ink)]">
      <header className="flex h-14 shrink-0 items-center gap-6 border-b border-[var(--line)] bg-white px-4">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
          <Logo className="size-6" />
          Homestretch
        </Link>
        <span className="text-sm text-[var(--muted)]">{BUSINESS}</span>
        <dl className="ml-auto flex items-center gap-6 text-sm">
          <Stat label="Open shifts" value={String(view.open)} />
          <Stat label="To approve" value={usd(view.readyTotal)} tone={view.readyTotal > 0 ? 'amber' : undefined} />
          <Stat label="Paid today" value={usd(paidToday.reduce((sum, entry) => sum + entry.amount, 0))} tone={paidToday.length > 0 ? 'green' : undefined} />
        </dl>
        <span className="rounded-full border border-[var(--line)] px-2.5 py-1 text-xs text-[var(--muted)]" title="Every payment here runs on the PayPal sandbox. No real money moves.">
          PayPal sandbox
        </span>
        <button type="button" onClick={() => board.reset()} className="rounded-md px-2 py-1 text-sm text-[var(--muted)] hover:bg-[var(--wash)] hover:text-[var(--ink)]">
          Reset demo
        </button>
        <button
          type="button"
          onClick={() => setAssistantOpen((value) => !value)}
          aria-pressed={assistantOpen}
          className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${assistantOpen ? 'border-[var(--line)] bg-[var(--wash)]' : 'border-[var(--brand)] text-[var(--brand)]'}`}
        >
          Assistant
        </button>
      </header>

      <main className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">{dock && <ShiftScheduler board={board} dock={dock} onPay={pay} onNotify={say} />}</div>
        <aside ref={setDock} className={`chat-dock w-[22rem] shrink-0 border-l border-[var(--line)] bg-white ${assistantOpen ? '' : 'hidden'}`} aria-label="Assistant" />
      </main>

      <PayPanel board={board} view={view} open={panelOpen} onToggle={() => setPanelOpen((value) => !value)} tab={tab} onTab={setTab} />

      <div className="pointer-events-none fixed bottom-4 left-4 z-50 flex w-96 flex-col gap-2" role="status" aria-live="polite">
        {notices.map((notice) => (
          <div
            key={notice.id}
            className={`notice rounded-lg border px-4 py-3 text-sm shadow-lg ${
              notice.tone === 'paid' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : notice.tone === 'error' ? 'border-red-200 bg-red-50 text-red-900' : 'border-[var(--line)] bg-white'
            }`}
          >
            {notice.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'amber' | 'green' }) {
  const color = tone === 'amber' ? 'text-amber-700' : tone === 'green' ? 'text-emerald-700' : '';
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className={`font-semibold tabular-nums ${color}`}>{value}</dd>
    </div>
  );
}
