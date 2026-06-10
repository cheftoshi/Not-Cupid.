import type { MetadataRoute } from 'next';

// PWA manifest — makes NotCupid installable ("Add to Home Screen") and gives
// the installed app its name, icon and standalone window.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NotCupid — A Connection Experiment',
    short_name: 'NotCupid',
    description:
      'Meet people, not profiles. The algorithm curates your most compatible people — you choose. No swiping.',
    id: '/',
    start_url: '/hub',
    display: 'standalone',
    background_color: '#f6f6f6',
    theme_color: '#0b0b0b',
    orientation: 'portrait',
    categories: ['social', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
