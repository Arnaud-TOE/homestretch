import type { Metadata } from 'next';
import { Bricolage_Grotesque, Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage' });

export const metadata: Metadata = {
  metadataBase: process.env.VERCEL_PROJECT_PRODUCTION_URL ? new URL(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) : undefined,
  title: 'Homestretch: clock out, get paid',
  description: 'A shift schedule with an assistant that staffs it and repairs it, and PayPal Payouts paying each shift the moment it is approved.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${bricolage.variable}`}>
      <body>{children}</body>
    </html>
  );
}
