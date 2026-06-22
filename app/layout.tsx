import type { Metadata, Viewport } from 'next'
import './globals.css'
import PageTracker from '@/components/page-tracker'
import SwRegister from '@/components/sw-register'

export const metadata: Metadata = {
  metadataBase: new URL('https://notcupid.com'),
  title: 'NotCupid — A Connection Experiment',
  description: 'Meet people, not profiles. The algorithm curates your most compatible people — you choose who to meet. No swiping. Born in Boston, now across the Northeast — New England + New York City.',
  applicationName: 'NotCupid',
  appleWebApp: {
    capable: true,
    title: 'NotCupid',
    statusBarStyle: 'default',
  },
  openGraph: {
    type: 'website',
    title: 'NotCupid — A Connection Experiment',
    description: 'Meet people, not profiles. The algorithm curates your most compatible — you choose. No swiping.',
    url: 'https://notcupid.com',
    siteName: 'NotCupid',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NotCupid — A Connection Experiment',
    description: 'Meet people, not profiles. The algorithm curates your most compatible — you choose. No swiping.',
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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* No-flash theme: apply the saved theme before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('nc-theme');if(t)document.documentElement.dataset.theme=t;}catch(e){}` }} />
      </head>
      <body>{children}<PageTracker /><SwRegister /></body>
    </html>
  )
}
