import { useState } from "react";
import { adminApi } from "../../services/admin.js";
import { useAsync } from "../../lib/useAsync.js";
import { Empty, ErrorBox, IconBtn, Modal, PageHeader, Spinner, useConfirm, useToast } from "../components/ui.jsx";
import { ReferenceForm } from "../components/ReferenceForm.jsx";
import { Icon } from "../../components/ui/icons.jsx";

export default function References() {
  const toast = useToast();
  const [confirm, dialog] = useConfirm();
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState("");
  const { data, error, loading, reload } = useAsync((s) => adminApi.references.list({ limit: 100 }, s), []);
  const list = (data || []).filter((r) => `${r.book} ${r.author || ""}`.toLowerCase().includes(q.toLowerCase()));

  async function remove(r) {
    if (!(await confirm({ title: "Delete reference", message: `Permanently delete “${r.book}”? Articles that cite it will lose this reference.`, confirm: "Delete", danger: true }))) return;
    try { await adminApi.references.remove(r.id); toast("Deleted"); reload(); } catch (e) { toast(e.message, "error"); }
  }

  return (
    <>
      <PageHeader title="References" desc="Books, volumes, pages and scans reused across articles.">
        <input className="a-input !w-52" placeholder="Search book / author" value={q} onChange={(e) => setQ(e.target.value)} dir="auto" />
        <button className="a-btn-primary" onClick={() => setEditing("new")}><Icon name="plus" size={15} />New reference</button>
      </PageHeader>
      {loading && !data ? <Spinner /> : error && !data ? <ErrorBox error={error} onRetry={reload} /> : list.length === 0 ? <Empty>No references found.</Empty> : (
        <ul className="a-card divide-y divide-ad-rule">
          {list.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p dir="auto" className="truncate text-sm font-medium">{r.book}</p>
                <p dir="auto" className="truncate text-xs text-ad-mute">{[r.author, r.volume && `Vol. ${r.volume}`, r.page && `p. ${r.page}`].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              {r.mediaKey && <span className="rounded-full bg-ad-bg px-2 py-0.5 text-xs text-ad-mute">scan</span>}
              <IconBtn icon="edit" label="Edit" onClick={() => setEditing(r)} />
              <IconBtn icon="trash" label="Delete" danger onClick={() => remove(r)} />
            </li>
          ))}
        </ul>
      )}
      {editing && <Modal wide title={editing === "new" ? "New reference" : "Edit reference"} onClose={() => setEditing(null)}><ReferenceForm initial={editing === "new" ? null : editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} /></Modal>}
      {dialog}
    </>
  );
}
