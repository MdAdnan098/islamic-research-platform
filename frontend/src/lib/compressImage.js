/**
 * Shrinks an image in the browser BEFORE it is uploaded to R2 (the Worker has no image library).
 * Tuned for photographed / scanned book pages:
 *  - the long side is capped at MAX_SIDE px (still sharp when zoomed on a phone);
 *  - re-encoded as WebP; a file bigger than TARGET_BYTES (400 KB) is squeezed to about that size by searching for the
 *    HIGHEST quality that still fits, but never below MIN_QUALITY - so small print never turns soft (a very dense page
 *    may therefore stay somewhat above 400 KB, on purpose);
 *  - a file already at or under TARGET_BYTES is uploaded untouched, so a 78 KB file stays 78 KB.
 * Never makes things worse: if the result is not smaller than the original, or anything fails (old browser, odd
 * file), the ORIGINAL file is uploaded unchanged. GIFs (may be animated) and PDFs are not touched.
 */
export const MAX_SIDE = 2200;              // px, longest side
export const TARGET_BYTES = 400 * 1024;    // bigger files are squeezed to about this size
export const MIN_QUALITY = 0.75;           // never go softer than this, even if the file stays above the target
export const MAX_QUALITY = 0.92;           // no point going higher

/** Size to scale (w x h) down to so that its longest side is at most `max` (never scales up). */
export function fitWithin(w, h, max = MAX_SIDE) {
  const longest = Math.max(w, h);
  if (longest <= max) return { width: w, height: h };
  const k = max / longest;
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

const toBlob = (canvas, type, quality) => new Promise((res) => canvas.toBlob(res, type, quality));

/**
 * Highest quality in [lo, hi] whose encoded size is <= target (binary search, ~6 encodes). If even `hi` fits it is
 * used; if even `lo` does not fit, `lo` is used (quality is protected before size). `sizeAt(q)` returns the size.
 */
export async function pickQuality(sizeAt, target = TARGET_BYTES, lo = MIN_QUALITY, hi = MAX_QUALITY) {
  if ((await sizeAt(hi)) <= target) return hi;
  if ((await sizeAt(lo)) > target) return lo;
  let best = lo, a = lo, b = hi;
  for (let i = 0; i < 6; i++) {
    const mid = Math.round(((a + b) / 2) * 1000) / 1000;
    if ((await sizeAt(mid)) <= target) { best = mid; a = mid; } else b = mid;
  }
  return best;
}

export async function compressImage(file) {
  try {
    if (!file?.type?.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
    if (file.size <= TARGET_BYTES) return file; // already small: leave it exactly as it is
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); // keeps phone-photo rotation right
    const { width, height } = fitWithin(bitmap.width, bitmap.height);

    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    let type = "image/webp";
    let source = canvas;
    const probe = await toBlob(canvas, type, MAX_QUALITY);
    if (!probe || probe.type !== "image/webp") { // browser cannot write WebP: JPEG on white (scans have no transparency)
      type = "image/jpeg";
      source = document.createElement("canvas");
      source.width = width; source.height = height;
      const c2 = source.getContext("2d");
      c2.fillStyle = "#fff"; c2.fillRect(0, 0, width, height); c2.drawImage(canvas, 0, 0);
    }
    const cache = new Map();
    const encode = async (q) => { if (!cache.has(q)) cache.set(q, await toBlob(source, type, q)); return cache.get(q); };
    const q = await pickQuality(async (x) => (await encode(x))?.size ?? Infinity);
    const blob = await encode(q);
    if (!blob || blob.size >= file.size) return file;
    const ext = type === "image/webp" ? "webp" : "jpg";
    return new File([blob], `${(file.name || "image").replace(/\.[^.]+$/, "")}.${ext}`, { type, lastModified: Date.now() });
  } catch {
    return file;
  }
}
