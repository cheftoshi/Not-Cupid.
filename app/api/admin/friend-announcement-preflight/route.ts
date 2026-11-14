import { NextRequest,NextResponse } from 'next/server';
import { timingSafeStringEqual } from '@/lib/request-security';
import { friendAnnouncementPreflight } from '@/lib/friend-announcement-preflight';
export const dynamic='force-dynamic';
export const maxDuration=300;
// Narrow aggregate-only diagnostic, no sending. Expiring operator token is kept
// server-side, never returned; the endpoint is disabled without a future expiry.
export async function POST(req:NextRequest) {
 const token=process.env.FRIEND_ANNOUNCEMENT_PREFLIGHT_TOKEN||'';
 const expires=Date.parse(process.env.FRIEND_ANNOUNCEMENT_PREFLIGHT_EXPIRES||'');
 if(token.length<32||!Number.isFinite(expires)||expires<=Date.now()||!timingSafeStringEqual(req.headers.get('authorization'),`Bearer ${token}`))return NextResponse.json({error:'Forbidden'},{status:403});
 try {return NextResponse.json(await friendAnnouncementPreflight(),{headers:{'Cache-Control':'no-store'}});}
 catch {return NextResponse.json({complete:false,error:'Preflight lookup unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
