import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { isSunSign } from '@/lib/astrology';
import { isManagedStorageUrl } from '@/lib/request-security';
import { withPrivateVideoPreview } from '@/lib/private-media';
import { normalizeProfilePrompts } from '@/lib/profile-prompts';
import { normalizeProfileText } from '@/lib/profile-text';
import { experimentProfileReadiness } from '@/lib/experiment-profile';
import { recordDatingExperimentFunnelEvent } from '@/lib/dating-experiment-funnel';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ user: await withPrivateVideoPreview(user) });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const experimentFunnel = req.headers.get('x-notcupid-funnel') === 'dating-experiment-comeback';

  const allowed = [
    'name', 'age', 'gender', 'seeking', 'zip',
    'bio', 'height_cm', 'occupation', 'education',
    'music', 'food', 'hobbies', 'sports', 'prompts',
    'age_min', 'age_max', 'auto_rematch',
    'vibes', 'relationship_style', 'love_availability', 'sun_sign', 'intro_video_url',
    'email_notifications',
  ];

  const VALID_RELATIONSHIP_STYLES = new Set([
    'marriage_track', 'dink', 'enm_poly', 'casual', 'open',
  ]);
  const VALID_LOVE_AVAILABILITY = new Set(['actively_looking', 'open_to_meeting']);

  const updates: Record<string, any> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
  }

  const isInteger = (value: unknown) => typeof value === 'number' && Number.isInteger(value);
  const normalizeStringList = (key: string) => {
    if (!(key in updates)) return true;
    if (!Array.isArray(updates[key]) || updates[key].length > 50) return false;
    const values = updates[key];
    if (values.some((v: unknown) => typeof v !== 'string' || v.length > 80)) return false;
    updates[key] = Array.from(new Set(values.map((v: string) => v.trim()).filter(Boolean)));
    return true;
  };
  const validJson = (value: unknown, max = 5000) => {
    if (!value || typeof value !== 'object') return false;
    try { return JSON.stringify(value).length <= max; } catch { return false; }
  };

  const textFields = [
    { key: 'name', label: 'Name', max: 100, required: true },
    { key: 'bio', label: 'Bio', max: 500, required: false },
    { key: 'occupation', label: 'Occupation', max: 120, required: false },
    { key: 'education', label: 'Education', max: 120, required: false },
  ] as const;
  for (const field of textFields) {
    if (!(field.key in updates)) continue;
    const result = normalizeProfileText(updates[field.key], field.max, field.required);
    if (!result.ok) {
      const message = result.reason === 'required'
        ? `${field.label} is required`
        : result.reason === 'length'
          ? `${field.label} must be ${field.max} characters or fewer`
          : `${field.label} must be plain text`;
      return NextResponse.json({ error: message }, { status: 400 });
    }
    updates[field.key] = result.value;
  }
  if (typeof updates.name === 'string') {
    updates.name = updates.name.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!updates.name) return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
  }
  if (updates.age != null && (!isInteger(updates.age) || updates.age < 18 || updates.age > 100)) {
    return NextResponse.json({ error: 'Invalid age' }, { status: 400 });
  }
  if (updates.gender != null && !['m', 'f', 'nb', 'o', 'b'].includes(updates.gender)) {
    return NextResponse.json({ error: 'Invalid gender' }, { status: 400 });
  }
  if (updates.seeking != null && !['m', 'f', 'b', 'both'].includes(updates.seeking)) {
    return NextResponse.json({ error: 'Invalid seeking preference' }, { status: 400 });
  }
  // Normalize the legacy UI value so matching sees its canonical "anyone"
  // code instead of silently excluding otherwise compatible profiles.
  if (updates.seeking === 'both') updates.seeking = 'b';
  if (updates.zip != null && (typeof updates.zip !== 'string' || !/^\d{5}$/.test(updates.zip.trim()))) {
    return NextResponse.json({ error: 'Invalid ZIP code' }, { status: 400 });
  }
  if (typeof updates.zip === 'string') updates.zip = updates.zip.trim();
  if (updates.height_cm != null && (!isInteger(updates.height_cm) || updates.height_cm < 120 || updates.height_cm > 250)) {
    return NextResponse.json({ error: 'Invalid height' }, { status: 400 });
  }
  if (updates.age_min != null && (!isInteger(updates.age_min) || updates.age_min < 18 || updates.age_min > 100)) {
    return NextResponse.json({ error: 'Invalid min age' }, { status: 400 });
  }
  if (updates.age_max != null && (!isInteger(updates.age_max) || updates.age_max < 18 || updates.age_max > 100)) {
    return NextResponse.json({ error: 'Invalid max age' }, { status: 400 });
  }
  const finalAgeMin = updates.age_min ?? user.age_min;
  const finalAgeMax = updates.age_max ?? user.age_max;
  if (finalAgeMin != null && finalAgeMax != null && finalAgeMin > finalAgeMax) {
    return NextResponse.json({ error: 'Minimum age must not exceed maximum age' }, { status: 400 });
  }
  if (!['music', 'food', 'hobbies', 'sports'].every(normalizeStringList)) {
    return NextResponse.json({ error: 'Invalid interests' }, { status: 400 });
  }
  if ('prompts' in updates) {
    if (!validJson(updates.prompts) || !Array.isArray(updates.prompts) || updates.prompts.length > 3) {
      return NextResponse.json({ error: 'Invalid prompts' }, { status: 400 });
    }
    const normalized = normalizeProfilePrompts(updates.prompts);
    const suppliedWithAnswers = updates.prompts.filter((entry: any) => entry?.answer?.trim()).length;
    if (normalized.length !== suppliedWithAnswers) {
      return NextResponse.json({ error: 'Choose a valid prompt and keep each answer under 180 characters' }, { status: 400 });
    }
    updates.prompts = normalized;
  }
  // `vibes` is optional on legacy profiles. A null value means "not answered"
  // and must not make unrelated profile edits impossible to save.
  if ('vibes' in updates && updates.vibes != null && !validJson(updates.vibes)) {
    return NextResponse.json({ error: 'Invalid vibes' }, { status: 400 });
  }
  if ('auto_rematch' in updates && typeof updates.auto_rematch !== 'boolean') {
    return NextResponse.json({ error: 'Invalid auto-rematch preference' }, { status: 400 });
  }
  if ('email_notifications' in updates && typeof updates.email_notifications !== 'boolean') {
    return NextResponse.json({ error: 'Invalid notification preference' }, { status: 400 });
  }
  if (updates.relationship_style != null && !VALID_RELATIONSHIP_STYLES.has(updates.relationship_style)) {
    return NextResponse.json({ error: 'Invalid relationship style' }, { status: 400 });
  }
  if (updates.love_availability != null && !VALID_LOVE_AVAILABILITY.has(updates.love_availability)) {
    return NextResponse.json({ error: 'Invalid Love Line availability' }, { status: 400 });
  }
  // sun_sign is one of the 12 keys, or '' / null to clear it.
  if (updates.sun_sign != null && updates.sun_sign !== '' && !isSunSign(updates.sun_sign)) {
    return NextResponse.json({ error: 'Invalid sun sign' }, { status: 400 });
  }
  if (updates.sun_sign === '') updates.sun_sign = null;
  // intro_video_url: a Supabase-storage https URL, or null to clear it.
  if ('intro_video_url' in updates) {
    const v = updates.intro_video_url;
    if (v == null || v === '') updates.intro_video_url = null;
    else if (typeof v !== 'string' || v.length > 600
      || !isManagedStorageUrl(v, 'raffle-videos', `profile/${user.id}/`)) {
      return NextResponse.json({ error: 'Invalid video' }, { status: 400 });
    }
  }

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

  const MATCHING_INPUTS = new Set([
    'age', 'gender', 'seeking', 'zip', 'age_min', 'age_max',
    'vibes', 'relationship_style',
  ]);
  if (Object.keys(updates).some((key) => MATCHING_INPUTS.has(key))) {
    updates.roster_snapshot = [];
    updates.roster_refreshed_at = null;
    updates.status = 'waiting';
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Profile update failed:', error);
    return NextResponse.json({ error: 'Profile update failed' }, { status: 500 });
  }

  if (experimentFunnel) {
    const readiness = experimentProfileReadiness(data);
    await recordDatingExperimentFunnelEvent(user.id, 'profile_saved', {
      eligible: readiness.complete,
      missing: readiness.missing.map((item) => item.key),
    });
    if (readiness.complete) {
      await recordDatingExperimentFunnelEvent(user.id, 'profile_eligible');
    }
  }

  return NextResponse.json({ user: await withPrivateVideoPreview(data) });
}
