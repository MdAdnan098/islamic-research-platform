import { request } from "./api.js";
import { bustPublicLists } from "../services/public.js";

/**
 * Saves an order the admin made by dragging cards on the public site (admin session required; the server re-checks it).
 * `ids` are the cards in their new top-to-bottom order. After a save the public lists skip the browser cache for a while.
 */
const post = (path, body) => request(path, { method: "POST", body }).then((r) => { bustPublicLists(); return r; });

export const reorderApi = {
  articles: (ids) => post("/api/admin/articles/reorder", { ids }),
  liveSessions: (ids) => post("/api/admin/live-sessions/reorder", { ids }),
  /** scope: "roots" | "home" | "children" (+ parentId) | "pinHome" | "pinAll" */
  folders: (scope, ids, extra = {}) => post("/api/admin/topics/reorder-list", { scope, ids, ...extra }),
};

/**
 * `list` with the cards named in `ids` put in that order, taking over the places those same cards had.
 * Cards that are not in `ids` (another page of the list, etc.) stay exactly where they are.
 */
export function applyOrder(list, ids, getId = (x) => x.id) {
  const want = new Set(ids);
  const byId = new Map(list.filter((x) => want.has(getId(x))).map((x) => [getId(x), x]));
  const queue = ids.filter((id) => byId.has(id)).map((id) => byId.get(id));
  let k = 0;
  return list.map((x) => (want.has(getId(x)) ? queue[k++] : x));
}
