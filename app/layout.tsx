import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import './monolith.css';
import { SessionProviderWrapper } from '@/components/SessionProviderWrapper';

// Self-hosted so builds never depend on reaching Google Fonts (SIL Open Font License).
const instrumentSans = localFont({
  src: './fonts/InstrumentSans-latin-variable.woff2',
  variable: '--font-body',
  weight: '400 600',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
});

export const metadata: Metadata = {
  title: { default: 'Tempo', template: '%s · Tempo' },
  description: 'Plan, follow, and review your own endurance training.',
};

export const viewport: Viewport = {
  themeColor: '#0B0F15',
  colorScheme: 'dark',
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "try{document.documentElement.dataset.workspaceTheme=localStorage.getItem('tempo-theme')==='light'?'light':'dark'}catch(e){document.documentElement.dataset.workspaceTheme='dark'}" }} />
      </head>
      <body className={instrumentSans.variable}>
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
