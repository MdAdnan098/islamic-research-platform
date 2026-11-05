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
