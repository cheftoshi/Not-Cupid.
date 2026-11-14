import { NextRequest,NextResponse } from 'next/server';
import { timingSafeStringEqual } from '@/lib/request-security';
import { prepareOwnerReview,sendOwnerReview } from '@/lib/campaign-owner-review-adapter';
export const dynamic='force-dynamic';
export const maxDuration=60;
// No cron, enrollment, approval creation or recipient override. Preparation and
// execution use distinct short-lived credentials. Default is always disabled.
export async function POST(req:NextRequest) {
 const headers={'Cache-Control':'no-store'};
 let input:unknown;try{input=await req.json();}catch{return NextResponse.json({error:'Invalid request'},{status:400,headers});}
 if(!input||typeof input!=='object')return NextResponse.json({error:'Invalid request'},{status:400,headers});
 const body=input as Record<string,unknown>,execute=body.action==='execute';
 const prefix=execute?'CAMPAIGN_OWNER_REVIEW_EXECUTION':'CAMPAIGN_OWNER_REVIEW_PREPARE';
 const token=process.env[`${prefix}_TOKEN`]||'',expires=Date.parse(process.env[`${prefix}_EXPIRES`]||'');
 if(token.length<32||!Number.isFinite(expires)||expires<=Date.now()||!timingSafeStringEqual(req.headers.get('authorization'),`Bearer ${token}`)||(execute&&process.env.CAMPAIGN_OWNER_REVIEW_SEND_ENABLED!=='true'))return NextResponse.json({error:'Disabled or unauthorized'},{status:403,headers});
 const allowed=execute?['action','campaign','manifestHash']:['action','campaign','expires'];
 if(!['prepare','execute'].includes(String(body.action))||Object.keys(body).some(k=>!allowed.includes(k))||typeof body.campaign!=='string'||!/^friend_events_announcement_[a-z0-9_]{1,60}$/.test(body.campaign))return NextResponse.json({error:'Invalid frozen reference'},{status:400,headers});
 try {
  if(execute){if(typeof body.manifestHash!=='string'||!/^[a-f0-9]{64}$/.test(body.manifestHash))return NextResponse.json({error:'Invalid hash'},{status:400,headers});return NextResponse.json(await sendOwnerReview(body.campaign,body.manifestHash,expires),{headers});}
  if(typeof body.expires!=='number'||!Number.isSafeInteger(body.expires)||body.expires<=Date.now()||body.expires>Date.now()+86400000)return NextResponse.json({error:'Invalid expiry'},{status:400,headers});
  return NextResponse.json(await prepareOwnerReview(body.campaign,body.expires),{headers});
 }catch{return NextResponse.json({error:execute?'Outcome uncertain; reconcile ledger before retry':'Preparation unavailable; nothing sent'},{status:503,headers});}
}
