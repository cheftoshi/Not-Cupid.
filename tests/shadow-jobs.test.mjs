import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shadowJobKey,shadowJobOutcome} from '../lib/shadow-job-policy.ts';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('shadow jobs deduplicate the same day and pool but preserve live ranking order',()=>{
 const input={userId:'test',intent:'love',liveAlgorithmVersion:'v1',liveTopIds:['a','b'],eligibleCandidateIds:['a','b']};
 const now=new Date('2026-09-15T12:00:00Z');
 assert.equal(shadowJobKey(input,now),shadowJobKey({...input,eligibleCandidateIds:['b','a']},now));
 assert.notEqual(shadowJobKey(input,now),shadowJobKey({...input,liveTopIds:['b','a']},now));
 assert.notEqual(shadowJobKey(input,now),shadowJobKey(input,new Date('2026-09-16T12:00:00Z')));
});
test('shadow retries are bounded and disabled/coverage skips are terminal',()=>{
 assert.equal(shadowJobOutcome('failed',1),'pending');assert.equal(shadowJobOutcome('failed',3),'failed');
 assert.equal(shadowJobOutcome('recorded',1),'done');assert.equal(shadowJobOutcome('skipped',1),'skipped');
 assert.equal(shadowJobOutcome('disabled',1),'skipped');
});
test('durable shadow worker is private, leased, consent checked and cannot change the roster',()=>{
 const sql=read('supabase/migrations/20260915170635_embedding_shadow_jobs.sql');
 assert.match(sql,/for update skip locked/);assert.match(sql,/enable row level security/);
 assert.match(sql,/grant select,insert,update,delete .* to service_role/);
 assert.match(sql,/clear_revoked_embedding_jobs/);assert.match(sql,/interval '1 day'/);
 const worker=read('lib/embedding-shadow-jobs.ts');assert.match(worker,/hasMatchingEmbeddingConsent\(user\)/);
 assert.match(worker,/\.eq\('lease_token',job.lease_token\)/);
 assert.match(worker,/AbortSignal.timeout\(1500\)/);
 assert.doesNotMatch(read('app/api/match/roster/route.ts'),/await evaluateEmbeddingShadow/);
 assert.match(read('lib/embedding-shadow.ts'),/onConflict: 'queue_job_id'/);
 assert.match(read('app/api/cron/embedding-shadow/route.ts'),/isAuthorizedCronRequest/);
});
