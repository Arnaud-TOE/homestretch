import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Logo } from '@/components/logo';

export const metadata: Metadata = {
  title: 'Homestretch: clock out, get paid',
};

const STEPS = [
  {
    title: 'The assistant builds the week',
    text: 'Say what you booked. It adds the job and staffs it fairly, within everyone\u2019s skills, availability, rest and weekly hours. You watch each shift land on the schedule.',
  },
  {
    title: 'Someone calls in sick',
    text: 'Tell it who is out. It repairs the schedule with the fewest moves it can find, explains each one and leaves everything else alone. Pinned shifts stay put.',
  },
  {
    title: 'You approve. PayPal pays.',
    text: 'When a shift ends it waits for your click. Approve it and PayPal Payouts sends the money right then. The worker sees it on their phone, and the ledger shows PayPal\u2019s own status and fee.',
  },
];

const GUARDS = [
  'The model only gets tools that enforce the rules. A move that breaks one is refused, with the reason.',
  'It has no tool that can pay. Only a person\u2019s click reaches PayPal.',
  'The server sets every amount from its own rates. The browser can\u2019t name a price or a recipient.',
];

const STACK = [
  ['PayPal Payouts', 'One approval, one batch. Status and fees come back from PayPal.'],
  ['PayPal Balances', 'The assistant knows whether the balance covers what\u2019s waiting.'],
  ['Bryntum Scheduler', 'The schedule, and the AI panel the assistant lives in, with undo.'],
  ['AG Grid', 'The ledger of every payment.'],
  ['OpenAI', 'The model behind the assistant, through a server proxy that holds the key.'],
];

export default function Home() {
  return (
    <div className="min-h-dvh">
      <nav className="mx-auto flex max-w-6xl items-center gap-2 px-6 py-5">
        <Logo className="size-7" />
        <span className="font-display text-lg font-semibold tracking-tight">Homestretch</span>
        <Link href="/schedule" className="ml-auto rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-dark)]">
          Open the schedule
        </Link>
      </nav>

      <main>
        <section className="mx-auto max-w-6xl px-6 pb-14 pt-10 md:pt-16">
          <p className="text-sm font-semibold text-[var(--brand)]">For small teams paid by the hour</p>
          <h1 className="mt-3 max-w-3xl font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">Clock out. Get paid.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
            Homestretch is a shift schedule with an assistant inside. It staffs the week and repairs it when someone is out. When a shift ends, you approve it and PayPal pays that person, right then, instead of two weeks later.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/schedule" className="rounded-lg bg-[var(--brand)] px-5 py-3 font-semibold text-white hover:bg-[var(--brand-dark)]">
              Open the schedule
            </Link>
            <Link href="/crew/theo" className="rounded-lg border border-[var(--line)] bg-white px-5 py-3 font-semibold hover:bg-[var(--wash)]">
              See a worker&rsquo;s phone
            </Link>
          </div>
          <p className="mt-4 text-sm text-[var(--muted)]">Runs on the PayPal sandbox. No real money moves, and the crew is fictional.</p>

          <div className="mt-12 overflow-hidden rounded-2xl border border-[var(--line)] shadow-xl">
            <Image src="/app.png" alt="The Homestretch schedule: a crew of eight, shifts on a timeline, an assistant panel and finished shifts waiting for approval" width={2880} height={1800} priority className="h-auto w-full" />
          </div>
        </section>

        <section className="border-y border-[var(--line)] bg-white">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-14 md:grid-cols-3">
            <Fact figure="61%" text="of hourly workers skipped meals in the past year to cover expenses." />
            <Fact figure="77%" text="have less than $500 in emergency savings." />
            <Fact figure="63%" text="would rather be paid weekly or on demand." />
          </div>
          <p className="mx-auto max-w-6xl px-6 pb-8 text-xs text-[var(--muted)]">Source: Branch, seventh annual report on hourly workers, December 2025, with more than 2,300 respondents.</p>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="font-display text-3xl font-semibold tracking-tight">How it works</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="rounded-2xl border border-[var(--line)] bg-white p-6">
                <span className="grid size-8 place-items-center rounded-full bg-[var(--wash)] text-sm font-semibold">{index + 1}</span>
                <h3 className="mt-4 font-display text-xl font-semibold">{step.title}</h3>
                <p className="mt-2 leading-relaxed text-[var(--muted)]">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto grid max-w-6xl gap-10 px-6 pb-20 md:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight">The assistant works. A person pays.</h2>
            <ul className="mt-6 space-y-4">
              {GUARDS.map((guard) => (
                <li key={guard} className="flex gap-3 leading-relaxed">
                  <Logo className="mt-1 size-4 shrink-0" />
                  {guard}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight">Built with</h2>
            <dl className="mt-6 space-y-3">
              {STACK.map(([name, role]) => (
                <div key={name}>
                  <dt className="font-semibold">{name}</dt>
                  <dd className="text-[var(--muted)]">{role}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--line)]">
        <p className="mx-auto max-w-6xl px-6 py-6 text-sm text-[var(--muted)]">Homestretch is a demo built for the PayPal AI Hackathon. Open source under the MIT licence. Juniper &amp; Rye Catering and its crew are fictional.</p>
      </footer>
    </div>
  );
}

function Fact({ figure, text }: { figure: string; text: string }) {
  return (
    <div>
      <p className="font-display text-5xl font-semibold tracking-tight text-[var(--brand)]">{figure}</p>
      <p className="mt-2 leading-relaxed text-[var(--muted)]">{text}</p>
    </div>
  );
}
