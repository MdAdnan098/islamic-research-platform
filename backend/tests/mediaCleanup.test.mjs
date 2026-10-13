// Run: cd backend && node --test tests/*.test.mjs
import { collectMediaKeys, removeUnusedMedia } from "../src/services/mediaCleanup.js";
import assert from "node:assert/strict";
import test from "node:test";

const K = (n) => `${String(n).repeat(8)}-1111-2222-3333-${String(n).repeat(12)}.webp`;

test("collects the cover, image blocks, gallery pages and a reference scan - and ignores ordinary text", () => {
  const article = {
    _id: { toString: () => "x" }, coverKey: K(1), title: "Post",
    blocks: [
      { type: "text", text: `see ${K(9)} inside a sentence` },       // not an exact key -> ignored
      { type: "image", key: K(2) },
      { type: "gallery", pages: [{ key: K(3) }, { key: "" }, { key: K(4).replace("webp", "pdf") }] },
    ],
  };
  assert.deepEqual([...collectMediaKeys(article)].sort(), [K(1), K(2), K(3), K(4).replace("webp", "pdf")].sort());
  assert.deepEqual([...collectMediaKeys({ mediaKey: K(5) })], [K(5)]);
  assert.equal(collectMediaKeys(null, undefined, {}).size, 0);
});

test("removes unused files, keeps the ones another document still uses, and survives a storage error", async () => {
  const keys = new Set([K(1), K(2), K(3)]);
  const removed = [];
  const out = await removeUnusedMedia({}, keys, {
    inUse: async (k) => k === K(2),               // K(2) is shared with another post
    remove: async (k) => { if (k === K(3)) throw new Error("boom"); removed.push(k); },
  });
  assert.deepEqual(removed, [K(1)]);
  assert.deepEqual(out, [K(1)]);
});
