'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Wordmark from '@/components/wordmark';
import ThemeToggle from '@/components/theme-toggle';

// One persistent top bar across the logged-in app: Hub · Love · Friend tabs +
// theme toggle + log out. Mounted once in the root layout; it hides itself on
// pre-auth / focused-flow routes (landing, login, quiz, the cinematic pack).

const APP_ROUTE = (p: string) =>
  p === '/hub' ||
  p.startsWith('/dashboard') ||
  p.startsWith('/profile') ||
  p.startsWith('/match') ||
  (p.startsWith('/friends') && !p.startsWith('/friends/pack') && !p.startsWith('/friends/quiz'));

export default function TopNav() {
  const p = usePathname() || '';
  if (!APP_ROUTE(p)) return null;

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
    <header style={{
      position: 'sticky', top: 0, zIndex: 45, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '0.6rem', padding: '0.6rem 1rem', background: 'var(--h-glass)',
      backdropFilter: 'saturate(180%) blur(14px)', WebkitBackdropFilter: 'saturate(180%) blur(14px)',
      borderBottom: '1px solid var(--h-border)', boxShadow: '0 4px 20px -14px rgba(0,0,0,0.45)', flexWrap: 'wrap',
    }}>
      <Wordmark size={1.05} href="/hub" />
      <nav style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexShrink: 0 }}>
        {tab('/hub', 'Hub', 'hub', '#0b0b0b')}
        {tab('/dashboard', '💘 Love', 'love', '#2563ff')}
        {tab('/friends', '🧡 Friend', 'friend', '#ff6a1f')}
      </nav>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', flexShrink: 0 }}>
        <Link href="/profile" style={linkStyle}>profile</Link>
        <ThemeToggle style={{ width: 28, height: 28 }} />
        <button onClick={logout} style={{ ...linkStyle, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>log out</button>
      </div>
    </header>
  );
}
