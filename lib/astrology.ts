// Sun signs — PROFILE FLAVOR ONLY. This never touches the matching score
// (lib/matching.ts); it's a fun badge + a playful "cosmic note" on cards. Users
// pick their sign (no birthdate stored).

export type Element = 'fire' | 'earth' | 'air' | 'water';

export interface SunSign {
  key: string; name: string; glyph: string; element: Element; dates: string;
}

export const SUN_SIGNS: SunSign[] = [
  { key: 'aries',       name: 'Aries',       glyph: '♈', element: 'fire',  dates: 'Mar 21 – Apr 19' },
  { key: 'taurus',      name: 'Taurus',      glyph: '♉', element: 'earth', dates: 'Apr 20 – May 20' },
  { key: 'gemini',      name: 'Gemini',      glyph: '♊', element: 'air',   dates: 'May 21 – Jun 20' },
  { key: 'cancer',      name: 'Cancer',      glyph: '♋', element: 'water', dates: 'Jun 21 – Jul 22' },
  { key: 'leo',         name: 'Leo',         glyph: '♌', element: 'fire',  dates: 'Jul 23 – Aug 22' },
  { key: 'virgo',       name: 'Virgo',       glyph: '♍', element: 'earth', dates: 'Aug 23 – Sep 22' },
  { key: 'libra',       name: 'Libra',       glyph: '♎', element: 'air',   dates: 'Sep 23 – Oct 22' },
  { key: 'scorpio',     name: 'Scorpio',     glyph: '♏', element: 'water', dates: 'Oct 23 – Nov 21' },
  { key: 'sagittarius', name: 'Sagittarius', glyph: '♐', element: 'fire',  dates: 'Nov 22 – Dec 21' },
  { key: 'capricorn',   name: 'Capricorn',   glyph: '♑', element: 'earth', dates: 'Dec 22 – Jan 19' },
  { key: 'aquarius',    name: 'Aquarius',    glyph: '♒', element: 'air',   dates: 'Jan 20 – Feb 18' },
  { key: 'pisces',      name: 'Pisces',      glyph: '♓', element: 'water', dates: 'Feb 19 – Mar 20' },
];

const BY_KEY = new Map(SUN_SIGNS.map((s) => [s.key, s]));
export const isSunSign = (k: unknown): k is string => typeof k === 'string' && BY_KEY.has(k);
export const signMeta = (key: string | null | undefined): SunSign | null => (key ? BY_KEY.get(key) ?? null : null);
export function signLabel(key: string | null | undefined): string | null {
  const s = signMeta(key);
  return s ? `${s.glyph} ${s.name}` : null;
}

// Classic element harmony: same element clicks; fire+air feed each other;
// earth+water nourish each other; everything else is more of a slow burn.
export function signCompat(aKey: string | null | undefined, bKey: string | null | undefined):
  { level: 'high' | 'mixed'; note: string } | null {
  const a = signMeta(aKey), b = signMeta(bKey);
  if (!a || !b) return null;
  const pair = new Set([a.element, b.element]);
  const high =
    a.element === b.element ||
    (pair.has('fire') && pair.has('air')) ||
    (pair.has('earth') && pair.has('water'));
  if (a.element === b.element) {
    return { level: 'high', note: `two ${a.element} signs — same wavelength, instant shorthand.` };
  }
  if (high) {
    return { level: 'high', note: `${a.element} + ${b.element} — opposites that actually feed each other.` };
  }
  return { level: 'mixed', note: `${a.element} meets ${b.element} — a slow burn, but the spark is there.` };
}
