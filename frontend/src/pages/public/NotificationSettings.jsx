import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../../i18n/index.jsx";
import { useMeta } from "../../lib/useMeta.js";
import { publicApi } from "../../services/public.js";
import { CATEGORIES } from "../../lib/push/pushState.js";
import { disablePush, enablePush, getPermission, getSavedState, pushMode, savePrefs } from "../../lib/push/pushClient.js";

function Switch({ checked, onChange, disabled, label, hint }) {
  return (
    <label className={`flex items-start justify-between gap-4 rounded-xl border border-rule bg-field px-4 py-3 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <span className="min-w-0">
        <span className="block text-base font-semibold">{label}</span>
        {hint && <span className="mt-0.5 block text-sm text-mute">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" className="mt-1 h-5 w-5 shrink-0 accent-[rgb(var(--cta))]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/** /notifications - this device's notification switches. Has nothing to do with the admin login. */
export default function NotificationSettings() {
  const { t } = useI18n();
  const text = t.push;
  useMeta({ title: text.settingsTitle, description: text.settingsIntro, noindex: true });

  const [mode, setMode] = useState(null); // native | web | needs-install | unsupported
  const [permission, setPermission] = useState("default");
  const [serverEnabled, setServerEnabled] = useState(true);
  const [state, setState] = useState(getSavedState());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const reload = useCallback(async () => {
    setMode(pushMode());
    setPermission(await getPermission());
    setState(getSavedState());
  }, []);

  useEffect(() => {
    reload().catch(() => {});
    publicApi.pushStatus().then(setServerEnabled).catch(() => {});
  }, [reload]);

  const on = state.enabled && permission === "granted";

  const toggleMaster = async (next) => {
    setBusy(true); setMessage("");
    if (next) {
      const result = await enablePush();
      if (!result.ok) setMessage(result.reason === "denied" ? (mode === "native" ? text.deniedApp : text.deniedWeb) : text.errorHint);
    } else {
      await disablePush();
    }
    await reload();
    setBusy(false);
  };

  const toggleCategory = async (key, next) => {
    setMessage("");
    const prefs = { ...state.prefs, [key]: next };
    setState({ ...state, prefs });
    try { await savePrefs(prefs); } catch { setMessage(text.saveFailed); await reload(); }
  };

  let notice = "";
  if (!serverEnabled) notice = text.serverOff;
  else if (mode === "needs-install") notice = text.needsInstall;
  else if (mode === "unsupported") notice = text.unsupported;
  else if (permission === "denied") notice = mode === "native" ? text.deniedApp : text.deniedWeb;
  const canUse = serverEnabled && (mode === "native" || mode === "web") && permission !== "denied";

  return (
    <div className="container-read py-12 sm:py-16">
      <h1 className="text-3xl font-bold sm:text-4xl">{text.settingsTitle}</h1>
      <p className="mt-3 text-base text-mute">{text.settingsIntro}</p>

      {notice && <p className="mt-6 rounded-xl border border-rule bg-field p-4 text-sm leading-relaxed" role="status">{notice}</p>}

      {mode && (
        <div className="mt-8 space-y-3">
          <Switch checked={on} disabled={!canUse || busy} onChange={toggleMaster} label={text.master} hint={on ? text.masterOn : text.masterOff} />
        </div>
      )}

      {mode && (
        <section className="mt-8" aria-labelledby="push-cats">
          <h2 id="push-cats" className="text-lg font-bold">{text.categories}</h2>
          <div className="mt-3 space-y-3">
            {CATEGORIES.map((key) => (
              <Switch key={key} checked={state.prefs[key] !== false} disabled={!on || busy} onChange={(v) => toggleCategory(key, v)} label={text[key]} hint={text[`${key}Hint`]} />
            ))}
          </div>
        </section>
      )}

      {message && <p className="mt-4 text-sm text-mute" role="alert">{message}</p>}
    </div>
  );
}
