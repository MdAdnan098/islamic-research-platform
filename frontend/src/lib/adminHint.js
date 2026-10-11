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
