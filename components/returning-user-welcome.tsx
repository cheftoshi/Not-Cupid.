'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { parseResponse } from '@/lib/fetch-helpers';
import {
  isReturningUserWelcome,
  RETURNING_USER_STORAGE_KEY,
} from '@/lib/returning-user';
import styles from './returning-user-welcome.module.css';

type ProfileSnapshot = {
  name?: string | null;
  photo_url?: string | null;
  intro_video_url?: string | null;
  prompts?: unknown;
  attach_style?: string | null;
  relationship_style?: string | null;
  pool_active?: boolean;
  email_notifications?: boolean;
  matching_disabled_at?: string | null;
  matching_cooldown_until?: string | null;
  ghost_strikes?: number | null;
};

function trackReactivation(action: string) {
  const payload = JSON.stringify({
    path: `/reactivation/${action}`,
    ref: null,
    anonId: (() => {
      try { return localStorage.getItem('nc_anon') || ''; } catch { return ''; }
    })(),
  });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([payload], { type: 'application/json' }));
    } else {
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      });
    }
  } catch {
    // The return flow must never depend on analytics.
  }
}

function ReturningUserWelcomeInner() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileSnapshot | null>(null);
  const [reactivating, setReactivating] = useState(false);
  const [reactivationMessage, setReactivationMessage] = useState('');
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current || !isReturningUserWelcome(searchParams.get('welcome'))) return;
    handled.current = true;

    let alreadySeen = false;
    try { alreadySeen = localStorage.getItem(RETURNING_USER_STORAGE_KEY) === 'seen'; } catch { /* private mode */ }

    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('welcome');
    window.history.replaceState(window.history.state, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);

    if (alreadySeen) return;
    setOpen(true);
    trackReactivation('welcome_viewed');
    fetch('/api/profile')
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setProfile(data?.user || null))
      .catch(() => setProfile(null));
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss('welcome_dismissed');
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function remember() {
    try { localStorage.setItem(RETURNING_USER_STORAGE_KEY, 'seen'); } catch { /* private mode */ }
  }

  function dismiss(action: string) {
    remember();
    trackReactivation(action);
    setOpen(false);
  }

  function go(path: string, action: string) {
    remember();
    trackReactivation(action);
    window.location.href = path;
  }

  async function reactivateLove() {
    if (reactivating) return;
    setReactivating(true);
    setReactivationMessage('');
    try {
      const response = await fetch('/api/profile/reactivate', { method: 'POST' });
      const data = await parseResponse<any>(response);
      if (!response.ok) throw new Error(data.error || 'Could not reactivate Love Line');
      setProfile((current) => current ? {
        ...current,
        pool_active: true,
        email_notifications: true,
        matching_disabled_at: null,
        matching_cooldown_until: null,
      } : current);
      setReactivationMessage('✓ Love Line and match emails are back on');
      trackReactivation('love_reactivated');
    } catch (error: any) {
      setReactivationMessage(error.message || 'Could not reactivate—try again');
    } finally {
      setReactivating(false);
    }
  }

  if (!open) return null;

  const prompts = Array.isArray(profile?.prompts)
    ? profile.prompts.filter((prompt: any) => typeof prompt?.answer === 'string' && prompt.answer.trim()).length
    : 0;
  const readiness = [
    { label: 'main photo', ready: !!profile?.photo_url },
    { label: 'video hello', ready: !!profile?.intro_video_url },
    { label: 'conversation prompt', ready: prompts > 0 },
    { label: 'Love answers', ready: !!profile?.attach_style && !!profile?.relationship_style },
  ];
  const readyCount = readiness.filter((item) => item.ready).length;
  const firstName = (profile?.name || 'there').split(' ')[0];
  const cooldownActive = !!profile?.matching_cooldown_until && new Date(profile.matching_cooldown_until).getTime() > Date.now();
  const hardLocked = Number(profile?.ghost_strikes || 0) >= 5;
  const needsReactivation = !!profile && (
    profile.pool_active === false ||
    profile.email_notifications === false ||
    !!profile.matching_disabled_at ||
    cooldownActive
  );

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) dismiss('welcome_dismissed');
    }}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="returning-user-title">
        <button className={styles.close} type="button" onClick={() => dismiss('welcome_dismissed')} aria-label="Close welcome back update" autoFocus>×</button>

        <div className={styles.eyebrow}>Love Line · welcome back</div>
        <h2 id="returning-user-title">{firstName}, your old profile doesn’t have to do all the work.</h2>
        <p className={styles.lede}>
          Love Line changed while you were away. Take two minutes to check what still feels like you, add the new profile pieces, then jump back into your rotation.
        </p>

        <div className={styles.readiness}>
          <div className={styles.readinessTop}>
            <span>your relaunch check</span>
            <strong>{readyCount}/4 ready</strong>
          </div>
          <div className={styles.checks}>
            {readiness.map((item) => (
              <span key={item.label} className={item.ready ? styles.ready : ''}>
                {item.ready ? '✓' : '+'} {item.label}
              </span>
            ))}
          </div>
        </div>

        {needsReactivation && (
          <div className={styles.reactivateCard}>
            <div>
              <span>your Love Line is paused</span>
              <p>{hardLocked ? 'Support needs to review this account before matching can resume.' : 'Turn matching and match emails back on before rejoining the rotation.'}</p>
            </div>
            {hardLocked ? (
              <a href="mailto:match@notcupid.com">email support →</a>
            ) : (
              <button type="button" onClick={reactivateLove} disabled={reactivating}>
                {reactivating ? 'turning it on…' : 'turn Love Line back on →'}
              </button>
            )}
          </div>
        )}
        {reactivationMessage && <div className={styles.reactivationMessage}>{reactivationMessage}</div>}

        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => go('/profile?mode=edit&from=welcome-back', 'profile_review_started')}>
            <span>recommended · about 2 minutes</span>
            <strong>review & relaunch my profile</strong>
            <em>photos · video · prompts · preferences →</em>
          </button>
          <button type="button" className={styles.secondary} onClick={() => go('/quiz?line=love&returning=1', 'love_answers_started')}>
            <strong>retune my Love answers</strong>
            <span>Update partner, connection, and values preferences →</span>
          </button>
          <button type="button" className={styles.current} onClick={() => go('/dashboard?from=welcome-back', 'current_profile_used')}>
            use my current profile & see Love Line →
          </button>
        </div>

        <p className={styles.note}>
          This review is non-destructive—existing matches stay, and it does not use one of your full account resets.
        </p>
      </section>
    </div>
  );
}

export default function ReturningUserWelcome() {
  return (
    <Suspense fallback={null}>
      <ReturningUserWelcomeInner />
    </Suspense>
  );
}
