'use client';

import { useState } from 'react';
import { parseResponse } from '@/lib/fetch-helpers';

const REASONS: Array<{ value: string; label: string }> = [
  { value: 'harassment', label: 'Harassment or threats' },
  { value: 'inappropriate_messages', label: 'Inappropriate messages' },
  { value: 'offensive_photos', label: 'Offensive photos' },
  { value: 'fake_profile', label: 'Fake or scam profile' },
  { value: 'made_me_uncomfortable', label: 'Made me uncomfortable' },
  { value: 'other', label: 'Something else' },
];

// Block & report. Filing a report ends the match, blocks the pair from ever
// re-matching, and queues it for admin review. Used from the match card + chat.
export default function ReportDialog({
  reportedId,
  matchId,
  otherName,
  onClose,
  onDone,
}: {
  reportedId: string;
  matchId?: string;
  otherName: string;
  onClose: () => void;
  onDone?: () => void;
}) {
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  async function submit() {
    if (!reason || busy) return;
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportedId, matchId, reason, detail: detail.trim() || undefined }),
      });
      const data = await parseResponse<any>(res);
      if (!res.ok) throw new Error(data.error || 'Could not submit report');
      setDone(true);
    } catch (e: any) {
      setErr(e.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  const first = (otherName || 'this person').split(' ')[0];

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={modal}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🛡️</div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#0b0b0b', margin: '0 0 10px' }}>Report submitted.</h2>
            <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: 14, color: '#6b6b76', lineHeight: 1.6, margin: '0 0 20px' }}>
              We&apos;ve ended this match and {first} won&apos;t be matched with you again. Our team will review it. Thank you for keeping NotCupid safe.
            </p>
            <button onClick={() => { onDone?.(); onClose(); }} style={primary}>done</button>
          </div>
        ) : (
          <>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#d2530f', marginBottom: 8 }}>
              report &amp; block
            </div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#0b0b0b', margin: '0 0 6px' }}>Report {first}?</h2>
            <p style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13, color: '#6b6b76', lineHeight: 1.5, margin: '0 0 16px' }}>
              This ends the match and blocks {first} from ever matching with you again. What happened?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setReason(r.value)}
                  style={{
                    textAlign: 'left', padding: '11px 14px', borderRadius: 10, cursor: 'pointer',
                    fontFamily: 'system-ui, sans-serif', fontSize: 14,
                    border: `1.5px solid ${reason === r.value ? '#d2530f' : 'rgba(11,11,11,0.14)'}`,
                    background: reason === r.value ? '#fff1e8' : '#fff',
                    color: '#0b0b0b',
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="anything else we should know? (optional)"
              style={{ width: '100%', borderRadius: 10, border: '1px solid rgba(11,11,11,0.15)', padding: '10px 12px', fontFamily: 'system-ui, sans-serif', fontSize: 13.5, resize: 'vertical', outline: 'none', marginBottom: 12 }}
            />
            {err && <p style={{ color: '#c0392b', fontSize: 12, margin: '0 0 10px', fontFamily: "'DM Mono', monospace" }}>{err}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={ghost}>cancel</button>
              <button onClick={submit} disabled={!reason || busy} style={{ ...danger, flex: 1, opacity: !reason || busy ? 0.5 : 1 }}>
                {busy ? 'submitting…' : 'report & block'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(11,11,11,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 70 };
const modal: React.CSSProperties = { background: '#fff', borderRadius: 16, maxWidth: 440, width: '100%', padding: 24, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px -20px rgba(11,11,11,0.4)' };
const primary: React.CSSProperties = { background: '#0b0b0b', color: '#fff', border: 'none', borderRadius: 999, padding: '12px 24px', fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' };
const ghost: React.CSSProperties = { background: 'transparent', color: '#6b6b76', border: '1px solid rgba(11,11,11,0.15)', borderRadius: 999, padding: '12px 18px', fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' };
const danger: React.CSSProperties = { background: '#c0392b', color: '#fff', border: 'none', borderRadius: 999, padding: '12px 18px', fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' };
