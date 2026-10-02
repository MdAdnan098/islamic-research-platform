import { useState } from "react";
import { adminApi } from "../../services/admin.js";
import { Field, useToast } from "./ui.jsx";
import { MediaUploader } from "./MediaUploader.jsx";

const EMPTY = { book: "", author: "", volume: "", page: "", referenceText: "", mediaKey: "" };

export function ReferenceForm({ initial, onSaved, onCancel }) {
  const toast = useToast();
  const [f, setF] = useState({ ...EMPTY, ...Object.fromEntries(Object.entries(initial || {}).filter(([k]) => k in EMPTY).map(([k, v]) => [k, v ?? ""])) });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const body = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]).map(([k, v]) => [k, k === "book" ? v : v || null]));
    try {
      const saved = initial?.id ? await adminApi.references.update(initial.id, body) : await adminApi.references.create(body);
      toast("Reference saved");
      onSaved(saved);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Book *"><input className="a-input" dir="auto" required value={f.book} onChange={set("book")} /></Field>
      <Field label="Author"><input className="a-input" dir="auto" value={f.author} onChange={set("author")} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Volume"><input className="a-input" dir="auto" value={f.volume} onChange={set("volume")} /></Field>
        <Field label="Page"><input className="a-input" dir="auto" value={f.page} onChange={set("page")} /></Field>
      </div>
      <Field label="Reference text"><textarea className="a-input min-h-28" dir="auto" value={f.referenceText} onChange={set("referenceText")} /></Field>
      <div>
        <span className="a-label">Scanned page</span>
        <MediaUploader value={f.mediaKey} onChange={(k) => setF((s) => ({ ...s, mediaKey: k }))} label="Upload scan" />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && <button type="button" className="a-btn" onClick={onCancel}>Cancel</button>}
        <button className="a-btn-primary" disabled={busy}>{busy ? "Saving…" : "Save reference"}</button>
      </div>
    </form>
  );
}
