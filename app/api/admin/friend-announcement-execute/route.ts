import { NextRequest,NextResponse } from 'next/server';
import { timingSafeStringEqual } from '@/lib/request-security';
import { executePreparedFriendAnnouncement } from '@/lib/friend-announcement-execute';
export const dynamic='force-dynamic';
export const maxDuration=800;
// LOCAL PREPARATION ONLY. Requires a distinct execution credential, disabled
// deployment flag, reviewed frozen manifest and real sequential approval records.
// It cannot accept or manufacture approvals. Never called by cron or preparation.
export async function POST(req:NextRequest) {
 const token=process.env.FRIEND_ANNOUNCEMENT_EXECUTION_TOKEN||'';
 const expires=Date.parse(process.env.FRIEND_ANNOUNCEMENT_EXECUTION_EXPIRES||'');
 if(process.env.FRIEND_ANNOUNCEMENT_SEND_ENABLED!=='true'||token.length<32||!Number.isFinite(expires)||expires<=Date.now()||!timingSafeStringEqual(req.headers.get('authorization'),`Bearer ${token}`))return NextResponse.json({error:'Execution disabled or unauthorized'},{status:403,headers:{'Cache-Control':'no-store'}});
 let input:unknown;try{input=await req.json();}catch{return NextResponse.json({error:'Invalid request'},{status:400});}
 if(!input||typeof input!=='object'||Object.keys(input).some(k=>!['campaign','manifestHash'].includes(k)))return NextResponse.json({error:'Only frozen campaign and hash accepted'},{status:400});
 const {campaign,manifestHash}=input as {campaign?:unknown;manifestHash?:unknown};
 if(typeof campaign!=='string'||!/^friend_events_announcement_[a-z0-9_]{1,60}$/.test(campaign)||typeof manifestHash!=='string'||!/^[a-f0-9]{64}$/.test(manifestHash))return NextResponse.json({error:'Invalid frozen reference'},{status:400});
 try{return NextResponse.json(await executePreparedFriendAnnouncement(campaign,manifestHash,Math.min(expires,Date.now()+700000)),{headers:{'Cache-Control':'no-store'}});}
 catch{return NextResponse.json({error:'Execution result uncertain; inspect ledger before retrying'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
