import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../../i18n/index.jsx";
import { formatDate, readMinutes } from "../../lib/format.js";
import { mediaUrl } from "../../lib/media.js";
import { useMeta } from "../../lib/useMeta.js";
import { Text } from "../ui/Text.jsx";
import { BlockRenderer } from "./BlockRenderer.jsx";

const LANG = { en: "Roman", hi: "हिन्दी", ur: "اردو", ar: "العربية" };

function ReadingProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const on = () => {
      const h = document.documentElement;
      setP(Math.min(100, (h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)) * 100));
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return <div className="fixed inset-x-0 top-0 z-50 h-0.5 bg-transparent" aria-hidden="true"><div className="h-full bg-gold transition-[width] duration-100" style={{ width: `${p}%` }} /></div>;
}

/** Shared by the public article page and the admin preview. */
export function ArticleView({ article, references, crumbs = [], banner }) {
  const { t } = useI18n();
  const cover = mediaUrl(article.coverKey);
  useMeta({ title: article.seoTitle || article.title, description: article.seoDescription || article.excerpt, image: cover });

  return (
    <article>
      <ReadingProgress />
      {banner && <div className="bg-gold/15 px-4 py-2 text-center text-sm font-medium text-bronze">{banner}</div>}
      <header className="container-read pb-6 pt-10 sm:pt-14">
        {crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mute">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden="true">/</span>}
                {c.to ? <Link to={c.to} className="hover:text-bronze">{c.label}</Link> : <span>{c.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <Text as="h1" className="font-display text-3xl font-semibold leading-[1.25] sm:text-5xl">{article.title}</Text>
        {article.excerpt && <Text as="p" className="mt-5 text-lg text-mute">{article.excerpt}</Text>}
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 border-y border-rule py-3 text-xs text-mute">
          <span>{formatDate(article.publishedAt || article.createdAt)}</span>
          <span>{readMinutes(article.blocks)} {t.article.minRead}</span>
          <span className="rounded-full border border-rule px-2 py-0.5">{LANG[article.language] || article.language}</span>
        </div>
      </header>
      {cover && <div className="container-page max-w-4xl"><img src={cover} alt="" className="w-full rounded-xl border border-rule" /></div>}
      <div className="container-read pb-6 pt-4"><BlockRenderer blocks={article.blocks} references={references} /></div>
    </article>
  );
}
