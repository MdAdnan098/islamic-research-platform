import { API_BASE } from "../config/env.js";

export const mediaUrl = (key) => (key ? `${API_BASE}/api/public/media/${encodeURIComponent(key)}` : null);
export const isPdfKey = (key) => /\.pdf$/i.test(key || "");
