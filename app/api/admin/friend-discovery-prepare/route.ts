import { NextRequest, NextResponse } from 'next/server';
import { timingSafeStringEqual } from '@/lib/request-security';
import { prepareFriendDiscovery } from '@/lib/friend-discovery-prepare';
export const dynamic='force-dynamic';
export const maxDuration=300;
// Dedicated expiring preparation credential. No execute action or send flag.
export async function POST(req:NextRequest){
  const headers={'Cache-Control':'no-store'},token=process.env.FRIEND_DISCOVERY_PREPARE_TOKEN||'',expiry=Date.parse(process.env.FRIEND_DISCOVERY_PREPARE_EXPIRES||'');
  if(token.length<32||!Number.isFinite(expiry)||expiry<=Date.now()||!timingSafeStringEqual(req.headers.get('authorization'),`Bearer ${token}`))return NextResponse.json({error:'Forbidden'},{status:403,headers});
  const raw=await req.text();if(raw.length>1024)return NextResponse.json({error:'Too large'},{status:413,headers});
  let body;try{body=JSON.parse(raw);}catch{return NextResponse.json({error:'Invalid request'},{status:400,headers});}
  if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).some(k=>!['edition','revision'].includes(k))||!['ideas','weekend'].includes(body.edition)||!Number.isInteger(body.revision??1)||(body.revision??1)<1||(body.revision??1)>20)return NextResponse.json({error:'Only edition and revision are accepted'},{status:400,headers});
  try{return NextResponse.json(await prepareFriendDiscovery(body.edition,body.revision??1),{headers});}catch{return NextResponse.json({prepared:false,sendReady:false,error:'Preparation unavailable; nothing sent'},{status:503,headers});}
}
