import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BrandName, LogoMark } from "../brand/Logo.jsx";
import { Icon } from "../ui/icons.jsx";
import { BRAND } from "../../config/env.js";
import { useI18n } from "../../i18n/index.jsx";
import { publicApi } from "../../services/public.js";
import { getNativeApp } from "../../lib/nativeApp.js";
import { RECHECK_MS, pickUpdateUrl, runUpdateCheck, snoozeVersion } from "../../lib/appUpdate.js";

const safeStorage = () => { try { return window.localStorage; } catch { return undefined; } };

function formatReleaseDate(value) {
  if (!value) return "";
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/**
 * Android update check + dialog. Mounted once (see AppUpdateLoader), only inside the Android app.
 *  - Runs when the app starts, and again when the app comes back to the foreground (at most every 6 hours).
 *  - One check at a time and one dialog at a time.
 *  - Optional update: "Later" hides that version for 3 days; a newer version shows straight away.
 *  - Mandatory update (marked mandatory, or installed version below the minimum supported one): no "Later".
 *    A failed check never blocks the app; the only exception is a mandatory update that was already announced.
 */
export default function AppUpdateGate() {
  const { t } = useI18n();
  const text = t.appUpdate;
  const [result, setResult] = useState(null); // { status: "optional"|"mandatory", release, installed }
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const lastCheck = useRef(0);
  const hiddenVersion = useRef(null); // optional update the user already acted on during this app session
  const controller = useRef(null);
  const primary = useRef(null);

  const check = useCallback(async () => {
    if (inFlight.current) return; // never two checks (and so never two dialogs) at once
    inFlight.current = true;
    lastCheck.current = Date.now();
    try {
      const native = await getNativeApp();
      if (!native) return;
      const info = await native.getAppInfo(); // the REAL installed native version
      const res = await runUpdateCheck({
        installedVersionName: info?.versionName,
        fetchRelease: () => publicApi.appUpdate(controller.current?.signal),
        storage: safeStorage(),
      });
      if (controller.current?.signal.aborted) return;
      if (res.status === "none") { setResult(null); return; }
      if (res.status === "optional" && res.release.latestVersion === hiddenVersion.current) return;
      setResult((prev) => (prev && prev.status === res.status && prev.release.latestVersion === res.release.latestVersion ? prev : res));
      setError("");
    } catch {
      /* A failed check must never get in the way of using the app. */
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    controller.current = new AbortController();
    check();
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastCheck.current > RECHECK_MS) check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.current?.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  const mandatory = result?.status === "mandatory";
  const release = result?.release;

  useEffect(() => { if (result) primary.current?.focus(); }, [result]);

  const later = useCallback(() => {
    if (!release || mandatory) return;
    snoozeVersion(safeStorage(), release.latestVersion);
    setResult(null);
  }, [release, mandatory]);

  useEffect(() => {
    if (!result || mandatory) return undefined;
    const onEsc = (e) => { if (e.key === "Escape") later(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [result, mandatory, later]);

  async function updateNow() {
    const url = pickUpdateUrl(release); // re-checked here: https only, public host
    if (!url) { setError(text.openFailed); return; }
    setBusy(true);
    setError("");
    try {
      const native = await getNativeApp();
      if (!native) throw new Error("no-native");
      await native.openExternalUrl({ url }); // Android shows its own download / install approval screens
      if (mandatory) setOpened(true);
      else { hiddenVersion.current = release.latestVersion; setResult(null); }
    } catch {
      setError(text.openFailed);
    } finally {
      setBusy(false);
    }
  }

  async function recheck() {
    setBusy(true);
    setOpened(false);
    setError("");
    await check(); // reads the installed version again; the dialog goes away by itself if nothing is required any more
    setBusy(false);
  }

  if (!result) return null;
  const date = formatReleaseDate(release.releaseDate);

  return createPortal(
    <div className="fixed inset-0 z-[300] grid place-items-center bg-black/60 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) later(); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-update-title"
        dir="ltr"
        className="animate-fade flex max-h-[90vh] w-full max-w-sm flex-col overflow-y-auto rounded-2xl border border-rule bg-paper p-5 text-ink shadow-elev"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex items-center gap-3">
          <LogoMark size={44} badge />
          <div className="leading-tight">
            <p className="text-lg font-bold tracking-tight"><BrandName /></p>
            <p className="text-[11px] text-mute">{BRAND.tagline}</p>
          </div>
        </div>

        <h2 id="app-update-title" className="mt-5 text-lg font-bold">{mandatory ? text.titleMandatory : text.titleOptional}</h2>
        <p className="mt-1 text-sm text-mute">{mandatory ? text.mandatoryText : text.optionalText}</p>

        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl border border-rule bg-field px-3 py-2">
            <dt className="text-[11px] uppercase tracking-wide text-mute">{text.newVersion}</dt>
            <dd className="font-semibold">v{release.latestVersion}</dd>
          </div>
          <div className="rounded-xl border border-rule bg-field px-3 py-2">
            <dt className="text-[11px] uppercase tracking-wide text-mute">{text.yourVersion}</dt>
            <dd className="font-semibold">v{result.installed}</dd>
          </div>
          {date && (
            <div className="col-span-2 rounded-xl border border-rule bg-field px-3 py-2">
              <dt className="text-[11px] uppercase tracking-wide text-mute">{text.releaseDate}</dt>
              <dd className="font-semibold">{date}</dd>
            </div>
          )}
        </dl>

        {release.releaseNotes.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-semibold">{text.whatsNew}</p>
            <ul className="mt-1.5 list-disc space-y-1 ps-5 text-sm text-mute">
              {release.releaseNotes.map((line, i) => <li key={i} dir="auto">{line}</li>)}
            </ul>
          </div>
        )}

        {(opened || error) && (
          <p role={error ? "alert" : "status"} className={`mt-4 rounded-xl border px-3 py-2 text-sm ${error ? "border-red-500/40 text-red-600" : "border-rule bg-field text-mute"}`}>
            {error || text.installHint}
          </p>
        )}

        <div className="mt-5 grid gap-2.5">
          <button ref={primary} type="button" disabled={busy} onClick={updateNow} className="btn-primary btn-cta !px-4 !py-2.5">
            <Icon name="download" size={16} />{text.updateNow}
          </button>
          {mandatory && (opened || error) && (
            <button type="button" disabled={busy} onClick={recheck} className="btn-outline !px-4 !py-2">{text.recheck}</button>
          )}
          {!mandatory && <button type="button" onClick={later} className="btn-outline !px-4 !py-2">{text.later}</button>}
        </div>
      </div>
    </div>,
    document.body
  );
}
