import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { WORKERS } from '@/lib/schedule/demo';
import { CrewLoader } from './loader';

export function generateStaticParams() {
  return WORKERS.map((worker) => ({ id: worker.id }));
}

export async function generateMetadata({ params }: PageProps<'/crew/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const worker = WORKERS.find((w) => w.id === id);
  return { title: worker ? `${worker.name.split(' ')[0]}'s shifts | Homestretch` : 'Homestretch' };
}

export default async function CrewPage({ params }: PageProps<'/crew/[id]'>) {
  const { id } = await params;
  if (!WORKERS.some((w) => w.id === id)) notFound();
  return <CrewLoader workerId={id} />;
}
