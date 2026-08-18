'use client';

import { useState } from 'react';
import EndMatchDialog from '@/components/end-match-dialog';
import styles from './dashboard.module.css';

export type LoveConnectionCard = {
  matchId: string;
  name: string;
  age: number | null;
  photo_url: string | null;
  archetype: string | null;
  score: number | null;
  unread: boolean;
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
  if (status === 'your-move') return 'waiting for your hello';
  if (status === 'chatting') return 'chat open';
  return 'waiting on them';
}

export default function LoveConnections({
  connections,
  includedPicks,
}: {
  connections: LoveConnectionCard[];
  includedPicks: number;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [ending, setEnding] = useState<LoveConnectionCard | null>(null);
  const visible = filter === 'all' ? connections : connections.filter((connection) => connection.status === filter);
  const countFor = (key: Filter) => key === 'all' ? connections.length : connections.filter((connection) => connection.status === key).length;

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
              <article key={connection.matchId} className={styles.connectionRow} data-status={connection.status}>
                <a href={`/match/${connection.matchId}`} className={styles.connectionPerson}>
                  <span className={styles.connectionAvatar}>
                    {connection.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={connection.photo_url} alt="" />
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
                  <a href={`/match/${connection.matchId}`}>
                    {connection.status === 'your-move' ? 'say hi' : connection.status === 'chatting' ? 'open chat' : 'view'}
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
          <p>No connections yet. Your seven curated choices are ready below.</p>
          <a href="#roster">see your seven options →</a>
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
