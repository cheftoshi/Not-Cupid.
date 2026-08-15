import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  // Experiment/profile video capture is allowed only for NotCupid itself.
  // Browser-level user permission is still required; embeds receive nothing.
  'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=(), payment=(self)',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Origin-Agent-Cluster': '?1',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://js.stripe.com",
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com",
    // Camera/file previews use object URLs while validating video duration on
    // the device. Playback after upload still comes from signed Supabase URLs.
    "media-src 'self' blob: https://*.supabase.co",
    "connect-src 'self' https://*.supabase.co https://api.stripe.com",
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join('; '),
}

export function proxy(req: NextRequest) {
  const hasSession = req.cookies.has('nc_session')

  // Cookie-authenticated API mutations must originate from this site. This is
  // defense-in-depth alongside SameSite cookies and blocks cross-site requests
  // before a privileged handler runs.
  const unsafeMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
  if (hasSession && unsafeMethod && req.nextUrl.pathname.startsWith('/api/')) {
    const origin = req.headers.get('origin')
    const fetchSite = req.headers.get('sec-fetch-site')
    if ((origin && origin !== req.nextUrl.origin) || fetchSite === 'cross-site') {
      const denied = NextResponse.json({ error: 'Cross-site request blocked' }, { status: 403 })
      applySecurityHeaders(denied)
      return denied
    }
  }

  if (hasSession && req.nextUrl.pathname === '/') {
    const res = NextResponse.redirect(new URL('/hub', req.url))
    applySecurityHeaders(res)
    return res
  }

  const res = NextResponse.next()
  applySecurityHeaders(res)
  return res
}

function applySecurityHeaders(res: NextResponse) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(key, value)
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf)$).*)',
  ],
}
