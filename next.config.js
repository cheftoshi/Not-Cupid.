/** @type {import('next').NextConfig} */

// Baseline security headers — applied to every route. (No strict CSP yet: the
// app leans on inline styles + external image/font hosts, so a CSP needs its own
// careful pass. These cover the cheap, high-value wins.)
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' }, // clickjacking
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
]

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // drop the giveaway `X-Powered-By: Next.js` header
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

module.exports = nextConfig
