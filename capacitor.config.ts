import type { CapacitorConfig } from '@capacitor/cli';

// NotCupid native shell (Capacitor) — the staged App Store path decided 6/10.
// The app is server-rendered Next.js on Vercel, so the native app is a thin
// wrapper around the LIVE site (server.url): every deploy updates the app
// instantly, no store re-review for content changes. Native layers (push,
// splash, icons — and later an IAP bridge) get added on top.
//
// Build flow:  npx cap sync  →  npx cap open ios / android  →  archive/upload.
// See docs/app-store-track.md for the full TestFlight / Play checklist.
const config: CapacitorConfig = {
  appId: 'com.notcupid.app',
  appName: 'NotCupid',
  // Native projects still want a local web dir for the shell fallback; we keep
  // a tiny placeholder (public/) — the real app loads from server.url.
  webDir: 'public',
  server: {
    url: 'https://notcupid.com',
    allowNavigation: ['notcupid.com', '*.notcupid.com', 'checkout.stripe.com', '*.stripe.com'],
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#f6f6f6',
  },
  android: {
    backgroundColor: '#f6f6f6',
  },
};

export default config;
