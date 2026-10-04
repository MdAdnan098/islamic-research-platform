export const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8787").replace(/\/$/, "");
export const SITE_URL = (import.meta.env.VITE_SITE_URL || "").replace(/\/$/, "");
export const SOCIAL = {
  youtube: import.meta.env.VITE_YOUTUBE_URL || "https://youtube.com/@atharitv-x4e?si=QXXaEhxez_amri9s",
  instagram: import.meta.env.VITE_INSTAGRAM_URL || "https://www.instagram.com/athari_tv?stkn=bnpsd3dubmpveTA=",
  whatsapp: import.meta.env.VITE_WHATSAPP_URL || "https://whatsapp.com/channel/0029VbBjiQFAzNbr5kz9zq3b",
};
export const BRAND = { name: "Fahm-e-Salaf", arabic: "فہمِ سلف", tagline: "Quran • Sunnah • Ahle Hadees" };
