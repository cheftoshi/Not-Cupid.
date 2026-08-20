import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { winnerDayOfEmail } from '../lib/dating-experiment-day-of.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('approved winner day-of email is exact, individualized, and asks for attendance only', () => {
  process.env.MATCH_LINK_SECRET ||= 'winner-confirmation-test-secret';
  const email = winnerDayOfEmail({
    drawId: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    userName: 'Prisca Example',
    partnerName: 'Nate Example',
    mailingAddress: '109 California Ave, Quincy, MA 02169',
  });
  assert.equal(email.subject, 'Quick check for tonight ✦');
  assert.match(email.html, /Please confirm your 6:30 PM dinner by noon/);
  assert.match(email.html, /Are you still able to meet Nate at The Berkeley tonight at 6:30 PM/);
  assert.match(email.html, /YES, I&#39;M STILL IN/);
  assert.match(email.html, /I CAN&#39;T MAKE IT/);
  assert.match(email.html, /reservation is under <strong>NotCupid App<\/strong>/);
  assert.doesNotMatch(email.html, /tag us|share (a|your) (photo|story|post)|social tagging/i);
});

test('email scanners cannot record attendance and the ledger is service-only', () => {
  const route = read('../app/api/raffle/winner-confirm/route.ts');
  const migration = read('../supabase/migrations/20260820125322_dating_experiment_winner_day_of_confirmation.sql');
  const getBody = route.slice(route.indexOf('export async function GET'), route.indexOf('export async function POST'));
  assert.doesNotMatch(getBody, /winner_confirmations.*upsert/s);
  assert.match(route, /export async function POST/);
  assert.match(route, /dating_experiment_winner_confirmations'\)\.upsert/);
  assert.match(route, /verifyWinnerConfirmation/);
  assert.match(migration, /unique \(draw_id, user_id\)/);
  assert.match(migration, /revoke all on table public\.dating_experiment_winner_confirmations from public, anon, authenticated/);
});
