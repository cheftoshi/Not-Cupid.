import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://notcupid.com'
  const now = new Date()
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/friend-maxxin`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/quiz`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  ]
}
