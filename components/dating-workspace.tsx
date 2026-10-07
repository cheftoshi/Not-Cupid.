'use client';
import { useEffect, useState, type ReactNode } from 'react';

export default function DatingWorkspace({ inbox, discovery, initialView, needsAction }: { inbox: ReactNode; discovery: ReactNode; initialView: 'inbox' | 'discover'; needsAction: number }) {
  const [view, setView] = useState(initialView);
  useEffect(() => setView(initialView), [initialView]);
  useEffect(() => {
    const sync = () => { if (location.hash === '#roster') setView('discover'); else if (location.hash === '#connections') setView('inbox'); };
    sync(); window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  function choose(next: 'inbox' | 'discover') {
    setView(next);
    const url = new URL(location.href); url.hash = next === 'inbox' ? 'connections' : 'roster';
    history.replaceState(null, '', url);
  }
  return <div onClick={e => { const target = (e.target as HTMLElement).closest('a'); if (target?.getAttribute('href') === '#roster') choose('discover'); }}>
    <nav className="workspaceTabs" aria-label="Dating sections">
      <button type="button" aria-pressed={view === 'inbox'} onClick={() => choose('inbox')}>Connections {needsAction > 0 && <span>{needsAction} to review</span>}</button>
      <button type="button" aria-pressed={view === 'discover'} onClick={() => choose('discover')}>Discover people</button>
    </nav>
    <div hidden={view !== 'inbox'}>{inbox}</div>
    <div hidden={view !== 'discover'}>{discovery}</div>
  </div>;
}
