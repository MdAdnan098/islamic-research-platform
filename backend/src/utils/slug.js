/**
 * Slug helpers shared by category/topic/article services.
 * Kept dependency-free (no external slugify package).
 */

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Lowercases/trims a caller-supplied slug. Does not change its shape. */
export function normalizeSlug(rawSlug) {
  return typeof rawSlug === "string" ? rawSlug.trim().toLowerCase() : rawSlug;
}

/** Derives a slug from arbitrary text (e.g. a title) when none was supplied. */
export function slugify(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function isValidSlugFormat(slug) {
  return typeof slug === "string" && slug.length > 0 && slug.length <= 200 && SLUG_RE.test(slug);
}
