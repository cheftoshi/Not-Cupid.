'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styles from './login.module.css';
import CorpFooter from '@/components/corp-footer';
import Wordmark from '@/components/wordmark';
import { suggestEmailCorrection } from '@/lib/email-typos';
import { parseResponse } from '@/lib/fetch-helpers';

function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//')) return null;
  return raw;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get('next'));
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
      const data = await parseResponse<any>(res);
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
      const data = await parseResponse<any>(res);

      // Happy path: new verify-otp returns 200 with redirect (handles both /profile and /quiz)
      if (res.ok && data.redirect) {
        // Prefer ?next= if the user came from a gated page (e.g. /admin) and has an account
        if (nextPath && !data.needsQuiz) {
          router.push(nextPath);
        } else {
          router.push(data.redirect);
        }
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
        <Wordmark size={1.2} href="/" />

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
      <CorpFooter />
    </div>
  );
}
