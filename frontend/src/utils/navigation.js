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

/**
 * Admin sidebar navigation. Only Dashboard is a real, working route in
 * this phase — the rest are listed as upcoming sections (disabled) so
 * the sidebar's final shape is visible without building their CRUD yet.
 */
export const ADMIN_NAV_LINKS = [
  { key: "dashboard", label: "Dashboard", href: "/admin/dashboard", enabled: true },
  { key: "articles", label: "Articles", href: "/admin/articles", enabled: false },
  { key: "categories", label: "Categories", href: "/admin/categories", enabled: false },
  { key: "topics", label: "Topics", href: "/admin/topics", enabled: false },
  { key: "references", label: "References", href: "/admin/references", enabled: false },
  { key: "media", label: "Media", href: "/admin/media", enabled: false },
  { key: "settings", label: "Settings", href: "/admin/settings", enabled: false },
];
