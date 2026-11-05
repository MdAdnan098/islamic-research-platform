import assert from "node:assert/strict";
import { addEmptyBlock, blockNumbers, groupsOf, moveBlock, moveIntoBlock, removeBlock, restoreStructure, safeIndex } from "../src/lib/groups.js";

const T = (id, extra = {}) => ({ id, type: "text", text: `t-${id}`, tr: { hi: `h-${id}`, ro: `r-${id}` }, hl: [[1, 2]], align: "center", referenceId: `ref-${id}`, ...extra });
const G = (id) => ({ id, type: "group" });
const ids = (bl) => bl.map((b) => b.id).join(",");
let n = 0;
const test = (name, fn) => { fn(); n += 1; console.log("ok -", name); };

// 1) numbering follows ORDER, not flat position
test("blockNumbers: sequence 1,2,3 by order", () => {
  const bl = [T("a"), T("b"), T("c"), G("G1"), T("d", { gid: "G1" }), T("e"), T("f"), T("g"), G("G2"), T("h", { gid: "G2" }), G("G3")];
  const m = blockNumbers(bl);
  assert.equal(m.get("G1"), 1); assert.equal(m.get("G2"), 2); assert.equal(m.get("G3"), 3);
  assert.deepEqual(groupsOf(bl).map((g) => g.n), [1, 2, 3]);
});
test("numbering fixes itself on reorder / create / delete", () => {
  let bl = [G("G1"), T("a", { gid: "G1" }), G("G2"), T("b", { gid: "G2" })];
  bl = moveBlock(bl, "G2", -1);
  assert.deepEqual(groupsOf(bl).map((g) => [g.id, g.n]), [["G2", 1], ["G1", 2]]);
  bl = addEmptyBlock(bl, "G3", { after: "b" });
  assert.deepEqual(groupsOf(bl).map((g) => [g.id, g.n]), [["G2", 1], ["G3", 2], ["G1", 3]]);
  bl = removeBlock(bl, "G2");
  assert.deepEqual(groupsOf(bl).map((g) => [g.id, g.n]), [["G3", 1], ["G1", 2]]);
});
test("no Blocks -> no numbers", () => { assert.equal(blockNumbers([T("a")]).size, 0); assert.deepEqual(groupsOf([]), []); });

// 2) new Block position
test("addEmptyBlock: default end (old behaviour)", () => {
  assert.equal(ids(addEmptyBlock([T("a"), T("b")], "N")), "a,b,N");
});
test("addEmptyBlock: before / after a normal block", () => {
  const bl = [T("a"), T("b"), T("c")];
  assert.equal(ids(addEmptyBlock(bl, "N", { before: "b" })), "a,N,b,c");
  assert.equal(ids(addEmptyBlock(bl, "N", { after: "b" })), "a,b,N,c");
  assert.equal(ids(addEmptyBlock(bl, "N", { after: "ghost" })), "a,b,c,N");
});
test("addEmptyBlock never cuts a Block", () => {
  const bl = [T("a"), G("G1"), T("x", { gid: "G1" }), T("y", { gid: "G1" }), T("z", { gid: "G1" }), T("b")];
  assert.equal(ids(addEmptyBlock(bl, "N", { after: "x" })), "a,G1,x,y,z,N,b");
  assert.equal(ids(addEmptyBlock(bl, "N", { before: "y" })), "a,G1,x,y,z,N,b");
  assert.equal(ids(addEmptyBlock(bl, "N", { before: "x" })), "a,G1,x,y,z,N,b");
  assert.equal(ids(addEmptyBlock(bl, "N", { before: "G1" })), "a,N,G1,x,y,z,b");
  assert.equal(ids(addEmptyBlock(bl, "N", { after: "G1" })), "a,G1,x,y,z,N,b");
});
test("addEmptyBlock leaves every other block as the very same object", () => {
  const bl = [T("a"), T("b")];
  const out = addEmptyBlock(bl, "N", { after: "a" });
  assert.equal(out[0], bl[0]); assert.equal(out[2], bl[1]);
});
test("safeIndex", () => {
  const bl = [G("G1"), T("x", { gid: "G1" }), T("y", { gid: "G1" }), T("b")];
  assert.equal(safeIndex(bl, 1), 3); assert.equal(safeIndex(bl, 2), 3); assert.equal(safeIndex(bl, 3), 3); assert.equal(safeIndex(bl, 0), 0); assert.equal(safeIndex(bl, 99), 4);
});

// Naya Block + Move: lands where the ticked content was
test("new Block is made where the first ticked block was, content moves in", () => {
  const bl = Array.from("abcdefg", (c) => T(c));
  const { blocks, moved } = moveIntoBlock(bl, ["c", "d", "e"], { create: true, id: "N" });
  assert.equal(moved, 3);
  assert.equal(ids(blocks), "a,b,N,c,d,e,f,g");
  assert.deepEqual(blocks.filter((b) => b.gid === "N").map((b) => b.id), ["c", "d", "e"]);
});
test("new Block does not cut an existing Block (first tick inside a Block)", () => {
  const bl = [T("a"), G("G1"), T("x", { gid: "G1" }), T("y", { gid: "G1" }), T("z", { gid: "G1" }), T("b")];
  const { blocks } = moveIntoBlock(bl, ["x", "b"], { create: true, id: "N" });
  assert.equal(ids(blocks), "a,G1,y,z,N,x,b");
  assert.deepEqual(blocks.filter((b) => b.gid === "G1").map((b) => b.id), ["y", "z"]);
});
test("moving into an EXISTING Block: the Block stays where it is", () => {
  const bl = [T("a"), T("b"), G("G1"), T("x", { gid: "G1" }), T("c"), T("d")];
  const { blocks } = moveIntoBlock(bl, ["a", "d"], { gid: "G1" });
  assert.equal(ids(blocks), "b,G1,x,a,d,c");
  assert.equal(blocks.indexOf(blocks.find((b) => b.id === "G1")), 1);
});
test("an empty new Block (made after 'c') stays after 'c' when content moves in", () => {
  let bl = Array.from("abcde", (c) => T(c));
  bl = addEmptyBlock(bl, "N", { after: "c" });
  const { blocks } = moveIntoBlock(bl, ["a", "e"], { gid: "N" });
  assert.equal(ids(blocks), "b,c,N,a,e,d");
  assert.equal(blocks.findIndex((b) => b.id === "N"), 2);
});

// nothing but order / gid may change
test("block objects keep text, tr, hl, align, referenceId, id (only gid / order change)", () => {
  const bl = Array.from("abcd", (c) => T(c));
  const { blocks } = moveIntoBlock(bl, ["b", "c"], { create: true, id: "N" });
  for (const o of bl) {
    const a = blocks.find((b) => b.id === o.id); const { gid, ...rest } = a;
    assert.deepEqual(rest, o);
  }
  const back = restoreStructure(bl, blocks);
  assert.deepEqual(back, bl);
});
test("items inside a Block keep their own order / ids (members not renumbered)", () => {
  const bl = [G("G1"), T("x", { gid: "G1" }), T("y", { gid: "G1" })];
  const { blocks } = moveIntoBlock([...bl, T("q")], ["q"], { gid: "G1" });
  assert.equal(ids(blocks), "G1,x,y,q");
});
console.log(`${n} tests passed`);
