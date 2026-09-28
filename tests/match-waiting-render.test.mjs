import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadTs} from './helpers/load-ts.mjs';
import * as quiz from '../lib/quiz-data.ts';
import {normalizeProfilePrompts} from '../lib/profile-prompts.ts';

const empty=()=>null;
const room=await loadTs('app/match/[id]/chat-room.tsx',{
  react:React,'react/jsx-runtime':jsxRuntime,
  '@/lib/fetch-helpers':{},'@/lib/love-events-client':{},'@/components/feedback':{},
  '@/components/report-dialog':{default:empty},'@/components/end-match-dialog':{default:empty},
  '@/components/date-feedback-dialog':{default:empty},'./compatibility-read-panel':{default:empty},
  './chat.module.css':{default:new Proxy({},{get:(_,key)=>key})},
  '@/lib/profile-prompts':{normalizeProfilePrompts},'@/lib/quiz-data':quiz,
  '@/lib/use-chat-realtime':{useChatRealtime:()=>{}},'@/lib/realtime-policy':{chatPollDelay:()=>10000},
});
const render=(changes={})=>renderToStaticMarkup(React.createElement(room.default,{
  matchId:'test-match',currentUserId:'a',otherUser:{name:'Test Person',hobbies:['Tennis'],bio:'Local test biography'},
  match:{user_1_id:'a',user_2_id:'b',user_1_accepted:true,user_2_accepted:false,status:'matched',...changes},
  initialMessages:[],profileUnlocked:false,readOnly:!!changes.ended_at,
}));
test('outgoing pending chat shows waiting without a composer or AI openers, even with a legacy timer',()=>{
  const html=render({chat_expires_at:'2099-01-01'});
  assert.ok(html.includes('Waiting for Test to connect'));
  assert.ok(!html.includes('aria-label="Message Test"'));
  assert.ok(!html.includes('ask the AI match coach'));
  assert.ok(html.includes('Interests &amp; everyday favorites'));
  assert.ok(html.includes('Local test biography'));
});
test('incoming request retains Yes/Pass, while mutual chat has a composer',()=>{
  const incoming=render({user_1_accepted:false,user_2_accepted:true});
  assert.ok(incoming.includes('yes, connect with Test'));assert.ok(!incoming.includes('aria-label="Message Test"'));
  const mutual=render({user_2_accepted:true,status:'both_accepted'});
  assert.ok(mutual.includes('aria-label="Message Test"'));assert.ok(mutual.includes('Start with hello.'));
});
test('closed chat stays read-only and does not pretend to wait for acceptance',()=>{
  const html=render({ended_at:'2026-01-01',status:'ended'});
  assert.ok(html.includes('this conversation has ended'));
  assert.ok(!html.includes('aria-label="Message Test"'));
  assert.ok(!html.includes('Waiting for Test to connect'));
});
