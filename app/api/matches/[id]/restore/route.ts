import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid chat' }, { status: 400 });
  const { data, error } = await supabaseAdmin.rpc('restore_love_chat', { p_match: id, p_user: user.id });
  if (error) return NextResponse.json({ error: 'Could not restore this chat. Please try again.' }, { status: 503 });
  if (data === 'restored' || data === 'already') return NextResponse.json({ restored: true });
  const message = data === 'limit' ? 'You can restore three expired chats in 30 days.'
    : data === 'capacity' ? 'One of you has reached the connection limit. A connection must be ended first.'
    : 'This chat cannot be restored. Only automatically expired mutual chats can return, once each.';
  return NextResponse.json({ error: message }, { status: 409 });
}
