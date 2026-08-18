export type AcquisitionKind = 'utm' | 'referrer';

export type AcquisitionAttribution = {
  source: string;
  medium: string | null;
  campaign: string | null;
  kind: AcquisitionKind;
  landingPath: string;
  capturedAt: string;
};

export const ACQUISITION_STORAGE_KEY = 'nc_acquisition_v1';
export const ACQUISITION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const ONLY_IN_BOSTON_CAMPAIGN = {
  source: 'only_in_boston',
  medium: 'instagram_story',
  campaign: 'only_in_boston_aug_2026',
  // The post was confirmed live during the announced 8–10 AM ET window. The
  // broad window begins at 8 AM and is always labelled contextual, never as
  // directly attributed traffic.
  launchStartedAt: '2026-08-18T12:00:00.000Z',
  launchLabel: 'August 18, 8:00 AM ET',
  landingPath: '/dating-experiment',
  shortPath: '/go/only-in-boston',
} as const;

function cleanTag(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
  return clean || null;
}

function cleanLandingPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value.split('?')[0].split('#')[0].slice(0, 200) || '/';
}

export function sanitizeAcquisition(value: unknown): AcquisitionAttribution | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const source = cleanTag(row.source);
  if (!source) return null;
  const kind: AcquisitionKind = row.kind === 'referrer' ? 'referrer' : 'utm';
  const parsedAt = typeof row.capturedAt === 'string' ? Date.parse(row.capturedAt) : Number.NaN;
  return {
    source,
    medium: cleanTag(row.medium),
    campaign: cleanTag(row.campaign),
    kind,
    landingPath: cleanLandingPath(row.landingPath),
    capturedAt: Number.isFinite(parsedAt) ? new Date(parsedAt).toISOString() : new Date().toISOString(),
  };
}

function socialSource(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'instagram';
    if (host === 'reddit.com' || host.endsWith('.reddit.com')) return 'reddit';
    if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'tiktok';
    if (host === 'facebook.com' || host.endsWith('.facebook.com')) return 'facebook';
    if (host === 'x.com' || host.endsWith('.x.com') || host === 't.co') return 'x';
  } catch { /* invalid referrer */ }
  return null;
}

export function attributionFromTouch(input: {
  search: string;
  pathname: string;
  referrer?: string | null;
  capturedAt?: string;
}): AcquisitionAttribution | null {
  const params = new URLSearchParams(input.search || '');
  const source = cleanTag(params.get('utm_source'));
  const capturedAt = input.capturedAt || new Date().toISOString();
  if (source) {
    return sanitizeAcquisition({
      source,
      medium: params.get('utm_medium'),
      campaign: params.get('utm_campaign'),
      kind: 'utm',
      landingPath: input.pathname,
      capturedAt,
    });
  }
  const referralSource = socialSource(input.referrer ?? null);
  if (!referralSource) return null;
  return sanitizeAcquisition({
    source: referralSource,
    medium: 'social_referral',
    campaign: null,
    kind: 'referrer',
    landingPath: input.pathname,
    capturedAt,
  });
}

export function readStoredAcquisition(): AcquisitionAttribution | null {
  if (typeof window === 'undefined') return null;
  try {
    const attribution = sanitizeAcquisition(JSON.parse(localStorage.getItem(ACQUISITION_STORAGE_KEY) || 'null'));
    if (!attribution || Date.now() - Date.parse(attribution.capturedAt) > ACQUISITION_TTL_MS) {
      localStorage.removeItem(ACQUISITION_STORAGE_KEY);
      return null;
    }
    return attribution;
  } catch {
    return null;
  }
}

export function captureBrowserAcquisition(pathname: string): AcquisitionAttribution | null {
  if (typeof window === 'undefined') return null;
  const touch = attributionFromTouch({
    search: window.location.search,
    pathname,
    referrer: document.referrer,
  });
  try {
    // A new explicit campaign is last-touch attribution. A generic social
    // referrer fills an empty/expired attribution but never overwrites a UTM.
    if (touch?.kind === 'utm') localStorage.setItem(ACQUISITION_STORAGE_KEY, JSON.stringify(touch));
    else if (touch && !readStoredAcquisition()) localStorage.setItem(ACQUISITION_STORAGE_KEY, JSON.stringify(touch));
  } catch { /* analytics must never block the product */ }
  return touch?.kind === 'utm' ? touch : readStoredAcquisition() || touch;
}

export function acquisitionColumns(attribution: AcquisitionAttribution | null): Record<string, string | null> {
  return attribution ? {
    acquisition_source: attribution.source,
    acquisition_medium: attribution.medium,
    acquisition_campaign: attribution.campaign,
    acquisition_kind: attribution.kind,
    acquisition_landing_path: attribution.landingPath,
    acquisition_captured_at: attribution.capturedAt,
  } : {};
}
