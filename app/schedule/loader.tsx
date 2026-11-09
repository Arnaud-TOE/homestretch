'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useSyncExternalStore, type CSSProperties } from 'react';
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
const PHONE_NIGHT = { '--night': '#06110e', '--glow-a': '#10b981', '--glow-b': '#f59e0b', '--glow-c': '#22d3ee' } as CSSProperties;

function PhoneNotice() {
  return (
    <main className="night grain flex min-h-dvh flex-col items-center justify-center overflow-hidden p-6 text-center" style={PHONE_NIGHT}>
      <div className="aurora" aria-hidden>
        <i />
        <i />
        <i />
      </div>
      <Logo className="size-10 drop-shadow-[0_0_14px_rgb(16_185_129_/_0.6)]" />
      <h1 className="text-balance mt-4 font-display text-3xl font-bold tracking-tight">The schedule needs a bigger screen</h1>
      <p className="mt-3 max-w-sm text-white/65">Open this page on a laptop to staff the week and talk to the assistant. On a phone, see what a worker sees.</p>
      <Image src="/app.png" width={2880} height={1800} sizes="100vw" alt="The Homestretch schedule: a crew of eight, shifts on a timeline and an assistant panel" className="mt-6 w-full max-w-md rounded-xl ring-1 ring-white/15 shadow-2xl shadow-emerald-500/20" />
      <Link href="/crew/theo" className="btn-glow mt-7 rounded-full px-6 py-3 font-bold">
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
