'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FRIEND_QUESTIONS } from '@/lib/friend-quiz';
import styles from '../friends.module.css';

const GENDERS = [
  { v: 'm', label: 'men' },
  { v: 'f', label: 'women' },
  { v: 'nb', label: 'non-binary folks' },
  { v: 'o', label: 'everyone else' },
];

export default function FriendQuizClient() {
  const router = useRouter();
  const total = FRIEND_QUESTIONS.length + 1; // + gender step
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({ activities: [] });
  const [seeking, setSeeking] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onGender = step === FRIEND_QUESTIONS.length;
  const q = FRIEND_QUESTIONS[step];

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
    setSeeking((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));
  }

  async function submit() {
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/friend/quiz', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friend_vibes: answers, friend_seeking: seeking }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Something went wrong');
      router.push('/friends');
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }

  const stepNum = step + 1;

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.brand}>FRIEND<span>LINE</span></div>
        <div className={styles.kick}>✦ find-a-friend quiz</div>
        <h1 className={styles.title}>let&apos;s find <em>your people.</em></h1>
        <p className={styles.sub}>quick one — we already know your personality, this is about how you like to hang.</p>

        <div className={styles.qCard}>
          <div className={styles.qProgress}>step {stepNum} of {total}</div>

          {!onGender && q && (
            <>
              <div className={styles.qText}>{q.q}</div>
              {q.multi ? (
                <>
                  <div>
                    {q.opts.map((opt) => (
                      <button key={opt} type="button"
                        className={`${styles.opt} ${styles.optMulti} ${(answers.activities || []).includes(opt) ? styles.optSel : ''}`}
                        onClick={() => toggleActivity(opt)}>{opt}</button>
                    ))}
                  </div>
                  <div className={styles.btnRow} style={{ marginTop: '0.75rem' }}>
                    <button className={styles.btn} disabled={(answers.activities || []).length === 0}
                      onClick={() => setStep((s) => s + 1)}>next →</button>
                  </div>
                </>
              ) : (
                q.opts.map((opt) => (
                  <button key={opt} type="button"
                    className={`${styles.opt} ${answers[q.key] === opt ? styles.optSel : ''}`}
                    onClick={() => pickSingle(q.key, opt)}>{opt}</button>
                ))
              )}
            </>
          )}

          {onGender && (
            <>
              <div className={styles.qText}>who are you open to befriending?</div>
              {GENDERS.map((g) => (
                <button key={g.v} type="button"
                  className={`${styles.opt} ${styles.optMulti} ${seeking.includes(g.v) ? styles.optSel : ''}`}
                  onClick={() => toggleGender(g.v)}>{g.label}</button>
              ))}
              <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#6b4a2f', fontSize: '0.85rem', margin: '0.75rem 0' }}>
                pick any. leave all unchecked = open to everyone.
              </p>
              {err && <div className={styles.err}>{err}</div>}
              <div className={styles.btnRow}>
                <button className={styles.btn} disabled={busy} onClick={submit}>
                  {busy ? 'finding…' : 'find my crew →'}
                </button>
              </div>
            </>
          )}
        </div>

        {!onGender && step > 0 && (
          <button onClick={() => setStep((s) => s - 1)}
            style={{ background: 'none', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#d2530f', cursor: 'pointer' }}>← back</button>
        )}
      </div>
    </div>
  );
}
