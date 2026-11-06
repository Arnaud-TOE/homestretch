import Link from 'next/link';

export default function Home() {
  return (
    <main className="grid min-h-dvh place-items-center">
      <Link href="/schedule" className="font-display text-2xl">
        Open the schedule
      </Link>
    </main>
  );
}
