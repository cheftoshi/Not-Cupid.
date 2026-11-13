import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
test('curated forward constraint permits reviewed URL shapes without weakening existing reference rules',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create table public.friend_activities(kind text,external_event_id text,external_event_url text, constraint friend_event_reference_valid check(external_event_id is null));`);
 await db.exec(fs.readFileSync('supabase/migrations/20261113032543_curated_friend_event_references.sql','utf8'));
 for(const row of [['event',null,null],['event','live:tm:abc','https://www.ticketmaster.com/event/abc'],['event','live:curated:walk','https://example.test/event'],['event','live:curated:query','https://example.test/?event=walk']])await db.query('insert into friend_activities values ($1,$2,$3)',row);
 for(const row of [['post','live:curated:walk','https://example.test/event'],['event','live:curated:walk','http://example.test/event'],['event','live:curated:walk','https://user@example.test/event'],['event','live:curated:walk','https://127.0.0.1/event'],['event','live:unknown:walk','https://example.test/event'],['event',null,'https://example.test/event']])await assert.rejects(db.query('insert into friend_activities values ($1,$2,$3)',row));
 }finally{await db.close();}
});
