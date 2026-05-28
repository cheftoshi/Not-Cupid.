import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NotCupid — Boston\'s Smartest Dating Experiment',
  description: 'The algo doesn\'t swipe. It decides. One match. No photos first. Boston only.',
  openGraph: {
    title: 'NotCupid',
    description: 'The algo doesn\'t swipe. It decides.',
    url: 'https://notcupid.com',
    siteName: 'NotCupid',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#f8f5ff',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
