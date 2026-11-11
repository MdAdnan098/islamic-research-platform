import test from "node:test";
import assert from "node:assert/strict";
import { permuteKeys, permuteAscending, replaceInSlots, strictlyDescending, homeFolderCompare } from "../src/utils/reorder.js";

// The admin's example: waseela 1,2 / ghaib 1,2,3 / waseela 3,4,5 / ghaib 4,5,6 (top = newest key)
const sortBy = (m) => [...m].sort((a, b) => b[1] - a[1]).map(([id]) => id);
const keys = new Map([["w1", 1000], ["w2", 990], ["g1", 980], ["g2", 970], ["g3", 960], ["w3", 950], ["w4", 940], ["w5", 930], ["g4", 920], ["g5", 910], ["g6", 900]]);

test("permuteKeys: moving waseela 3,4,5 up gives w1..w5 then ghaib in order", () => {
  const order = ["w1", "w2", "w3", "w4", "w5", "g1", "g2", "g3", "g4", "g5", "g6"];
  const next = permuteKeys(keys, order);
  assert.deepEqual(sortBy(next), order);
});

test("permuteKeys: cards that are not in the list are never touched", () => {
  const next = permuteKeys(keys, ["w3", "g1"]);
  assert.equal(next.size, 2);
  assert.equal(next.get("w3"), 980);
  assert.equal(next.get("g1"), 950);
});

test("permuteKeys: equal keys still change order", () => {
  const next = permuteKeys(new Map([["a", 5], ["b", 5]]), ["b", "a"]);
  assert.ok(next.get("b") > next.get("a"));
  assert.deepEqual(strictlyDescending([5, 5, 5]), [5, 4, 3]);
});

test("permuteAscending: pinned folders swap pin times", () => {
  const next = permuteAscending(new Map([["a", 10], ["b", 20]]), ["b", "a"]);
  assert.equal(next.get("b"), 10);
  assert.equal(next.get("a"), 20);
});

test("replaceInSlots: a subset takes over its own places, others stay", () => {
  assert.deepEqual(replaceInSlots(["a", "x", "b", "y", "c"], ["c", "a", "b"]), ["c", "x", "a", "y", "b"]);
  assert.equal(replaceInSlots(["a", "b"], ["a", "zzz"]), null);
  assert.equal(replaceInSlots(["a", "b"], ["a", "a"]), null);
});

test("homeFolderCompare: unplaced newest first, then placed by rank", () => {
  const list = [
    { id: "1", homeRank: 1, createdAt: "2026-01-01" },
    { id: "2", homeRank: 0, createdAt: "2026-02-01" },
    { id: "3", createdAt: "2026-03-01" },
    { id: "4", createdAt: "2026-04-01" },
  ];
  assert.deepEqual(list.sort(homeFolderCompare).map((f) => f.id), ["4", "3", "2", "1"]);
});
