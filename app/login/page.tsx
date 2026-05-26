'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './login.module.css';

// Common domain typos → corrections
const EMAIL_TYPOS: Record<string, string> = {
  'gmal.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'outlook.fom': 'outlook.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outlook.cm': 'outlook.com',
  'outlook.co': 'outlook.com',
  'yahoo.cm': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmail.cm': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'iclud.com': 'icloud.com',
  'icloud.cm': 'icloud.com',
  'icoud.com': 'icloud.com',
  'me.cm': 'me.com',
  'northeastern.com': 'northeastern.edu',
  'harvard.com': 'harvard.edu',
  'bu.com': 'bu.edu',
  'mit.com': 'mit.edu',
};

function suggestEmailCorrection(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 0) return null;
  const domain = email.slice(at + 1).toLowerCase().trim();
  const correction = EMAIL_TYPOS[domain];
  if (correction) {
    return email.slice(0, at + 1) + correction;
  }
  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestion, setSuggestion] = useState<string | null>(null);

  // Check for email typos as user types
  useEffect(() => {
    if (step !== 'email' || !email.includes('@')) {
      setSuggestion(null);
      return;
    }
    setSuggestion(suggestEmailCorrection(email));
  }, [email, step]);

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
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
        }),
      });
      const data = await res.json();

      // Happy path: new verify-otp returns 200 with redirect (handles both /profile and /quiz)
      if (res.ok && data.redirect) {
        router.push(data.redirect);
        return;
      }

      // Legacy path: old verify-otp returned 404 + needsQuiz
      if (data.needsQuiz) {
        router.push('/quiz');
        return;
      }

      setError(data.error || 'invalid code');
    } catch (err) {
      setError('something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function applySuggestion() {
    if (suggestion) {
      setEmail(suggestion);
      setSuggestion(null);
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
          {step === 'email' ? "enter your email — we'll send a code →" : 'check your email for the code →'}
        </p>

        {step === 'email' ? (
          <form onSubmit={handleSendCode} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
                autoFocus
                className={styles.input}
              />
              {suggestion && (
                <div className={styles.suggestion}>
                  did you mean{' '}
                  <button type="button" onClick={applySuggestion} className={styles.suggestionButton}>
                    {suggestion}
                  </button>
                  {' '}?
                </div>
              )}
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
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="6 digit code"
                required
                autoFocus
                maxLength={6}
                className={`${styles.input} ${styles.codeInput}`}
              />
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <button type="submit" disabled={loading || code.length !== 6} className={styles.button}>
              {loading ? 'verifying...' : 'verify →'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('email');
                setCode('');
                setError('');
              }}
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
