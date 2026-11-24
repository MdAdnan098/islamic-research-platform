// PUBLIC Firebase web-app settings (Firebase console -> Project settings -> Your apps -> Web app). These values are meant to
// be visible in the browser; they are NOT secrets. The private service-account key is only ever a Cloudflare Worker secret.
// Set them as Cloudflare Pages build variables (see PHASE-3-CHANGELOG.md). Without them website push stays switched off.
const v = (name) => String(import.meta.env[name] || "").trim();

export const FIREBASE_CONFIG = {
  apiKey: v("VITE_FIREBASE_API_KEY"),
  projectId: v("VITE_FIREBASE_PROJECT_ID"),
  messagingSenderId: v("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: v("VITE_FIREBASE_APP_ID"),
};
/** Web Push certificate "key pair" public key (Firebase console -> Cloud Messaging -> Web Push certificates). */
export const VAPID_KEY = v("VITE_FIREBASE_VAPID_KEY");

export const isFirebaseWebConfigured = () => Object.values(FIREBASE_CONFIG).every(Boolean) && !!VAPID_KEY;
