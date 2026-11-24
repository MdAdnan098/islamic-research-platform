import { Component, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useI18n } from "../../i18n/index.jsx";
import { publicApi } from "../../services/public.js";
import { countVisit, loadState, saveState, shouldPrompt } from "../../lib/push/pushState.js";
import {
  BANNER_EVENT,
  enablePush,
  getPermission,
  listenForNativeLinks,
  openNotificationLink,
  pushMode,
  refreshPush,
  setNotificationNavigator,
} from "../../lib/push/pushClient.js";

/** Wait this long before the permission card appears, so it never lands on top of the first thing a visitor reads. */
const PROMPT_DELAY_MS = 8000;
const BANNER_MS = 7000;

class Silent extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.warn("Push notifications disabled:", err?.message); }
  render() { return this.state.failed ? null : this.props.children; }
}

/** The banner shown at the top while the app / site is open (the system does not show a popup for a foreground message). */
function Banner({ banner, onClose, onOpen, label, closeLabel }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[400] flex justify-center px-3" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)" }}>
      <div role="status" aria-live="polite" className="animate-fade pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-rule bg-paper p-3 text-ink shadow-elev">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-start" aria-label={`${label}: ${banner.title}`}>
          <span className="block truncate text-sm font-bold">{banner.title}</span>
          {banner.body && <span className="mt-0.5 line-clamp-2 block text-sm text-mute">{banner.body}</span>}
        </button>
        <button type="button" onClick={onClose} aria-label={closeLabel} className="shrink-0 rounded-md px-2 text-lg leading-none text-mute hover:text-ink">×</button>
      </div>
    </div>
  );
}

function PushInner() {
  const { t } = useI18n();
  const text = t.push;
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [banner, setBanner] = useState(null);
  const [promptReady, setPromptReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");
  const timer = useRef(null);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  // Start-up: count the visit, keep the token fresh, listen for taps. Runs once.
  useEffect(() => {
    let removeNative = () => {};
    let cancelled = false;
    setNotificationNavigator((path) => navigate(path));
    saveState(window.localStorage, countVisit(loadState(window.localStorage)));
    (async () => {
      let serverEnabled = false;
      try { serverEnabled = await publicApi.pushStatus(); } catch { /* offline */ }
      if (cancelled) return;
      if (pushMode() === "native") removeNative = await listenForNativeLinks();
      if (serverEnabled) await refreshPush();
      const permission = await getPermission();
      if (cancelled) return;
      if (shouldPrompt(loadState(window.localStorage), { permission, serverEnabled, path: pathRef.current })) {
        timer.current = setTimeout(() => {
          if (!pathRef.current.startsWith("/admin")) setPromptReady(true);
        }, PROMPT_DELAY_MS);
      }
    })().catch(() => {});
    return () => { cancelled = true; clearTimeout(timer.current); removeNative(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Foreground messages.
  useEffect(() => {
    let hide;
    const onBanner = (event) => {
      setBanner(event.detail);
      clearTimeout(hide);
      hide = setTimeout(() => setBanner(null), BANNER_MS);
    };
    window.addEventListener(BANNER_EVENT, onBanner);
    return () => { window.removeEventListener(BANNER_EVENT, onBanner); clearTimeout(hide); };
  }, []);

  const dismissPrompt = useCallback(() => {
    saveState(window.localStorage, { ...loadState(window.localStorage), dismissedAt: Date.now() });
    setPromptReady(false);
  }, []);

  const turnOn = async () => {
    setBusy(true);
    setHint("");
    const result = await enablePush();
    setBusy(false);
    if (result.ok) { setPromptReady(false); return; }
    if (result.reason === "denied") setHint(text.deniedHint);
    else if (result.reason === "dismissed") dismissPrompt();
    else setHint(text.errorHint);
  };

  const showPrompt = promptReady && !pathname.startsWith("/admin") && pathname !== "/notifications";
  return (
    <>
      {banner && (
        <Banner
          banner={banner}
          label={text.banner}
          closeLabel={text.close}
          onClose={() => setBanner(null)}
          onOpen={() => { if (banner.link) openNotificationLink(banner.link); setBanner(null); }}
        />
      )}
      {showPrompt && (
        <div className="fixed inset-x-0 bottom-0 z-[350] flex justify-center px-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}>
          <div role="dialog" aria-labelledby="push-prompt-title" className="animate-fade w-full max-w-md rounded-2xl border border-rule bg-paper p-4 text-ink shadow-elev">
            <h2 id="push-prompt-title" className="text-base font-bold">{text.promptTitle}</h2>
            <p className="mt-1 text-sm text-mute">{text.promptText}</p>
            {hint && <p className="mt-2 text-sm text-mute" role="alert">{hint}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn btn-cta !px-4 !py-2 !text-sm" disabled={busy} onClick={turnOn}>{text.turnOn}</button>
              <button type="button" className="btn-ghost !px-3 !py-2 !text-sm" disabled={busy} onClick={dismissPrompt}>{text.notNow}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Mounted once in App.jsx (inside the router). Any error here is swallowed so notifications can never break the site. */
export default function PushLoader() {
  return <Silent><PushInner /></Silent>;
}
