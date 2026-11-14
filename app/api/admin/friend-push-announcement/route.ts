import {NextRequest,NextResponse} from 'next/server';
import {timingSafeStringEqual} from '@/lib/request-security';
import {preparePush,executePush} from '@/lib/friend-push-announcement';
export const dynamic='force-dynamic';export const maxDuration=300;
export async function POST(req:NextRequest){
 const token=process.env.FRIEND_PUSH_ANNOUNCEMENT_TOKEN||'';const expires=Date.parse(process.env.FRIEND_PUSH_ANNOUNCEMENT_EXPIRES||'');
 if(token.length<32||!Number.isFinite(expires)||expires<=Date.now()||!timingSafeStringEqual(req.headers.get('authorization'),`Bearer ${token}`))return NextResponse.json({error:'Disabled or unauthorized'},{status:403});
 try{const input=await req.json();if(!input||Object.keys(input).some(k=>!['action','manifestHash'].includes(k)))return NextResponse.json({error:'Invalid input'},{status:400});
 if(input.action==='prepare')return NextResponse.json(await preparePush(),{headers:{'Cache-Control':'no-store'}});
 if(input.action==='execute'&&typeof input.manifestHash==='string'&&/^[a-f0-9]{64}$/.test(input.manifestHash)&&process.env.FRIEND_PUSH_ANNOUNCEMENT_SEND_ENABLED==='true')return NextResponse.json(await executePush(input.manifestHash),{headers:{'Cache-Control':'no-store'}});
 return NextResponse.json({error:'Execution disabled or invalid input'},{status:403});
 }catch{return NextResponse.json({error:'Stopped; inspect ledger before any retry'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
