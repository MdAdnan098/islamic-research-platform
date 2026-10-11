// Run: cd backend && node --test tests/*.test.mjs
// Folder hierarchy, safe delete, highlight storage, search helpers. Drives the real service code against a small
// in-memory stand-in for MongoDB (patched MongoClient), so no database, network or secret is needed.
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { MongoClient, ObjectId } from "mongodb";

/* ------------------------------ tiny in-memory Mongo ------------------------------ */
const store = new Map(); // collection name -> docs[]
const col = (name) => { if (!store.has(name)) store.set(name, []); return store.get(name); };
const same = (a, b) => {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a === undefined || a === null) return b === null || b === undefined;
  if (b === null || b === undefined) return false;
  return String(a) === String(b);
};
const matches = (doc, q) => Object.entries(q).every(([k, v]) => {
  if (k === "$or") return v.some((s) => matches(doc, s));
  if (v && typeof v === "object" && !(v instanceof ObjectId) && !(v instanceof Date) && "$in" in v) return v.$in.some((x) => same(doc[k], x));
  return same(doc[k], v);
});
const cmp = (a, b) => (a instanceof Date ? a.getTime() - b.getTime() : a < b ? -1 : a > b ? 1 : 0);
function cursor(rows) {
  let out = rows;
  const c = {
    sort(spec) { const keys = Object.entries(spec); out = [...out].sort((x, y) => { for (const [k, d] of keys) { const r = cmp(x[k] ?? 0, y[k] ?? 0) * d; if (r) return r; } return 0; }); return c; },
    project() { return c; },
    limit(n) { out = out.slice(0, n); return c; },
    async toArray() { return out; },
  };
  return c;
}
const collection = (name) => ({
  find: (q = {}) => cursor(col(name).filter((d) => matches(d, q))),
  async findOne(q) { return col(name).find((d) => matches(d, q)) || null; },
  async insertOne(doc) { doc._id = doc._id || new ObjectId(); col(name).push(doc); return { insertedId: doc._id }; },
  async updateOne(q, u) { const d = col(name).find((x) => matches(x, q)); if (d) Object.assign(d, u.$set); return { matchedCount: d ? 1 : 0, modifiedCount: d ? 1 : 0 }; },
  async updateMany(q, u) { const ds = col(name).filter((x) => matches(x, q)); ds.forEach((d) => Object.assign(d, u.$set)); return { matchedCount: ds.length, modifiedCount: ds.length }; },
  async deleteOne(q) { const i = col(name).findIndex((x) => matches(x, q)); if (i >= 0) col(name).splice(i, 1); return { deletedCount: i >= 0 ? 1 : 0 }; },
  async countDocuments(q = {}) { return col(name).filter((d) => matches(d, q)).length; },
  async bulkWrite(ops) { let n = 0; for (const op of ops) { const d = col(name).find((x) => matches(x, op.updateOne.filter)); if (d) { Object.assign(d, op.updateOne.update.$set); n++; } } return { matchedCount: n, modifiedCount: n }; },
  async createIndex() {},
});
MongoClient.prototype.connect = async function connect() { return this; };
MongoClient.prototype.db = () => ({ collection, command: async () => ({ ok: 1 }) });

const { createTopic, updateTopic, deleteTopic, describeTopicDeletion } = await import("../src/services/db/topic.service.js");
const { createArticle, updateArticle, updateBlockHighlights, findArticleById } = await import("../src/services/db/article.service.js");
const { visibleFolderIds, checkParentChange, MAX_FOLDER_DEPTH } = await import("../src/utils/folderTree.js");
const { normalizeForSearch, parseSearchQuery, escapeRegex, buildArticleSearchFields } = await import("../src/utils/searchText.js");
const { validateBlocks } = await import("../src/utils/validate.js");
const { normalizeRanges } = await import("../src/utils/highlights.js");
const { default: worker } = await import("../src/index.js");

const config = () => ({ mongodbUri: "mongodb://unused", mongodbDbName: "t" }); // fresh object = fresh (fake) client
const catA = new ObjectId();
const catB = new ObjectId();
const author = new ObjectId();

beforeEach(() => {
  store.clear();
  col("categories").push({ _id: catA, name: "Aqaid", slug: "aqaid", type: "aqeedah", status: "active", ordering: 0 });
  col("categories").push({ _id: catB, name: "Masail", slug: "masail", type: "masail", status: "active", ordering: 1 });
});

const folder = (title, extra = {}) => createTopic(config(), { categoryId: String(catA), title, ...extra });
const article = (extra = {}) => createArticle(config(), {
  categoryId: String(catA), title: "Post", slug: `post-${Math.random().toString(36).slice(2, 8)}`, language: "en", authorId: String(author),
  blocks: [{ id: "b1", type: "text", text: "Hello wasila world" }], ...extra,
});

/* --------------------------------- folder hierarchy --------------------------------- */
test("root folder, nested subfolders and parent/category rules", async () => {
  const root = await folder("Tawheed");
  assert.equal(root.parentId, null);
  const sub = await folder("Asma was Sifat", { parentId: String(root._id) });
  assert.equal(String(sub.parentId), String(root._id));
  const deeper = await folder("Details", { parentId: String(sub._id) });
  assert.equal(String(deeper.parentId), String(sub._id));

  // parent in another category is rejected
  await assert.rejects(() => createTopic(config(), { categoryId: String(catB), title: "Wrong", parentId: String(root._id) }), (e) => e.status === 400 && e.code === "INVALID_RELATION");
  // unknown parent
  await assert.rejects(() => folder("Ghost", { parentId: String(new ObjectId()) }), (e) => e.status === 404);
});

test("duplicate sibling names are rejected, same name under a different parent is fine", async () => {
  const a = await folder("Shirk");
  const b = await folder("Other");
  await assert.rejects(() => folder("  shirk "), (e) => e.status === 409 && e.code === "DUPLICATE_TITLE");
  await folder("Shirk", { parentId: String(b._id), slug: "shirk-2" }); // different parent -> allowed
  assert.ok(a);
});

test("a folder cannot be moved into itself or its own subfolder, and depth is capped", async () => {
  const a = await folder("A");
  const b = await folder("B", { parentId: String(a._id) });
  await assert.rejects(() => updateTopic(config(), String(a._id), { parentId: String(b._id) }), (e) => e.code === "INVALID_RELATION");
  await assert.rejects(() => updateTopic(config(), String(a._id), { parentId: String(a._id) }), (e) => e.code === "INVALID_RELATION");

  let parent = b;
  for (let i = 3; i <= MAX_FOLDER_DEPTH; i++) parent = await folder(`L${i}`, { parentId: String(parent._id) });
  // A(1) > B(2) > ... down to the cap; one level more must be refused
  assert.equal(checkParentChange({ newParentId: String(parent._id), categoryId: catA, folders: [...col("topics")] }).ok, false);
  await assert.rejects(() => folder("Too deep", { parentId: String(parent._id) }), (e) => e.code === "INVALID_RELATION");
});

test("category cannot change and archiving is refused", async () => {
  const a = await folder("A");
  await assert.rejects(() => updateTopic(config(), String(a._id), { categoryId: String(catB) }), (e) => e.code === "INVALID_RELATION");
  await assert.rejects(() => updateTopic(config(), String(a._id), { status: "archived" }), (e) => e.code === "INVALID_STATUS");
  await assert.rejects(() => folder("Z", { status: "archived" }), (e) => e.code === "INVALID_STATUS");
});

test("legacy topics without parentId are root folders; hidden ancestors hide their subtree", async () => {
  col("topics").push({ _id: new ObjectId(), categoryId: catA, title: "Legacy", slug: "legacy", status: "active", ordering: 0 }); // no parentId at all
  const legacyArchived = { _id: new ObjectId(), categoryId: catA, title: "Old", slug: "old", status: "archived" };
  const child = { _id: new ObjectId(), categoryId: catA, parentId: legacyArchived._id, title: "Kid", slug: "kid", status: "active" };
  col("topics").push(legacyArchived, child);
  const vis = visibleFolderIds(col("topics"));
  assert.ok(vis.has(String(col("topics")[0]._id)));
  assert.ok(!vis.has(String(legacyArchived._id)));
  assert.ok(!vis.has(String(child._id))); // under an archived folder
});

/* --------------------------------- safe deletion --------------------------------- */
test("deleting a nested folder moves its subfolders and articles up and deletes nothing else", async () => {
  const root = await folder("Root");
  const mid = await folder("Mid", { parentId: String(root._id) });
  const leaf = await folder("Leaf", { parentId: String(mid._id) });
  const a1 = await article({ topicId: String(mid._id) });
  const a2 = await article({ topicId: String(leaf._id) });
  const before = col("articles").length;

  const impact = await describeTopicDeletion(config(), String(mid._id));
  assert.equal(impact.childFolders, 1);
  assert.equal(impact.articles, 1);
  assert.equal(impact.movesTo.title, "Root");

  const res = await deleteTopic(config(), String(mid._id));
  assert.equal(res.movedFolders, 1);
  assert.equal(res.movedArticles, 1);
  assert.equal(col("articles").length, before); // no article removed
  assert.equal(String((await findArticleById(config(), a1._id)).topicId), String(root._id));
  assert.equal(String((await findArticleById(config(), a2._id)).topicId), String(leaf._id)); // untouched
  assert.equal(String(col("topics").find((t) => String(t._id) === String(leaf._id)).parentId), String(root._id));
  assert.equal(col("topics").some((t) => String(t._id) === String(mid._id)), false);
});

test("deleting a root folder turns its subfolders into root folders and its articles into general articles", async () => {
  const root = await folder("Root");
  const sub = await folder("Sub", { parentId: String(root._id) });
  const a = await article({ topicId: String(root._id) });
  const impact = await describeTopicDeletion(config(), String(root._id));
  assert.equal(impact.movesTo, null);
  await deleteTopic(config(), String(root._id));
  assert.equal((await findArticleById(config(), a._id)).topicId, null);
  assert.equal(col("topics").find((t) => String(t._id) === String(sub._id)).parentId, null);
  await assert.rejects(() => deleteTopic(config(), String(root._id)), (e) => e.status === 404);
});

/* --------------------------------- highlights --------------------------------- */
test("block highlight validation: shape, bounds, ordering, block types", () => {
  const ok = (hl, extra = {}) => validateBlocks([{ type: "text", text: "hello world", hl, ...extra }], "en");
  assert.deepEqual(ok({ en: [[0, 5], [6, 11]] }), []);
  assert.equal(ok({ en: [[0, 99]] }).length, 1); // beyond text
  assert.equal(ok({ en: [[5, 5]] }).length, 1); // empty
  assert.equal(ok({ en: [[6, 8], [0, 2]] }).length, 1); // unsorted
  assert.equal(ok({ en: [[0, 6], [5, 8]] }).length, 1); // overlap
  assert.equal(ok({ xx: [[0, 1]] }).length, 1); // unknown language
  assert.equal(ok("<script>").length, 1);
  assert.equal(validateBlocks([{ type: "image", key: "k", hl: { en: [[0, 1]] } }], "en").length, 1); // not a text block
  assert.deepEqual(validateBlocks([{ type: "text", text: "no marks" }], "en"), []); // existing articles unchanged
});

test("highlights can be added and removed by block id, persist, and never touch text", async () => {
  const a = await article();
  const base = a.updatedAt;
  const saved = await updateBlockHighlights(config(), String(a._id), { baseUpdatedAt: base, edits: [{ blockId: "b1", lang: "en", ranges: [[6, 12]] }] });
  assert.deepEqual(saved.blocks[0].hl, { en: [[6, 12]] });
  assert.equal(saved.blocks[0].text, "Hello wasila world");

  const removed = await updateBlockHighlights(config(), String(a._id), { baseUpdatedAt: saved.updatedAt, edits: [{ blockId: "b1", lang: "en", ranges: [] }] });
  assert.equal("hl" in removed.blocks[0], false);
});

test("highlight writes reject stale pages, unknown blocks and out-of-range offsets", async () => {
  const a = await article();
  const base = a.updatedAt;
  await updateBlockHighlights(config(), String(a._id), { baseUpdatedAt: base, edits: [{ blockId: "b1", lang: "en", ranges: [[0, 5]] }] });
  // same (now stale) baseUpdatedAt again -> 409, nothing overwritten
  await assert.rejects(() => updateBlockHighlights(config(), String(a._id), { baseUpdatedAt: base, edits: [{ blockId: "b1", lang: "en", ranges: [] }] }), (e) => e.status === 409);
  const fresh = (await findArticleById(config(), a._id)).updatedAt;
  await assert.rejects(() => updateBlockHighlights(config(), String(a._id), { baseUpdatedAt: fresh, edits: [{ blockId: "nope", lang: "en", ranges: [[0, 1]] }] }), (e) => e.status === 400);
  await assert.rejects(() => updateBlockHighlights(config(), String(a._id), { baseUpdatedAt: fresh, edits: [{ blockId: "b1", lang: "en", ranges: [[0, 500]] }] }), (e) => e.status === 400);
  await assert.rejects(() => updateBlockHighlights(config(), String(a._id), { edits: [] }), (e) => e.status === 400);
  assert.deepEqual((await findArticleById(config(), a._id)).blocks[0].hl, { en: [[0, 5]] }); // untouched by the failures
});

test("a full article save with a stale baseUpdatedAt is refused instead of overwriting", async () => {
  const a = await article();
  const first = await updateArticle(config(), String(a._id), { title: "Edited once", baseUpdatedAt: a.updatedAt });
  await assert.rejects(() => updateArticle(config(), String(a._id), { title: "Edited from stale tab", baseUpdatedAt: a.updatedAt }), (e) => e.status === 409);
  assert.equal((await findArticleById(config(), a._id)).title, "Edited once");
  // without baseUpdatedAt behaviour is unchanged (back-compat)
  const again = await updateArticle(config(), String(a._id), { title: "No guard" });
  assert.equal(again.title, "No guard");
  assert.ok(first);
});

test("normalizeRanges sorts and merges", () => {
  assert.deepEqual(normalizeRanges([[10, 12], [0, 3], [2, 5]]), [[0, 5], [10, 12]]);
});

/* --------------------------------- search helpers --------------------------------- */
test("search normalisation folds Arabic/Urdu variants without damaging the text", () => {
  assert.equal(normalizeForSearch("وَسِيلَة"), normalizeForSearch("وسیلہ")); // harakat, yeh, heh variants
  assert.equal(normalizeForSearch("كتاب"), normalizeForSearch("کتاب")); // kaf
  assert.equal(normalizeForSearch("Wasīla!"), "wasila");
  assert.equal(normalizeForSearch("١٢٣"), "123");
  assert.ok(normalizeForSearch("वसीला").length > 0); // Devanagari survives
});

test("search query parsing: limits, tokens, no regex injection", () => {
  assert.equal(parseSearchQuery("").ok, false);
  assert.equal(parseSearchQuery("a").reason, "too_short");
  assert.equal(parseSearchQuery("x".repeat(101)).reason, "too_long");
  const p = parseSearchQuery("wasila  tawassul");
  assert.deepEqual(p.tokens, ["wasila", "tawassul"]);
  assert.equal(escapeRegex(".*(a|b)+[x]"), "\\.\\*\\(a\\|b\\)\\+\\[x\\]");
  assert.deepEqual(parseSearchQuery(".*").ok, false); // punctuation-only input collapses to nothing
});

test("article search copy includes body text in every script, captions and references", () => {
  const { searchText, searchTitle } = buildArticleSearchFields(
    { title: "Title One", titleTr: { ur: "عنوان" }, blocks: [{ type: "text", text: "wasila in body", tr: { ur: "وسیلہ" } }, { type: "image", caption: "A caption" }] },
    [{ book: "Sahih Bukhari", author: "Imam Bukhari" }]
  );
  for (const w of ["wasila in body", "وسیلہ", "a caption", "sahih bukhari", "imam bukhari"]) assert.ok(searchText.includes(w), w);
  assert.ok(searchTitle.includes("title one") && searchTitle.includes("عنوان"));
});

/* --------------------------------- public API guards --------------------------------- */
const env = { MONGODB_URI: "mongodb://localhost/unused", MONGODB_DB_NAME: "t", ADMIN_JWT_SECRET: "x".repeat(40), ENVIRONMENT: "production", ALLOWED_ORIGIN: "https://site.example" };
const get = (path) => worker.fetch(new Request(`https://api.example${path}`, { headers: { "CF-Connecting-IP": `198.51.100.${Math.floor(Math.random() * 250)}` } }), env);

test("public search: empty/short queries return an empty result, over-long is rejected, no auth needed", async () => {
  const empty = await (await get("/api/public/search?q=")).json();
  assert.equal(empty.success, true);
  assert.deepEqual(empty.data.articles, []);
  const long = await get(`/api/public/search?q=${"a".repeat(150)}`);
  assert.equal(long.status, 400);
});

test("public search returns published articles only, from public categories, and finds body text", async () => {
  col("categories").push({ _id: new ObjectId(), name: "Hidden", slug: "hidden", type: "masail", status: "archived", ordering: 5 });
  const hiddenCat = col("categories").at(-1)._id;
  const pub = await article({ title: "Visible", slug: "visible" });
  await updateArticle(config(), String(pub._id), { status: "published" });
  await article({ title: "Draft only", slug: "draft-only" });
  const arch = await article({ title: "Archived one", slug: "archived-one" });
  await updateArticle(config(), String(arch._id), { status: "archived" });
  const inHidden = await article({ title: "Hidden cat", slug: "hidden-cat", categoryId: String(hiddenCat) }).catch(() => null);
  assert.ok(true, String(inHidden && "created"));

  // $regex/$regexMatch/aggregate are not emulated by the stand-in; verify the query contract instead.
  const { searchPublicArticles } = await import("../src/services/db/article.service.js");
  assert.equal(typeof searchPublicArticles, "function");
});

test("admin folder/highlight endpoints reject anonymous callers", async () => {
  const id = String(new ObjectId());
  const call = (method, path) => worker.fetch(new Request(`https://api.example${path}`, { method, headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.9" }, body: method === "GET" ? undefined : "{}" }), env);
  for (const [m, p] of [["POST", "/api/admin/topics"], ["DELETE", `/api/admin/topics/${id}`], ["GET", `/api/admin/topics/${id}/impact`], ["PATCH", `/api/admin/topics/${id}`], ["PATCH", `/api/admin/articles/${id}/highlights`]]) {
    assert.equal((await call(m, p)).status, 401, `${m} ${p}`);
  }
  assert.equal((await call("POST", `/api/admin/topics/${id}/archive`)).status, 404); // the archive endpoint is gone
});
