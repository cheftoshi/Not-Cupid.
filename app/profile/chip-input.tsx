'use client';

import { useRef, useState, KeyboardEvent } from 'react';
import styles from './profile.module.css';

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  variant?: 'lav' | 'accent' | 'mix';
  maxItems?: number;
};

const variants = {
  lav:    { bg: 'rgba(139,127,212,0.13)', color: '#5b4fa0', border: 'rgba(139,127,212,0.35)' },
  accent: { bg: '#ede9ff',                color: '#0e0c1a', border: 'rgba(14,12,26,0.13)' },
};

export default function ChipInput({ value, onChange, placeholder, variant = 'mix', maxItems = 12 }: Props) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function commit(raw: string) {
    const clean = raw.trim();
    if (!clean) return;
    if (value.includes(clean)) { setDraft(''); return; }
    if (value.length >= maxItems) return;
    onChange([...value, clean]);
    setDraft('');
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit(draft);
    } else if (e.key === 'Backspace' && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function chipStyle(i: number) {
    if (variant !== 'mix') return variants[variant];
    return i % 2 === 0 ? variants.lav : variants.accent;
  }

  return (
    <div className={styles.chipInput} onClick={() => inputRef.current?.focus()}>
      {value.map((v, i) => {
        const s = chipStyle(i);
        return (
          <span key={`${v}-${i}`} className={styles.chip} style={{ background: s.bg, color: s.color, borderColor: s.border }}>
            {v}
            <button type="button" className={styles.chipX} onClick={(e) => { e.stopPropagation(); remove(i); }} aria-label={`remove ${v}`}>×</button>
          </span>
        );
      })}
      <input
        ref={inputRef}
        type="text"
        className={styles.chipFieldInput}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => commit(draft)}
        placeholder={value.length === 0 ? placeholder : ''}
      />
    </div>
  );
}
