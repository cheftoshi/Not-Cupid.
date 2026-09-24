// OTP requests are never automatically replayed: a lost response can still
// mean the server sent a code or established a session.
export function safeLoginPath(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//') || /[\\\x00-\x20]/.test(raw)) return null;
  return raw;
}

export async function requestLogin(
  action: 'send' | 'verify',
  payload: { email: string; code?: string },
  { signal, timeoutMs = 12_000, request = fetch }: { signal?: AbortSignal; timeoutMs?: number; request?: typeof fetch } = {},
): Promise<{ ok: true; redirect?: string; returning?: boolean; needsQuiz?: boolean } | { ok: false; error: string; code: 'http' | 'timeout' | 'cancelled' | 'network' | 'invalid_response' }> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  const timer = setTimeout(cancel, timeoutMs);
  let received = false;
  try {
    if (controller.signal.aborted) throw new Error('cancelled');
    const response = await request(action === 'send' ? '/api/send-otp' : '/api/verify-otp', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    received = true;
    const data = await response.json();
    if (controller.signal.aborted) throw new Error('cancelled');
    if (!response.ok) {
      return { ok: false, code: 'http', error: response.status === 429 ? 'Too many attempts. Wait a few minutes before trying again.'
        : action === 'verify' && [400, 401, 404].includes(response.status) ? 'That code is invalid or expired. Check the latest code or request a new one.'
          : 'Sign-in is temporarily unavailable. Please try again.' };
    }
    if (!data || typeof data !== 'object' || data.error) throw new Error('invalid_response');
    if (action === 'verify') {
      const redirect = safeLoginPath(data.redirect);
      if (!redirect) throw new Error('invalid_redirect');
      return { ok: true, redirect, returning: data.returning === true, needsQuiz: data.needsQuiz === true };
    }
    if (data.ok !== true && data.success !== true) throw new Error('invalid_response');
    return { ok: true };
  } catch {
    return { ok: false, code: signal?.aborted ? 'cancelled' : controller.signal.aborted ? 'timeout' : received ? 'invalid_response' : 'network', error: action === 'send'
      ? 'We couldn’t confirm delivery. Check your connection and inbox. If a code arrived, enter it below; otherwise try again.'
      : 'We couldn’t confirm sign-in. Check your connection, then try verifying again. Your code is still here.' };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

// Diagnostics deliberately omit the email, OTP, destination, and raw error.
export function recordLoginRecovery(action: 'send' | 'verify', code: string) {
  try {
    void fetch('/api/performance', { method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        eventName: 'login_recovery', path: '/login', loginAction: action, recoveryCode: code,
        deviceClass: window.innerWidth < 600 ? 'phone' : 'desktop',
        displayMode: (navigator as Navigator & { standalone?: boolean }).standalone || window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser',
      }),
    }).catch(() => {});
  } catch { /* Diagnostics must not interrupt sign-in. */ }
}
