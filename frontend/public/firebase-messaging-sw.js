/* AthariTV website push notifications (Phase 3) - Firebase Cloud Messaging service worker.
 *
 * Registered by src/lib/push/pushClient.js as /firebase-messaging-sw.js?apiKey=...&projectId=...&messagingSenderId=...&appId=...
 * The values in the query string are the PUBLIC Firebase web settings. There is no secret in this file.
 *
 * The server sends DATA-ONLY messages to the web, so the notification is shown here (once) and a tap is handled here.
 * When the website is open and focused, the page shows its own banner instead (onMessage in pushClient.js).
 *
 * The SDK version below must be a published firebase-js-sdk version; keep it on the same major as "firebase" in package.json.
 */
importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js");

const params = new URL(self.location.href).searchParams;
const config = {
  apiKey: params.get("apiKey"),
  projectId: params.get("projectId"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
};

/** Only a page of this website may be opened (same rule as the server and the app). */
function safePath(link) {
  if (typeof link !== "string") return "/";
  const v = link.trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.length > 512 || /[\u0000-\u001f\u007f\\]/.test(v) || /^\/admin(\/|$|\?|#)/i.test(v)) return "/";
  return v;
}

if (config.apiKey && config.projectId && config.messagingSenderId && config.appId) {
  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const data = payload.data || {};
    const title = String(data.title || "AthariTV").slice(0, 100);
    return self.registration.showNotification(title, {
      body: String(data.body || "").slice(0, 300),
      icon: data.icon || "/brand/favicon-192.png",
      badge: "/brand/favicon-32.png",
      tag: data.nid || undefined, // the same notification replaces itself instead of stacking
      data: { link: safePath(data.link) },
    });
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(safePath(event.notification.data && event.notification.data.link), self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          return client.focus().then((focused) => (focused && "navigate" in focused ? focused.navigate(url) : undefined));
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
