import type { Metadata } from 'next';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { Logo } from '@/components/logo';
import { HeroVideo } from '@/components/hero-video';
import { CountUp, Marquee, Spot } from '@/components/fx';
import { ArrowIcon, CalendarIcon, HandIcon, LockIcon, PayIcon, RepairIcon, RuleIcon } from '@/components/icons';
import { Reveal } from '@/components/reveal';
import { WarmUpSchedule } from './warm-up-schedule';

export const metadata: Metadata = {
  title: 'Homestretch: clock out, get paid',
};

// The front door, as a night page in Homestretch's green with an amber glow (app/fx.css).
const NIGHT = {
  '--night': '#06110e',
  '--glow-a': '#10b981',
  '--glow-b': '#f59e0b',
  '--glow-c': '#22d3ee',
} as CSSProperties;

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

const STACK = ['PayPal Payouts', 'PayPal Balances', 'Bryntum Scheduler', 'Bryntum AI panel', 'AG Grid', 'OpenAI GPT-5.4 mini', 'Next.js 16', 'Tailwind CSS'];

export default function Home() {
  return (
    <div className="night min-h-dvh" style={NIGHT}>
      <header className="sticky top-0 z-40 border-b hairline bg-[#06110e]/70 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-6xl items-center gap-2 px-6 py-3">
          <Logo className="size-7" />
          <span className="font-display text-lg font-semibold tracking-tight">Homestretch</span>
          <a href="#how" className="ml-auto hidden rounded-lg px-3 py-2 text-sm font-semibold text-white/60 transition hover:text-white sm:block">
            How it works
          </a>
          <a href="#payday" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-white/60 transition hover:text-white md:block">
            Payday
          </a>
          <Link href="/crew/lena" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-white/60 transition hover:text-white sm:block">
            A worker&rsquo;s phone
          </Link>
          <Link href="/schedule" className="btn-glow ml-auto rounded-full px-4 py-2 text-sm font-bold sm:ml-2">
            Open the schedule
          </Link>
        </nav>
      </header>

      <WarmUpSchedule />
      <main>
        {/* Hero */}
        <section className="grain relative overflow-hidden">
          <div className="aurora" aria-hidden>
            <i />
            <i />
            <i />
          </div>
          <div className="grid-lines" aria-hidden />
          <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-14 md:pt-24">
            <p className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white/80">
              <span className="live-dot" aria-hidden />
              For small teams paid by the hour
            </p>
            <h1 className="mt-7 max-w-4xl font-display text-7xl font-bold leading-[0.92] tracking-[-0.04em] md:text-[8.5rem]">
              Clock out.
              <br />
              <span className="shimmer-text">Get paid.</span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-relaxed text-white/65">
              Homestretch is a shift schedule with an assistant inside. It staffs the week and repairs it when someone is out. When a shift ends, you approve it and PayPal
              pays that person, right then, instead of two weeks later.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/schedule" className="btn-glow group inline-flex items-center gap-2 rounded-full px-7 py-3.5 font-bold">
                Open the schedule
                <ArrowIcon className="size-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link href="/crew/lena" className="btn-ghost rounded-full px-7 py-3.5 font-bold">
                See a worker&rsquo;s phone
              </Link>
            </div>
            <p className="mt-4 text-xs text-white/45">Runs on the PayPal sandbox. No real money moves, and the crew is fictional.</p>

            <div className="relative mt-16">
              <div className="glow-under" aria-hidden />
              <div className="tilt-in">
                <Link href="/schedule" className="beam block overflow-hidden rounded-[1.4rem] p-1.5" aria-label="Open the schedule">
                  <span className="block overflow-hidden rounded-[1.05rem] bg-white">
                    <span className="browser-bar" aria-hidden>
                      <i />
                      <i />
                      <i />
                      <span className="browser-url">homestretch-three.vercel.app/schedule</span>
                    </span>
                    <HeroVideo />
                  </span>
                </Link>
              </div>
              <div className="float-chip float-a left-[-3rem] top-24" aria-hidden>
                <span className="chip-icon bg-amber-100 text-amber-700">⏱</span>
                <span>
                  <b>Shift over: Lena, 6 h</b>
                  <br />
                  $144.00 ready for your approval
                </span>
              </div>
              <div className="float-chip float-b right-[-3rem] top-[40%]" aria-hidden>
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

        <section className="border-y hairline py-7">
          <Marquee items={STACK} />
        </section>

        {/* The problem */}
        <section className="mx-auto max-w-6xl px-6 py-24">
          <Reveal className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">The problem</p>
            <h2 className="text-balance mt-4 font-display text-4xl font-bold tracking-[-0.03em] md:text-6xl">The people who work the shift wait the longest to be paid.</h2>
          </Reveal>
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {[
              { to: 61, text: 'of hourly workers skipped meals in the past year to cover expenses.' },
              { to: 77, text: 'have less than $500 in emergency savings.' },
              { to: 63, text: 'would rather be paid weekly or on demand.' },
            ].map((fact, i) => (
              <Reveal key={fact.to} delay={i * 100}>
                <Spot className="glass h-full rounded-3xl p-8">
                  <p className="font-display text-7xl font-bold tracking-[-0.04em]">
                    <CountUp to={fact.to} suffix="%" />
                  </p>
                  <p className="mt-4 leading-relaxed text-white/60">{fact.text}</p>
                </Spot>
              </Reveal>
            ))}
          </div>
          <p className="mt-6 text-xs text-white/40">Source: Branch, seventh annual report on hourly workers, December 2025, with more than 2,300 respondents.</p>
        </section>

        {/* Payday, compared */}
        <section id="payday" className="relative scroll-mt-20 overflow-hidden border-y hairline py-24">
          <div className="aurora opacity-50" aria-hidden>
            <i />
            <i />
            <i />
          </div>
          <div className="mx-auto max-w-6xl px-6">
            <Reveal>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Payday</p>
              <h2 className="text-balance mt-4 max-w-2xl font-display text-4xl font-bold tracking-[-0.03em] md:text-6xl">From two weeks to the end of the shift.</h2>
            </Reveal>
            <div className="mt-12 space-y-4">
              <Reveal>
                <div className="glass rounded-3xl p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold">A usual payroll</p>
                    <p className="text-sm text-white/55">Shift ends, then up to 14 days of waiting</p>
                  </div>
                  <div className="mt-4 flex h-11 overflow-hidden rounded-2xl text-xs font-semibold">
                    <span className="grid w-[8%] place-items-center bg-white/15">Shift</span>
                    <span className="grow-bar grid flex-1 place-items-center bg-[repeating-linear-gradient(135deg,rgb(255_255_255/0.04),rgb(255_255_255/0.04)_8px,rgb(255_255_255/0.09)_8px,rgb(255_255_255/0.09)_16px)] text-white/50">
                      waiting for payday
                    </span>
                    <span className="grid w-[10%] place-items-center bg-white/25">Paid</span>
                  </div>
                </div>
              </Reveal>
              <Reveal delay={120}>
                <div className="beam rounded-3xl" style={{ '--beam-fill': '#0a1d17' } as CSSProperties}>
                  <div className="p-6">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-semibold text-emerald-300">With Homestretch</p>
                      <p className="text-sm text-white/55">Shift ends, you approve, PayPal answers in about 20 seconds in the sandbox</p>
                    </div>
                    <div className="mt-4 flex h-11 overflow-hidden rounded-2xl text-xs font-semibold">
                      <span className="grid w-[8%] place-items-center bg-white/15">Shift</span>
                      <span className="grow-bar grid w-[14%] place-items-center bg-gradient-to-r from-emerald-400 to-teal-300 text-emerald-950">Paid</span>
                      <span className="grid flex-1 place-items-center text-white/50">the rest of the two weeks is theirs</span>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-24">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">How it works</p>
            <h2 className="text-balance mt-4 max-w-2xl font-display text-4xl font-bold tracking-[-0.03em] md:text-6xl">An assistant that drives the schedule.</h2>
          </Reveal>
          <div role="list" className="mt-14 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <Reveal key={step.title} delay={index * 110}>
                <Spot className="glass h-full rounded-3xl p-7">
                  <div role="listitem">
                    <div className="flex items-center justify-between">
                      <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400/30 to-amber-400/20 text-emerald-200 ring-1 ring-white/15">
                        <step.icon className="size-6" />
                      </span>
                      <span className="font-display text-5xl font-bold text-white/10">{index + 1}</span>
                    </div>
                    <h3 className="mt-6 font-display text-2xl font-semibold">{step.title}</h3>
                    <p className="mt-2 leading-relaxed text-white/60">{step.text}</p>
                  </div>
                </Spot>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-10">
            <p className="text-sm text-white/55">Ask it in the schedule:</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {['Staff the Rivera wedding', 'Lena is out sick tomorrow. Fix it.', 'Who is waiting to be paid?'].map((prompt) => (
                <span key={prompt} className="glass rounded-full px-4 py-2 text-sm">
                  &ldquo;{prompt}&rdquo;
                </span>
              ))}
            </div>
          </Reveal>
        </section>

        {/* Guards */}
        <section className="border-y hairline bg-white/[0.02]">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <Reveal>
              <h2 className="text-balance max-w-3xl font-display text-4xl font-bold tracking-[-0.03em] md:text-6xl">The assistant works. A person pays.</h2>
            </Reveal>
            <div className="mt-14 grid gap-4 md:grid-cols-3">
              {GUARDS.map((guard, i) => (
                <Reveal key={guard.title} delay={i * 110}>
                  <Spot className="glass h-full rounded-3xl p-7">
                    <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400/30 to-cyan-400/20 text-emerald-200 ring-1 ring-white/15">
                      <guard.icon className="size-6" />
                    </span>
                    <h3 className="mt-6 font-display text-2xl font-semibold">{guard.title}</h3>
                    <p className="mt-2 leading-relaxed text-white/60">{guard.text}</p>
                  </Spot>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Closing call */}
        <section className="px-6 py-24">
          <Reveal>
            <div className="beam relative mx-auto max-w-6xl overflow-hidden rounded-[2.2rem]" style={{ '--beam-fill': '#0a1d17' } as CSSProperties}>
              <div className="aurora" aria-hidden>
                <i />
                <i />
                <i />
              </div>
              <div className="relative px-8 py-20 text-center">
                <h2 className="text-balance mx-auto max-w-3xl font-display text-5xl font-bold tracking-[-0.035em] md:text-6xl">Approve a shift. Watch PayPal pay it.</h2>
                <p className="mx-auto mt-5 max-w-xl text-white/65">Finished shifts are waiting at Juniper &amp; Rye. Open the schedule, ask the assistant, then approve one.</p>
                <div className="mt-9 flex flex-wrap justify-center gap-3">
                  <Link href="/schedule" className="btn-glow inline-flex items-center gap-2 rounded-full px-7 py-3.5 font-bold">
                    Open the schedule
                    <ArrowIcon className="size-4" />
                  </Link>
                  <Link href="/crew/lena" className="btn-ghost rounded-full px-7 py-3.5 font-bold">
                    See Lena&rsquo;s phone
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="overflow-hidden border-t hairline">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 pt-10 text-sm text-white/50">
          <span className="flex items-center gap-2">
            <Logo className="size-5" />
            A demo built for the PayPal AI Hackathon. Juniper &amp; Rye Catering and its crew are fictional.
          </span>
          <a href="https://github.com/Arnaud-TOE/homestretch" className="font-semibold text-emerald-300 hover:underline">
            Source on GitHub, MIT license
          </a>
        </div>
        <p className="wordmark mx-auto max-w-6xl px-6 pt-6 font-display text-[17vw] sm:text-[10.5rem]" aria-hidden>
          Homestretch
        </p>
      </footer>
    </div>
  );
}
