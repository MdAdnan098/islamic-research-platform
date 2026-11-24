/**
 * Phase 3 - push notifications on the device.
 *
 *  - Inside the Android app (Capacitor): the native FCM token comes from @capacitor/push-notifications.
 *  - In a browser: Firebase Web Messaging + the service worker /firebase-messaging-sw.js.
 * Both register their token with the SAME backend (/api/public/push/*), which sends through FCM to each independently.
 *
 * Nothing here asks for permission by itself: enablePush() is only called after the visitor taps "Turn on" (the prompt card
 * or the Notification settings page). The Firebase Admin credentials are never in the browser - only public settings.
 */
import { getNativeApp, isNativeApp } from "../nativeApp.js";
import { publicApi } from "../../services/public.js";
import { FIREBASE_CONFIG, VAPID_KEY, isFirebaseWebConfigured } from "../../config/firebase.js";
import { bannerFrom, loadState, newInstallId, normalizePrefs, safeInternalPath, saveState, webPushSupport } from "./pushState.js";

export const BANNER_EVENT = "fs:push-banner";
const SW_SCOPE = "/firebase-cloud-messaging-push-scope"; // Firebase's default scope: the worker never controls the site's own pages

const read = () => loadState(window.localStorage);
const write = (patch) => saveState(window.localStorage, { ...read(), ...patch });

/* ------------------------- opening the page of a tapped notification ------------------------- */
let navigator_ = null;
export function setNotificationNavigator(fn) { navigator_ = fn; }
/** Opens a page of the site. A second event for the same tap (native event + plugin event) finds us already there and does nothing. */
export function openNotificationLink(link) {
  const path = safeInternalPath(link);
  if (!path) return false;
  const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (here === path) return true;
  if (navigator_) navigator_(path);
  else window.location.assign(path);
  return true;
}

const emitBanner = (data) => {
  const banner = bannerFrom(data);
  if (banner) window.dispatchEvent(new CustomEvent(BANNER_EVENT, { detail: banner }));
};

/* ------------------------------------- environment ------------------------------------- */
export function pushMode() {
  if (isNativeApp()) return "native";
  const nav = window.navigator;
  const support = webPushSupport({
    hasServiceWorker: "serviceWorker" in nav,
    hasPush: "PushManager" in window,
    hasNotification: "Notification" in window,
    userAgent: nav.userAgent,
    platform: nav.platform,
    maxTouchPoints: nav.maxTouchPoints,
    standalone: window.matchMedia?.("(display-mode: standalone)")?.matches === true || nav.standalone === true,
  });
  if (support !== "ok") return support; // "needs-install" | "unsupported"
  return isFirebaseWebConfigured() ? "web" : "unsupported";
}

async function nativePlugin() {
  return (await import("@capacitor/push-notifications")).PushNotifications;
}

/** "default" (not asked yet) | "granted" | "denied" | "unsupported" */
export async function getPermission() {
  const mode = pushMode();
  try {
    if (mode === "native") {
      const { receive } = await (await nativePlugin()).checkPermissions();
      return receive === "granted" ? "granted" : receive === "denied" ? "denied" : "default";
    }
    if (mode === "web") return window.Notification.permission;
  } catch { /* fall through */ }
  return "unsupported";
}

export const getSavedState = read;

/* --------------------------------------- tokens --------------------------------------- */
async function registerToken(platform, token) {
  const state = read();
  const installId = state.installId || newInstallId();
  write({ installId, token });
  const out = await publicApi.pushRegister({ platform, token, installId, prefs: state.prefs });
  write({ prefs: normalizePrefs(out?.prefs || state.prefs), enabled: true });
}

let nativeReady = false;
async function attachNative(PN) {
  if (nativeReady) return;
  nativeReady = true;
  await PN.addListener("registration", ({ value }) => { registerToken("android", value).catch(() => {}); });
  await PN.addListener("registrationError", () => { write({ enabled: false }); });
  // The app is open: Android shows nothing by itself, so the page shows its own banner at the top.
  await PN.addListener("pushNotificationReceived", (n) => emitBanner({ title: n.title, body: n.body, link: n.data?.link }));
  // Tap on a notification (a second route to the same page as the native "notificationLink" event; duplicates are harmless).
  await PN.addListener("pushNotificationActionPerformed", (a) => openNotificationLink(a.notification?.data?.link));
  try {
    await PN.createChannel({ id: "atharitv_default", name: "AthariTV", description: "New posts, courses and live sessions", importance: 4, visibility: 1, vibration: true });
  } catch { /* the channel is also created natively; ignore */ }
}

let webListening = false;
async function webToken() {
  const params = new URLSearchParams(FIREBASE_CONFIG).toString();
  const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params}`, { scope: SW_SCOPE });
  await navigator.serviceWorker.ready;
  const [{ getApps, initializeApp }, messagingApi] = await Promise.all([import("firebase/app"), import("firebase/messaging")]);
  if (!(await messagingApi.isSupported())) throw new Error("unsupported");
  const app = getApps()[0] || initializeApp(FIREBASE_CONFIG);
  const messaging = messagingApi.getMessaging(app);
  if (!webListening) {
    webListening = true;
    messagingApi.onMessage(messaging, (payload) => emitBanner(payload?.data)); // page is open: banner instead of a system popup
  }
  const token = await messagingApi.getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  if (!token) throw new Error("no-token");
  return { token, messaging, messagingApi };
}

/* --------------------------------------- actions --------------------------------------- */

/** Turn notifications on (asks the system for permission if it has not been asked). -> { ok, reason? } */
export async function enablePush() {
  const mode = pushMode();
  try {
    if (mode === "native") {
      const PN = await nativePlugin();
      let { receive } = await PN.checkPermissions();
      if (receive !== "granted") receive = (await PN.requestPermissions()).receive; // Android 13+: the system dialog
      if (receive !== "granted") { write({ asked: true }); return { ok: false, reason: "denied" }; }
      await attachNative(PN);
      write({ asked: true, enabled: true });
      await PN.register(); // the token arrives in the "registration" listener
      return { ok: true };
    }
    if (mode === "web") {
      const result = await window.Notification.requestPermission();
      write({ asked: true });
      if (result !== "granted") return { ok: false, reason: result === "denied" ? "denied" : "dismissed" };
      const { token } = await webToken();
      await registerToken("web", token);
      return { ok: true };
    }
    return { ok: false, reason: mode };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** Turn notifications off on this device and forget it on the server. Does not touch the account / admin login. */
export async function disablePush() {
  const { token } = read();
  write({ enabled: false, token: "" });
  if (token) { try { await publicApi.pushUnregister({ token }); } catch { /* the server also drops dead tokens by itself */ } }
  try {
    const mode = pushMode();
    if (mode === "native") await (await nativePlugin()).unregister();
    else if (mode === "web") { const { messaging, messagingApi } = await webToken(); await messagingApi.deleteToken(messaging); }
  } catch { /* nothing to delete */ }
}

/** Save the category switches here and on the server. */
export async function savePrefs(prefs) {
  const next = normalizePrefs(prefs);
  const state = write({ prefs: next });
  if (!state.token) return next;
  try {
    await publicApi.pushPreferences({ token: state.token, prefs: next });
  } catch (e) {
    if (e?.status === 404) await refreshPush(); // the server lost this device: register it again with the saved switches
    else throw e;
  }
  return next;
}

/**
 * App start / page load: when the visitor had turned notifications on, make sure the token is current (tokens rotate) and
 * the permission was not taken away in the phone / browser settings (then the device is removed from the server).
 */
export async function refreshPush() {
  const state = read();
  if (!state.enabled) return;
  const permission = await getPermission();
  if (permission !== "granted") { await disablePush(); return; }
  try {
    const mode = pushMode();
    if (mode === "native") { const PN = await nativePlugin(); await attachNative(PN); await PN.register(); }
    else if (mode === "web") { const { token } = await webToken(); await registerToken("web", token); }
  } catch { /* offline: try again next time */ }
}

/** Native only: listen for the "page to open" event from the Android launch / new intent. -> remove function */
export async function listenForNativeLinks() {
  const app = await getNativeApp();
  if (!app?.onNotificationLink) return () => {};
  const handle = await app.onNotificationLink((link) => openNotificationLink(link));
  return () => { try { handle?.remove?.(); } catch { /* ignore */ } };
}
