import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { HeroVideo } from '@/components/hero-video';
import { ArrowIcon, CalendarIcon, HandIcon, LockIcon, PayIcon, RepairIcon, RuleIcon } from '@/components/icons';
import { Reveal } from '@/components/reveal';
import { WarmUpSchedule } from './warm-up-schedule';

export const metadata: Metadata = {
  title: 'Homestretch: clock out, get paid',
};

const STEPS = [
  {
    icon: CalendarIcon,
    title: 'The assistant builds the week',
    text: 'Say what you booked. It adds the job and staffs it fairly, within everyone’s skills, availability, rest and weekly hours. You watch each shift land on the schedule.',
  },
  {
    icon: RepairIcon,
    title: 'Someone calls in sick',
    text: 'Tell it who is out. It repairs the schedule with the fewest moves it can find, explains each one and leaves everything else alone. Pinned shifts stay put.',
  },
  {
    icon: PayIcon,
    title: 'You approve. PayPal pays.',
    text: 'When a shift ends it waits for your click. Approve it and PayPal Payouts sends the money right then. The worker sees it on their phone, and the ledger shows PayPal’s own status and fee.',
  },
];

const GUARDS = [
  { icon: RuleIcon, title: 'Rules it can’t bend', text: 'The model only gets tools that enforce the rules. A move that breaks one is refused, with the reason.' },
  { icon: HandIcon, title: 'No tool that pays', text: 'Only a person’s click reaches PayPal. The assistant can say who is waiting, never send the money.' },
  { icon: LockIcon, title: 'Amounts from the server', text: 'The server sets every amount from its own rates. The browser can’t name a price or a recipient.' },
];

const STACK = [
  ['PayPal Payouts', 'One approval, one batch. Status and fees come back from PayPal.'],
  ['PayPal Balances', 'The assistant knows whether the balance covers what’s waiting.'],
  ['Bryntum Scheduler', 'The schedule, and the AI panel the assistant lives in, with undo.'],
  ['AG Grid', 'The ledger of every payment.'],
  ['OpenAI', 'The model behind the assistant, through a server proxy that holds the key.'],
];

export default function Home() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-[var(--line)]/70 bg-[var(--paper)]/80 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center gap-2 px-6 py-3">
          <Logo className="size-7" />
          <span className="font-display text-lg font-semibold tracking-tight">Homestretch</span>
          <a href="#how" className="ml-auto hidden rounded-lg px-3 py-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)] sm:block">
            How it works
          </a>
          <Link href="/crew/lena" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)] sm:block">
            A worker&rsquo;s phone
          </Link>
          <Link href="/schedule" className="ml-auto rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-dark)] sm:ml-2">
            Open the schedule
          </Link>
        </nav>
      </header>

      <WarmUpSchedule />
      <main>
        {/* Hero */}
        <section className="shift-hero relative overflow-hidden">
          <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-12 md:pt-20">
            <p className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/80 px-3.5 py-1.5 text-xs font-semibold shadow-sm">
              <span className="live-dot" aria-hidden />
              For small teams paid by the hour
            </p>
            <h1 className="mt-6 max-w-4xl font-display text-6xl font-bold leading-[0.98] tracking-tight md:text-8xl">
              Clock out. <span className="brand-gradient">Get paid.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
              Homestretch is a shift schedule with an assistant inside. It staffs the week and repairs it when someone is out. When a shift ends, you
              approve it and PayPal pays that person, right then, instead of two weeks later.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/schedule"
                className="group inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-6 py-3.5 font-semibold text-white shadow-lg shadow-[var(--brand)]/25 transition hover:-translate-y-0.5 hover:bg-[var(--brand-dark)]"
              >
                Open the schedule
                <ArrowIcon className="size-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link href="/crew/lena" className="rounded-xl border border-[var(--line)] bg-white px-6 py-3.5 font-semibold transition hover:-translate-y-0.5 hover:bg-[var(--wash)]">
                See a worker&rsquo;s phone
              </Link>
            </div>
            <p className="mt-4 text-xs text-[var(--muted)]">Runs on the PayPal sandbox. No real money moves, and the crew is fictional.</p>

            <div className="relative mt-14">
              <Link href="/schedule" className="browser-frame block" aria-label="Open the schedule">
                <span className="browser-bar" aria-hidden>
                  <i />
                  <i />
                  <i />
                  <span className="browser-url">homestretch-three.vercel.app/schedule</span>
                </span>
                <HeroVideo />
              </Link>
              <div className="float-chip float-a left-[-2.5rem] top-24" aria-hidden>
                <span className="chip-icon bg-amber-100 text-amber-700">⏱</span>
                <span>
                  <b>Shift over: Lena, 6 h</b>
                  <br />
                  $144.00 ready for your approval
                </span>
              </div>
              <div className="float-chip float-b right-[-2.5rem] top-[40%]" aria-hidden>
                <span className="chip-icon bg-emerald-100 text-emerald-700">✓</span>
                <span>
                  <b>Paid through PayPal</b>
                  <br />
                  Status SUCCESS, fee and IDs in the ledger
                </span>
              </div>
              <div className="float-chip float-c bottom-12 left-[12%]" aria-hidden>
                <span className="chip-icon bg-[var(--wash)] text-[var(--brand)]">↻</span>
                <span>
                  <b>Lena is out sick</b>
                  <br />
                  Two shifts moved, the rest stayed put
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* The problem */}
        <section className="border-y border-[var(--line)] bg-white">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-14 md:grid-cols-3">
            <Fact figure="61%" text="of hourly workers skipped meals in the past year to cover expenses." />
            <Fact figure="77%" text="have less than $500 in emergency savings." delay={90} />
            <Fact figure="63%" text="would rather be paid weekly or on demand." delay={180} />
          </div>
          <p className="mx-auto max-w-6xl px-6 pb-8 text-xs text-[var(--muted)]">Source: Branch, seventh annual report on hourly workers, December 2025, with more than 2,300 respondents.</p>
        </section>

        {/* Payday, compared */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-widest text-[var(--brand)]">Payday</p>
            <h2 className="mt-3 max-w-2xl font-display text-4xl font-bold tracking-tight md:text-5xl">From two weeks to the end of the shift.</h2>
          </Reveal>
          <div className="mt-10 space-y-5">
            <Reveal>
              <div className="rounded-2xl border border-[var(--line)] bg-white p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">A usual payroll</p>
                  <p className="text-sm text-[var(--muted)]">Shift ends, then up to 14 days of waiting</p>
                </div>
                <div className="mt-4 flex h-10 overflow-hidden rounded-xl text-xs font-semibold">
                  <span className="grid w-[8%] place-items-center bg-[var(--wash)]">Shift</span>
                  <span className="grow-bar grid flex-1 place-items-center bg-[repeating-linear-gradient(135deg,#f3efe8,#f3efe8_8px,#ebe5da_8px,#ebe5da_16px)] text-[var(--muted)]">
                    waiting for payday
                  </span>
                  <span className="grid w-[10%] place-items-center bg-slate-300">Paid</span>
                </div>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="rounded-2xl border border-[var(--brand)]/30 bg-white p-6 shadow-lg shadow-[var(--brand)]/10">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-[var(--brand)]">With Homestretch</p>
                  <p className="text-sm text-[var(--muted)]">Shift ends, you approve, PayPal answers in about 20 seconds in the sandbox</p>
                </div>
                <div className="mt-4 flex h-10 overflow-hidden rounded-xl text-xs font-semibold">
                  <span className="grid w-[8%] place-items-center bg-[var(--wash)]">Shift</span>
                  <span className="grow-bar grid w-[14%] place-items-center bg-[var(--brand)] text-white">Paid</span>
                  <span className="grid flex-1 place-items-center text-[var(--muted)]">the rest of the two weeks is theirs</span>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 bg-[var(--wash)]/60 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <Reveal>
              <p className="text-sm font-semibold uppercase tracking-widest text-[var(--brand)]">How it works</p>
              <h2 className="mt-3 max-w-2xl font-display text-4xl font-bold tracking-tight md:text-5xl">An assistant that drives the schedule.</h2>
            </Reveal>
            <ol className="mt-12 grid gap-5 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <Reveal key={step.title} delay={index * 110}>
                  <li className="card-lift h-full rounded-2xl border border-[var(--line)] bg-white p-7">
                    <div className="flex items-center justify-between">
                      <span className="grid size-12 place-items-center rounded-2xl bg-emerald-50 text-[var(--brand)]">
                        <step.icon className="size-6" />
                      </span>
                      <span className="font-display text-5xl font-bold text-[var(--line)]">{index + 1}</span>
                    </div>
                    <h3 className="mt-6 font-display text-xl font-semibold">{step.title}</h3>
                    <p className="mt-2 leading-relaxed text-[var(--muted)]">{step.text}</p>
                  </li>
                </Reveal>
              ))}
            </ol>
            <Reveal className="mt-10">
              <p className="text-sm text-[var(--muted)]">Ask it in the schedule:</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {['Staff the Rivera wedding', 'Lena is out sick tomorrow. Fix it.', 'Who is waiting to be paid?'].map((prompt) => (
                  <span key={prompt} className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm">
                    &ldquo;{prompt}&rdquo;
                  </span>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* Guards */}
        <section className="bg-[#10261f] text-white">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <Reveal>
              <h2 className="max-w-3xl font-display text-4xl font-bold tracking-tight md:text-5xl">The assistant works. A person pays.</h2>
            </Reveal>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {GUARDS.map((guard, i) => (
                <Reveal key={guard.title} delay={i * 110}>
                  <span className="grid size-12 place-items-center rounded-2xl bg-white/10 text-emerald-300">
                    <guard.icon className="size-6" />
                  </span>
                  <h3 className="mt-5 font-display text-xl font-semibold">{guard.title}</h3>
                  <p className="mt-2 leading-relaxed text-white/75">{guard.text}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Built with */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <Reveal>
            <h2 className="font-display text-4xl font-bold tracking-tight">Built with</h2>
            <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {STACK.map(([name, role]) => (
                <div key={name} className="card-lift rounded-2xl border border-[var(--line)] bg-white px-5 py-4">
                  <dt className="font-semibold">{name}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{role}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </section>

        {/* Closing call */}
        <section className="px-6 pb-20">
          <Reveal>
            <div className="shift-cta mx-auto max-w-6xl overflow-hidden rounded-[2rem] px-8 py-16 text-center text-white">
              <h2 className="mx-auto max-w-2xl font-display text-4xl font-bold tracking-tight md:text-5xl">Approve a shift. Watch PayPal pay it.</h2>
              <p className="mx-auto mt-4 max-w-xl text-white/80">Finished shifts are waiting at Juniper &amp; Rye. Open the schedule, ask the assistant, then approve one.</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/schedule" className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 font-semibold text-[var(--brand-dark)] transition hover:-translate-y-0.5">
                  Open the schedule
                  <ArrowIcon className="size-4" />
                </Link>
                <Link href="/crew/lena" className="rounded-xl border border-white/40 px-6 py-3.5 font-semibold transition hover:bg-white/10">
                  See Lena&rsquo;s phone
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-[var(--muted)]">
          <span className="flex items-center gap-2">
            <Logo className="size-5" />
            A demo built for the PayPal AI Hackathon. Juniper &amp; Rye Catering and its crew are fictional.
          </span>
          <a href="https://github.com/Arnaud-TOE/homestretch" className="font-semibold text-[var(--brand)] hover:underline">
            Source on GitHub, MIT license
          </a>
        </div>
      </footer>
    </div>
  );
}

function Fact({ figure, text, delay = 0 }: { figure: string; text: string; delay?: number }) {
  return (
    <Reveal delay={delay}>
      <p className="font-display text-6xl font-bold tracking-tight text-[var(--brand)]">{figure}</p>
      <p className="mt-2 leading-relaxed text-[var(--muted)]">{text}</p>
    </Reveal>
  );
}
