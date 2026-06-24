'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { signLabel } from '@/lib/astrology';
import styles from './pack.module.css';

type Friend = {
  otherId: string; name: string; age: number | null; photo_url: string | null;
  archetype: string | null; metro: string | null; sharedActivities: string[]; score: number | null;
  sunSign?: string | null;
};
type Phase = 'loading' | 'ready' | 'opening' | 'revealed' | 'empty' | 'ghosted';

function rarity(score: number | null) {
  const s = score ?? 0;
  if (s >= 90) return { cls: styles.rLegendary, label: '✦ legendary match' };
  if (s >= 75) return { cls: styles.rRare, label: '★ rare match' };
  return { cls: styles.rCommon, label: 'good match' };
}

export default function PackClient({ firstName, pro }: { firstName: string; pro: boolean }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [openedCount, setOpenedCount] = useState(0);
  const [flash, setFlash] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [termsOk, setTermsOk] = useState(false);
  useEffect(() => { try { if (localStorage.getItem('nc-friend-terms') === '1') setTermsOk(true); } catch { /* ignore */ } }, []);
  function agreeTerms() { setTermsOk(true); try { localStorage.setItem('nc-friend-terms', '1'); } catch { /* ignore */ } }

  // Pick someone from the pack → they get pinged that you chose them. When they
  // accept you back, you become connections.
  async function connectFriend(otherId: string) {
    if (!termsOk) return;
    setRequested((prev) => new Set(prev).add(otherId));
    try {
      await fetch('/api/friend/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidateId: otherId }) });
    } catch { /* optimistic — leave the ✓ even if the ping retries */ }
  }

  const sparks = useMemo(
    () => Array.from({ length: 26 }, (_, i) => ({
      left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, delay: `${(i % 9) * 0.34}s`,
    })),
    []
  );

  async function load() {
    setErr('');
    try {
      const r = await fetch('/api/friend/pack');
      const d = await r.json();
      if (d.ghosted) { setPhase('ghosted'); return; }
      setOpenedCount(d.openedCount || 0);
      if (Array.isArray(d.sealed) && d.sealed.length > 0) { setFriends(d.sealed); setPhase('ready'); }
      else setPhase('empty');
    } catch { setErr('something glitched — try again'); setPhase('empty'); }
  }
  useEffect(() => { load(); }, []);

  async function openPack() {
    if (phase !== 'ready') return;
    setPhase('opening');
    setFlash(true);
    fetch('/api/friend/pack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'open' }) }).catch(() => {});
    setTimeout(() => setFlash(false), 700);
    setTimeout(() => setPhase('revealed'), 760);
  }

  // "Open another pack": free for All-Access (grant + reload), else $1.99 checkout.
  async function anotherPack() {
    setBusy(true); setErr('');
    try {
      if (pro) {
        const r = await fetch('/api/friend/pack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'grant' }) });
        const d = await r.json();
        if (!r.ok) { setErr(d.error || 'could not open a pack'); return; }
        if (!d.created) { setErr('no fresh friends to pack right now — check back soon'); return; }
        await load();
      } else {
        const r = await fetch('/api/friend/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
        const d = await r.json();
        if (d.url) window.location.href = d.url;
        else setErr(d.error || 'checkout unavailable');
      }
    } catch { setErr('something glitched — try again'); }
    finally { setBusy(false); }
  }

  return (
    <div className={styles.stage}>
      <div className={styles.aura} />
      {sparks.map((s, i) => <span key={i} className={styles.spark} style={{ left: s.left, top: s.top, animationDelay: s.delay }} />)}
      {flash && <div className={styles.flash} />}
      <Link href="/friends?view=crew" className={styles.back}>← my pack</Link>

      {phase === 'loading' && <div className={styles.kicker}>shuffling the deck…</div>}

      {phase === 'ghosted' && (
        <div className={styles.center}>
          <div className={styles.headline}>paused for now</div>
          <p className={styles.subtle}>a few matches went quiet, so we paused you to keep things fair. pick back up from the Friend Line whenever you’re ready.</p>
          <Link href="/friends" className={styles.cta} style={{ marginTop: '1.4rem' }}>back to friend line →</Link>
        </div>
      )}

      {(phase === 'ready' || phase === 'opening') && (
        <div className={styles.center}>
          <div className={styles.kicker}>a friendship pack appeared</div>
          <h1 className={styles.headline}>open it, {firstName.toLowerCase()}</h1>
          <div
            className={`${styles.pack} ${phase === 'opening' ? styles.packBurst : ''}`}
            onClick={openPack} role="button" aria-label="Open your friendship pack"
          >
            <div className={styles.packEmoji}>🎒</div>
            <div className={styles.packLogo}>not<span style={{ opacity: 0.85 }}>cupid</span></div>
            <div className={styles.packTag}>friendship pack · {friends.length} inside</div>
            {/* blurred faces peeking through — you can't quite make them out yet */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.3rem', marginTop: '0.7rem' }}>
              {friends.slice(0, 6).map((f) => (
                f.photo_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img key={f.otherId} src={f.photo_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', filter: 'blur(5px)', border: '2px solid rgba(255,255,255,0.55)', opacity: 0.9 }} />
                  : <div key={f.otherId} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.35)', filter: 'blur(4px)', border: '2px solid rgba(255,255,255,0.45)' }} />
              ))}
            </div>
          </div>
          {phase === 'ready' && <div className={styles.tapHint}>tap to rip it open</div>}
        </div>
      )}

      {phase === 'revealed' && (
        <div className={styles.reveal}>
          <div className={styles.kicker} style={{ marginBottom: '0.2rem' }}>your pack · {friends.length} new {friends.length === 1 ? 'friend' : 'friends'}</div>
          <h1 className={styles.headline} style={{ marginBottom: '1rem' }}>meet your people</h1>
          {!termsOk && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', maxWidth: 520, margin: '0 auto 1rem', padding: '0.7rem 0.9rem', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 12, cursor: 'pointer', textAlign: 'left' }}>
              <input type="checkbox" checked={termsOk} onChange={agreeTerms} style={{ width: 17, height: 17, marginTop: '0.1rem', flexShrink: 0 }} />
              <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.45 }}>
                before connecting — I agree to the <a href="/terms" style={{ color: '#fff', textDecoration: 'underline' }}>terms</a> &amp; <a href="/safety" style={{ color: '#fff', textDecoration: 'underline' }}>community guidelines</a>: be kind &amp; meet new people safely.
              </span>
            </label>
          )}
          <div className={styles.cardGrid}>
            {friends.map((f, i) => {
              const r = rarity(f.score);
              return (
                <div key={f.otherId} className={styles.fcard} style={{ animationDelay: `${i * 0.16}s` }}>
                  {f.photo_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={f.photo_url} alt="" className={styles.fphoto} />
                    : <div className={styles.fphotoEmpty}>{(f.name || '?').charAt(0)}</div>}
                  <div className={styles.fname}>{(f.name || 'friend').split(' ')[0]}{f.age ? `, ${f.age}` : ''}</div>
                  {f.archetype && <div className={styles.farch}>{f.archetype}</div>}
                  {f.sunSign && <div className={styles.farch} style={{ color: 'rgba(255,255,255,0.8)' }}>{signLabel(f.sunSign)}</div>}
                  <div className={`${styles.rarity} ${r.cls}`}>{r.label}</div>
                  {f.sharedActivities.length > 0 && (
                    <div className={styles.fshared}>both into {f.sharedActivities.slice(0, 2).join(' · ')}</div>
                  )}
                  {requested.has(f.otherId)
                    ? <div style={{ marginTop: '0.6rem', fontFamily: "'DM Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9fe0b0' }}>✓ request sent</div>
                    : <button onClick={() => connectFriend(f.otherId)} disabled={!termsOk} style={{ marginTop: '0.6rem', width: '100%', cursor: termsOk ? 'pointer' : 'not-allowed', opacity: termsOk ? 1 : 0.5, background: 'rgba(255,255,255,0.95)', color: '#1a1030', border: 'none', borderRadius: 999, padding: '0.45rem', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', letterSpacing: '0.03em' }}>🤝 connect</button>}
                </div>
              );
            })}
          </div>
          <div className={styles.center}>
            <div className={styles.subtle} style={{ marginBottom: '0.5rem' }}>tap <b>connect</b> on anyone — they’ll get a ping, and once they accept you’re friends.</div>
            <Link href="/friends?view=crew" className={styles.cta}>see them on the friend line →</Link>
            <button onClick={anotherPack} disabled={busy} className={`${styles.cta} ${styles.ctaGhost}`} style={{ marginTop: '0.8rem' }}>
              {busy ? '…' : pro ? '✦ open another pack · free' : '🎁 open another pack · $1.99'}
            </button>
            {err && <p className={styles.subtle} style={{ color: '#ffb3b3' }}>{err}</p>}
          </div>
        </div>
      )}

      {phase === 'empty' && (
        <div className={styles.center}>
          <div className={styles.kicker}>{openedCount > 0 ? `you've opened ${openedCount} ${openedCount === 1 ? 'friend' : 'friends'}` : 'the deck is warming up'}</div>
          <h1 className={styles.headline}>no sealed packs</h1>
          <p className={styles.subtle}>
            {openedCount > 0
              ? 'your current pack is already open. grab a fresh one when you’re ready for new people.'
              : 'we’re lining up your first batch of friends. check back in a bit, or pull a fresh pack now.'}
          </p>
          <button onClick={anotherPack} disabled={busy} className={styles.cta} style={{ marginTop: '1.4rem' }}>
            {busy ? '…' : pro ? '✦ open a pack · free' : '🎁 open a pack · $1.99'}
          </button>
          {!pro && <Link href="/pro" className={styles.subtle} style={{ textDecoration: 'underline', marginTop: '0.7rem' }}>or go Pro — unlimited packs, $3.99/mo →</Link>}
          {err && <p className={styles.subtle} style={{ color: '#ffb3b3' }}>{err}</p>}
        </div>
      )}
    </div>
  );
}
