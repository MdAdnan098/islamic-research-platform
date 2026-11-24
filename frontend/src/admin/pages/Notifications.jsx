import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi } from "../../services/admin.js";
import { useAsync } from "../../lib/useAsync.js";
import { newInstallId, safeInternalPath } from "../../lib/push/pushState.js";
import { ErrorBox, Field, PageHeader, Spinner, StatusBadge, useConfirm, useToast } from "../components/ui.jsx";
import { formatDateTime } from "../../lib/format.js";

/**
 * Push notification dashboard (Phase 3): one place that controls BOTH the Android app and the website.
 * Real operating-system notifications are sent by the server through Firebase Cloud Messaging - this page only
 * writes the message and shows the results. No device token or credential is ever shown here.
 */
const CATEGORIES = [
  ["posts", "New posts"],
  ["courses", "Courses"],
  ["live", "Live sessions"],
  ["announcements", "Announcements"],
];
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES);
const AUTO_LABELS = [
  ["posts", "New published posts", "When a post goes from draft to published (not on later edits)."],
  ["courses", "New courses", "When a course becomes public."],
  ["liveNew", "New live sessions", "When a live session is published before it starts."],
  ["liveStart", "Live session starting", "When a published session goes live (instantly for manual / YouTube changes; by the scheduled check for start times)."],
];
const LINK_HINTS = ["/", "/live", "/courses", "/aqaid", "/masail", "/article/"];
const STATUS_LABEL = { completed: "Delivered", completed_with_errors: "Delivered with errors", sending: "Sending…", queued: "Queued", failed: "Failed" };
const PLATFORM_LABEL = { android: "Android app", web: "Website" };

const EMPTY = { title: "", body: "", category: "posts", android: true, web: true, link: "" };

function Preview({ form }) {
  const title = form.title.trim() || "Notification title";
  const body = form.body.trim() || "The message appears here.";
  return (
    <div className="space-y-3" aria-label="Preview">
      <p className="a-label">Preview</p>
      <div className="flex items-start gap-3 rounded-2xl border border-ad-rule bg-ad-bg p-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ad-brand text-xs font-bold text-on-accent" aria-hidden>A</span>
        <div className="min-w-0">
          <p className="text-[11px] text-ad-mute">AthariTV · now</p>
          <p className="truncate text-sm font-bold">{title}</p>
          <p className="line-clamp-3 text-sm text-ad-mute">{body}</p>
        </div>
      </div>
      <p className="text-xs text-ad-mute">
        Opens: <span className="font-mono">{form.link.trim() || "(the app / website home)"}</span>. Android shows this in the status bar when the app is closed or in the background, and as a banner at the top while the app is open. Browsers show it as a system notification, and as a banner while the site is open.
      </p>
    </div>
  );
}

function NotificationRow({ n, onContinue, busy }) {
  const targeted = n.targeted.android + n.targeted.web;
  return (
    <tr className="border-t border-ad-rule align-top">
      <td className="px-3 py-2">
        <p className="max-w-[18rem] truncate font-semibold">{n.title}</p>
        <p className="max-w-[18rem] truncate text-xs text-ad-mute">{n.body}</p>
        {n.link && <p className="font-mono text-[11px] text-ad-mute">{n.link}</p>}
      </td>
      <td className="px-3 py-2 text-sm">{CATEGORY_LABEL[n.category] || n.category}<br /><span className="text-xs text-ad-mute">{n.source === "auto" ? "Automatic" : "Custom"} · {n.platforms.map((p) => PLATFORM_LABEL[p]).join(" + ")}</span></td>
      <td className="px-3 py-2">
        <StatusBadge status={n.status === "completed" ? "published" : n.status === "failed" ? "failed" : "scheduled"} />
        <p className="mt-1 text-xs text-ad-mute">{STATUS_LABEL[n.status] || n.status}</p>
        {n.lastError && <p className="text-[11px] text-ad-danger">{n.lastError}</p>}
      </td>
      <td className="px-3 py-2 text-sm tabular-nums">
        <p><span className="text-ad-ok">{n.sent} sent</span> · <span className={n.failed ? "text-ad-danger" : ""}>{n.failed} failed</span></p>
        <p className="text-xs text-ad-mute">of {targeted} devices · Android {n.byPlatform.android.sent}/{n.byPlatform.android.sent + n.byPlatform.android.failed} · Web {n.byPlatform.web.sent}/{n.byPlatform.web.sent + n.byPlatform.web.failed}</p>
        {n.removed > 0 && <p className="text-xs text-ad-mute">{n.removed} expired device(s) removed</p>}
        {(n.status === "sending" || n.status === "queued") && (
          <button type="button" className="a-btn mt-1 !py-0.5 text-xs" disabled={busy} onClick={() => onContinue(n.id)}>Continue sending</button>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-xs text-ad-mute">{formatDateTime(n.createdAt)}{n.createdBy && <><br />{n.createdBy}</>}</td>
    </tr>
  );
}

export default function Notifications() {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const { data, error, loading, reload } = useAsync((signal) => adminApi.notifications.overview(signal), []);
  const [form, setForm] = useState(EMPTY);
  const [requestId, setRequestId] = useState(() => newInstallId());
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState([]);
  const [auto, setAuto] = useState(null);
  const finishing = useRef(false);

  useEffect(() => { if (data) { setList(data.notifications); setAuto(data.auto); } }, [data]);

  const merge = useCallback((n) => setList((old) => [n, ...old.filter((x) => x.id !== n.id)].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))), []);

  /** A big audience is sent in chunks; keep going while this page is open (the server also lets the scheduled run finish it). */
  const finish = useCallback(async (id) => {
    if (finishing.current) return;
    finishing.current = true;
    try {
      for (let i = 0; i < 500; i += 1) {
        const n = await adminApi.notifications.continue(id);
        merge(n);
        if (n.status !== "sending" && n.status !== "queued") break;
      }
    } catch (err) {
      toast(err.message, "error");
    } finally {
      finishing.current = false;
    }
  }, [merge, toast]);

  useEffect(() => {
    const pending = list.find((n) => n.status === "sending" || n.status === "queued");
    if (pending) finish(pending.id);
  }, [list, finish]);

  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;

  const platforms = [form.android && "android", form.web && "web"].filter(Boolean);
  const linkText = form.link.trim();
  const linkOk = !linkText || /^https:\/\//i.test(linkText) || !!safeInternalPath(linkText);
  const valid = form.title.trim() && form.body.trim() && platforms.length > 0 && linkOk && data.configured;
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function send() {
    const reach = platforms.map((p) => `${PLATFORM_LABEL[p]} (${data.devices[p]} registered)`).join(" and ");
    const ok = await confirm({ title: "Send this notification now?", message: `It will be sent immediately to ${reach}, only to people who allow "${CATEGORY_LABEL[form.category]}". This cannot be undone.`, confirm: "Send now" });
    if (!ok) return;
    setBusy(true);
    try {
      const n = await adminApi.notifications.send({ title: form.title.trim(), body: form.body.trim(), category: form.category, platforms, link: linkText, clientRequestId: requestId });
      merge(n);
      setForm(EMPTY);
      setRequestId(newInstallId());
      toast(n.status === "sending" ? "Sending started" : `Sent to ${n.sent} device(s)`);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleAuto(key, value) {
    const before = auto;
    setAuto({ ...auto, [key]: value });
    try { setAuto(await adminApi.notifications.saveAuto({ [key]: value })); } catch (err) { setAuto(before); toast(err.message, "error"); }
  }

  return (
    <div>
      <PageHeader title="Notifications" desc="Push notifications for the Android app and the website, from one place." />

      {!data.configured && (
        <div className="a-card mb-5 border-ad-warn/40 p-4 text-sm" role="alert">
          <p className="font-semibold text-ad-warn">Push is not set up on the server yet.</p>
          <p className="mt-1 text-ad-mute">The Cloudflare Worker secret FIREBASE_SERVICE_ACCOUNT is missing or invalid, so nothing can be sent. Follow the Firebase setup in PHASE-3-CHANGELOG.md.</p>
        </div>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="a-card p-4"><p className="a-label">Android app devices</p><p className="text-2xl font-bold tabular-nums">{data.devices.android}</p></div>
        <div className="a-card p-4"><p className="a-label">Website browsers</p><p className="text-2xl font-bold tabular-nums">{data.devices.web}</p></div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="a-card space-y-4 p-5" aria-labelledby="n-compose">
          <h2 id="n-compose" className="text-base font-bold">Send a notification</h2>
          <Field label="Title" hint={`${form.title.length}/100`}><input className="a-input" maxLength={100} value={form.title} onChange={set("title")} /></Field>
          <Field label="Message" hint={`${form.body.length}/300`}><textarea className="a-input min-h-[5.5rem]" maxLength={300} value={form.body} onChange={set("body")} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category (users can switch categories off)">
              <select className="a-input" value={form.category} onChange={set("category")}>{CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </Field>
            <div>
              <span className="a-label">Send to</span>
              <label className="mr-4 inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={form.android} onChange={set("android")} /> Android app</label>
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={form.web} onChange={set("web")} /> Website</label>
            </div>
          </div>
          <Field label="Opens this page (optional)" hint={linkOk ? "A page of this website, e.g. /article/<slug> or /courses/<slug>. Leave empty to open the home page." : "Must start with / (a page of this website) or be a full https link on this website."}>
            <input className="a-input font-mono" list="n-links" placeholder="/article/my-post" value={form.link} onChange={set("link")} />
            <datalist id="n-links">{LINK_HINTS.map((l) => <option key={l} value={l} />)}</datalist>
          </Field>
          <Preview form={form} />
          <button type="button" className="a-btn-primary" disabled={!valid || busy} onClick={send}>{busy ? "Sending…" : "Send now"}</button>
        </section>

        <section className="a-card space-y-3 p-5" aria-labelledby="n-auto">
          <h2 id="n-auto" className="text-base font-bold">Automatic notifications</h2>
          <p className="text-sm text-ad-mute">Sent by the server only after the content is saved as published. Drafts, minor edits and re-publishing the same item never notify twice.</p>
          {auto && AUTO_LABELS.map(([key, label, hint]) => (
            <label key={key} className="flex items-start justify-between gap-4 rounded-xl border border-ad-rule px-3 py-2">
              <span><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-ad-mute">{hint}</span></span>
              <input type="checkbox" className="mt-1 h-4 w-4" checked={auto[key]} onChange={(e) => toggleAuto(key, e.target.checked)} />
            </label>
          ))}
          <p className="text-xs text-ad-mute">Important announcements are sent from the form on the left (category “Announcements”).</p>
        </section>
      </div>

      <section className="a-card mt-5 overflow-hidden" aria-labelledby="n-history">
        <h2 id="n-history" className="px-5 pt-4 text-base font-bold">History</h2>
        <p className="px-5 pb-3 text-xs text-ad-mute">“Sent” means Firebase accepted the message; a phone that is switched off receives it when it comes back online. Expired devices are removed automatically.</p>
        {list.length === 0 ? <p className="px-5 pb-5 text-sm text-ad-mute">Nothing sent yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-start text-sm">
              <thead className="bg-ad-bg text-xs text-ad-mute"><tr><th className="px-3 py-2 text-start">Notification</th><th className="px-3 py-2 text-start">Type</th><th className="px-3 py-2 text-start">Status</th><th className="px-3 py-2 text-start">Delivery</th><th className="px-3 py-2 text-start">When</th></tr></thead>
              <tbody>{list.map((n) => <NotificationRow key={n.id} n={n} busy={finishing.current} onContinue={finish} />)}</tbody>
            </table>
          </div>
        )}
      </section>
      {confirmDialog}
    </div>
  );
}
