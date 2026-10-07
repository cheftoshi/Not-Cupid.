/** Explicit staging origin is an operator assertion; test-account status alone
 * does not establish that a deployment has an isolated database. */
export function requireStagingTarget(base, approvedOrigin) {
  if (!base || !approvedOrigin) throw Error('Configure E2E_BASE_URL and E2E_STAGING_ORIGIN for an isolated staging environment.');
  const url = new URL(base);
  const approved = new URL(approvedOrigin);
  if (url.protocol !== 'https:' || /(^|\.)notcupid\.com\.?$/i.test(url.hostname)
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash
    || approved.href !== `${approved.origin}/` || url.origin !== approved.origin) {
    throw Error('Authenticated checks require the explicitly approved isolated HTTPS staging origin, never production.');
  }
  return url;
}
