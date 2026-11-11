/**
 * Helpers for the admin's drag-and-drop ordering on the public site.
 *
 * Posts and live sessions keep an optional numeric `sortKey` (higher = shown first). Without one, the key is the date
 * they were always sorted by, so nothing changes until the admin drags something. A drag only PERMUTES the keys of the
 * cards that were shown: the same set of numbers is handed out again in the new order, so cards that were not on screen
 * (other pages, other folders) are never disturbed and no key ever needs rewriting for them.
 */

/** Makes a descending list strictly descending (ties are nudged down by 1 ms) so a swap always changes the order. */
export function strictlyDescending(keys) {
  const out = [...keys];
  for (let i = 1; i < out.length; i += 1) if (out[i] >= out[i - 1]) out[i] = out[i - 1] - 1;
  return out;
}

/**
 * keyById: Map(id -> current effective key). orderedIds: the cards in their NEW top-to-bottom order.
 * Returns Map(id -> new key): the old keys, largest first, handed to the cards in the new order.
 */
export function permuteKeys(keyById, orderedIds) {
  const ids = [...new Set(orderedIds)].filter((id) => keyById.has(id));
  const keys = strictlyDescending(ids.map((id) => keyById.get(id)).sort((a, b) => b - a));
  return new Map(ids.map((id, i) => [id, keys[i]]));
}

/** Same idea for pin dates (earliest pin = first): the dates, oldest first, handed out in the new order. */
export function permuteAscending(valueById, orderedIds) {
  const ids = [...new Set(orderedIds)].filter((id) => valueById.has(id));
  const vals = ids.map((id) => valueById.get(id)).sort((a, b) => a - b);
  for (let i = 1; i < vals.length; i += 1) if (vals[i] <= vals[i - 1]) vals[i] = vals[i - 1] + 1;
  return new Map(ids.map((id, i) => [id, vals[i]]));
}

/**
 * fullOrder: every id of a list in its current order. movedIds: some of them (all or a subset) in the new order.
 * The moved cards take over the places the same cards occupied, in the new order; every other card stays where it is.
 * Returns null when movedIds is not a set of ids that all exist in fullOrder.
 */
export function replaceInSlots(fullOrder, movedIds) {
  const moved = [...new Set(movedIds)];
  const want = new Set(moved);
  if (moved.length < 2 || moved.length !== movedIds.length) return null;
  const slots = [];
  fullOrder.forEach((id, i) => { if (want.has(id)) slots.push(i); });
  if (slots.length !== moved.length) return null;
  const next = [...fullOrder];
  slots.forEach((at, i) => { next[at] = moved[i]; });
  return next;
}

/** Homepage folder order (non-pinned): folders the admin never placed come first, newest first; placed ones follow by rank. */
export function homeFolderCompare(a, b) {
  const ra = typeof a.homeRank === "number", rb = typeof b.homeRank === "number";
  if (ra !== rb) return ra ? 1 : -1;
  if (ra && rb && a.homeRank !== b.homeRank) return a.homeRank - b.homeRank;
  return new Date(b.createdAt || 0) - new Date(a.createdAt || 0) || String(b.id).localeCompare(String(a.id));
}
