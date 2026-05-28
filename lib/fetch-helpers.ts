// Safely parse a fetch Response body that's expected to be JSON.
//
// Why this exists: when Vercel's infrastructure rejects a request before our
// handler runs (e.g. a 413 "Request Entity Too Large" on file uploads, or a
// 504 timeout HTML page), the body is plain text. Calling `res.json()` on it
// throws "Unexpected token X in JSON" — which surfaces to the user as a
// cryptic error like "token R" instead of a real message.
//
// Returns parsed JSON on success. On a non-JSON body, returns a synthesized
// { error: string } so existing call-sites that read `data.error` keep working.
export async function parseResponse<T = any>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) {
    if (res.ok) return {} as T;
    return { error: friendlyHttpError(res.status, '') } as any as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return { error: friendlyHttpError(res.status, text) } as any as T;
  }
}

function friendlyHttpError(status: number, text: string): string {
  if (status === 413) return 'request too large';
  if (status === 401) return 'not signed in';
  if (status === 429) return 'too many requests — try again in a minute';
  if (status >= 500) return 'server error — try again';
  if (text) return text.slice(0, 120);
  return `error ${status}`;
}
