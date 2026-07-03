import type { MetadataRoute } from 'next'
import { METRO_CENTERS, ARCHETYPES, typeSlug } from '@/lib/quiz-data'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://notcupid.com'
  const now = new Date()
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/how-it-works`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/quiz`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    // Per-metro landing pages ("meet people in boston") — the SEO surface.
    ...Object.keys(METRO_CENTERS).map((metro) => ({
      url: `${base}/city/${metro}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.7,
    })),
    // Public archetype pages (the shareable quiz results).
    ...ARCHETYPES.map((a) => ({
      url: `${base}/type/${typeSlug(a.name)}`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.5,
    })),
  ]
}
