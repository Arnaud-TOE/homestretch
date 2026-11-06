'use client';

import dynamic from 'next/dynamic';

// It reads the browser's clock and storage, so it only ever runs there.
const CrewView = dynamic(() => import('./crew-view'), { ssr: false });

export function CrewLoader({ workerId }: { workerId: string }) {
  return <CrewView workerId={workerId} />;
}
