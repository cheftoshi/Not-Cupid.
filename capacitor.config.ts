import type { CapacitorConfig } from '@capacitor/cli';

// NotCupid native shell (Capacitor) — staged TestFlight/Play path.
// NOTE: server.url is retained for internal device testing of the SSR app. The
// Capacitor docs explicitly classify it as a live-reload option, not a final
// production architecture. Remove it in the App Store release build after the
// native delivery strategy in docs/app-store-track.md is complete.
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
    cleartext: false,
  },
  ios: {
    // CSS env(safe-area-inset-*) owns the insets across PWA and native shells.
    contentInset: 'never',
    backgroundColor: '#f6f6f6',
    preferredContentMode: 'mobile',
    allowsLinkPreview: false,
    webContentsDebuggingEnabled: false,
  },
  android: {
    backgroundColor: '#f6f6f6',
  },
};

export default config;
