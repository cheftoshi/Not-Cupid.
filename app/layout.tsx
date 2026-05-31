import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NotCupid — Boston\'s Social Experiment',
  description: 'Meet people, not profiles. The algorithm hands you your most compatible matches — you pick. No swiping. A Boston social experiment.',
  openGraph: {
    title: 'NotCupid — Boston\'s Social Experiment',
    description: 'Meet people, not profiles. No swiping — pick from your most compatible matches.',
    url: 'https://notcupid.com',
    siteName: 'NotCupid',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NotCupid — Boston\'s Social Experiment',
    description: 'Meet people, not profiles. No swiping — pick from your most compatible matches.',
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
