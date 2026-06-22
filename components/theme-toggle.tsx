'use client';

import { useEffect, useState } from 'react';

// Dark-mode toggle. Sets data-theme on <html> + persists to localStorage; the
// no-flash script in the root layout applies it before paint on the next load.
export default function ThemeToggle({ style }: { style?: React.CSSProperties }) {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.dataset.theme === 'dark'); }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    const t = next ? 'dark' : 'light';
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('nc-theme', t); } catch { /* private mode */ }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'light mode' : 'dark mode'}
      style={{
        background: 'var(--h-surface, #fff)',
        border: '1px solid var(--h-border, rgba(11,11,11,0.12))',
        borderRadius: 999,
        width: 32, height: 32,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1, color: 'var(--h-text, #0a0a0a)',
        ...style,
      }}
    >
      {dark ? '☀' : '☾'}
    </button>
  );
}
