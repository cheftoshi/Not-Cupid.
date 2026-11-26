import { NextRequest, NextResponse } from 'next/server';
import { timingSafeStringEqual } from '@/lib/request-security';
import { FRIDAY_FRIENDS_VERSION, FRIDAY_RUNTIME_BUDGET_MS } from '@/lib/friday-friends-policy';
import { runFridayFriends } from '@/lib/friday-friends-adapter';
export const dynamic='force-dynamic';
export const maxDuration=300;
// No scheduler, automatic enrollment, approval mutation or audience overrides.
export async function POST(req:NextRequest){
 const started=Date.now();
 const headers={'Cache-Control':'no-store'},token=process.env.FRIDAY_FRIENDS_EXECUTION_TOKEN||'',deadline=Date.parse(process.env.FRIDAY_FRIENDS_EXECUTION_EXPIRES||'');
 if(process.env.FRIDAY_FRIENDS_SEND_VERSION!==FRIDAY_FRIENDS_VERSION||token.length<32||!Number.isFinite(deadline)||deadline<=Date.now()||!timingSafeStringEqual(req.headers.get('authorization'),`Bearer ${token}`))return NextResponse.json({error:'Disabled or unauthorized'},{status:403,headers});
 const raw=await req.text();if(raw.length>1024)return NextResponse.json({error:'Too large'},{status:413,headers});
 let body;try{body=JSON.parse(raw);}catch{return NextResponse.json({error:'Invalid request'},{status:400,headers});}
 if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).some(k=>!['campaign','manifestHash'].includes(k))||typeof body.campaign!=='string'||!/^friend_events_announcement_discovery_\d{8}_weekend_friday_r\d{1,2}$/.test(body.campaign)||typeof body.manifestHash!=='string'||!/^[a-f0-9]{64}$/.test(body.manifestHash))return NextResponse.json({error:'Exact Friday frozen reference required'},{status:400,headers});
 try{return NextResponse.json(await runFridayFriends(body.campaign,body.manifestHash,Math.min(deadline,started+FRIDAY_RUNTIME_BUDGET_MS)),{headers});}catch{return NextResponse.json({attempted:0,accepted:0,error:'Outcome unknown; inspect receipts before retry'},{status:503,headers});}
}
