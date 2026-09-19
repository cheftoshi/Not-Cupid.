// Public mobile CI needs TLS because the production CSP upgrades resources.
// No database login, production secret, or outbound notification is required.
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import https from 'node:https';

const base = 'https://127.0.0.1:3117';
const dir = mkdtempSync(join(tmpdir(), 'notcupid-public-qa-'));
const key = join(dir, 'key.pem'), cert = join(dir, 'cert.pem');
let server;
try {
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=127.0.0.1'], { stdio: 'ignore' });
  const env = { ...process.env, E2E_LOCAL_HTTPS: '1', E2E_TLS_KEY: key, E2E_TLS_CERT: cert, E2E_BASE_URL: base };
  server = spawn(process.execPath, ['scripts/test-https-server.mjs'], { env, stdio: 'inherit' });
  let spawnError;
  server.on('error', (error) => { spawnError = error; });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (spawnError || server.exitCode !== null) throw new Error('Local HTTPS server failed to start');
    ready = await new Promise((resolve) => {
      const request = https.get(`${base}/login`, { rejectUnauthorized: false, timeout: 1500 }, (response) => {
        response.resume(); resolve(response.statusCode === 200);
      });
      request.on('error', () => resolve(false));
      request.on('timeout', () => request.destroy());
    });
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('Local HTTPS server did not become ready');
  const code = await new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'test:e2e'], { env, stdio: 'inherit' });
    child.on('error', reject); child.on('exit', resolve);
  });
  process.exitCode = code === 0 ? 0 : 1;
} finally {
  if (server && server.exitCode === null) {
    await new Promise((resolve) => { server.once('exit', resolve); server.kill('SIGTERM'); });
  }
  for (const path of [key, cert]) { try { unlinkSync(path); } catch { /* setup may have failed */ } }
  rmdirSync(dir);
}
