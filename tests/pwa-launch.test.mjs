import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('PWA metadata and install assets cover iOS and standalone installs', () => {
  const manifest = source('app/manifest.ts');
  const layout = source('app/layout.tsx');
  assert.match(manifest, /start_url:\s*'\/hub'/);
  assert.match(manifest, /display:\s*'standalone'/);
  assert.match(manifest, /icon-192\.png/);
  assert.match(manifest, /icon-512\.png/);
  assert.match(manifest, /icon-512-maskable\.png/);
  assert.match(layout, /appleWebApp:\s*\{/);
  assert.match(layout, /capable:\s*true/);
  assert.match(layout, /viewportFit:\s*'cover'/);
  for (const path of [
    '../public/icons/icon-192.png',
    '../public/icons/icon-512.png',
    '../public/icons/icon-512-maskable.png',
    '../app/apple-icon.png',
    '../public/offline.html',
  ]) assert.equal(existsSync(new URL(path, import.meta.url)), true, `${path} should exist`);
});

test('service worker keeps pages and APIs network-first while supporting install and push', () => {
  const register = source('components/sw-register.tsx');
  const worker = source('public/sw.js');
  assert.match(register, /serviceWorker\.register\('\/sw\.js'\)/);
  assert.match(worker, /event\.request\.mode === 'navigate'/);
  assert.match(worker, /fetch\(event\.request\)\.catch/);
  assert.match(worker, /url\.pathname\.startsWith\('\/_next\/static\/'\)/);
  assert.match(worker, /showNotification/);
  assert.match(worker, /notificationclick/);
  assert.doesNotMatch(worker, /url\.pathname\.startsWith\('\/api\/'\)/);
});

test('mobile experiment and onboarding flows respect safe areas and camera video previews', () => {
  const csp = source('proxy.ts');
  const experiment = source('app/raffle/raffle-client.tsx');
  const faq = source('app/dating-experiment/faq/page.tsx');
  const login = source('app/login/login.module.css');
  const quiz = source('app/quiz/quiz.module.css');
  assert.match(csp, /Permissions-Policy': 'camera=\(self\), microphone=\(self\)/);
  assert.match(csp, /media-src 'self' blob: https:\/\/\*\.supabase\.co/);
  assert.match(experiment, /URL\.createObjectURL\(file\)/);
  assert.match(experiment, /safe-area-inset-top/);
  assert.match(experiment, /safe-area-inset-bottom/);
  assert.match(experiment, /minHeight:\s*44/);
  assert.match(experiment, /prepaid restaurant fulfillment, and NotCupid Sponsor details are confirmed/);
  assert.match(experiment, /Lemon Labs owns NotCupid; it is not the public prize Sponsor/);
  assert.match(experiment, /Private admin rehearsal/);
  assert.match(experiment, /Public entries are still closed/);
  assert.doesNotMatch(experiment, /until restaurant fulfillment/);
  assert.match(faq, /parking, valet charges or tips, transportation/);
  assert.match(login, /min-height:\s*100dvh/);
  assert.match(login, /safe-area-inset-bottom/);
  assert.match(quiz, /min-height:\s*100dvh/);
  assert.match(quiz, /safe-area-inset-top/);
});
