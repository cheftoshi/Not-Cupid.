import { NextRequest, NextResponse } from 'next/server';
import { timingSafeStringEqual } from '@/lib/request-security';
import { prepareFriendAnnouncement } from '@/lib/friend-announcement-prepare';
export const dynamic='force-dynamic';
export const maxDuration=300;
// Preparation only. No send path or approval mutation exists in this endpoint.
export async function POST(req:NextRequest) {
 const token=process.env.FRIEND_ANNOUNCEMENT_PREFLIGHT_TOKEN||'';
 const expiry=Date.parse(process.env.FRIEND_ANNOUNCEMENT_PREFLIGHT_EXPIRES||'');
 if(token.length<32||!Number.isFinite(expiry)||expiry<=Date.now()||!timingSafeStringEqual(req.headers.get('authorization'),`Bearer ${token}`))return NextResponse.json({error:'Forbidden'},{status:403,headers:{'Cache-Control':'no-store'}});
 let body:unknown;try{body=await req.json();}catch{return NextResponse.json({error:'Invalid request'},{status:400});}
 if(!body||typeof body!=='object'||Object.keys(body).some(k=>!['campaign','expires'].includes(k)))return NextResponse.json({error:'Only campaign and expires are accepted'},{status:400});
 const {campaign,expires}=body as {campaign?:unknown;expires?:unknown};
 if(typeof campaign!=='string'||!/^friend_events_announcement_[a-z0-9_]{1,60}$/.test(campaign)||typeof expires!=='number'||!Number.isSafeInteger(expires)||expires<=Date.now()||expires>Date.now()+86400000)return NextResponse.json({error:'Invalid campaign or expiry'},{status:400});
 try{return NextResponse.json(await prepareFriendAnnouncement(campaign,expires),{headers:{'Cache-Control':'no-store'}});}
 catch{return NextResponse.json({prepared:false,error:'Preparation unavailable; nothing sent'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
