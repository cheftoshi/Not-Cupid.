import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NotCupid — Boston\'s Smartest Dating Experiment',
  description: 'Not a swipe app. One match. Real science. Boston only.',
  openGraph: {
    title: 'NotCupid',
    description: 'Not a swipe app. One match. Real science. Boston only.',
    url: 'https://notcupid.com',
    siteName: 'NotCupid',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
