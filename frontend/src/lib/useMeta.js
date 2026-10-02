import { useEffect } from "react";
import { BRAND } from "../config/env.js";

const DEFAULT_TITLE = `${BRAND.name} — ${BRAND.arabic}`;

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content || "");
}

/** Lightweight <head> management (title, description, Open Graph). */
export function useMeta({ title, description, image } = {}) {
  useEffect(() => {
    document.title = title ? `${title} · ${BRAND.name}` : DEFAULT_TITLE;
    if (description) {
      setMeta("name", "description", description);
      setMeta("property", "og:description", description);
    }
    setMeta("property", "og:title", title || DEFAULT_TITLE);
    if (image) setMeta("property", "og:image", image);
    return () => { document.title = DEFAULT_TITLE; };
  }, [title, description, image]);
}
