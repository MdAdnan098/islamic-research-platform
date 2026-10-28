import { useCallback, useEffect, useRef, useState } from "react";
import { referenceIdsOf, withIds } from "./blocks.js";
import { applyEdits, cleanBlocksHl } from "./highlights.js";
import { setLineHeading } from "./lineHeading.js";

/**
 * Admin-only "working copy" of a post for the View-site / Preview editing.
 * Every change (edit, add, delete, highlight, bold / colour, heading) is AUTO-SAVED as a draft on the server:
 * a live post keeps showing its published text to visitors until "Save & Publish" is pressed.
 * The admin API is loaded on demand, so public visitors never download any of this logic's network code.
 */
const toCopy = (a) => ({
  blocks: withIds(a.pending?.blocks ?? a.blocks ?? []),
  rev: a.rev ?? a.updatedAt,
  status: a.status,
  hasDraft: !!a.pending,
  language: a.language,
});

const NONE = [];

export function useAdminDraft({ article, references, enabled = true, initial = null }) {
  const [copy, setCopy] = useState(() => (initial ? toCopy(initial) : null));
  const [refs, setRefs] = useState(references || NONE);
  const [busy, setBusy] = useState(false);
  const copyRef = useRef(copy);
  copyRef.current = copy;
  const refsRef = useRef(refs);
  refsRef.current = refs;
  const chain = useRef(Promise.resolve());
  const id = article?.id;

  useEffect(() => { setRefs(references || NONE); }, [references]);

  useEffect(() => { if (initial && !copyRef.current) setCopy(toCopy(initial)); }, [initial]);

  useEffect(() => {
    if (!enabled || !id || copy || initial) return undefined;
    const ctrl = new AbortController();
    import("../services/admin.js")
      .then((m) => m.adminApi.articles.get(id, ctrl.signal))
      .then((a) => { if (!ctrl.signal.aborted) setCopy(toCopy(a)); })
      .catch(() => { /* not an admin / demo post: the page simply keeps the published copy */ });
    return () => ctrl.abort();
  }, [enabled, id, copy, initial]);

  /** One change at a time, in order, so two quick taps can never collide on the version check. */
  const run = useCallback((fn) => {
    const p = chain.current.then(async () => { setBusy(true); try { return await fn(); } finally { setBusy(false); } });
    chain.current = p.catch(() => {});
    return p;
  }, []);

  /** updater(blocks) -> new blocks (or null for "nothing to do"); the result is auto-saved as the draft. */
  const change = useCallback((updater) => run(async () => {
    const cur = copyRef.current;
    if (!cur) throw new Error("Post abhi load ho raha hai, thodi der baad koshish karein.");
    const next = updater(cur.blocks);
    if (!next) return;
    const { adminApi } = await import("../services/admin.js");
    const blocks = cleanBlocksHl(next, cur.language || article.language || "en");
    const res = await adminApi.articles.saveDraft(id, { blocks, references: referenceIdsOf(blocks), baseRev: cur.rev });
    setCopy(toCopy(res.article));
    setRefs(res.references || []); // the server sends the references of these blocks with the save: no extra requests
  }), [run, id]);

  const indexOf = (blocks, i, blockId) => {
    const at = blockId ? blocks.findIndex((b) => b.id === blockId) : -1;
    return at >= 0 ? at : i;
  };

  const ops = {
    onApply: (edits) => change((blocks) => applyEdits(blocks, edits)),
    /** Selected line(s) -> H1/H2/H3 (or paragraph for level 0). Resolves to an error message, or "". */
    onTransform: async (pieces, level) => {
      let error = "";
      await change((blocks) => {
        const res = setLineHeading(blocks, article.language, pieces, level);
        error = res.error;
        return res.error ? null : res.blocks;
      });
      return error;
    },
    onInsert: (index, block, afterId) => change((blocks) => {
      const at = afterId && blocks.some((b) => b.id === afterId) ? blocks.findIndex((b) => b.id === afterId) : Math.min(index, blocks.length - 1);
      return [...blocks.slice(0, at + 1), block, ...blocks.slice(at + 1)];
    }),
    onSave: (index, block) => change((blocks) => {
      const at = indexOf(blocks, index, block.id);
      if (at < 0 || at >= blocks.length) throw new Error("Ye hissa post mein nahi mila. Page refresh karke dobara koshish karein.");
      return blocks.map((b, i) => (i === at ? { ...block, id: b.id } : b));
    }),
    onRemove: (index, blockId) => change((blocks) => {
      const at = indexOf(blocks, index, blockId);
      if (at < 0 || at >= blocks.length) throw new Error("Ye hissa post mein nahi mila. Page refresh karke dobara koshish karein.");
      return blocks.filter((_, i) => i !== at);
    }),
  };

  const publish = useCallback(() => run(async () => {
    const { adminApi } = await import("../services/admin.js");
    const saved = await adminApi.articles.action(id, "publish");
    setCopy(toCopy(saved));
    return saved;
  }), [run, id]);

  const discard = useCallback(() => run(async () => {
    const { adminApi } = await import("../services/admin.js");
    const res = await adminApi.articles.discardDraft(id);
    setCopy(toCopy(res.article));
    setRefs(res.references || []);
  }), [run, id]);

  return {
    ready: !!copy,
    blocks: copy?.blocks || null,
    references: refs,
    hasDraft: !!copy?.hasDraft,
    status: copy?.status,
    needsPublish: !!copy && (copy.hasDraft || copy.status !== "published"),
    busy,
    ops,
    publish,
    discard,
  };
}
