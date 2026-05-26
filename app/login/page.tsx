'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not send code');
      setStep('code');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.needsQuiz) {
          setError('no account with that email — take the quiz to sign up');
        } else {
          setError(data.error || 'invalid code');
        }
        return;
      }
      router.push(data.redirect || '/profile');
    } catch (err) {
      setError('something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Link href="/" className={styles.brand}>NOTCUPID</Link>

        <h1 className={styles.title}>
          welcome <span className={styles.titleAccent}>back.</span>
        </h1>
        <p className={styles.subtitle}>
          {step === 'email' ? 'enter your email — we\'ll send a code →' : 'check your email for the code →'}
        </p>

        {step === 'email' ? (
          <form onSubmit={handleSendCode} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
                autoFocus
                className={styles.input}
              />
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <button type="submit" disabled={loading || !email} className={styles.button}>
              {loading ? 'sending...' : 'send code →'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Code sent to {email}</label>
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="6 digit code"
                required
                autoFocus
                maxLength={6}
                className={`${styles.input} ${styles.codeInput}`}
              />
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <button type="submit" disabled={loading || code.length < 4} className={styles.button}>
              {loading ? 'verifying...' : 'verify →'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('email'); setCode(''); setError(''); }}
              className={styles.linkButton}
            >
              ← use a different email
            </button>
          </form>
        )}

        <div className={styles.divider}>
          <span>or</span>
        </div>

        <Link href="/" className={styles.signupLink}>
          new here? take the quiz to sign up →
        </Link>
      </div>
    </div>
  );
}
