/**
 * "Block" (group) helpers.
 *
 * A Block is stored FLAT inside the post's `blocks` array, so highlights, search, media clean-up, saving and
 * the language converter keep working exactly as before:
 *
 *   { id: "G1", type: "group" }             <- marks where the Block starts (has no content of its own)
 *   { id: "a",  type: "heading", gid: "G1" } <- every block that belongs to it carries gid = the marker's id
 *   { id: "b",  type: "text",    gid: "G1" }    and sits directly after the marker
 *   { id: "c",  type: "reference", gid: "G1" }
 *
 * A block whose gid has no marker right before it is simply shown as a normal block (nothing breaks).
 */
export const isGroup = (b) => !!b && b.type === "group";

/** Top-level items in order: { group, at, members: [{ b, i }] } for a Block, { single: b, at } for any other block. */
export function itemsOf(blocks = []) {
  const items = [];
  for (let i = 0; i < blocks.length; i += 1) {
    const b = blocks[i];
    if (isGroup(b)) {
      const members = [];
      let j = i + 1;
      while (j < blocks.length && blocks[j]?.gid === b.id && !isGroup(blocks[j])) { members.push({ b: blocks[j], i: j }); j += 1; }
      items.push({ group: b, at: i, members });
      i = j - 1;
    } else {
      items.push({ single: b, at: i });
    }
  }
  return items;
}

/** The [start, end) positions a block occupies: a Block covers its marker plus all its members, any other block just itself. */
export function spanOf(blocks, id) {
  const at = blocks.findIndex((b) => b.id === id);
  if (at < 0) return null;
  if (!isGroup(blocks[at])) return [at, at + 1];
  let end = at + 1;
  while (end < blocks.length && blocks[end]?.gid === blocks[at].id && !isGroup(blocks[end])) end += 1;
  return [at, end];
}

/** Up (-1) / Down (+1): a Block or a normal block moves past the neighbouring Block / block as ONE unit;
 *  a block inside a Block only moves among the blocks of its own Block (it can never leave it). */
export function moveBlock(blocks, id, dir) {
  const at = blocks.findIndex((b) => b.id === id);
  if (at < 0) return blocks;
  const b = blocks[at];
  if (b.gid && !isGroup(b)) {
    const to = at + dir;
    if (to < 0 || to >= blocks.length || blocks[to].gid !== b.gid || isGroup(blocks[to])) return blocks;
    const next = blocks.slice();
    [next[at], next[to]] = [next[to], next[at]];
    return next;
  }
  const items = itemsOf(blocks);
  const k = items.findIndex((it) => it.at === at);
  const to = k + dir;
  if (k < 0 || to < 0 || to >= items.length) return blocks;
  const order = items.slice();
  [order[k], order[to]] = [order[to], order[k]];
  return order.flatMap((it) => (it.group ? [it.group, ...it.members.map((m) => m.b)] : [it.single]));
}

/** Deleting a Block deletes everything inside it; any other block is removed alone. */
export function removeBlock(blocks, id, fallbackIndex = -1) {
  let at = id ? blocks.findIndex((b) => b.id === id) : -1;
  if (at < 0) at = fallbackIndex;
  if (at < 0 || at >= blocks.length) return null;
  const span = blocks[at].id ? spanOf(blocks, blocks[at].id) : [at, at + 1];
  const [s, e] = span || [at, at + 1];
  return blocks.filter((_, i) => i < s || i >= e);
}

/** Existing Blocks of a post, in order: [{ id, n, size }] (n = the same "#n" position number the page shows on the Block's label). */
export function groupsOf(blocks = []) {
  return itemsOf(blocks).filter((it) => it.group).map((it) => ({ id: it.group.id, n: it.at + 1, size: it.members.length }));
}

/**
 * Moves already-written blocks INTO a Block (admin "Select & Move").
 *   selectedIds : ids of the blocks to move (a Block's own marker can't be selected - only its content)
 *   target      : { create: true, id }  -> a NEW Block is made (marker `id`) where the first selected block was
 *                 { gid }               -> they are added at the end of that existing Block
 * Only the ORDER and each moved block's `gid` change. Every block is carried over as the very same object
 * ({ ...block, gid }): text, tr[lang], highlights, align, id, reference ids all stay exactly as they were.
 * Blocks that were NOT selected keep their places and order. A Block that is left empty by the move loses its (empty) marker.
 * Returns { blocks, moved }, or throws an Error with a message for the admin.
 */
export function moveIntoBlock(blocks, selectedIds, target) {
  const want = new Set(selectedIds);
  const picked = blocks.filter((b) => b.id && want.has(b.id) && !isGroup(b));
  if (!picked.length) throw new Error("Pehle kuch hissa select karein.");
  const existing = target?.gid ? blocks.find((b) => b.id === target.gid && isGroup(b)) : null;
  if (target?.gid && !existing) throw new Error("Ye Block post mein nahi mila. Page refresh karke dobara koshish karein.");
  if (!target?.gid && !target?.create) throw new Error("Pehle batayein kaunse Block mein move karna hai.");
  const toMove = existing ? picked.filter((b) => b.gid !== existing.id) : picked;
  if (!toMove.length) throw new Error("Ye sab pehle se isi Block ke andar hain.");
  const moveIds = new Set(toMove.map((b) => b.id));
  const rest = blocks.filter((b) => !moveIds.has(b.id));

  let next;
  let gid;
  if (existing) {
    gid = existing.id;
    const sp = spanOf(rest, gid);
    const end = sp ? sp[1] : rest.length;
    next = [...rest.slice(0, end), ...toMove.map((b) => ({ ...b, gid })), ...rest.slice(end)];
  } else {
    gid = target.id;
    if (!gid || blocks.some((b) => b.id === gid)) throw new Error("Naye Block ki id sahi nahi hai.");
    let at = blocks.findIndex((b) => moveIds.has(b.id)); // the new Block starts where the first selected block was
    // never cut another Block in two: if that spot is inside a Block, the new one starts right after that Block's remaining blocks
    while (at > 0 && at < rest.length && !isGroup(rest[at]) && rest[at].gid && (rest[at - 1].gid === rest[at].gid || rest[at - 1].id === rest[at].gid)) at += 1;
    next = [...rest.slice(0, at), { id: gid, type: "group" }, ...toMove.map((b) => ({ ...b, gid })), ...rest.slice(at)];
  }

  // a Block whose every item was moved away is left with an empty marker: drop it
  const emptied = new Set(toMove.map((b) => b.gid).filter((g) => g && g !== gid));
  next = next.filter((b) => !(isGroup(b) && emptied.has(b.id) && !next.some((x) => x.gid === b.id && !isGroup(x))));

  // safety net: nothing may be lost, duplicated or changed except `gid`
  const before = blocks.filter((b) => !isGroup(b));
  const after = next.filter((b) => !isGroup(b));
  const same = before.length === after.length && before.every((b) => {
    const a = after.find((x) => x.id === b.id);
    if (!a) return false;
    const { gid: g1, ...r1 } = b;
    const { gid: g2, ...r2 } = a;
    return Object.keys(r1).length === Object.keys(r2).length && Object.keys(r1).every((k) => r1[k] === r2[k]);
  });
  if (!same) throw new Error("Move rok diya gaya: kuch content badalta dikha. Kuch save nahi hua.");
  return { blocks: next, moved: toMove.length };
}

/** Undo of moveIntoBlock: puts back the order / Blocks of `before`, but keeps the CURRENT content of every block. */
export function restoreStructure(before, current) {
  const cur = new Map(current.map((b) => [b.id, b]));
  return before.map((b) => {
    const c = cur.get(b.id);
    if (!c) return b;
    const { gid: _g, ...rest } = c;
    return b.gid ? { ...rest, gid: b.gid } : rest;
  });
}
