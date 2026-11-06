'use client';

import dynamic from 'next/dynamic';

// The board reads the browser's clock and storage, so it only ever runs there.
const ScheduleApp = dynamic(() => import('./schedule-app'), {
  ssr: false,
  loading: () => <div className="grid h-dvh place-items-center text-sm text-[var(--muted)]">Loading the schedule…</div>,
});

export function ScheduleLoader() {
  return <ScheduleApp />;
}
