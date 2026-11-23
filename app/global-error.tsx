'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', background: '#F5F4EF', color: '#112842', fontFamily: 'system-ui, sans-serif' }}>
        <style>{`
          .tempo-error-retry { background: #102F51; }
          .tempo-error-retry, .tempo-error-home { cursor: pointer; }
          @media (hover: hover) {
            .tempo-error-retry:hover { background: #112842; }
            .tempo-error-home:hover { background: #F5F4EF; }
          }
        `}</style>
        <main style={{ boxSizing: 'border-box', display: 'grid', minHeight: '100vh', placeItems: 'center', padding: '32px 20px' }}>
          <section style={{ boxSizing: 'border-box', width: '100%', maxWidth: 520, border: '1px solid #D4D3CD', background: '#FBFAF7', padding: 28, textAlign: 'center' }}>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 400, letterSpacing: '-0.04em' }}>Tempo couldn’t start</h1>
            <p style={{ margin: '16px 0 24px', color: '#53606B', fontSize: 15, lineHeight: 1.55 }}>Something went wrong while loading the app. Try again, or return to the home page.</p>
            {error.digest ? <p style={{ color: '#7F8588', fontSize: 12 }}>Error code: {error.digest}</p> : null}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
              <button type="button" onClick={reset} className="tempo-error-retry" style={{ minHeight: 40, border: 0, color: '#FFFFFF', padding: '8px 16px', font: '600 13px system-ui, sans-serif' }}>Try again</button>
              <Link href="/" className="tempo-error-home" style={{ display: 'inline-flex', minHeight: 40, alignItems: 'center', border: '1px solid #D4D3CD', color: '#112842', padding: '8px 16px', fontSize: 13, textDecoration: 'none' }}>Back to Home</Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
