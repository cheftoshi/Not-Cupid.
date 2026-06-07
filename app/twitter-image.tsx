// Reuse the same branded card for Twitter/X.
// `runtime` must be a direct string-literal export (Next can't statically read
// a re-exported runtime field — it would warn and fall back to the default).
export const runtime = 'edge';
export { default, alt, size, contentType } from './opengraph-image';
