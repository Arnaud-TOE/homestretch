'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { Logo } from '@/components/logo';

// The board reads the browser's clock and storage, so it only ever runs there.
const ScheduleApp = dynamic(() => import('./schedule-app'), {
  ssr: false,
  loading: () => <div className="grid h-dvh place-items-center text-sm text-[var(--muted)]">Loading the schedule…</div>,
});

const WIDE_ENOUGH = '(min-width: 768px)';

const watchWidth = (onChange: () => void) => {
  const query = window.matchMedia(WIDE_ENOUGH);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};

// A week of shifts needs room. A phone gets a way forward instead, without downloading the scheduler.
function PhoneNotice() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[var(--paper)] p-6 text-center text-[var(--ink)]">
      <Logo className="size-9" />
      <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">The schedule needs a bigger screen</h1>
      <p className="mt-3 max-w-sm text-[var(--muted)]">Open this page on a laptop to staff the week and talk to the assistant. On a phone, see what a worker sees.</p>
      <Image src="/app.png" width={2880} height={1800} sizes="100vw" alt="The Homestretch schedule: a crew of eight, shifts on a timeline and an assistant panel" className="mt-6 w-full max-w-md rounded-xl border border-[var(--line)]" />
      <Link href="/crew/theo" className="mt-6 rounded-lg bg-[var(--brand)] px-5 py-3 font-semibold text-white">
        See a worker&rsquo;s phone
      </Link>
    </main>
  );
}

export function ScheduleLoader() {
  const wideEnough = useSyncExternalStore(
    watchWidth,
    () => window.matchMedia(WIDE_ENOUGH).matches,
    () => true,
  );
  return wideEnough ? <ScheduleApp /> : <PhoneNotice />;
}
