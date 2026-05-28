import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

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
    'music', 'food', 'hobbies', 'prompts',
    'age_min', 'age_max', 'auto_rematch',
    'vibes',
  ];

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
