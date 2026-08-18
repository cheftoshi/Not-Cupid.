'use client';

import { forwardRef, useImperativeHandle, useRef, useState, KeyboardEvent } from 'react';
import styles from './profile.module.css';

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  variant?: 'lav' | 'accent' | 'mix';
  maxItems?: number;
};

export type ChipInputHandle = {
  /** Include text still sitting in the input when the surrounding form saves. */
  valueWithDraft: () => string[];
};

const variants = {
  lav:    { bg: 'rgba(37,99,255,0.13)', color: 'var(--h-accent)', border: 'rgba(37,99,255,0.35)' },
  accent: { bg: 'var(--h-surface-2)',     color: 'var(--h-text)', border: 'var(--h-border)' },
};

const ChipInput = forwardRef<ChipInputHandle, Props>(function ChipInput(
  { value, onChange, placeholder, variant = 'mix', maxItems = 12 },
  ref,
) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function valueWithDraft(raw = draft) {
    const clean = raw.trim();
    if (!clean || value.includes(clean) || value.length >= maxItems) return value;
    return [...value, clean];
  }

  useImperativeHandle(ref, () => ({ valueWithDraft }), [draft, value, maxItems]);

  function commit(raw: string) {
    const next = valueWithDraft(raw);
    if (next !== value) onChange(next);
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
      {draft.trim() && value.length < maxItems ? (
        <button
          type="button"
          className={styles.chipAdd}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => commit(draft)}
          aria-label={`add ${draft.trim()}`}
        >
          + add
        </button>
      ) : null}
    </div>
  );
});

export default ChipInput;
