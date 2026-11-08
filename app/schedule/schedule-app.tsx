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

const WELCOME_ID = 1;

function welcomeBack(board: Board): Notice {
  const { ready, ledger } = board.getView();
  const paid = ledger.filter((entry) => entry.status === 'SUCCESS').length;
  return {
    id: WELCOME_ID,
    tone: 'info',
    text:
      `Welcome back: a new day at ${BUSINESS}. ${ready.length} finished shifts wait for your approval` +
      (paid > 0 ? `, and your ${paid} earlier PayPal payments are still in the ledger.` : '.'),
  };
}

export default function ScheduleApp() {
  const [board] = useState(() => new Board());
  const view = useSyncExternalStore(board.subscribe, board.getView, board.getView);
  // Someone back on a later day is greeted with what is waiting; the week itself starts afresh each day.
  const [notices, setNotices] = useState<Notice[]>(() => (board.returning ? [welcomeBack(board)] : []));
  // On a short screen the crew comes first: the panel's tab says what is waiting.
  const [panelOpen, setPanelOpen] = useState(() => window.innerHeight >= 900);
  const [tab, setTab] = useState<'ready' | 'ledger'>('ready');
  // The assistant's panel lives beside the schedule, so the Scheduler needs this element when it starts.
  const [dock, setDock] = useState<HTMLElement | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(() => window.innerWidth >= 1100);

  const addNotice = useCallback((notice: Notice) => {
    setNotices((current) => [...current.slice(-3), notice]);
    setTimeout(() => setNotices((current) => current.filter((n) => n.id !== notice.id)), 6000);
  }, []);

  useEffect(() => board.onNotice(addNotice), [board, addNotice]);
  useEffect(() => {
    if (!board.returning) return;
    const timer = setTimeout(() => setNotices((current) => current.filter((n) => n.id !== WELCOME_ID)), 10_000);
    return () => clearTimeout(timer);
  }, [board]);
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
      <p className="bg-amber-50 px-4 py-2 text-sm text-amber-900 lg:hidden">This schedule is built for a bigger screen. On a phone, try the <Link className="underline" href="/crew/theo">worker&rsquo;s view</Link>.</p>
      <header className="relative z-10 flex h-14 shrink-0 items-center gap-6 overflow-x-auto border-b border-[var(--line)] bg-white/85 px-4 backdrop-blur-xl">
        <span className="brand-strip" aria-hidden />
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
          <Logo className="size-6" />
          Homestretch
        </Link>
        <span className="whitespace-nowrap text-sm text-[var(--muted)]">{BUSINESS}</span>
        <dl className="ml-auto flex items-center gap-2 text-sm">
          <Stat label="Open shifts" value={String(view.open)} />
          <Stat label="To approve" value={usd(view.readyTotal)} tone={view.readyTotal > 0 ? 'amber' : undefined} />
          <Stat label="Paid today" value={usd(paidToday.reduce((sum, entry) => sum + entry.amount, 0))} tone={paidToday.length > 0 ? 'green' : undefined} />
          {view.balance !== null && (
            <Stat
              label="PayPal balance"
              value={usd(view.balance)}
              title={
                view.balanceAsOf
                  ? `PayPal's figure from ${new Date(view.balanceAsOf).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}, less what was paid here since. PayPal refreshes it every few hours.`
                  : undefined
              }
            />
          )}
        </dl>
        <span className="whitespace-nowrap rounded-full border border-[var(--line)] px-2.5 py-1 text-xs text-[var(--muted)]" title="Every payment here runs on the PayPal sandbox. No real money moves.">
          PayPal sandbox
        </span>
        <button type="button" onClick={() => board.reset()} className="whitespace-nowrap rounded-md px-2 py-1 text-sm text-[var(--muted)] hover:bg-[var(--wash)] hover:text-[var(--ink)]">
          Reset demo
        </button>
        <button
          type="button"
          onClick={() => setAssistantOpen((value) => !value)}
          aria-pressed={assistantOpen}
          className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${assistantOpen ? 'border-[var(--line)] bg-[var(--wash)]' : 'assistant-glow border-transparent text-white'}`}
        >
          Assistant
        </button>
      </header>

      <main className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">{dock && <ShiftScheduler board={board} dock={dock} onPay={pay} onNotify={say} />}</div>
        <aside ref={setDock} className={`chat-dock w-80 shrink-0 border-l border-[var(--line)] bg-white ${assistantOpen ? '' : 'hidden'}`} aria-label="Assistant" />
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

function Stat({ label, value, tone, title }: { label: string; value: string; tone?: 'amber' | 'green'; title?: string }) {
  const color = tone === 'amber' ? 'text-amber-700' : tone === 'green' ? 'text-emerald-700' : '';
  const pill = tone === 'amber' ? 'border-amber-200 bg-amber-50' : tone === 'green' ? 'border-emerald-200 bg-emerald-50' : 'border-[var(--line)] bg-white/70';
  return (
    <div className={`flex items-baseline gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 ${pill}`} title={title}>
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className={`font-semibold tabular-nums ${color}`}>{value}</dd>
    </div>
  );
}
