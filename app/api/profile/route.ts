import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { isSunSign } from '@/lib/astrology';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ user });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  const allowed = [
    'name', 'age', 'gender', 'seeking', 'zip',
    'bio', 'height_cm', 'occupation', 'education',
    'music', 'food', 'hobbies', 'sports', 'prompts',
    'age_min', 'age_max', 'auto_rematch',
    'vibes', 'relationship_style', 'sun_sign',
    'email_notifications',
  ];

  const VALID_RELATIONSHIP_STYLES = new Set([
    'marriage_track', 'dink', 'enm_poly', 'casual', 'open',
  ]);

  const updates: Record<string, any> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
  }

  // Validations that handle null/undefined safely
  if (updates.age != null && (updates.age < 18 || updates.age > 100)) {
    return NextResponse.json({ error: 'Invalid age' }, { status: 400 });
  }
  if (updates.bio != null && updates.bio.length > 500) {
    return NextResponse.json({ error: 'Bio too long (max 500)' }, { status: 400 });
  }
  if (updates.height_cm != null && (updates.height_cm < 120 || updates.height_cm > 250)) {
    return NextResponse.json({ error: 'Invalid height' }, { status: 400 });
  }
  if (updates.age_min != null && (updates.age_min < 18 || updates.age_min > 100)) {
    return NextResponse.json({ error: 'Invalid min age' }, { status: 400 });
  }
  if (updates.age_max != null && (updates.age_max < 18 || updates.age_max > 100)) {
    return NextResponse.json({ error: 'Invalid max age' }, { status: 400 });
  }
  if (updates.relationship_style != null && !VALID_RELATIONSHIP_STYLES.has(updates.relationship_style)) {
    return NextResponse.json({ error: 'Invalid relationship style' }, { status: 400 });
  }
  // sun_sign is one of the 12 keys, or '' / null to clear it.
  if (updates.sun_sign != null && updates.sun_sign !== '' && !isSunSign(updates.sun_sign)) {
    return NextResponse.json({ error: 'Invalid sun sign' }, { status: 400 });
  }
  if (updates.sun_sign === '') updates.sun_sign = null;

  // email_notifications and pool_active are coupled: turning emails off
  // pulls you from the matching pool (you can't be notified of matches);
  // turning them back on puts you back in.
  if (typeof updates.email_notifications === 'boolean') {
    updates.pool_active = updates.email_notifications;
    if (updates.email_notifications === false) {
      updates.notifications_paused_at = new Date().toISOString();
    } else {
      updates.notifications_paused_at = null;
    }
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Profile update failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ user: data });
}
