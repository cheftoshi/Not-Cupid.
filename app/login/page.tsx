'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './login.module.css';
import Wordmark from '@/components/wordmark';
import { suggestEmailCorrection } from '@/lib/email-typos';
import { requestLogin, safeLoginPath, recordLoginRecovery } from '@/lib/login-request';
import { withReturningUserWelcome } from '@/lib/returning-user';

export default function LoginPage() {
  return <LoginInner />;
}

function LoginInner() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState<string | null>(null);
  useEffect(() => {
    setNextPath(safeLoginPath(new URLSearchParams(window.location.search).get('next')));
  }, []);
  const experimentNext = nextPath === '/dating-experiment';
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => {
    const cancel = () => pending.current?.abort();
    window.addEventListener('pagehide', cancel);
    window.addEventListener('offline', cancel);
    return () => { cancel(); window.removeEventListener('pagehide', cancel); window.removeEventListener('offline', cancel); };
  }, []);

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
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setError('');
    try {
      const data = await requestLogin('send', { email: email.trim().toLowerCase() }, { signal: controller.signal });
      if (!data.ok) { setError(data.error); recordLoginRecovery('send', data.code); return; }
      setStep('code');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      pending.current = null;
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setError('');
    try {
      const data = await requestLogin('verify', { email: email.trim().toLowerCase(), code: code.trim() }, { signal: controller.signal });
      if (!data.ok) { setError(data.error); recordLoginRecovery('verify', data.code); return; }

      // Happy path: new verify-otp returns 200 with redirect (handles both /profile and /quiz)
      if (data.redirect) {
        const welcomePath = (path: string) => data.returning ? withReturningUserWelcome(path) : path;
        // Prefer ?next= if the user came from a gated page (e.g. /admin) and has an account
        if (nextPath && !data.needsQuiz) {
          router.push(welcomePath(nextPath));
        } else if (data.needsQuiz && experimentNext) {
          router.push('/quiz?next=experiment');
        } else if (data.needsQuiz && nextPath?.startsWith('/friends')) {
          router.push('/quiz?next=friends');
        } else {
          router.push(welcomePath(data.redirect));
        }
        return;
      }

      setError('Could not confirm sign-in. Please try again.');
    } catch (err) {
      setError('something went wrong');
    } finally {
      pending.current = null;
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
          {experimentNext ? <>join the <span className={styles.titleAccent}>experiment.</span></> : <>welcome <span className={styles.titleAccent}>back.</span></>}
        </h1>
        <p className={styles.subtitle}>
          {step === 'email'
            ? experimentNext ? "enter your email — we'll bring you straight back here →" : "enter your email — we'll send a code →"
            : 'check your email for the code →'}
        </p>

        {step === 'email' ? (
          <form onSubmit={handleSendCode} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="login-email" className={styles.label}>Email</label>
              <input
                id="login-email"
                autoComplete="email"
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
            {error && <div role="alert" className={styles.error}>{error}</div>}
            <button type="submit" disabled={loading || !email} className={styles.button}>
              {loading ? 'sending...' : 'send code →'}
            </button>
            <button type="button" disabled={loading || !email.trim()} className={styles.linkButton} onClick={() => { setStep('code'); setError(''); }}>Already have a code? Enter it</button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="login-code" className={styles.label}>Code for {email}</label>
              <input
                id="login-code"
                autoComplete="one-time-code"
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
            {error && <div role="alert" className={styles.error}>{error}</div>}
            <button type="submit" disabled={loading || code.length !== 6} className={styles.button}>
              {loading ? 'verifying...' : 'verify →'}
            </button>
            <button
              type="button"
              disabled={loading}
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

        <Link href={experimentNext ? '/quiz?next=experiment' : '/quiz'} className={styles.signupLink}>
          new here? take the quiz to sign up →
        </Link>
      </div>
    </div>
  );
}
