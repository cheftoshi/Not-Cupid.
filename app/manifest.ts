import type { MetadataRoute } from 'next';

// PWA manifest — makes NotCupid installable ("Add to Home Screen") and gives
// the installed app its name, icon and standalone window.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NotCupid — A Connection Experiment',
    short_name: 'NotCupid',
    description:
      'Find member-created plans near you. Meet for a walk, a date, or a small-group hangout.',
    id: '/',
    scope: '/',
    start_url: '/hub',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui', 'browser'],
    background_color: '#f6f6f6',
    theme_color: '#ff6a1f',
    orientation: 'portrait',
    categories: ['social', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Friend Line',
        short_name: 'Friend',
        description: 'Open today’s friend-making loop.',
        url: '/friends?source=pwa-shortcut',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Love Line',
        short_name: 'Love',
        description: 'Browse up to 10 curated profiles and use 3 included connection picks.',
        url: '/dashboard?source=pwa-shortcut',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Home plans',
        short_name: 'Home',
        description: 'See real invitations from NotCupid members.',
        url: '/hub?source=pwa-shortcut',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  } as MetadataRoute.Manifest;
}
