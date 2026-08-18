'use client';

import { useEffect, useMemo, useState } from 'react';
import EndMatchDialog from '@/components/end-match-dialog';
import { trackLoveEvent } from '@/lib/love-events-client';
import styles from './dashboard.module.css';

export type LoveConnectionCard = {
  matchId: string;
  name: string;
  age: number | null;
  photo_url: string | null;
  archetype: string | null;
  score: number | null;
  unread: boolean;
  needsStarter: boolean;
  status: 'chatting' | 'waiting' | 'your-move';
};

type Filter = 'all' | LoveConnectionCard['status'];

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'all' },
  { key: 'your-move', label: 'your move' },
  { key: 'chatting', label: 'chatting' },
  { key: 'waiting', label: 'waiting' },
];

function statusCopy(status: LoveConnectionCard['status']): string {
  if (status === 'your-move') return 'they chose you · decide yes or pass';
  if (status === 'chatting') return 'chat open';
  return 'you chose them · waiting on their answer';
}

export default function LoveConnections({
  connections,
  includedPicks,
  focusMatchId,
}: {
  connections: LoveConnectionCard[];
  includedPicks: number;
  focusMatchId?: string;
}) {
  const focused = useMemo(
    () => connections.find((connection) => connection.matchId === focusMatchId),
    [connections, focusMatchId],
  );
  const [filter, setFilter] = useState<Filter>(focused?.status === 'your-move' ? 'your-move' : 'all');
  const [ending, setEnding] = useState<LoveConnectionCard | null>(null);
  const visible = filter === 'all' ? connections : connections.filter((connection) => connection.status === filter);
  const countFor = (key: Filter) => key === 'all' ? connections.length : connections.filter((connection) => connection.status === key).length;
  const yourMoveCount = countFor('your-move');
  const needsStarterCount = connections.filter((connection) => connection.needsStarter).length;

  useEffect(() => {
    if (!focusMatchId || !focused) return;
    if (focused.status === 'your-move') setFilter('your-move');
    const timer = window.setTimeout(() => {
      document.getElementById(`love-connection-${focusMatchId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [focusMatchId, focused]);

  return (
    <section className={styles.loveConnections} id="connections" aria-labelledby="love-connections-title">
      <div className={styles.loveConnectionsHead}>
        <div>
          <div className={styles.panelKicker}>your connections</div>
          <h2 id="love-connections-title">everyone waiting or talking, in one place.</h2>
          <p>
            {connections.length >= includedPicks
              ? `${connections.length} connections are in motion. Your roster still stays open; extra picks after the ${includedPicks} included ones are $0.99 each.`
              : `${connections.length} connections are in motion. Each roster includes ${includedPicks} distinct picks.`}
          </p>
        </div>
        <a href="#roster">see your options →</a>
      </div>

      {connections.length > 0 ? (
        <>
          {yourMoveCount > 0 && (
            <div className={styles.connectionDecisionCallout} role="status">
              <strong>{yourMoveCount} {yourMoveCount === 1 ? 'person chose' : 'people chose'} you.</strong>
              <span>Review each profile and choose Yes or Pass. Either answer keeps the Love Line moving.</span>
            </div>
          )}
          {needsStarterCount > 0 && (
            <div className={styles.connectionDecisionCallout} role="status">
              <strong>{needsStarterCount} mutual {needsStarterCount === 1 ? 'match is' : 'matches are'} ready.</strong>
              <span>The chat is open. Start with one specific question—the match coach can help.</span>
            </div>
          )}
          <div className={styles.connectionFilters} role="tablist" aria-label="Filter Love Line connections">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={filter === item.key}
                onClick={() => setFilter(item.key)}
              >
                {item.label} <span>{countFor(item.key)}</span>
              </button>
            ))}
          </div>

          <div className={styles.connectionList} aria-live="polite">
            {visible.length > 0 ? visible.map((connection) => (
              <article
                key={connection.matchId}
                id={`love-connection-${connection.matchId}`}
                className={styles.connectionRow}
                data-status={connection.status}
                data-focused={connection.matchId === focusMatchId ? 'true' : undefined}
              >
                <a href={`/match/${connection.matchId}`} className={styles.connectionPerson} onClick={() => trackLoveEvent(connection.needsStarter ? 'mutual_chat_open' : 'profile_open', { matchId: connection.matchId })}>
                  <span className={styles.connectionAvatar}>
                    {connection.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={connection.photo_url} alt="" loading="lazy" decoding="async" />
                    ) : (
                      <b>{connection.name.charAt(0)}</b>
                    )}
                    {connection.unread && <i aria-label="new message" />}
                  </span>
                  <span className={styles.connectionCopy}>
                    <strong>{connection.name.split(' ')[0]}{connection.age ? `, ${connection.age}` : ''}</strong>
                    <em>{statusCopy(connection.status)}{connection.score != null ? ` · ${connection.score}% match` : ''}</em>
                    {connection.archetype && <small>{connection.archetype}</small>}
                  </span>
                </a>
                <div className={styles.connectionActions}>
                  <a href={`/match/${connection.matchId}`} onClick={() => trackLoveEvent(connection.needsStarter ? 'mutual_chat_open' : 'profile_open', { matchId: connection.matchId })}>
                    {connection.status === 'your-move' ? 'review & decide' : connection.needsStarter ? 'start chat' : connection.status === 'chatting' ? 'open chat' : 'view profile'}
                  </a>
                  <button type="button" onClick={() => setEnding(connection)}>end</button>
                </div>
              </article>
            )) : (
              <div className={styles.connectionFilterEmpty}>No connections in this segment.</div>
            )}
          </div>
        </>
      ) : (
        <div className={styles.connectionEmpty}>
          <p>No connections yet. Your curated choices are ready below.</p>
          <a href="#roster">see your options →</a>
        </div>
      )}

      {ending && (
        <EndMatchDialog
          matchId={ending.matchId}
          otherName={ending.name.split(' ')[0]}
          mutual={ending.status === 'chatting'}
          onClose={() => setEnding(null)}
          onEnded={() => { window.location.href = '/dashboard#connections'; }}
        />
      )}
    </section>
  );
}
