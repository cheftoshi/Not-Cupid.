export type ClientErrorCode =
  | 'abort'
  | 'chunk_load'
  | 'hydration'
  | 'network'
  | 'permission'
  | 'resize_observer'
  | 'script_error'
  | 'syntax'
  | 'type'
  | 'unknown';

const KNOWN_NAMES = new Set([
  'AbortError',
  'ChunkLoadError',
  'Error',
  'NetworkError',
  'NotAllowedError',
  'SecurityError',
  'SyntaxError',
  'TypeError',
]);

// Keep client diagnostics useful without collecting raw exception messages,
// stack traces, query strings, form text, email addresses, or device details.
export function safeClientErrorName(value: unknown): string {
  return typeof value === 'string' && KNOWN_NAMES.has(value) ? value : 'Error';
}

export function classifyClientError(name: unknown, message: unknown): ClientErrorCode {
  const normalizedName = typeof name === 'string' ? name.toLowerCase() : '';
  const normalizedMessage = typeof message === 'string' ? message.toLowerCase() : '';
  const combined = `${normalizedName} ${normalizedMessage}`;
  if (/abort|cancelled|canceled/.test(combined)) return 'abort';
  if (/chunkload|loading chunk|dynamically imported module|failed to fetch.*module/.test(combined)) return 'chunk_load';
  // React production builds replace descriptive hydration messages with
  // invariant numbers. Keep these coarse codes actionable without collecting
  // the raw message or stack (which could contain user-rendered text).
  if (/hydration|hydrating|minified react error #(418|423|425)\b/.test(combined)) return 'hydration';
  if (/resizeobserver/.test(combined)) return 'resize_observer';
  if (/script error/.test(combined)) return 'script_error';
  if (/notallowed|permission|securityerror|pushmanager|serviceworker/.test(combined)) return 'permission';
  if (/network|failed to fetch|load failed|fetch failed|offline/.test(combined)) return 'network';
  if (normalizedName === 'syntaxerror') return 'syntax';
  if (normalizedName === 'typeerror') return 'type';
  return 'unknown';
}

export function safeClientErrorSource(value: unknown, origin: string): string {
  if (typeof value !== 'string' || !value) return 'unknown';
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin) return 'cross-origin';
    return url.pathname.slice(0, 160) || '/';
  } catch {
    return 'unknown';
  }
}

// FNV-1a is intentionally non-cryptographic: this is only a stable grouping
// key for equivalent failures, never an identifier or security primitive.
export function clientErrorFingerprint(parts: Array<string | number | null | undefined>): string {
  const input = parts.map((part) => String(part ?? '')).join('|');
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
