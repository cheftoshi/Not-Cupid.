import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fetchAllSupabaseRows } from '../lib/supabase-pagination.ts';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('server-side Supabase pagination collects every page past the 1,000-row ceiling', async () => {
  const sourceRows = Array.from({ length: 2412 }, (_, id) => ({ id }));
  const requested = [];

  const rows = await fetchAllSupabaseRows(async (from, to) => {
    requested.push([from, to]);
    return { data: sourceRows.slice(from, to + 1), error: null };
  });

  assert.equal(rows.length, 2412);
  assert.deepEqual(requested, [[0, 999], [1000, 1999], [2000, 2999]]);
  assert.deepEqual(rows.at(-1), { id: 2411 });
});

test('pagination performs the final empty probe at an exact page boundary', async () => {
  const sourceRows = Array.from({ length: 2000 }, (_, id) => ({ id }));
  let calls = 0;

  const rows = await fetchAllSupabaseRows(async (from, to) => {
    calls += 1;
    return { data: sourceRows.slice(from, to + 1), error: null };
  });

  assert.equal(rows.length, 2000);
  assert.equal(calls, 3);
});

test('admin traffic uses stable range pagination and keeps the API ceiling low', () => {
  const stats = source('app/api/admin-stats/route.ts');
  const config = source('supabase/config.toml');

  assert.match(stats, /fetchAllSupabaseRows<PageViewRow>/);
  assert.match(stats, /\.order\('created_at', \{ ascending: true \}\)/);
  assert.match(stats, /\.order\('id', \{ ascending: true \}\)/);
  assert.match(stats, /\.range\(from, to\)/);
  assert.match(config, /max_rows = 1000/);
});
