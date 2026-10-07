import { useState } from "react";
import { adminApi } from "../../services/admin.js";
import { useAsync } from "../../lib/useAsync.js";
import { formatDateTime } from "../../lib/format.js";
import { Empty, ErrorBox, Field, IconBtn, Modal, PageHeader, Spinner, StatusBadge, useConfirm, useToast } from "../components/ui.jsx";
import { Icon } from "../../components/ui/icons.jsx";

/** ISO string <-> value for <input type="datetime-local"> (local time). */
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (value) => (value ? new Date(value).toISOString() : null);

function SessionForm({ initial, onDone, onCancel }) {
  const toast = useToast();
  const [f, setF] = useState({
    youtubeUrl: initial?.youtubeUrl || "",
    title: initial?.title || "",
    description: initial?.description || "",
    scheduledStartTime: toLocalInput(initial?.scheduledStartTime),
    status: !initial || initial.status === "scheduled" ? "auto" : initial.status,
    isPublished: initial?.isPublished ?? false,
    syncEnabled: initial?.syncEnabled ?? true,
  });
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const body = {
      youtubeUrl: f.youtubeUrl.trim(),
      title: f.title.trim(),
      description: f.description,
      scheduledStartTime: fromLocalInput(f.scheduledStartTime),
      // "auto": future time -> upcoming (countdown); past time -> goes live/ends by itself; no time -> recording.
      status: f.status === "auto" ? (f.scheduledStartTime ? "scheduled" : "ended") : f.status,
      isPublished: f.isPublished,
      syncEnabled: f.syncEnabled,
    };
    try {
      initial ? await adminApi.liveSessions.update(initial.id, body) : await adminApi.liveSessions.create(body);
      toast("Live session saved");
      onDone();
    } catch (err) {
      toast(err.message, "error");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="YouTube live URL or video ID *" hint="e.g. https://www.youtube.com/watch?v=… or https://youtu.be/…">
        <input className="a-input" required value={f.youtubeUrl} onChange={(e) => setF({ ...f, youtubeUrl: e.target.value })} />
      </Field>
      <Field label="Title" hint="Optional if automatic sync is configured — it fills this in from YouTube.">
        <input className="a-input" dir="auto" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      </Field>
      <Field label="Description"><textarea className="a-input min-h-20" dir="auto" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Scheduled start"><input type="datetime-local" className="a-input" value={f.scheduledStartTime} onChange={(e) => setF({ ...f, scheduledStartTime: e.target.value })} /></Field>
        <Field label="Status" hint="Auto: future time = upcoming with countdown, goes live at start time. No time = recording.">
          <select className="a-input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="auto">Auto (recommended)</option><option value="live">Force: Live now</option><option value="ended">Force: Ended (recording)</option>
          </select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isPublished} onChange={(e) => setF({ ...f, isPublished: e.target.checked })} />Published on the website</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.syncEnabled} onChange={(e) => setF({ ...f, syncEnabled: e.target.checked })} />Let automatic YouTube sync update this session</label>
      <div className="flex justify-end gap-2 pt-2"><button type="button" className="a-btn" onClick={onCancel}>Cancel</button><button className="a-btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button></div>
    </form>
  );
}

export default function LiveSessions() {
  const toast = useToast();
  const [confirm, dialog] = useConfirm();
  const [editing, setEditing] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const { data, error, loading, reload } = useAsync((s) => adminApi.liveSessions.listWithMeta({}, s), []);

  async function sync() {
    setSyncing(true);
    try {
      const r = await adminApi.liveSessions.sync();
      toast(!r.configured ? "YouTube sync is not configured yet (no API key)." : r.error ? `Sync problem: ${r.error}` : `Synced — ${r.refreshed} updated, ${r.created} new.`, r.error ? "error" : undefined);
      reload();
    } catch (e) { toast(e.message, "error"); }
    setSyncing(false);
  }
  async function togglePublish(s) {
    try { await adminApi.liveSessions.update(s.id, { isPublished: !s.isPublished }); reload(); } catch (e) { toast(e.message, "error"); }
  }
  async function remove(s) {
    if (!(await confirm({ title: "Delete live session", message: `“${s.title}” will be removed from the website. The YouTube video itself is not affected.`, confirm: "Delete", danger: true }))) return;
    try { await adminApi.liveSessions.remove(s.id); toast("Deleted"); reload(); } catch (e) { toast(e.message, "error"); }
  }

  const sessions = data?.sessions || [];
  return (
    <>
      <PageHeader title="Live Sessions" desc="YouTube live streams shown on the homepage. Only links and details are stored — never the video.">
        <button className="a-btn" onClick={sync} disabled={syncing}>{syncing ? "Syncing…" : "Sync from YouTube"}</button>
        <button className="a-btn-primary" onClick={() => setEditing("new")}><Icon name="plus" size={15} />Add live session</button>
      </PageHeader>
      {data && !data.youtubeSync?.configured && (
        <p className="a-card mb-4 px-4 py-3 text-sm text-ad-mute">Automatic YouTube sync is off (no API key configured). Add sessions manually here.</p>
      )}
      {loading && !data ? <Spinner /> : error && !data ? <ErrorBox error={error} onRetry={reload} /> : sessions.length === 0 ? <Empty>No live sessions yet.</Empty> : (
        <ul className="a-card divide-y divide-ad-rule">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
              <div className="min-w-0 flex-1 basis-60">
                <p dir="auto" className="truncate text-sm font-medium">{s.title}</p>
                <p className="text-xs text-ad-mute">{formatDateTime(s.scheduledStartTime || s.actualStartTime) || "No date"} · {s.source === "youtube" ? "from YouTube" : "manual"}</p>
              </div>
              <StatusBadge status={s.status} />
              <button className={s.isPublished ? "a-btn" : "a-btn-primary"} onClick={() => togglePublish(s)}>{s.isPublished ? "Unpublish" : "Publish"}</button>
              <a className="a-btn !px-2" href={s.youtubeUrl} target="_blank" rel="noopener noreferrer" aria-label="Open on YouTube"><Icon name="external" size={15} /></a>
              <IconBtn icon="edit" label="Edit" onClick={() => setEditing(s)} />
              <IconBtn icon="trash" label="Delete" danger onClick={() => remove(s)} />
            </li>
          ))}
        </ul>
      )}
      {editing && <Modal wide title={editing === "new" ? "Add live session" : "Edit live session"} onClose={() => setEditing(null)}><SessionForm initial={editing === "new" ? null : editing} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} /></Modal>}
      {dialog}
    </>
  );
}
