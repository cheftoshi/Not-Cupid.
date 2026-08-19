import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  classifyClientError,
  clientErrorFingerprint,
  safeClientErrorName,
  safeClientErrorSource,
} from '../lib/client-error-fingerprint.ts';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('client errors are grouped without collecting raw messages, stacks, or query strings', () => {
  assert.equal(classifyClientError('TypeError', 'Failed to fetch'), 'network');
  assert.equal(classifyClientError('ChunkLoadError', 'Loading chunk 81 failed'), 'chunk_load');
  assert.equal(classifyClientError('NotAllowedError', 'Permission denied'), 'permission');
  assert.equal(classifyClientError(null, 'Script error.'), 'script_error');
  assert.equal(safeClientErrorName('CustomError'), 'Error');
  assert.equal(
    safeClientErrorSource('https://notcupid.com/_next/static/chunks/app.js?token=private', 'https://notcupid.com'),
    '/_next/static/chunks/app.js',
  );
  assert.equal(safeClientErrorSource('https://third-party.example/widget.js', 'https://notcupid.com'), 'cross-origin');
  assert.equal(clientErrorFingerprint(['promise', 'network', 'TypeError']), clientErrorFingerprint(['promise', 'network', 'TypeError']));
  assert.notEqual(clientErrorFingerprint(['promise', 'network']), clientErrorFingerprint(['runtime', 'network']));

  const instrumentation = source('instrumentation-client.ts');
  const endpoint = source('app/api/performance/route.ts');
  assert.match(instrumentation, /\.catch\(\(\) => \{\}\)/);
  assert.doesNotMatch(instrumentation, /stack:/);
  assert.doesNotMatch(instrumentation, /message:/);
  assert.match(endpoint, /metadata\.fingerprint/);
  assert.match(endpoint, /ERROR_CODES/);
});

test('shared client telemetry cannot turn a failed analytics request into an app error', () => {
  for (const path of [
    'components/page-tracker.tsx',
    'components/web-vitals.tsx',
    'lib/love-events-client.ts',
    'app/dashboard/roster-picker.tsx',
    'components/returning-user-welcome.tsx',
  ]) {
    assert.match(source(path), /fetch\([\s\S]*?\.catch\(\(\) => \{\}\)/, `${path} should swallow best-effort telemetry failures`);
  }
  const prompt = source('components/pwa-prompt.tsx');
  assert.match(prompt, /import \{ subscribeToPush \} from '@\/lib\/push-client'/);
  assert.doesNotMatch(prompt, /function urlBase64ToUint8Array/);
});

test('Love chat, Friend Line and Dating Experiment actions handle network failures locally', () => {
  const love = source('app/match/[id]/chat-room.tsx');
  const friend = source('app/friends/friend-hub-client.tsx');
  const discovery = source('app/friends/friend-discovery-card.tsx');
  const experiment = source('app/raffle/raffle-client.tsx');
  assert.match(love, /date-vibe-save-failed[\s\S]*catch/);
  assert.match(friend, /const loadMatches = useCallback\(async \(\) => \{[\s\S]*catch/);
  assert.match(friend, /friend-message-failed[\s\S]*setMsg\(body\)/);
  assert.match(discovery, /could not post that signal — check your connection/);
  assert.match(experiment, /could not save your private choices — check your connection/);
});

test('Friend profile and account actions recover instead of leaving rejected promises', () => {
  const friendProfile = source('app/friends/profile/friend-profile-client.tsx');
  const profileForm = source('app/profile/profile-form.tsx');
  const profileShell = source('app/profile/profile-shell.tsx');
  assert.match(friendProfile, /upload failed — check your connection and try again/);
  assert.match(friendProfile, /could not remove that photo — check your connection/);
  assert.match(friendProfile, /couldn\\'t save — check your connection and try again/);
  assert.match(profileForm, /could not delete your account — try again/);
  assert.match(profileForm, /could not log out — check your connection and try again/);
  assert.match(profileShell, /catch \{ toast\('could not log out/);
});
