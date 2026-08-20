import { NextRequest, NextResponse } from 'next/server';
import { escapeHtml } from '@/lib/email';
import { verifyWinnerConfirmation } from '@/lib/dating-experiment-winner-confirmation';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type WinnerResponse = 'still_in' | 'cant_make_it';

const page = (input: { title: string; body: string; form?: string }, status = 200) => new NextResponse(`<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(input.title)}</title></head>
<body style="margin:0;background:#f6f6f6;color:#0b0b0b;font-family:system-ui,-apple-system,sans-serif;"><main style="max-width:520px;margin:0 auto;padding:48px 22px;"><div style="background:#fff;border:1px solid #e7e7ea;border-radius:18px;padding:28px;"><div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#2563ff;">NotCupid Dating Experiment</div><h1 style="font-family:Georgia,serif;font-size:32px;line-height:1.1;margin:12px 0;">${escapeHtml(input.title)}</h1><p style="line-height:1.6;color:#555;">${escapeHtml(input.body)}</p>${input.form || ''}</div></main></body></html>`, {
  status,
  headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' },
});

async function validWinner(drawId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('raffle_draws')
    .select('id,user_a_id,user_b_id,status,winner_slot')
    .eq('id', drawId)
    .eq('status', 'both_accepted')
    .not('winner_slot', 'is', null)
    .maybeSingle();
  if (error) throw error;
  return !!data && (data.user_a_id === userId || data.user_b_id === userId);
}

export async function GET(req: NextRequest) {
  const drawId = req.nextUrl.searchParams.get('draw');
  const userId = req.nextUrl.searchParams.get('user');
  const token = req.nextUrl.searchParams.get('token');
  const intent: WinnerResponse = req.nextUrl.searchParams.get('intent') === 'cant_make_it' ? 'cant_make_it' : 'still_in';
  if (!verifyWinnerConfirmation({ drawId, userId, token })) return page({ title: 'This confirmation link is not valid.', body: 'Reply to the email if you need help.' }, 400);
  if (!await validWinner(drawId!, userId!)) return page({ title: 'This confirmation is no longer available.', body: 'Reply to the email if you need help.' }, 409);
  const title = intent === 'still_in' ? 'Confirm you’re still in?' : 'Confirm you can’t make it?';
  const body = intent === 'still_in'
    ? 'Your dinner is tonight at 6:30 PM at The Berkeley. The reservation is under NotCupid App.'
    : 'We’ll record that your plans changed and notify the operator. Please confirm below.';
  const form = `<form method="post"><input type="hidden" name="draw" value="${escapeHtml(drawId)}"><input type="hidden" name="user" value="${escapeHtml(userId)}"><input type="hidden" name="token" value="${escapeHtml(token)}"><input type="hidden" name="response" value="${intent}"><button type="submit" style="width:100%;border:0;border-radius:10px;background:${intent === 'still_in' ? '#0b0b0b' : '#fff'};color:${intent === 'still_in' ? '#fff' : '#b42318'};padding:15px;font-weight:700;font-size:15px;cursor:pointer;${intent === 'cant_make_it' ? 'border:1px solid #b42318;' : ''}">${intent === 'still_in' ? 'YES, I’M STILL IN' : 'I CAN’T MAKE IT'}</button></form>`;
  return page({ title, body, form });
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const drawId = String(form.get('draw') || '');
  const userId = String(form.get('user') || '');
  const token = String(form.get('token') || '');
  const response: WinnerResponse = form.get('response') === 'cant_make_it' ? 'cant_make_it' : 'still_in';
  if (!verifyWinnerConfirmation({ drawId, userId, token })) return page({ title: 'This confirmation link is not valid.', body: 'Reply to the email if you need help.' }, 400);
  if (!await validWinner(drawId, userId)) return page({ title: 'This confirmation is no longer available.', body: 'Reply to the email if you need help.' }, 409);
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from('dating_experiment_winner_confirmations').upsert({
    draw_id: drawId,
    user_id: userId,
    response,
    responded_at: now,
    updated_at: now,
  }, { onConflict: 'draw_id,user_id' });
  if (error) return page({ title: 'We couldn’t save that yet.', body: 'Please try again or reply to the email.' }, 503);
  return response === 'still_in'
    ? page({ title: 'You’re confirmed.', body: 'We’ll see you at The Berkeley at 6:30 PM. The reservation is under NotCupid App.' })
    : page({ title: 'Thanks for letting us know.', body: 'Your change has been recorded. The NotCupid team will take it from here.' });
}
