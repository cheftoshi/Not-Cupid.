import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Expansion waitlist (the out-of-range page). Notifies the team SERVER-SIDE
// using the server RESEND key — replaces a broken client call that referenced a
// NEXT_PUBLIC_ Resend key (which would have shipped the secret to the browser).
export async function POST(req: NextRequest) {
  const { email, city } = await req.json().catch(() => ({}));
  if (!email || typeof email !== 'string' || !email.includes('@') || email.length > 200) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }
  const safeEmail = esc(email.trim().slice(0, 200));
  const safeCity = esc((typeof city === 'string' ? city : '').trim().slice(0, 100));

  await sendEmail({
    to: 'match@notcupid.com',
    subject: `Waitlist · ${safeCity || 'unknown city'}`,
    html: `<p>New expansion waitlist signup.</p><p><strong>Email:</strong> ${safeEmail}<br/><strong>City:</strong> ${safeCity || '—'}</p>`,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
