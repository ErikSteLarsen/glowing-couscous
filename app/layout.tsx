import type { Metadata } from 'next';
import './globals.css';
import { SessionProviderWrapper } from '@/components/SessionProviderWrapper';

export const metadata: Metadata = {
  title: 'Workout Planner',
  description: 'Weekly workout planning for coaches and athletes',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProviderWrapper>
          <main className="mx-auto min-h-screen max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
