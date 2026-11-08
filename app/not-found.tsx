import Link from 'next/link';
import type { CSSProperties } from 'react';
import { Logo } from '@/components/logo';

const NIGHT = { '--night': '#06110e', '--glow-a': '#10b981', '--glow-b': '#f59e0b', '--glow-c': '#22d3ee' } as CSSProperties;

// A wrong address still lands somewhere friendly, with the way into the demo.
export default function NotFound() {
  return (
    <main className="night grain grid min-h-dvh place-items-center overflow-hidden px-6" style={NIGHT}>
      <div className="aurora" aria-hidden>
        <i />
        <i />
        <i />
      </div>
      <div className="grid-lines" aria-hidden />
      <div className="relative max-w-lg text-center">
        <Logo className="mx-auto size-14" />
        <p className="shimmer-text mt-6 font-display text-[8rem] font-bold leading-none tracking-[-0.05em]">404</p>
        <h1 className="text-balance mt-4 font-display text-4xl font-bold">Nobody is scheduled on this page.</h1>
        <p className="mt-3 text-white/60">The shifts, the assistant and the payouts are right this way.</p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href="/schedule" className="btn-glow rounded-full px-7 py-3.5 font-bold">
            Open the schedule
          </Link>
          <Link href="/" className="btn-ghost rounded-full px-7 py-3.5 font-bold">
            Front page
          </Link>
        </div>
      </div>
    </main>
  );
}
