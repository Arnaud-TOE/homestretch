import type { Metadata } from 'next';
import '@bryntum/scheduler/scheduler.css';
import '@bryntum/scheduler/svalbard-light.css';
import '@bryntum/scheduler/fontawesome/css/fontawesome.css';
import '@bryntum/scheduler/fontawesome/css/solid.css';
import './schedule.css';
import { ScheduleLoader } from './loader';

export const metadata: Metadata = {
  title: 'The schedule | Homestretch',
  description: 'A week of catering shifts with an assistant that staffs and repairs it, and PayPal Payouts paying each shift when it is approved.',
};

export default function SchedulePage() {
  return <ScheduleLoader />;
}
