export type QuizProfileResult =
  | { status: 'ready'; user: Record<string, any> }
  | { status: 'signed-out' | 'error' | 'cancelled' };

// Bound the entire read, including the response body. Navigation cancels it;
// only an actual 401 means sign-in is required. Never expose raw API errors.
export async function loadQuizProfile({
  signal,
  timeoutMs = 12_000,
  request = fetch,
}: { signal?: AbortSignal; timeoutMs?: number; request?: typeof fetch } = {}): Promise<QuizProfileResult> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  const timer = setTimeout(cancel, timeoutMs);
  try {
    if (controller.signal.aborted) return { status: 'cancelled' };
    const response = await request('/api/profile', {
      signal: controller.signal, cache: 'no-store', credentials: 'same-origin',
    });
    if (signal?.aborted) return { status: 'cancelled' };
    if (response.status === 401) return { status: 'signed-out' };
    if (!response.ok) return { status: 'error' };
    const data = await response.json();
    if (signal?.aborted) return { status: 'cancelled' };
    if (controller.signal.aborted || !data?.user || typeof data.user.id !== 'string' || !data.user.id) {
      return { status: 'error' };
    }
    return { status: 'ready', user: data.user };
  } catch {
    return { status: signal?.aborted ? 'cancelled' : 'error' };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
