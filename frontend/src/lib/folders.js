/** Folder (topic) tree helpers for the admin UI. A topic with no parentId is a root folder. */
const byOrder = (a, b) => (a.ordering ?? 0) - (b.ordering ?? 0) || String(a.title).localeCompare(String(b.title));

/** Depth-first flat list: [{ ...topic, depth, path: ["Root", "Sub"] }], siblings in their configured order. */
export function flattenTree(topics = []) {
  const kids = new Map();
  const ids = new Set(topics.map((t) => t.id));
  topics.forEach((t) => {
    const p = t.parentId && ids.has(t.parentId) ? t.parentId : null; // a missing parent is shown at the top level
    if (!kids.has(p)) kids.set(p, []);
    kids.get(p).push(t);
  });
  const out = [];
  const walk = (parent, depth, path) => (kids.get(parent) || []).sort(byOrder).forEach((t) => {
    out.push({ ...t, depth, path: [...path, t.title] });
    walk(t.id, depth + 1, [...path, t.title]);
  });
  walk(null, 0, []);
  return out;
}

/** Ids of a folder and everything below it (so it can't be offered as its own parent). */
export function subtreeIds(topics, id) {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    topics.forEach((t) => { if (t.parentId && out.has(t.parentId) && !out.has(t.id)) { out.add(t.id); grew = true; } });
  }
  return out;
}

export const folderLabel = (t) => `${"— ".repeat(t.depth || 0)}${t.title}`;
