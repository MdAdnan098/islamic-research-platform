/**
 * Folder (topic) hierarchy helpers - pure functions over plain arrays, so the rules are unit-testable
 * without a database. A folder is a `topics` document: { _id/id, categoryId, parentId|null, status, title, slug }.
 * Legacy topics have no `parentId`; they are root folders.
 */

export const MAX_FOLDER_DEPTH = 6; // root = depth 1

const idOf = (x) => String(x._id ?? x.id);
const parentOf = (x) => (x.parentId ? String(x.parentId) : null);

export function indexFolders(folders) {
  const byId = new Map();
  const children = new Map();
  for (const f of folders) {
    byId.set(idOf(f), f);
    const p = parentOf(f);
    if (!children.has(p)) children.set(p, []);
    children.get(p).push(f);
  }
  return { byId, children };
}

/** Ancestors from root down to (not including) the folder. Stops on a missing parent or a cycle. */
export function ancestorsOf(folder, byId) {
  const chain = [];
  const seen = new Set([idOf(folder)]);
  let p = parentOf(folder);
  while (p && byId.has(p) && !seen.has(p)) {
    seen.add(p);
    const parent = byId.get(p);
    chain.unshift(parent);
    p = parentOf(parent);
  }
  return chain;
}

export const depthOf = (folder, byId) => ancestorsOf(folder, byId).length + 1;

/** Every descendant id (children, grandchildren ...) of a folder. */
export function descendantIds(folderId, children) {
  const out = [];
  const stack = [String(folderId)];
  const seen = new Set(stack);
  while (stack.length) {
    for (const c of children.get(stack.pop()) || []) {
      const cid = idOf(c);
      if (seen.has(cid)) continue;
      seen.add(cid);
      out.push(cid);
      stack.push(cid);
    }
  }
  return out;
}

/** Height of the subtree under a folder (0 = no children). */
export function subtreeHeight(folderId, children, seen = new Set()) {
  const id = String(folderId);
  if (seen.has(id)) return 0;
  seen.add(id);
  let h = 0;
  for (const c of children.get(id) || []) h = Math.max(h, 1 + subtreeHeight(idOf(c), children, seen));
  return h;
}

/**
 * Checks that placing `folderId` (null = a new folder) under `newParentId` is valid.
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
export function checkParentChange({ folderId = null, newParentId, categoryId, folders }) {
  if (!newParentId) return { ok: true };
  const { byId, children } = indexFolders(folders);
  const parent = byId.get(String(newParentId));
  if (!parent) return { ok: false, code: "NOT_FOUND", message: "Parent folder not found." };
  if (String(parent.categoryId) !== String(categoryId)) {
    return { ok: false, code: "INVALID_RELATION", message: "The parent folder belongs to a different section/category." };
  }
  if (folderId) {
    if (String(folderId) === String(newParentId)) return { ok: false, code: "INVALID_RELATION", message: "A folder cannot be its own parent." };
    if (descendantIds(folderId, children).includes(String(newParentId))) {
      return { ok: false, code: "INVALID_RELATION", message: "A folder cannot be moved inside one of its own subfolders." };
    }
  }
  const parentDepth = depthOf(parent, byId);
  const below = folderId ? subtreeHeight(folderId, children) : 0;
  if (parentDepth + 1 + below > MAX_FOLDER_DEPTH) {
    return { ok: false, code: "INVALID_RELATION", message: `Folders can be nested at most ${MAX_FOLDER_DEPTH} levels deep.` };
  }
  return { ok: true };
}

/** Case/space-insensitive sibling title clash (same category, same parent). */
export function hasSiblingWithTitle({ folders, categoryId, parentId, title, exceptId = null }) {
  const want = String(title || "").trim().toLowerCase().replace(/\s+/g, " ");
  return folders.some((f) =>
    String(f.categoryId) === String(categoryId) &&
    parentOf(f) === (parentId ? String(parentId) : null) &&
    (!exceptId || idOf(f) !== String(exceptId)) &&
    String(f.title || "").trim().toLowerCase().replace(/\s+/g, " ") === want
  );
}

/**
 * Ids of folders that are publicly visible: active, and every ancestor active too.
 * Anything under a hidden folder is hidden with it.
 */
export function visibleFolderIds(folders) {
  const { byId } = indexFolders(folders);
  const visible = new Set();
  for (const f of folders) {
    const chain = [...ancestorsOf(f, byId), f];
    const rootReachable = !parentOf(chain[0]); // an orphaned chain (missing parent) is not visible
    if (rootReachable && chain.every((x) => (x.status || "active") === "active")) visible.add(idOf(f));
  }
  return visible;
}

/**
 * What deleting a folder does (the documented rule):
 *   - its subfolders move up to the deleted folder's parent (or become root folders)
 *   - its articles move to that same parent folder (or become general articles of the category)
 * Nothing is deleted except the folder record itself.
 */
export function deletionPlan(folder, folders) {
  const { children } = indexFolders(folders);
  const newParentId = parentOf(folder);
  return { newParentId, childIds: (children.get(idOf(folder)) || []).map(idOf) };
}
