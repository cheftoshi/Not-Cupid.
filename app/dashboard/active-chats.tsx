'use client';

import { relationshipStyleLabel } from '@/lib/quiz-data';
import { signLabel } from '@/lib/astrology';

// Your active/chosen matches — the rich cards at the TOP of the dashboard. Shows
// the free details (archetype, career, city, style, sign) always, plus the
// unlock-gated stuff (bio + interests) once the $0.99 profile is unlocked.
type Card = {
  matchId: string; name: string; photo_url: string | null; age: number | null;
  archetype: string | null; occupation?: string | null; city?: string | null;
  relationship_style?: string | null; sun_sign?: string | null;
  bio?: string | null; interests?: string[];
  score: number | null;
  status: 'chatting' | 'waiting' | 'your-move'; profileUnlocked: boolean; hasContent: boolean;
};

const STATUS = {
  chatting: { label: '● chatting', color: '#2d7a4f' },
  'your-move': { label: '● your move', color: '#2563ff' },
  waiting: { label: '● waiting on them', color: 'var(--h-text-dim)' },
} as const;

export default function ActiveChats({ cards }: { cards: Card[] }) {
  if (!cards.length) return null;

  async function unlock(matchId: string) {
    try {
      const res = await fetch(`/api/matches/${matchId}/unlock-checkout`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'profile' }),
      });
      const d = await res.json();
      if (res.ok && d.url) window.location.href = d.url;
    } catch { /* ignore */ }
  }

  return (
    <div>
      <style>{`
        [data-chat] { transition: box-shadow .22s var(--ease), transform .22s var(--ease); }
        [data-chat]:hover { box-shadow: var(--shadow-lg); }
      `}</style>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--h-text-dim)', marginBottom: '0.85rem' }}>
        your chats · {cards.length}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.1rem' }}>
        {cards.map((a) => {
          const first = (a.name || 'your match').split(' ')[0];
          const s = STATUS[a.status];
          const style = relationshipStyleLabel(a.relationship_style);
          const sign = signLabel(a.sun_sign);
          const meta = [
            a.occupation ? `💼 ${a.occupation}` : null,
            a.city ? `📍 ${a.city}` : null,
            style ? `💞 ${style}` : null,
            sign ? `✨ ${sign}` : null,
          ].filter(Boolean) as string[];
          return (
            <div key={a.matchId} data-chat style={{ display: 'flex', gap: '1.1rem', background: 'var(--h-surface)', border: '2px solid var(--blue)', borderRadius: 18, padding: '1.1rem', boxShadow: 'var(--shadow-md)' }}>
              <div style={{ width: 116, height: 150, borderRadius: 14, overflow: 'hidden', flexShrink: 0, background: 'var(--h-surface-2)' }}>
                {a.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at 32% 28%, rgba(37,99,255,0.2), transparent 60%), var(--h-surface-2)', fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic', fontWeight: 700, color: 'var(--blue)', fontSize: '2.6rem' }}>{(first?.[0] || '✦').toUpperCase()}</div>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.55rem', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: "'Playfair Display', Georgia, ui-serif, serif", fontSize: '1.45rem', fontWeight: 700, color: 'var(--h-text)', lineHeight: 1 }}>
                    {first}{a.age ? <span style={{ fontWeight: 400, fontStyle: 'italic', color: 'var(--h-text-dim)' }}>, {a.age}</span> : null}
                  </span>
                  {a.score != null && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', fontWeight: 700, color: 'var(--blue)' }}>{a.score}%</span>}
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: s.color }}>{s.label}</div>
                {a.archetype && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--h-text-dim)', lineHeight: 1.3 }}>{a.archetype}</div>}

                {meta.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.75rem', fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.04em', color: 'var(--h-text-dim)' }}>
                    {meta.map((m, i) => <span key={i}>{m}</span>)}
                  </div>
                )}

                {a.interests && a.interests.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.1rem' }}>
                    {a.interests.map((it, i) => (
                      <span key={i} style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.04em', textTransform: 'lowercase', color: 'var(--h-text-dim)', background: 'var(--h-surface-3)', border: '1px solid var(--h-border)', borderRadius: 999, padding: '0.15rem 0.5rem' }}>{it}</span>
                    ))}
                  </div>
                )}

                {a.bio && <p style={{ margin: '0.15rem 0 0', fontFamily: 'Georgia, ui-serif, serif', fontStyle: 'italic', fontSize: '0.82rem', lineHeight: 1.45, color: 'var(--h-text-dim)' }}>“{a.bio.length > 120 ? a.bio.slice(0, 120) + '…' : a.bio}”</p>}

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: 'auto', paddingTop: '0.5rem', flexWrap: 'wrap' }}>
                  <a href={`/match/${a.matchId}`} style={{ textDecoration: 'none', background: '#2563ff', color: '#fff', borderRadius: 10, padding: '0.55rem 1rem', fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    💬 {a.status === 'your-move' ? 'say hi →' : 'open chat →'}
                  </a>
                  {!a.profileUnlocked && a.hasContent && (
                    <button onClick={() => unlock(a.matchId)} style={{ background: 'none', border: '1px solid var(--h-border)', color: 'var(--h-accent)', borderRadius: 10, padding: '0.52rem 0.8rem', fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.05em', textTransform: 'uppercase', cursor: 'pointer' }}>🔒 see full profile · $0.99</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
