'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { CommandButton, CommandPalette, type Command } from '@/components/command-palette';
import { BUSINESS, WORKERS } from '@/lib/schedule/demo';
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

  // The command palette (Ctrl K): ask the assistant, open the payments, or go somewhere.
  const router = useRouter();
  const [askAssistant, setAskAssistant] = useState<((text: string) => void) | null>(null);
  const onAskReady = useCallback((ask: (text: string) => void) => setAskAssistant(() => ask), []);
  const ask = (text: string) => {
    setAssistantOpen(true);
    requestAnimationFrame(() => askAssistant?.(text));
  };
  const showPayments = (next: 'ready' | 'ledger') => {
    setPanelOpen(true);
    setTab(next);
  };
  const commands: Command[] = [
    ...['Staff the Rivera wedding', 'Lena is out sick tomorrow. Fix it.', 'Who is waiting to be paid?', 'We just booked a dinner on Friday. One cook, two servers.'].map((prompt) => ({
      id: `ask-${prompt}`,
      group: 'Ask the assistant',
      label: prompt,
      hint: 'AI',
      icon: '✦',
      run: () => ask(prompt),
    })),
    {
      id: 'ready',
      group: 'Payments',
      label: view.ready.length ? `Shifts ready to pay (${view.ready.length}, ${usd(view.readyTotal)})` : 'Shifts ready to pay',
      icon: '$',
      keywords: 'approve payouts',
      run: () => showPayments('ready'),
    },
    ...(view.ready.length > 1
      ? [
          {
            id: 'approve-all',
            group: 'Payments',
            label: `Approve all: ${usd(view.readyTotal)}`,
            hint: 'Asks first',
            icon: '✓',
            keywords: 'pay everyone payouts',
            // Presses the panel's own button, so its confirmation still comes first.
            run: () => {
              showPayments('ready');
              setTimeout(() => document.querySelector<HTMLButtonElement>('.approve-all')?.click(), 200);
            },
          },
        ]
      : []),
    { id: 'ledger', group: 'Payments', label: 'PayPal ledger', icon: '≡', keywords: 'payouts status fees batch', run: () => showPayments('ledger') },
    ...WORKERS.map((worker) => ({
      id: `phone-${worker.id}`,
      group: 'Crew phones',
      label: `${worker.name}'s phone`,
      hint: 'New tab',
      icon: '◱',
      keywords: worker.skills.join(' '),
      run: () => window.open(`/crew/${worker.id}`, '_blank'),
    })),
    { id: 'assistant', group: 'View', label: assistantOpen ? 'Hide the assistant' : 'Show the assistant', icon: '✦', run: () => setAssistantOpen((value) => !value) },
    { id: 'reset', group: 'View', label: 'Reset the demo', icon: '↺', run: () => board.reset() },
    { id: 'home', group: 'View', label: 'Front page', icon: '⌂', run: () => router.push('/') },
  ];

  const paidToday = view.ledger.filter((entry) => entry.status === 'SUCCESS' && entry.sentAt.slice(0, 10) === new Date().toISOString().slice(0, 10));

  return (
    <div className="app-frame flex h-dvh flex-col text-[var(--ink)]">
      <p className="bg-amber-50 px-4 py-2 text-sm text-amber-900 lg:hidden">This schedule is built for a bigger screen. On a phone, try the <Link className="underline" href="/crew/theo">worker&rsquo;s view</Link>.</p>
      <header className="relative z-10 flex h-14 shrink-0 items-center gap-4 overflow-x-auto px-4 text-white">
        <span className="brand-strip" aria-hidden />
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
          <Logo className="size-6 drop-shadow-[0_0_12px_rgb(16_185_129_/_0.55)]" />
          Homestretch
        </Link>
        <span className="hidden whitespace-nowrap text-sm text-white/50 2xl:inline">{BUSINESS}</span>
        <CommandButton label="Ask or act" className="hidden md:inline-flex" />
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
        <span className="live-pill" title="Every payment here runs on the PayPal sandbox. No real money moves.">
          PayPal sandbox
        </span>
        <button type="button" onClick={() => board.reset()} className="whitespace-nowrap rounded-md px-2 py-1 text-sm text-white/60 hover:bg-white/10 hover:text-white">
          Reset demo
        </button>
        <button
          type="button"
          onClick={() => setAssistantOpen((value) => !value)}
          aria-pressed={assistantOpen}
          className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${assistantOpen ? 'border-white/15 bg-white/10 text-white' : 'assistant-glow border-transparent text-white'}`}
        >
          Assistant
        </button>
      </header>

      <main className="flex min-h-0 flex-1 gap-2 px-2 pb-2">
        <div className="app-panel flex min-w-0 flex-1 flex-col bg-white">
          <div className="relative min-h-0 flex-1">{dock && <ShiftScheduler board={board} dock={dock} onPay={pay} onNotify={say} onAskReady={onAskReady} />}</div>
          <PayPanel board={board} view={view} open={panelOpen} onToggle={() => setPanelOpen((value) => !value)} tab={tab} onTab={setTab} />
        </div>
        <aside ref={setDock} className={`chat-dock app-panel w-80 shrink-0 bg-white ${assistantOpen ? '' : 'hidden'}`} aria-label="Assistant" />
      </main>
      <CommandPalette commands={commands} placeholder="Ask the assistant, or open the payments…" />

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
  const color = tone === 'amber' ? 'text-amber-300' : tone === 'green' ? 'text-emerald-300' : 'text-white';
  const pill = tone === 'amber' ? 'border-amber-300/35 bg-amber-400/10' : tone === 'green' ? 'border-emerald-300/35 bg-emerald-400/10' : 'border-white/12 bg-white/5';
  return (
    <div className={`flex items-baseline gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 ${pill}`} title={title}>
      <dt className="text-white/50">{label}</dt>
      <dd className={`font-semibold tabular-nums ${color}`}>{value}</dd>
    </div>
  );
}
