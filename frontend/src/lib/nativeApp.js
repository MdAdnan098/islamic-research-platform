/**
 * Bridge to the AthariTV native (Android) app - the small local Capacitor plugin "AthariApp"
 * (android/app/src/main/java/com/atharitv/app/AthariAppPlugin.java).
 *
 * The website itself is loaded remotely inside the app, so this only does anything when it runs inside the Android
 * app. In an ordinary browser getNativeApp() resolves to null and nothing is imported or called.
 */

export function isNativeApp() {
  try { return window.Capacitor?.isNativePlatform?.() === true; } catch { return false; }
}

let loading = null;

/** -> null (browser / plugin unavailable) or { getAppInfo(): Promise<{versionName, versionCode, packageName}>, openExternalUrl({url}): Promise<{opened}>, onNotificationLink(cb) } */
export function getNativeApp() {
  if (!isNativeApp()) return Promise.resolve(null);
  loading ||= import("@capacitor/core")
    .then(({ registerPlugin }) => {
      const plugin = registerPlugin("AthariApp");
      // A thin wrapper object is resolved instead of the plugin proxy itself, so the promise never treats the proxy as a thenable.
      return {
        getAppInfo: () => plugin.getAppInfo(),
        openExternalUrl: (options) => plugin.openExternalUrl(options),
        // Phase 3: the page a tapped push notification wants to open. Fires once per tap (also for a cold start).
        // -> Promise<{ remove(): Promise<void> }>
        onNotificationLink: (callback) => plugin.addListener("notificationLink", (event) => callback(event?.link)),
      };
    })
    .catch(() => null);
  return loading;
}
