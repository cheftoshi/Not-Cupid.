// Client-side image compression. Phone photos are routinely 5–12MB and iPhones
// shoot HEIC — both fail our 4MB upload cap / JPEG-only server. We downscale and
// re-encode to JPEG in the browser before upload, which fixes BOTH at once:
// size drops well under the cap, and the output is always a displayable JPEG.
//
// HEIC note: createImageBitmap/<img> can decode HEIC on iOS Safari (the main
// HEIC source) via the system decoder. On the rare desktop-Chrome-HEIC case it
// can't decode → we return the original and the server gives a clear message.

const CAP = 4 * 1024 * 1024; // ~Vercel 4.5MB body limit minus multipart overhead

async function loadDimensions(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; cleanup: () => void } | null> {
  // Prefer createImageBitmap (respects EXIF orientation, fast).
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as any);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, cleanup: () => bitmap.close?.() };
  } catch { /* fall through */ }
  // Fallback: decode via an <img> element.
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, cleanup: () => URL.revokeObjectURL(url) };
  } catch {
    return null;
  }
}

function encode(source: CanvasImageSource, w: number, h: number, quality: number): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(source, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/**
 * Returns a compressed JPEG File (downscaled to fit `maxDim`, under the upload
 * cap where possible). On any failure, returns the original file unchanged so
 * upload still proceeds (server validates as the backstop).
 */
export async function compressImage(file: File, maxDim = 1600): Promise<File> {
  if (typeof window === 'undefined' || !file.type.startsWith('image/')) return file;
  // Already small + already a supported web format → leave it alone.
  if (file.size <= CAP && /image\/(jpeg|png|webp)/.test(file.type)) return file;

  try {
    const decoded = await loadDimensions(file);
    if (!decoded) return file;
    const { source, width, height, cleanup } = decoded;

    let dim = maxDim;
    let quality = 0.85;
    let out: Blob | null = null;
    // Up to 3 passes, tightening dimension + quality until under the cap.
    for (let i = 0; i < 3; i++) {
      const scale = Math.min(1, dim / Math.max(width, height));
      out = await encode(source, Math.round(width * scale), Math.round(height * scale), quality);
      if (!out || out.size <= CAP) break;
      dim = Math.round(dim * 0.8);
      quality -= 0.12;
    }
    cleanup();
    if (!out) return file;

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    const compressed = new File([out], name, { type: 'image/jpeg' });
    // Use whichever is smaller (a tiny source can grow when re-encoded).
    return compressed.size < file.size ? compressed : file;
  } catch {
    return file;
  }
}
