/**
 * Shrinks an image in the browser BEFORE it is uploaded to R2 (the Worker has no image library).
 * Tuned for photographed / scanned book pages: the long side is capped at MAX_SIDE px (still sharp when zoomed on a
 * phone) and the picture is re-encoded as WebP at high quality.
 * FLOOR: the result is never smaller than MIN_BYTES - if the first (quality 0.85) result falls below it, quality is
 * raised step by step until the file reaches the floor (or the top step), so small print never turns soft.
 * Files already at or under the floor are uploaded untouched. Never makes things worse: if the result is not
 * smaller than the original, or anything fails (old browser, odd file), the ORIGINAL file is uploaded unchanged.
 * GIFs (may be animated) and PDFs are not touched.
 */
export const MAX_SIDE = 2200;               // px, longest side
export const MIN_BYTES = 400 * 1024;        // floor: never compress below ~400 KB
export const QUALITY_STEPS = [0.85, 0.9, 0.94, 0.97]; // first one reaching MIN_BYTES wins

/** Size to scale (w x h) down to so that its longest side is at most `max` (never scales up). */
export function fitWithin(w, h, max = MAX_SIDE) {
  const longest = Math.max(w, h);
  if (longest <= max) return { width: w, height: h };
  const k = max / longest;
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

const toBlob = (canvas, type, quality) => new Promise((res) => canvas.toBlob(res, type, quality));

/** The first quality step whose size reaches `floor` (else the last step). `sizeAt(q)` returns the encoded size. */
export async function pickQuality(sizeAt, floor = MIN_BYTES, steps = QUALITY_STEPS) {
  let q = steps[0];
  for (const step of steps) { q = step; if ((await sizeAt(step)) >= floor) break; }
  return q;
}

export async function compressImage(file) {
  try {
    if (!file?.type?.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
    if (file.size <= MIN_BYTES) return file; // already at/below the floor: leave it exactly as it is
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
    const probe = await toBlob(canvas, type, QUALITY_STEPS[0]);
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
