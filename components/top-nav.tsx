'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import Wordmark from '@/components/wordmark';
import ThemeToggle from '@/components/theme-toggle';
import NavExtras from '@/components/nav-extras';

// One persistent top bar across the logged-in app: Hub · Love · Friend tabs +
// theme toggle + log out. Mounted once in the root layout; it hides itself on
// pre-auth / focused-flow routes (landing, login, quiz, the cinematic pack).

const APP_ROUTE = (p: string) =>
  p === '/hub' || p === '/pro' ||
  p.startsWith('/dashboard') ||
  p.startsWith('/profile') ||
  p.startsWith('/match') ||
  (p.startsWith('/friends') && !p.startsWith('/friends/pack') && !p.startsWith('/friends/quiz') && p !== '/friends/how-it-works');

export default function TopNav() {
  const p = usePathname() || '';
  const query = useSearchParams();
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
      delete root.dataset.appEditing;
      return;
    }

    let frame = 0;
    let settleTimer = 0;
    let forceNextFrame = false;
    let lastNavHeight = -1;
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
      forceNextFrame ||= forceViewport;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const forced = forceNextFrame;
        forceNextFrame = false;
        const navHeight = window.innerWidth >= 1024 ? 0 : Math.ceil(nav.getBoundingClientRect().height);
        // Hide the mobile bar only for an actually reduced keyboard viewport.
        // Focus alone must not move a submit button between pointerdown and click.
        root.dataset.appEditing = (viewport?.height || window.innerHeight) < window.innerHeight - 120 ? 'true' : 'false';
        if (navHeight !== lastNavHeight) {
          root.style.setProperty('--app-top-nav-height', `${navHeight}px`);
          lastNavHeight = navHeight;
        }
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
          forced ||
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
    // Keyboard dismissal can finish in increments smaller than the toolbar
    // threshold, after focus has already left the field. Reconcile once settled.
    const syncKeyboard = () => {
      sync(true);
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => sync(true), 450);
    };
    sync(true);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncNav) : null;
    observer?.observe(nav);
    viewport?.addEventListener('resize', syncViewport);
    window.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', syncForced);
    window.addEventListener('pageshow', syncForced);
    document.addEventListener('visibilitychange', syncVisible);
    document.addEventListener('focusin', syncKeyboard);
    document.addEventListener('focusout', syncKeyboard);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      observer?.disconnect();
      viewport?.removeEventListener('resize', syncViewport);
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', syncForced);
      window.removeEventListener('pageshow', syncForced);
      document.removeEventListener('visibilitychange', syncVisible);
      document.removeEventListener('focusin', syncKeyboard);
      document.removeEventListener('focusout', syncKeyboard);
    };
  }, [isAppRoute, p]);

  if (!isAppRoute) return null;

  const active =
    p.startsWith('/dashboard') || p.startsWith('/match') ? 'love'
    : p.startsWith('/friends') ? 'friend'
    : p.startsWith('/profile') ? 'profile'
    : p === '/hub' ? (query.get('view') === 'coach' ? 'coach' : 'hub')
    : '';

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/';
  }

  const items = [
    { href: '/hub', label: 'Home', key: 'hub', icon: '⌂' },
    { href: '/dashboard', label: 'Dating', key: 'love', icon: '♡' },
    { href: '/friends', label: 'Friendship', key: 'friend', icon: '☺' },
    { href: '/profile', label: 'You', key: 'profile', icon: '○' },
  ];
  return (
    <header ref={navRef} data-perf-region="navigation" className="appTopNav appNavigation">
      <div className="appNavBrand"><Wordmark size={1.25} href="/hub" /><span>A place for your people.</span></div>
      <nav className="appPrimaryNav" aria-label="Main navigation">
        {items.map(item => <Link key={item.key} href={item.href} aria-current={active === item.key ? 'page' : undefined}>
          <span aria-hidden="true">{item.icon}</span>{item.label}
        </Link>)}
      </nav>
      <div className="appNavTools">
        <Link href="/hub?view=coach" aria-current={active === 'coach' ? 'page' : undefined}>AI coach <span>Optional help</span></Link>
        <Link href="/pro" aria-current={p === '/pro' ? 'page' : undefined}>NotCupid Pro <span>Optional extras</span></Link>
      </div>
      <div className="appNavUtilities"><NavExtras /><ThemeToggle style={{ width: 44, height: 44 }} />
        <button onClick={logout}>Log out</button>
      </div>
    </header>
  );
}
