export const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8787").replace(/\/$/, "");
export const SITE_URL = (import.meta.env.VITE_SITE_URL || "").replace(/\/$/, "");
export const SOCIAL = {
  youtube: import.meta.env.VITE_YOUTUBE_URL || "#",
  instagram: import.meta.env.VITE_INSTAGRAM_URL || "#",
};
export const BRAND = { name: "Fahm-e-Salaf", arabic: "فہمِ سلف", tagline: "Quran • Sunnah • Ahle Hadees" };
