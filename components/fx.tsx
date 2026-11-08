'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

const prefersLessMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A card that lights up under the pointer: sets --x and --y for the .spot glow in globals.css. */
export function Spot({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={`spot ${className}`}
      onPointerMove={(event) => {
        const box = ref.current?.getBoundingClientRect();
        if (!box) return;
        ref.current!.style.setProperty('--x', `${event.clientX - box.left}px`);
        ref.current!.style.setProperty('--y', `${event.clientY - box.top}px`);
      }}
    >
      {children}
    </div>
  );
}

/**
 * A number that counts up the first time it scrolls into view. The page renders the final value, so
 * without JavaScript, or for people who prefer less motion, it is simply there.
 */
export function CountUp({ to, decimals = 0, prefix = '', suffix = '', duration = 1400 }: { to: number; decimals?: number; prefix?: string; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(to);

  useEffect(() => {
    const element = ref.current;
    if (!element || prefersLessMotion() || !('IntersectionObserver' in window)) return;
    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / duration);
          setValue(to * (1 - (1 - progress) ** 3));
          if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    // Start from zero only while it is still out of sight, so nobody sees it jump back.
    const box = element.getBoundingClientRect();
    if (box.top > window.innerHeight) frame = requestAnimationFrame(() => setValue(0));
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [to, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

/** An endless, pausable row of words: what the project is built with. */
export function Marquee({ items }: { items: string[] }) {
  const row = (hidden: boolean) => (
    <ul className="marquee-row" aria-hidden={hidden || undefined}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
  return (
    <div className="marquee">
      {row(false)}
      {row(true)}
    </div>
  );
}
