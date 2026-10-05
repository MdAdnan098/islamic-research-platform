import { useCallback, useSyncExternalStore } from "react";

/**
 * Reader bookmarks — kept only in this browser (localStorage), no login needed.
 * Each entry is a small snapshot { slug, title, titleTr, language, savedAt }.
 */
const KEY = "fs_bookmarks";
const EVENT = "fs-bookmarks";
const EMPTY = [];
let raw = null;
let cache = EMPTY;

function read() {
  try {
    const s = localStorage.getItem(KEY) || "[]";
    if (s !== raw) {
      raw = s;
      const a = JSON.parse(s);
      cache = Array.isArray(a) ? a : EMPTY;
    }
  } catch {
    raw = null;
    cache = EMPTY;
  }
  return cache;
}

function write(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}

export function useBookmarks() {
  const items = useSyncExternalStore(subscribe, read, () => EMPTY);
  const has = useCallback((slug) => items.some((b) => b.slug === slug), [items]);
  const remove = useCallback((slug) => write(read().filter((b) => b.slug !== slug)), []);
  const toggle = useCallback((article) => {
    const list = read();
    if (list.some((b) => b.slug === article.slug)) { write(list.filter((b) => b.slug !== article.slug)); return; }
    const { slug, title, titleTr, language } = article;
    write([{ slug, title, titleTr: titleTr || null, language, savedAt: Date.now() }, ...list]);
  }, []);
  return { items, has, toggle, remove };
}
