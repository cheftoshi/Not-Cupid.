// One-off: rasterize the nc monogram into PWA icons.
// (icon.svg uses a <text> node — librsvg renders it with a system serif, which
// matches the Georgia/Playfair look closely enough for a 180–512px tile.)
import sharp from 'sharp';
import { readFileSync } from 'fs';

const svg = readFileSync('app/icon.svg');
const out = async (size, path, pad = 0) => {
  // pad>0 → maskable: shrink art into a safe zone on the ink background.
  if (!pad) {
    await sharp(svg, { density: 72 * (size / 64) }).resize(size, size).png().toFile(path);
  } else {
    const inner = Math.round(size * (1 - pad * 2));
    const art = await sharp(svg, { density: 72 * (inner / 64) }).resize(inner, inner).png().toBuffer();
    await sharp({ create: { width: size, height: size, channels: 4, background: '#0b0b0b' } })
      .composite([{ input: art, gravity: 'centre' }])
      .png().toFile(path);
  }
  console.log('wrote', path);
};

await out(192, 'public/icons/icon-192.png');
await out(512, 'public/icons/icon-512.png');
await out(512, 'public/icons/icon-512-maskable.png', 0.12);
await out(180, 'app/apple-icon.png');
