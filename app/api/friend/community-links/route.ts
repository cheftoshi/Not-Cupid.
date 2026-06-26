import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { metroOf } from '@/lib/quiz-data';

export const dynamic = 'force-dynamic';

const KINDS = ['discord', 'whatsapp', 'groupme', 'telegram', 'slack', 'other'];

// GET — APPROVED community links in your city (realm-segregated).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const meTest = (user as any).is_test === true;
  const myMetro = metroOf((user as any).zip);
  let q = supabaseAdmin.from('friend_community_links').select('id, title, url, kind, description, created_at')
    .eq('approved', true).eq('is_test', meTest).order('created_at', { ascending: false }).limit(60);
  if (myMetro) q = q.eq('metro', myMetro);
  const { data } = await q;
  return NextResponse.json({ links: data ?? [] });
}

// POST { title, url, kind, description } — submit a link (stays hidden until an
// admin approves it).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.friend_opted_in_at) return NextResponse.json({ error: 'Join the Friend Line first.' }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  const title = String(b.title ?? '').trim().slice(0, 100);
  let url = String(b.url ?? '').trim().slice(0, 400);
  if (!title || !url) return NextResponse.json({ error: 'Title and link required.' }, { status: 400 });
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  if (!/^https?:\/\/[^\s.]+\.[^\s]+/i.test(url)) return NextResponse.json({ error: 'That doesn’t look like a valid link.' }, { status: 400 });
  const kind = KINDS.includes(b.kind) ? b.kind : 'other';
  const description = String(b.description ?? '').trim().slice(0, 240) || null;

  const { error } = await supabaseAdmin.from('friend_community_links').insert({
    title, url, kind, description,
    submitter_id: user.id, metro: metroOf((user as any).zip), is_test: (user as any).is_test === true,
    approved: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
