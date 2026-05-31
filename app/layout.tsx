import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NotCupid — Boston\'s Social Experiment',
  description: 'Meet people, not profiles. The algorithm shows you 5 compatible people — you choose one. One match at a time, no swiping. A Boston social experiment.',
  openGraph: {
    title: 'NotCupid — Boston\'s Social Experiment',
    description: 'Meet people, not profiles. See your 5 most compatible, choose one. No swiping.',
    url: 'https://notcupid.com',
    siteName: 'NotCupid',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NotCupid — Boston\'s Social Experiment',
    description: 'Meet people, not profiles. See your 5 most compatible, choose one. No swiping.',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#f6f6f6',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
