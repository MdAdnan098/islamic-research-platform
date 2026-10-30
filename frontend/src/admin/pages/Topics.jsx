import { useState } from "react";
import { adminApi } from "../../services/admin.js";
import { useAsync } from "../../lib/useAsync.js";
import { flattenTree } from "../../lib/folders.js";
import { Empty, ErrorBox, IconBtn, Modal, PageHeader, Spinner, moveItem, toOrdering, useConfirm, useToast } from "../components/ui.jsx";
import { FolderForm } from "../components/FolderForm.jsx";
import { Icon } from "../../components/ui/icons.jsx";

/** Explains, in plain words, exactly what deleting will do. Nothing but the folder itself is removed. */
function deleteMessage(impact) {
  const where = impact.movesTo ? `“${impact.movesTo.title}” folder mein` : "category ke top level par (subfolders root folders ban jayenge, articles General Articles mein aa jayenge)";
  const lines = [`“${impact.folder.title}” folder delete hoga. Is mein ke articles ya subfolders delete NAHI honge.`];
  lines.push(impact.childFolders ? `• ${impact.childFolders} subfolder(s) ${where} move ho jayenge.` : "• Is mein koi subfolder nahi hai.");
  lines.push(impact.articles ? `• ${impact.articles} article(s) ${where} move ho jayenge.` : "• Is mein koi article nahi hai.");
  return lines.join("\n");
}

export default function Topics() {
  const toast = useToast();
  const [confirm, dialog] = useConfirm();
  const [editing, setEditing] = useState(null); // { initial?, categoryId?, parentId? }
  const cats = useAsync((s) => adminApi.categories.list({}, s), []);
  const { data, error, loading, reload, setData } = useAsync(async (s) => {
    const list = cats.data || [];
    const rows = await Promise.all(list.map(async (c) => ({ category: c, topics: flattenTree(await adminApi.topics.list({ categoryId: c.id }, s)) })));
    return rows;
  }, [cats.data]);

  async function move(catId, topics, index, to) {
    const t = topics[index];
    const siblings = topics.filter((x) => (x.parentId || "") === (t.parentId || ""));
    const from = siblings.findIndex((x) => x.id === t.id);
    const next = moveItem(siblings, from, to);
    if (next === siblings) return;
    try { await adminApi.topics.reorder(catId, toOrdering(next)); reload(); } catch (e) { toast(e.message, "error"); }
  }

  async function remove(t) {
    let impact;
    try { impact = await adminApi.topics.impact(t.id); } catch (e) { return toast(e.message, "error"); }
    if (!(await confirm({ title: "Folder delete karein?", message: <span className="whitespace-pre-line">{deleteMessage(impact)}</span>, confirm: "Delete folder", danger: true }))) return;
    try {
      const r = await adminApi.topics.remove(t.id);
      toast(`Folder delete ho gaya (${r.movedFolders} subfolder, ${r.movedArticles} article safe move hue)`);
      reload();
    } catch (e) { toast(e.message, "error"); }
  }

  const activeCats = (cats.data || []).filter((c) => c.status === "active");
  return (
    <>
      <PageHeader title="Folders" desc="Section → folder → subfolders → articles. Folders articles se alag banaye ja sakte hain.">
        <button className="a-btn-primary btn-cta" disabled={!activeCats.length} onClick={() => setEditing({})}><Icon name="plus" size={15} />New folder</button>
      </PageHeader>

      {cats.loading && !cats.data ? <Spinner /> : !cats.data?.length ? <Empty>Create a category first.</Empty> : loading && !data ? <Spinner /> : error && !data ? <ErrorBox error={error} onRetry={reload} /> : (
        <div className="space-y-6">
          {(data || []).map(({ category: c, topics }) => (
            <section key={c.id}>
              <h2 className="mb-2 text-sm font-semibold text-ad-mute">{c.name} · {c.type === "aqeedah" ? "Aqaid" : "Masail"}</h2>
              {topics.length === 0 ? <Empty>Is category mein abhi koi folder nahi.</Empty> : (
                <ul className="a-card divide-y divide-ad-rule">
                  {topics.map((t, i) => (
                    <li key={t.id} className="flex min-h-[56px] flex-wrap items-center gap-2 px-3 py-2" style={{ paddingInlineStart: `${12 + t.depth * 22}px` }}>
                      <div className="flex"><IconBtn icon="up" label="Move up" onClick={() => move(c.id, topics, i, -1)} /><IconBtn icon="down" label="Move down" onClick={() => move(c.id, topics, i, +1)} /></div>
                      <Icon name="folder" size={16} className="shrink-0 text-ad-mute" />
                      <div className="min-w-0 flex-1">
                        <p dir="auto" className="truncate text-sm font-medium">{t.title}</p>
                        <p className="truncate text-xs text-ad-mute">{t.path.join(" › ")}{t.status === "archived" ? " · hidden (purana archived — Delete karein ya Edit se wapas laayein)" : ""}</p>
                      </div>
                      <IconBtn icon="plus" label="Add subfolder" onClick={() => setEditing({ categoryId: c.id, parentId: t.id })} />
                      <IconBtn icon="edit" label="Edit" onClick={() => setEditing({ initial: t })} />
                      <IconBtn icon="trash" label="Delete" danger onClick={() => remove(t)} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
      {editing && (
        <Modal wide title={editing.initial ? "Edit folder" : editing.parentId ? "New subfolder" : "New folder"} onClose={() => setEditing(null)}>
          <FolderForm initial={editing.initial} categories={activeCats} defaultCategoryId={editing.categoryId} defaultParentId={editing.parentId} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />
        </Modal>
      )}
      {dialog}
    </>
  );
}
