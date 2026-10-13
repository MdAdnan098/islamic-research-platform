import { useEffect, useState } from "react";

/**
 * The public site never calls the admin API for ordinary visitors. Only a browser that has signed in to the admin
 * panel carries this (non-secret) hint; it merely makes the public pages ASK the server "am I an admin?".
 * Real authorisation is always the server's: the hint grants nothing, and every write is checked server-side.
 */
const KEY = "fs_admin_hint";
export const setAdminHint = (on) => { try { on ? localStorage.setItem(KEY, "1") : localStorage.removeItem(KEY); } catch { /* ignore */ } };
const hasHint = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };

/** true only when the hint exists AND the server confirms an active admin session. */
export function useIsAdmin() {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    if (!hasHint()) return undefined;
    const ctrl = new AbortController();
    import("../services/admin.js")
      .then((m) => m.adminApi.me(ctrl.signal))
      .then(() => !ctrl.signal.aborted && setAdmin(true))
      .catch((e) => { if (e?.name !== "AbortError") { setAdminHint(false); setAdmin(false); } });
    return () => ctrl.abort();
  }, []);
  return admin;
}

/** Saves highlight edits for a stored article (admin only; the server re-checks the session). */
export async function saveHighlights(article, edits) {
  const { adminApi } = await import("../services/admin.js");
  return adminApi.articles.highlights(article.id, { baseUpdatedAt: article.updatedAt, edits });
}

/**
 * Inserts `block` right after the block `afterId` (or after position `index` when the displayed blocks have no ids yet)
 * of a stored article, straight from the post page. It works on a fresh copy fetched from the server, so a stale
 * page cannot overwrite newer edits. Returns what the page needs to refresh itself.
 */
export async function insertBlockInto(article, references, index, afterId, block) {
  const [{ adminApi }, { withIds, referenceIdsOf }] = await Promise.all([import("../services/admin.js"), import("./blocks.js")]);
  const fresh = await adminApi.articles.get(article.id);
  const current = withIds(fresh.blocks || []);
  const at = afterId && current.some((b) => b.id === afterId) ? current.findIndex((b) => b.id === afterId) : Math.min(index, current.length - 1);
  const next = [...current.slice(0, at + 1), block, ...current.slice(at + 1)];
  const saved = await adminApi.articles.update(article.id, { blocks: next, references: referenceIdsOf(next), baseUpdatedAt: fresh.updatedAt });
  // A newly added reference block needs its reference loaded so it can be drawn immediately.
  const known = new Set((references || []).map((r) => r.id));
  const missing = referenceIdsOf(saved.blocks).filter((id) => !known.has(id));
  const extra = (await Promise.all(missing.map((id) => adminApi.references.get(id).catch(() => null)))).filter(Boolean);
  return { article: { ...article, blocks: saved.blocks, updatedAt: saved.updatedAt }, references: [...(references || []), ...extra] };
}
