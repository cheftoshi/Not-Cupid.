'use client';

import { useState } from 'react';
import { typeSlug } from '@/lib/quiz-data';

export default function TypeStoryCard({ name, tag }: { name: string; tag: string }) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  async function download() {
    if (busy) return;
    setBusy(true);
    try {
      await document.fonts.ready;
      const canvas = document.createElement('canvas');
      canvas.width = 1080; canvas.height = 1920;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.fillStyle = '#f7f3ea'; ctx.fillRect(0, 0, 1080, 1920);
      ctx.fillStyle = '#0d4a42'; ctx.fillRect(64, 260, 952, 1280);
      ctx.fillStyle = '#0d4a42'; ctx.font = '700 64px "Space Grotesk"'; ctx.fillText('notcupid.', 86, 160);
      ctx.fillStyle = '#f3c64a'; ctx.font = '600 28px "DM Sans"'; ctx.fillText('MY PERSONALITY TYPE', 110, 380);
      const wrap = (text: string, y: number, lineHeight: number) => {
        let line = '';
        for (const word of text.split(/\s+/)) {
          const next = line ? `${line} ${word}` : word;
          if (ctx.measureText(next).width > 850 && line) { ctx.fillText(line, 110, y); y += lineHeight; line = word; }
          else line = next;
        }
        if (line) ctx.fillText(line, 110, y);
        return y + lineHeight;
      };
      ctx.fillStyle = '#fffdf8'; ctx.font = '700 88px "Space Grotesk"';
      const next = wrap(name, 570, 108);
      ctx.font = '400 40px "DM Sans"'; wrap(tag, next + 100, 58);
      ctx.fillStyle = '#d8ece5'; ctx.font = '400 30px "DM Sans"';
      wrap('A conversation starter, not a diagnosis or a definition of who I am.', 1310, 44);
      ctx.fillStyle = '#0d4a42'; ctx.font = '600 30px "DM Sans"';
      wrap(`Find your type: notcupid.com/type/${typeSlug(name)}`, 1680, 44);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Export failed')), 'image/png'));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `notcupid-${typeSlug(name)}.png`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setStatus('Your story image is ready. Share it only if you want to.');
    } catch { setStatus('Could not create the image. You can still share your type link below.'); }
    finally { setBusy(false); }
  }
  return <div style={{ textAlign: 'center', margin: '1rem 0' }}>
    <button type="button" className="btn-primary" onClick={download} disabled={busy}>{busy ? 'Creating image…' : 'Save story image'}</button>
    <p style={{ fontSize: '.8rem', marginTop: '.6rem' }}>1080 × 1920 · type and tagline only · no profile details</p>
    <p role="status" style={{ fontSize: '.85rem', marginTop: '.5rem' }}>{status}</p>
  </div>;
}
