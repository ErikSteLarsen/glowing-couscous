import type { Metadata, Viewport } from 'next';
import { Instrument_Sans } from 'next/font/google';
import './globals.css';
import { SessionProviderWrapper } from '@/components/SessionProviderWrapper';
import { SIDEBAR_STORAGE_KEY } from '@/lib/sidebar-state';

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: { default: 'Tempo', template: '%s · Tempo' },
  description: 'Plan, follow, and review your own endurance training.',
};

export const viewport: Viewport = {
  themeColor: '#0B0F15',
  colorScheme: 'dark',
};

// Applies the remembered sidebar width before paint so the rail never flashes open.
const sidebarScript = `try{if(localStorage.getItem('${SIDEBAR_STORAGE_KEY}')==='rail')document.documentElement.dataset.sidebar='rail'}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: sidebarScript }} />
      </head>
      <body className={instrumentSans.variable}>
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
