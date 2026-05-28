import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SECURITY_HEADERS: Record<string, string> = {
  // Block clickjacking — no embedding inside iframes from any origin.
  'X-Frame-Options': 'DENY',
  // Stop MIME-type sniffing.
  'X-Content-Type-Options': 'nosniff',
  // Don't leak full URLs in the Referer header to third parties.
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Tell browsers to only ever talk to us over HTTPS.
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  // Lock down permissions APIs we don't use.
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(self)',
  // Conservative CSP: same-origin everything by default, with Stripe + Resend assets allowed.
  // Inline styles permitted because the app uses style props extensively; we can tighten later.
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://js.stripe.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co https://api.stripe.com",
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; '),
}

export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has('nc_session')

  // Logged-in users land in /profile instead of the marketing page.
  if (hasSession && req.nextUrl.pathname === '/') {
    const res = NextResponse.redirect(new URL('/profile', req.url))
    applySecurityHeaders(res)
    return res
  }

  const res = NextResponse.next()
  applySecurityHeaders(res)
  return res
}

function applySecurityHeaders(res: NextResponse) {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(k, v)
  }
}

export const config = {
  // Apply to all routes except Next internals and static files.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf)$).*)',
  ],
}
