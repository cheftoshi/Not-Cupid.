import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('owner incident diagnostic is fixed-account read-only and behind existing expiring authentication',()=>{
 const source=readFileSync('lib/friend-owner-diagnostic.ts','utf8');
 const route=readFileSync('app/api/admin/friend-announcement-preflight/route.ts','utf8');
 assert.match(source,/10804fc4-6506-431a-8282-a2dfcff01b41/);
 assert.doesNotMatch(source,/\.(insert|update|delete|upsert|send)\(/);
 assert.match(source,/reason:'admin_excluded'/);
 assert.ok(route.indexOf('status:403')<route.indexOf("searchParams.get('diagnostic')"));
 assert.match(route,/expires<=Date.now\(\)/);
 assert.match(route,/timingSafeStringEqual/);
 assert.match(route,/'Cache-Control':'no-store'/);
});
