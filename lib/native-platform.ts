import { Capacitor } from '@capacitor/core';

/** True inside the installed Capacitor iOS/Android shell, never in the PWA. */
export function isNativeShell() {
  return Capacitor.isNativePlatform();
}

export function nativePlatform() {
  return isNativeShell() ? Capacitor.getPlatform() : null;
}
