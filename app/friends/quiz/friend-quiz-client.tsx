'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FRIEND_QUESTIONS } from '@/lib/friend-quiz';
import styles from '../../quiz/quiz.module.css';

// Friend quiz, re-skinned to match the Love-line quiz aesthetic (same layout,
// type + chrome from quiz.module.css) with the friend palette: we flip the
// quiz's accent CSS vars to orange on the wrapper so it reads as a sibling.
const ORANGE_VARS: any = {
  '--accent': '#ff6a1f',
  '--accent-dim': 'rgba(255,106,31,0.12)',
  '--accent-mid': 'rgba(255,106,31,0.4)',
  '--gold': '#d2530f',
  '--gold-dim': 'rgba(210,83,15,0.14)',
  '--ink-muted': 'var(--h-text-dim)',
  '--ink-faint': 'var(--h-text-faint)',
  '--bg-card': 'var(--h-surface)',
  '--bg-subtle': 'var(--h-surface-3)',
  '--bg-dark': '#1a120c',
  '--border': 'var(--h-border)',
  '--border-md': 'var(--h-border)',
  '--border-dark': 'var(--h-border)',
  '--green': '#2d7a4f',
};

const GENDERS = [
  { v: 'm', label: 'men' },
  { v: 'f', label: 'women' },
  { v: 'lgbtq', label: 'LGBTQ+' },
  { v: 'nb', label: 'non-binary' },
  { v: 'all', label: 'all of them' },
];

export default function FriendQuizClient() {
  const router = useRouter();
  const total = FRIEND_QUESTIONS.length + 2; // + gender step + age step
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({ activities: [] });
  const [seeking, setSeeking] = useState<string[]>([]);
  const [isLgbtq, setIsLgbtq] = useState<boolean | null>(null);
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onGender = step === FRIEND_QUESTIONS.length;
  const onAge = step === FRIEND_QUESTIONS.length + 1;
  const q = FRIEND_QUESTIONS[step];
  const stepNum = step + 1;
  const dim = onGender ? 'who you vibe with' : onAge ? 'age range' : 'how you hang';

  function pickSingle(key: string, opt: string) {
    setAnswers((a) => ({ ...a, [key]: opt }));
    setTimeout(() => setStep((s) => s + 1), 160);
  }
  function toggleActivity(opt: string) {
    setAnswers((a) => {
      const cur: string[] = a.activities || [];
      return { ...a, activities: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] };
    });
  }
  function toggleGender(v: string) {
    setSeeking((s) => {
      // "all of them" is exclusive with the specific options.
      if (v === 'all') return s.includes('all') ? [] : ['all'];
      return s.includes(v) ? s.filter((x) => x !== v) : [...s.filter((x) => x !== 'all'), v];
    });
  }

  async function submit() {
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/friend/quiz', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          friend_vibes: answers,
          friend_seeking: seeking,
          is_lgbtq: isLgbtq,
          friend_age_min: ageMin || null,
          friend_age_max: ageMax || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Something went wrong');
      router.push('/friends');
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }

  const inputStyle: React.CSSProperties = {
    flex: 1, padding: '0.85rem 1rem', borderRadius: '0.3rem',
    border: '1.5px solid var(--h-border)', fontFamily: "'Inter', sans-serif",
    fontSize: '0.95rem', background: 'var(--h-surface)', color: 'var(--h-text)',
  };

  // ── chapter-style intro card (mirrors the love quiz) ──
  if (!started) {
    return (
      <div className={styles.screen} style={ORANGE_VARS}>
        <div className={styles.introWrap}>
          <div className={styles.introHero}>
            <div className={styles.stickerRow}>
              <span className={styles.sticker}>✦ friend line</span>
              <span className={styles.stickerGold}>find your people</span>
            </div>
            <h1 className={styles.introH1}>
              let&apos;s find <em>your people.</em>
            </h1>
            <p className={styles.introLede}>
              we already know your personality — this part is about how you actually like to hang.<br />
              <span className={styles.introLedeSub}>{total} quick ones. then we go.</span>
            </p>
          </div>
          <button className="btn-primary" onClick={() => setStarted(true)} style={{ width: '100%', justifyContent: 'center' }}>
            start →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.screen} style={ORANGE_VARS}>
      <div className={styles.quizWrap}>
        <div className={styles.quizTop}>
          <div className={styles.quizLogo} style={{ color: '#d2530f' }}>Friend<span style={{ color: '#ff6a1f' }}>Line</span></div>
          <div className={styles.qMeta}>
            <span className={styles.qDim}>{dim}</span>
            <span className={styles.qCount}>{stepNum}/{total}</span>
          </div>
        </div>

        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${((step) / total) * 100}%` }} />
        </div>

        {/* ── regular friend question ── */}
        {!onGender && !onAge && q && (
          <>
            <p className={styles.qText}>{q.q}</p>
            {q.multi ? (
              <>
                <div className={styles.qOptions}>
                  {q.opts.map((opt, i) => (
                    <button key={opt} type="button"
                      className={`${styles.qOpt} ${(answers.activities || []).includes(opt) ? styles.qOptSelected : ''}`}
                      onClick={() => toggleActivity(opt)}>
                      <span className={styles.qKey}>{String.fromCharCode(65 + i)}</span>
                      <span className={styles.qOptText}>{opt}</span>
                    </button>
                  ))}
                </div>
                <div className={styles.qNav}>
                  <button className={styles.qSkip} onClick={() => step > 0 && setStep((s) => s - 1)}>{step > 0 ? '← back' : ''}</button>
                  <button className="btn-primary" disabled={(answers.activities || []).length === 0}
                    onClick={() => setStep((s) => s + 1)}>next →</button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.qOptions}>
                  {q.opts.map((opt, i) => (
                    <button key={opt} type="button"
                      className={`${styles.qOpt} ${answers[q.key] === opt ? styles.qOptSelected : ''}`}
                      onClick={() => pickSingle(q.key, opt)}>
                      <span className={styles.qKey}>{String.fromCharCode(65 + i)}</span>
                      <span className={styles.qOptText}>{opt}</span>
                    </button>
                  ))}
                </div>
                {step > 0 && (
                  <div className={styles.qNav}>
                    <button className={styles.qSkip} onClick={() => setStep((s) => s - 1)}>← back</button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── who you're open to + LGBTQ self-ID ── */}
        {onGender && (
          <>
            <p className={styles.qText}>who are you open to befriending?</p>
            <div className={styles.qOptions}>
              {GENDERS.map((g, i) => (
                <button key={g.v} type="button"
                  className={`${styles.qOpt} ${seeking.includes(g.v) ? styles.qOptSelected : ''}`}
                  onClick={() => toggleGender(g.v)}>
                  <span className={styles.qKey}>{String.fromCharCode(65 + i)}</span>
                  <span className={styles.qOptText}>{g.label}</span>
                </button>
              ))}
            </div>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.04em', color: 'var(--h-text-faint)', margin: '0 0 1.5rem' }}>
              pick any. leave all unchecked = open to everyone.
            </p>

            <p className={styles.qText} style={{ fontSize: '1.1rem' }}>do you identify as LGBTQ+?</p>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.04em', color: 'var(--h-text-faint)', margin: '0 0 0.85rem' }}>
              optional — so LGBTQ+ folks &amp; events can find you.
            </p>
            <div className={styles.qOptions}>
              {([[true, 'yes'], [false, 'no']] as const).map(([v, label], i) => (
                <button key={label} type="button"
                  className={`${styles.qOpt} ${isLgbtq === v ? styles.qOptSelected : ''}`}
                  onClick={() => setIsLgbtq((cur) => (cur === v ? null : v))}>
                  <span className={styles.qKey}>{String.fromCharCode(65 + i)}</span>
                  <span className={styles.qOptText}>{label}</span>
                </button>
              ))}
            </div>
            <div className={styles.qNav}>
              <button className={styles.qSkip} onClick={() => setStep((s) => s - 1)}>← back</button>
              <button className="btn-primary" onClick={() => setStep((s) => s + 1)}>next →</button>
            </div>
          </>
        )}

        {/* ── age range ── */}
        {onAge && (
          <>
            <p className={styles.qText}>what age range of friends are you after?</p>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', margin: '0 0 0.75rem' }}>
              <input type="number" inputMode="numeric" min={18} max={100} placeholder="18"
                value={ageMin} onChange={(e) => setAgeMin(e.target.value)} style={inputStyle} />
              <span style={{ fontFamily: "'DM Mono', monospace", color: 'var(--h-text-faint)' }}>to</span>
              <input type="number" inputMode="numeric" min={18} max={100} placeholder="99"
                value={ageMax} onChange={(e) => setAgeMax(e.target.value)} style={inputStyle} />
            </div>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.04em', color: 'var(--h-text-faint)', margin: '0 0 1.5rem' }}>
              leave blank for no limit. friends near your vibe, your age.
            </p>
            {err && <p style={{ color: 'var(--h-accent-2)', fontSize: '0.82rem', marginBottom: '1rem' }}>{err}</p>}
            <div className={styles.qNav}>
              <button className={styles.qSkip} onClick={() => setStep((s) => s - 1)}>← back</button>
              <button className="btn-primary" disabled={busy} onClick={submit}>
                {busy ? 'finding…' : 'find my crew →'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
