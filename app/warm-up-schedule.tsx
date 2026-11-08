'use client';

import { useEffect } from 'react';

// The scheduler's code is about 1.4 MB, and it only starts downloading once the schedule page asks for it.
// Fetching it while the visitor reads this page makes "Open the schedule" open at once. Phones never see
// the scheduler (app/schedule/loader.tsx), so they skip this.
export function WarmUpSchedule() {
  useEffect(() => {
    if (!window.matchMedia('(min-width: 768px)').matches) return;
    const warmUp = () => {
      void import('./schedule/schedule-app');
      void import('./schedule/shift-scheduler');
    };
    if ('requestIdleCallback' in window) {
      const handle = window.requestIdleCallback(warmUp, { timeout: 4000 });
      return () => window.cancelIdleCallback(handle);
    }
    const timer = setTimeout(warmUp, 1500);
    return () => clearTimeout(timer);
  }, []);
  return null;
}
