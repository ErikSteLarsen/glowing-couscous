import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TempoBuilder',
    short_name: 'TempoBuilder',
    description: 'Plan, follow, and review your own endurance training.',
    start_url: '/',
    display: 'browser',
    background_color: '#0B0F15',
    theme_color: '#0B0F15',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
