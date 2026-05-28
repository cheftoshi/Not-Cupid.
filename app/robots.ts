import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/friend-maxxin', '/login', '/quiz'],
        disallow: [
          '/admin',
          '/api/',
          '/dashboard',
          '/profile',
          '/match/',
          '/hub',
          '/unlock',
          '/out-of-range',
        ],
      },
    ],
    sitemap: 'https://notcupid.com/sitemap.xml',
  }
}
