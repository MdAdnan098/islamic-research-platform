import { useEffect } from "react";
import { BRAND } from "../config/env.js";

const DEFAULT_TITLE = BRAND.name;
// Same text as index.html - restored whenever a page doesn't set its own, so one page's description never lingers on the next.
const DEFAULT_DESCRIPTION = "Quran, Sunnat aur mustanad hawalon ki bunyaad par Islami aqaid, masail aur tahqiqi mazameen.";

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content || "");
}

/** Lightweight <head> management (title, description, Open Graph). `noindex` keeps error pages out of search engines. */
export function useMeta({ title, description, image, noindex } = {}) {
  useEffect(() => {
    document.title = title ? `${title} · ${BRAND.name}` : DEFAULT_TITLE;
    const desc = (description || "").replace(/\s+/g, " ").trim().slice(0, 300) || DEFAULT_DESCRIPTION;
    setMeta("name", "description", desc);
    setMeta("property", "og:description", desc);
    setMeta("property", "og:title", title || DEFAULT_TITLE);
    if (image) setMeta("property", "og:image", image);
    if (noindex) setMeta("name", "robots", "noindex");
    return () => {
      document.title = DEFAULT_TITLE;
      if (noindex) document.head.querySelector('meta[name="robots"]')?.remove();
    };
  }, [title, description, image, noindex]);
}
