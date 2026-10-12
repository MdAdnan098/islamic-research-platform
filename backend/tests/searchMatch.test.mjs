import assert from "node:assert/strict";
import test from "node:test";
import { phoneticNameMatch, phoneticQueryTokens, normalizeForSearch, skeletonOf } from "../src/utils/searchText.js";
const q = (s) => phoneticQueryTokens(normalizeForSearch(s));
test("folder names: spelling variants match, random speech does not", () => {
  for (const s of ["wasila", "waseela", "वसीला", "وسیلہ"]) assert.ok(phoneticNameMatch("Wasila", q(s)), s);
  for (const s of ["hello", "babu sahab", "lund fund hello good bye"]) assert.equal(phoneticNameMatch("Wasila", q(s)), false, s);
  assert.equal(skeletonOf("hello"), "hl");
});
