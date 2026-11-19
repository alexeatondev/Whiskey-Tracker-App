// Image helpers: load a photo (respecting EXIF orientation), downscale, and re-encode as JPEG.

async function loadBitmap(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch { /* fall through to <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function drawScaled(source, maxSide) {
  const w = source.width, h = source.height;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, cw, ch);
  return canvas;
}

const toBlob = (canvas, quality) => new Promise((resolve, reject) => {
  canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', quality);
});

/**
 * Returns { image, thumb, base64 }:
 *  - image: JPEG Blob (max 1600px) stored with the entry
 *  - thumb: small JPEG Blob (max 480px) for the collection grid
 *  - base64: JPEG data (max 1568px, Claude's recommended size) for label recognition
 */
export async function processPhoto(file) {
  const bmp = await loadBitmap(file);
  const full = drawScaled(bmp, 1600);
  const image = await toBlob(full, 0.85);
  const thumb = await toBlob(drawScaled(bmp, 480), 0.8);
  const ai = drawScaled(bmp, 1568);
  const base64 = ai.toDataURL('image/jpeg', 0.85).split(',')[1];
  if (bmp.close) bmp.close();
  return { image, thumb, base64 };
}
