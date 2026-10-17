import { useState } from "react";
import { adminApi } from "../../services/admin.js";
import { Field, useToast } from "./ui.jsx";

/** Older references were Book / Author / Volume / Page / Text: when one is edited, those parts are merged into the single field. */
function startText(initial) {
  if (!initial) return "";
  const old = [initial.book, initial.author, initial.volume && `Vol. ${initial.volume}`, initial.page && `p. ${initial.page}`].filter(Boolean).join(" · ");
  return [old, initial.referenceText].filter(Boolean).join("\n");
}

export function ReferenceForm({ initial, onSaved, onCancel }) {
  const toast = useToast();
  const [text, setText] = useState(startText(initial));
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const referenceText = text.trim();
    if (!referenceText) return toast("Reference likhiye.", "error");
    setBusy(true);
    // The single field is stored as `referenceText`; the old separate fields are cleared (a saved scan, if any, is left untouched).
    const body = { referenceText, book: null, author: null, volume: null, page: null };
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
      <Field label="Reference">
        <textarea className="a-input min-h-32" dir="auto" autoFocus required value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && <button type="button" className="a-btn" onClick={onCancel}>Cancel</button>}
        <button className="a-btn-primary" disabled={busy}>{busy ? "Saving…" : "Save reference"}</button>
      </div>
    </form>
  );
}
