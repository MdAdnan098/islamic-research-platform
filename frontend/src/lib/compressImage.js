/**
 * Shrinks an image in the browser BEFORE it is uploaded to R2 (the Worker has no image library).
 * Tuned for photographed / scanned book pages: the long side is capped at MAX_SIDE px (still sharp when zoomed on a
 * phone) and the picture is re-encoded as WebP at high quality, so small print stays crisp while the file is
 * typically 5-10x smaller. Never makes things worse: if the result is not clearly smaller, or anything fails
 * (old browser, odd file), the ORIGINAL file is uploaded unchanged. GIFs (may be animated) and PDFs are not touched.
 */
export const MAX_SIDE = 2200;     // px, longest side
export const WEBP_QUALITY = 0.85; // high: no visible blur on text
const SKIP_BELOW = 250 * 1024;    // already small -> leave as is

/** Size to scale (w x h) down to so that its longest side is at most `max` (never scales up). */
export function fitWithin(w, h, max = MAX_SIDE) {
  const longest = Math.max(w, h);
  if (longest <= max) return { width: w, height: h };
  const k = max / longest;
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

const toBlob = (canvas, type, quality) => new Promise((res) => canvas.toBlob(res, type, quality));

export async function compressImage(file) {
  try {
    if (!file?.type?.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); // keeps phone-photo rotation right
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const resized = width !== bitmap.width;
    if (!resized && file.size < SKIP_BELOW) { bitmap.close?.(); return file; }

    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    let blob = await toBlob(canvas, "image/webp", WEBP_QUALITY);
    if (!blob || blob.type !== "image/webp") { // browser cannot write WebP: JPEG on white (scans have no transparency)
      const flat = document.createElement("canvas");
      flat.width = width; flat.height = height;
      const c2 = flat.getContext("2d");
      c2.fillStyle = "#fff"; c2.fillRect(0, 0, width, height); c2.drawImage(canvas, 0, 0);
      blob = await toBlob(flat, "image/jpeg", 0.88);
    }
    if (!blob || (blob.size >= file.size * 0.9 && !resized)) return file; // not worth it
    if (blob.size >= file.size) return file;
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    return new File([blob], `${(file.name || "image").replace(/\.[^.]+$/, "")}.${ext}`, { type: blob.type, lastModified: Date.now() });
  } catch {
    return file;
  }
}
