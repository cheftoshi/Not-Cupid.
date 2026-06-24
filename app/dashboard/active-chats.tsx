'use client';

// Your active/chosen matches as openable chat cards — a distributed row at the
// top of the dashboard (a "your chats" inbox), each opening the conversation.
type Card = {
  matchId: string; name: string; photo_url: string | null; age: number | null;
  archetype: string | null; score: number | null;
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
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--h-text-dim)', marginBottom: '0.7rem' }}>
        your chats · {cards.length}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {cards.map((a) => {
          const first = (a.name || 'your match').split(' ')[0];
          const s = STATUS[a.status];
          return (
            <div key={a.matchId} style={{ display: 'flex', gap: '0.9rem', alignItems: 'center', background: 'var(--h-surface)', border: '2px solid #2563ff', borderRadius: 16, padding: '0.85rem 0.95rem', boxShadow: '0 14px 40px -28px rgba(0,0,0,0.5)' }}>
              <div style={{ width: 76, height: 76, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: 'var(--h-surface-2)' }}>
                {a.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#2563ff', fontSize: '0.7rem' }}>no photo</div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Georgia, ui-serif, serif', fontSize: '1.15rem', fontWeight: 700, color: 'var(--h-text)' }}>
                  {first}{a.age ? <span style={{ fontWeight: 400, fontStyle: 'italic', color: 'var(--h-text-dim)' }}>, {a.age}</span> : null}
                  {a.score != null && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', color: 'var(--h-text-faint)', marginLeft: '0.5rem' }}>{a.score}%</span>}
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: s.color, marginTop: '0.15rem' }}>{s.label}</div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.55rem', flexWrap: 'wrap' }}>
                  <a href={`/match/${a.matchId}`} style={{ textDecoration: 'none', background: '#2563ff', color: '#fff', borderRadius: 9, padding: '0.45rem 0.85rem', fontFamily: "'DM Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    💬 {a.status === 'your-move' ? 'say hi →' : 'open chat →'}
                  </a>
                  {!a.profileUnlocked && a.hasContent && (
                    <button onClick={() => unlock(a.matchId)} style={{ background: 'none', border: '1px solid var(--h-border)', color: 'var(--h-accent)', borderRadius: 9, padding: '0.42rem 0.7rem', fontFamily: "'DM Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>🔒 $0.99</button>
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
