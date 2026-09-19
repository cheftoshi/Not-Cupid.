// HTTPS permission does not authorize secure WebSockets in CSP. Allow only
// the configured backend origin, never every websocket host on the internet.
export function realtimeCspSource(backendUrl: string | undefined): string {
  try {
    const url = new URL(backendUrl ?? '');
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    return `wss://${url.host}`;
  } catch {
    return '';
  }
}

export function chatPollDelay(connected: boolean, visible = true, fallbackMs = 3_000): number {
  return visible ? (connected ? 30_000 : fallbackMs) : 45_000;
}
