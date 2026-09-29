/**
 * Central definitions for public site navigation and language options.
 * Kept separate from components so the same data can later be swapped
 * for a backend-driven menu without touching UI code.
 */

export const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Aqeedah", href: "/aqeedah" },
  { label: "Masail", href: "/masail" },
];

/**
 * UI-only for now — selecting a language does not yet translate content.
 * Real multilingual content will be served from the backend in a later
 * phase (see project roadmap: Hindi / Urdu / Roman Urdu support).
 */
export const LANGUAGES = [
  { code: "roman", label: "Roman" },
  { code: "hi", label: "Hindi" },
  { code: "ur", label: "Urdu" },
];
