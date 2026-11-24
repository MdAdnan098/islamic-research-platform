import { useState } from "react";
import { adminApi } from "../../services/admin.js";
import { useAsync } from "../../lib/useAsync.js";
import { compareVersions, isValidVersion } from "../../lib/appUpdate.js";
import { ErrorBox, Field, PageHeader, Spinner, StatusBadge, useConfirm, useToast } from "../components/ui.jsx";
import { formatDateTime } from "../../lib/format.js";

/**
 * Android APP releases (the APK) - NOT the website. Website changes go live by themselves after a deployment and need
 * no APK; only native changes do. Publishing here is what makes installed apps show the "update available" dialog.
 */
const EMPTY = { latestVersion: "", minSupportedVersion: "", releaseDate: "", releaseNotes: [], downloadUrl: "", storeUrl: "", mandatory: false, published: false };

function ReleaseForm({ initial, allowedHosts, onSaved }) {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [f, setF] = useState({ ...EMPTY, ...initial, releaseNotes: (initial?.releaseNotes || []).join("\n") });
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setF({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const policy = (() => {
    if (!isValidVersion(f.latestVersion.trim())) return "";
    const min = f.minSupportedVersion.trim();
    const minOk = min && isValidVersion(min) && compareVersions(min, f.latestVersion.trim()) <= 0;
    if (f.mandatory) return `Every installed version below ${f.latestVersion.trim()} must update (no "Later" button).`;
    if (minOk) return `Versions below ${min} must update (no "Later" button). Versions from ${min} up to the latest see an optional update.`;
    return "Everyone on an older version sees an optional update (with a \"Later\" button).";
  })();

  async function save(published) {
    if (published && f.mandatory) {
      const ok = await confirm({ title: "Publish a mandatory update?", message: `Every installed app older than ${f.latestVersion.trim() || "the latest version"} will be blocked until it is updated. Make sure the download link works first.`, confirm: "Publish" });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await adminApi.appRelease.save({
        latestVersion: f.latestVersion.trim(),
        minSupportedVersion: f.minSupportedVersion.trim(),
        releaseDate: f.releaseDate,
        releaseNotes: f.releaseNotes.split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
        downloadUrl: f.downloadUrl.trim(),
        storeUrl: f.storeUrl.trim(),
        mandatory: f.mandatory,
        published,
      });
      toast(published ? "Update published" : initial?.published && !published ? "Update unpublished" : "Saved as draft");
      onSaved();
    } catch (err) {
      toast(err.message, "error");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="a-card max-w-2xl space-y-4 p-5" autoComplete="off">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Android app release</h2>
        <StatusBadge status={initial?.published ? "published" : "draft"} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Latest version *" hint="Must match versionName in android/app/build.gradle of the APK you release, e.g. 1.2.0">
          <input className="a-input" inputMode="decimal" value={f.latestVersion} onChange={set("latestVersion")} placeholder="1.2.0" maxLength={19} />
        </Field>
        <Field label="Minimum supported version" hint="Optional. Installed apps below it are forced to update.">
          <input className="a-input" inputMode="decimal" value={f.minSupportedVersion} onChange={set("minSupportedVersion")} placeholder="1.0" maxLength={19} />
        </Field>
        <Field label="Release date">
          <input className="a-input" type="date" value={f.releaseDate} onChange={set("releaseDate")} />
        </Field>
      </div>

      <Field label="What's new" hint="One line per point (max 20 lines).">
        <textarea className="a-input min-h-[7rem]" dir="auto" value={f.releaseNotes} onChange={set("releaseNotes")} maxLength={6000} />
      </Field>

      <Field label="Official APK download URL" hint={`https:// only.${allowedHosts?.length ? ` Allowed hosts: ${allowedHosts.join(", ")}.` : ""} Opened in the phone's browser; Android then asks the user to approve the install.`}>
        <input className="a-input" type="url" inputMode="url" value={f.downloadUrl} onChange={set("downloadUrl")} placeholder="https://…/AthariTV-1.2.0.apk" maxLength={2048} />
      </Field>
      <Field label="Play Store / store listing URL" hint="Optional. If set, the app opens this instead of the APK link.">
        <input className="a-input" type="url" inputMode="url" value={f.storeUrl} onChange={set("storeUrl")} placeholder="https://play.google.com/store/apps/details?id=com.atharitv.app" maxLength={2048} />
      </Field>

      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4" checked={f.mandatory} onChange={set("mandatory")} />
        <span><span className="font-semibold">Mandatory update</span><span className="block text-xs text-ad-mute">Users cannot skip it. Use only when the old app can no longer work.</span></span>
      </label>

      {policy && <p className="rounded-md border border-ad-rule bg-ad-bg px-3 py-2 text-xs text-ad-mute">{policy}</p>}

      <div className="flex flex-wrap items-center gap-2 border-t border-ad-rule pt-4">
        <button type="button" className="a-btn-primary btn-cta" disabled={busy} onClick={() => save(true)}>{initial?.published ? "Save & keep published" : "Publish update"}</button>
        <button type="button" className="a-btn" disabled={busy} onClick={() => save(false)}>{initial?.published ? "Unpublish" : "Save as draft"}</button>
        {initial?.updatedAt && <span className="ms-auto text-xs text-ad-mute">Last saved {formatDateTime(initial.updatedAt)}{initial.updatedBy ? ` by ${initial.updatedBy}` : ""}</span>}
      </div>
      {confirmDialog}
    </form>
  );
}

export default function AppRelease() {
  const { data, error, loading, reload } = useAsync((signal) => adminApi.appRelease.get(signal), []);
  return (
    <div>
      <PageHeader title="App Updates" desc="Android app (APK) releases. Website changes never need this: they appear in the app after the website is deployed." />
      {loading && !data ? <Spinner /> : error && !data ? <ErrorBox error={error} onRetry={reload} /> : (
        <ReleaseForm key={data.release?.updatedAt || "new"} initial={data.release} allowedHosts={data.allowedHosts} onSaved={reload} />
      )}
    </div>
  );
}
