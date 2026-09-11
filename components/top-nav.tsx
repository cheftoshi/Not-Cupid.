'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import Wordmark from '@/components/wordmark';
import ThemeToggle from '@/components/theme-toggle';
import NavExtras from '@/components/nav-extras';

// One persistent top bar across the logged-in app: Hub · Love · Friend tabs +
// theme toggle + log out. Mounted once in the root layout; it hides itself on
// pre-auth / focused-flow routes (landing, login, quiz, the cinematic pack).

const APP_ROUTE = (p: string) =>
  p === '/hub' ||
  p.startsWith('/dashboard') ||
  p.startsWith('/profile') ||
  p.startsWith('/match') ||
  (p.startsWith('/friends') && !p.startsWith('/friends/pack') && !p.startsWith('/friends/quiz') && p !== '/friends/how-it-works');

export default function TopNav() {
  const p = usePathname() || '';
  const navRef = useRef<HTMLElement>(null);
  const isAppRoute = APP_ROUTE(p);

  // Every app surface shares the same measured nav and visible viewport. Some
  // Android/iOS PWAs leave CSS `dvh` stale after rotation, keyboard use, or an
  // app switch; using visualViewport here keeps every fixed sheet and chat in
  // the actually visible screen instead of implementing one-off fixes.
  useEffect(() => {
    const root = document.documentElement;
    const nav = navRef.current;
    if (!isAppRoute || !nav) {
      root.style.setProperty('--app-top-nav-height', '0px');
      root.style.removeProperty('--app-visual-viewport-height');
      return;
    }

    let frame = 0;
    let lastViewportHeight = 0;
    let lastViewportWidth = 0;
    const viewport = window.visualViewport;
    const hasEditableFocus = () => {
      const active = document.activeElement;
      return active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        (active instanceof HTMLElement && active.isContentEditable);
    };
    const sync = (forceViewport = false) => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        root.style.setProperty('--app-top-nav-height', `${Math.ceil(nav.getBoundingClientRect().height)}px`);
        const viewportHeight = Math.round(viewport?.height || window.innerHeight);
        const viewportWidth = Math.round(viewport?.width || window.innerWidth);
        const heightDelta = Math.abs(viewportHeight - lastViewportHeight);
        const widthChanged = Math.abs(viewportWidth - lastViewportWidth) > 1;

        // Android Chrome can emit visualViewport resize events while its URL
        // bar moves during an ordinary swipe. Rewriting the viewport CSS var
        // for every one of those events forces the whole app to re-layout and
        // makes scrolling feel stuck. Still sync real rotations, keyboards,
        // app restores, and large viewport changes.
        if (viewportHeight > 0 && (
          forceViewport ||
          lastViewportHeight === 0 ||
          widthChanged ||
          hasEditableFocus() ||
          heightDelta > 160
        )) {
          root.style.setProperty('--app-visual-viewport-height', `${viewportHeight}px`);
          lastViewportHeight = viewportHeight;
          lastViewportWidth = viewportWidth;
        }
      });
    };
    const syncVisible = () => { if (document.visibilityState === 'visible') sync(true); };
    const syncNav = () => sync(false);
    const syncViewport = () => sync(false);
    const syncForced = () => sync(true);
    sync(true);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncNav) : null;
    observer?.observe(nav);
    viewport?.addEventListener('resize', syncViewport);
    window.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', syncForced);
    window.addEventListener('pageshow', syncForced);
    document.addEventListener('visibilitychange', syncVisible);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      viewport?.removeEventListener('resize', syncViewport);
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', syncForced);
      window.removeEventListener('pageshow', syncForced);
      document.removeEventListener('visibilitychange', syncVisible);
    };
  }, [isAppRoute, p]);

  if (!isAppRoute) return null;

  const active =
    p.startsWith('/dashboard') || p.startsWith('/match') ? 'love'
    : p.startsWith('/friends') ? 'friend'
    : p === '/hub' ? 'hub'
    : '';

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/';
  }

  const tab = (href: string, label: string, key: string, color: string) => {
    const on = active === key;
    return (
      <Link href={href} style={{
        fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase',
        textDecoration: 'none', padding: '0.42rem 0.8rem', borderRadius: 999, whiteSpace: 'nowrap',
        color: on ? '#fff' : 'var(--h-text-dim)', background: on ? color : 'transparent',
        border: on ? '1px solid transparent' : '1px solid var(--h-border)',
        boxShadow: on ? `0 6px 16px -8px ${color}` : 'none',
        transition: 'transform .2s var(--ease), background .2s var(--ease), color .2s var(--ease)',
      }}>{label}</Link>
    );
  };

  const linkStyle: React.CSSProperties = { fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--h-text-dim)', textDecoration: 'none' };

  return (
    <header ref={navRef} className="appTopNav" style={{
      position: 'sticky', top: 0, zIndex: 45, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '0.6rem', padding: '0.6rem 1rem', background: 'var(--h-glass)',
      backdropFilter: 'saturate(180%) blur(14px)', WebkitBackdropFilter: 'saturate(180%) blur(14px)',
      borderBottom: '1px solid var(--h-border)', boxShadow: '0 4px 20px -14px rgba(0,0,0,0.45)', flexWrap: 'wrap',
    }}>
      <Wordmark size={1.05} href="/hub" />
      <nav className="appTopNavTabs" style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexShrink: 0 }}>
        {tab('/hub', 'Hub', 'hub', '#0b0b0b')}
        {tab('/dashboard', '💘 Love', 'love', '#2563ff')}
        {tab('/friends', '🧡 Friend', 'friend', '#ff6a1f')}
      </nav>
      <div className="appTopNavActions" style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', flexShrink: 0, flexWrap: 'wrap' }}>
        <NavExtras />
        <Link href="/profile" style={linkStyle}>profile</Link>
        <ThemeToggle style={{ width: 28, height: 28 }} />
        <button onClick={logout} style={{ ...linkStyle, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>log out</button>
      </div>
    </header>
  );
}
