import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { SessionProviderWrapper } from '@/components/SessionProviderWrapper';

const schibsted = localFont({
  src: './fonts/schibsted-grotesk-latin.woff2',
  variable: '--font-schibsted',
  weight: '400 700',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Tempo',
  description: 'Endurance training for athletes and coaches',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={schibsted.variable}>
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
