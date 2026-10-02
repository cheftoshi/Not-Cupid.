const base = process.env.E2E_BASE_URL;
const session = process.env.E2E_TEST_SESSION;
if (!base || !session) throw Error('Configure the staging E2E_BASE_URL and E2E_TEST_SESSION first.');
const url = new URL(base);
if (url.protocol !== 'https:' || /(^|\.)notcupid\.com$/i.test(url.hostname)) {
  throw Error('Authenticated release checks require an isolated HTTPS staging deployment, never production.');
}
const response = await fetch(new URL('/api/profile', url), {
  headers: { Cookie: `nc_session=${session}` }, redirect: 'error', signal: AbortSignal.timeout(10000),
});
if (!response.ok || (await response.json()).user?.is_test !== true) {
  throw Error('The staging credential must belong to a seeded test-realm account.');
}
console.log('Isolated authenticated test account verified; no credentials logged.');
