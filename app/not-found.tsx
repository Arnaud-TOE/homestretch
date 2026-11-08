import Link from 'next/link';
import { Logo } from '@/components/logo';

// A wrong address still lands somewhere friendly, with the way into the demo.
export default function NotFound() {
  return (
    <main className="shift-hero relative grid min-h-dvh place-items-center overflow-hidden px-6">
      <div className="relative max-w-lg text-center">
        <Logo className="mx-auto size-14" />
        <p className="brand-gradient mt-6 font-display text-8xl font-bold tracking-tight">404</p>
        <h1 className="mt-3 font-display text-3xl font-bold">Nobody is scheduled on this page.</h1>
        <p className="mt-3 text-[var(--muted)]">The shifts, the assistant and the payouts are right this way.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/schedule" className="rounded-xl bg-[var(--brand)] px-6 py-3 font-semibold text-white hover:bg-[var(--brand-dark)]">
            Open the schedule
          </Link>
          <Link href="/" className="rounded-xl border border-[var(--line)] bg-white px-6 py-3 font-semibold">
            Front page
          </Link>
        </div>
      </div>
    </main>
  );
}
