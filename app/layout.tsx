import type { Metadata, Viewport } from 'next'
import './globals.css'
import TopNav from '@/components/top-nav'
import SiteFooter from '@/components/site-footer'
import DeferredClientShell from '@/components/deferred-client-shell'
import WebVitals from '@/components/web-vitals'

export const metadata: Metadata = {
  metadataBase: new URL('https://notcupid.com'),
  title: 'NotCupid — A place to find your people.',
  description: 'Dating and friendship, with more in common. Find people, start conversations, and make plans. You choose who to meet.',
  applicationName: 'NotCupid',
  appleWebApp: {
    capable: true,
    title: 'NotCupid',
    statusBarStyle: 'default',
  },
  openGraph: {
    type: 'website',
    title: 'NotCupid — A place to find your people.',
    description: 'Dating and friendship, with more in common. Find people, start conversations, and make plans. You choose who to meet.',
    url: 'https://notcupid.com',
    siteName: 'NotCupid',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NotCupid — A place to find your people.',
    description: 'Dating and friendship, with more in common. Find people, start conversations, and make plans. You choose who to meet.',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#064c48',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preload" href="/fonts/SpaceGrotesk.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/DMSans.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        {/* No-flash theme: apply the saved theme before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('nc-theme');if(t)document.documentElement.dataset.theme=t;}catch(e){}` }} />
      </head>
      <body style={{ margin: 0 }}><WebVitals /><TopNav />{children}<SiteFooter /><DeferredClientShell /></body>
    </html>
  )
}
