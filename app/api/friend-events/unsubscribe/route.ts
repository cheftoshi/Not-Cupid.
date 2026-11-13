import { NextRequest, NextResponse } from 'next/server';
import { verifyFriendEventToken } from '@/lib/friend-event-campaign';
import { supabaseAdmin } from '@/lib/supabase';
export const dynamic = 'force-dynamic';
// GET only displays confirmation; mail scanners cannot silently change consent.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const claim = verifyFriendEventToken(token, 'unsubscribe');
  if (!claim) return new NextResponse('Invalid or expired link', { status: 403 });
  return new NextResponse(`<html lang="en"><meta name="referrer" content="no-referrer"><title>Friend event preferences</title><body><h1>Stop Friend event ${claim.channel === 'email' ? 'emails' : 'push alerts'}?</h1><p>Your matches, messages and other channel preferences will not change.</p><form method="post"><button>Unsubscribe</button></form></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; form-action 'self'; frame-ancestors 'none'" } });
}
// Supports signed form confirmation and RFC8058 List-Unsubscribe-Post.
export async function POST(req: NextRequest) {
  const claim = verifyFriendEventToken(req.nextUrl.searchParams.get('token'), 'unsubscribe');
  if (!claim) return new NextResponse('Invalid or expired link', { status: 403 });
  const { error } = await supabaseAdmin.rpc('set_friend_event_preference', { p_user: claim.userId, p_channel: claim.channel, p_enabled: false, p_source: 'signed_unsubscribe' });
  return new NextResponse(error ? 'Could not save. Please try again.' : 'Unsubscribed from Friend event alerts for this channel. Other preferences are unchanged.', { status: error ? 503 : 200, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
