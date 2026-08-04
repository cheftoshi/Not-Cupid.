'use client';

import { useEffect } from 'react';
import { nativePlatform } from '@/lib/native-platform';

// Expose the native runtime to CSS without making every page import Capacitor.
// The attribute also gives future native-only UI a stable, testable hook.
export default function NativeShellBootstrap() {
  useEffect(() => {
    const platform = nativePlatform();
    if (!platform) return;
    document.documentElement.dataset.nativeShell = platform;
    return () => { delete document.documentElement.dataset.nativeShell; };
  }, []);

  return null;
}
