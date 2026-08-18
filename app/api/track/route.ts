import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { acquisitionColumns, sanitizeAcquisition } from '@/lib/acquisition';

export const dynamic = 'force-dynamic';

function safeReferrer(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    // Never retain query strings or fragments: emailed action links and
    // checkout returns can contain bearer tokens or provider session IDs.
    return `${url.origin}${url.pathname}`.slice(0, 300);
  } catch {
    return null;
  }
}

// Fire-and-forget pageview beacon. No auth (anonymous visitors count too),
// kept deliberately cheap — no session lookup per hit.
export async function POST(req: NextRequest) {
  try {
    const limit = await rateLimit({ key: `track:${getClientIp(req)}`, windowSec: 60, maxAttempts: 240, blockSec: 60 });
    if (!limit.ok) return NextResponse.json({ ok: false }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } });
    const { path, ref, anonId, displayMode, deviceClass, orientation, acquisition } = await req.json().catch(() => ({}));
    if (!path || typeof path !== 'string' || !path.startsWith('/')) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    // Don't log admin/api routes or anything with absurd length.
    const clean = path.split('?')[0].split('#')[0].slice(0, 200);
    if (clean.startsWith('/admin') || clean.startsWith('/api')) {
      return NextResponse.json({ ok: true, skipped: true });
    }
    const safeDisplayMode = ['standalone', 'minimal-ui', 'fullscreen', 'browser', 'unknown'].includes(displayMode) ? displayMode : 'unknown';
    const safeDeviceClass = ['phone', 'tablet', 'desktop', 'unknown'].includes(deviceClass) ? deviceClass : 'unknown';
    const safeOrientation = ['portrait', 'landscape', 'unknown'].includes(orientation) ? orientation : 'unknown';
    const row = {
      path: clean,
      anon_id: typeof anonId === 'string' ? anonId.slice(0, 64) : null,
      referrer: safeReferrer(ref),
      display_mode: safeDisplayMode,
      device_class: safeDeviceClass,
      orientation: safeOrientation,
      ...acquisitionColumns(sanitizeAcquisition(acquisition)),
    };
    const result = await supabaseAdmin.from('page_views').insert(row);
    // Deployment ordering safety: keep basic traffic flowing if the app lands
    // before the additive attribution migration reaches the database.
    if (result.error && /acquisition_/i.test(result.error.message || '')) {
      const { acquisition_source, acquisition_medium, acquisition_campaign, acquisition_kind, acquisition_landing_path, acquisition_captured_at, ...legacyRow } = row as any;
      await supabaseAdmin.from('page_views').insert(legacyRow);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
