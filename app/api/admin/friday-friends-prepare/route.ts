import { NextRequest, NextResponse } from 'next/server';
import { timingSafeStringEqual } from '@/lib/request-security';
import { prepareFriendDiscovery } from '@/lib/friend-discovery-prepare';
import { fridayReadinessPlan, fridayPreparationWindow } from '@/lib/friday-friends-policy';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const headers = {'Cache-Control':'no-store'};
function authorized(req: NextRequest) {
  const token = process.env.FRIEND_DISCOVERY_PREPARE_TOKEN || '';
  const expires = Date.parse(process.env.FRIEND_DISCOVERY_PREPARE_EXPIRES || '');
  return token.length >= 32 && Number.isFinite(expires) && expires > Date.now() && timingSafeStringEqual(req.headers.get('authorization'), `Bearer ${token}`);
}
// GET is a no-database/no-provider schedule proposal, never an activation.
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({error:'Forbidden'}, {status:403, headers});
  return NextResponse.json(fridayReadinessPlan(), {headers});
}
// Freeze a fresh review artifact only, after the daily digest window has closed.
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({error:'Forbidden'}, {status:403, headers});
  const raw = await req.text();
  if (raw.length > 1024) return NextResponse.json({error:'Too large'}, {status:413, headers});
  let body;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({error:'Invalid request'}, {status:400, headers}); }
  if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).some(k => !['deliveryDay','revision'].includes(k)) || typeof body.deliveryDay !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.deliveryDay) || !Number.isInteger(body.revision ?? 1) || (body.revision ?? 1)<1 || (body.revision ?? 1)>20) return NextResponse.json({error:'Only deliveryDay and revision are accepted'}, {status:400, headers});
  const now = Date.now();
  try { fridayPreparationWindow(body.deliveryDay, now); } catch { return NextResponse.json({error:'Fresh Friday preparation window required', ...fridayReadinessPlan(now)}, {status:409, headers}); }
  try { return NextResponse.json(await prepareFriendDiscovery('weekend', body.revision ?? 1, now, body.deliveryDay), {headers}); }
  catch { return NextResponse.json({prepared:false, sendReady:false, error:'Preparation unavailable; nothing sent'}, {status:503, headers}); }
}
