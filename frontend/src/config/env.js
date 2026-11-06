// Production: same-origin "/api/*" (proxied to the Worker by functions/api/[[path]].js), so the
// admin session cookie is first-party. Local dev talks to `wrangler dev` directly.
export const API_BASE = import.meta.env.DEV
  ? (import.meta.env.VITE_API_BASE_URL || "http://localhost:8787").replace(/\/$/, "")
  : "";
export const SITE_URL = (import.meta.env.VITE_SITE_URL || "").replace(/\/$/, "");
export const SOCIAL = {
  youtube: import.meta.env.VITE_YOUTUBE_URL || "https://youtube.com/@atharitv-x4e?si=QXXaEhxez_amri9s",
  instagram: import.meta.env.VITE_INSTAGRAM_URL || "https://www.instagram.com/athari_tv?stkn=bnpsd3dubmpveTA=",
  whatsapp: import.meta.env.VITE_WHATSAPP_URL || "https://whatsapp.com/channel/0029VbBjiQFAzNbr5kz9zq3b",
};
// Contact details shown in the footer ("Contact Us"). The defaults below are the real ones; VITE_CONTACT_PHONE /
// VITE_CONTACT_EMAIL (Cloudflare Pages env vars) override them. An empty value is simply not shown.
export const CONTACT = {
  phone: (import.meta.env.VITE_CONTACT_PHONE || "+91 98042 23604").trim(),
  email: (import.meta.env.VITE_CONTACT_EMAIL || "debatermuhammadrazasalafi@gmail.com").trim(),
};
export const BRAND = { name: "AthariTV", tagline: "Quran • Sunnah • Ahle Hadees" };