import { NextRequest, NextResponse } from 'next/server';
import { FRIEND_EVENT_COOKIE, verifyFriendEventToken, signFriendEventToken } from '@/lib/friend-event-campaign';
import { supabaseAdmin } from '@/lib/supabase';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  const claim = verifyFriendEventToken(req.nextUrl.searchParams.get('token'), 'attribution');
  const response = NextResponse.redirect(new URL('/hub?discover=1', req.url));
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Cache-Control', 'no-store');
  if (!claim || !claim.deliveryId) return response;
  const { data, error } = await supabaseAdmin.from('friend_event_deliveries').select('id').eq('id', claim.deliveryId).eq('user_id', claim.userId).eq('channel', claim.channel).in('status', ['accepted', 'delivered']).maybeSingle();
  if (error || !data) return response;
  // Raw request, NOT a verified human tap: email security scanners follow URLs.
  await supabaseAdmin.from('friend_event_attribution').upsert({ delivery_id: claim.deliveryId, event: 'link_request' }, { onConflict: 'delivery_id,event', ignoreDuplicates: true });
  response.cookies.set(FRIEND_EVENT_COOKIE, signFriendEventToken({ ...claim, expires: Math.min(claim.expires, Date.now() + 7 * 86400000) }), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 7 * 86400 });
  return response;
}
