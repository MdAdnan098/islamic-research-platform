import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../../i18n/index.jsx";
import { formatDate } from "../../lib/format.js";
import { mediaUrl } from "../../lib/media.js";
import { useMeta } from "../../lib/useMeta.js";
import { Text } from "../ui/Text.jsx";
import { BlockRenderer } from "./BlockRenderer.jsx";
import { pickVersion } from "../../lib/versions.js";

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
  return <div className="fixed inset-x-0 top-0 z-50 h-0.5 bg-transparent" aria-hidden="true"><div className="h-full bg-accent transition-[width] duration-100" style={{ width: `${p}%` }} /></div>;
}

/** Shared by the public article page and the admin preview. */
export function ArticleView({ article, references, crumbs = [], banner, sectionBase }) {
  const { t, contentLang } = useI18n();
  const title = pickVersion(article.title, article.titleTr, article.language, contentLang);
  const cover = mediaUrl(article.coverKey);
  useMeta({ title: article.seoTitle || title, description: article.seoDescription || article.excerpt, image: cover });

  return (
    <article>
      <ReadingProgress />
      {banner && <div className="bg-accent/10 px-4 py-2 text-center text-sm font-medium text-accent">{banner}</div>}
      <header className="container-read pb-6 pt-10 sm:pt-14">
        <div className="mb-4 flex items-start justify-between gap-3 text-xs text-mute">
          {crumbs.length > 0 ? (
            <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-2">
                  {i > 0 && <span aria-hidden="true">/</span>}
                  {c.to ? <Link to={c.to} className="hover:text-bronze">{c.label}</Link> : <span>{c.label}</span>}
                </span>
              ))}
            </nav>
          ) : <span />}
          <span className="ms-auto shrink-0">{formatDate(article.publishedAt || article.createdAt)}</span>
        </div>
        <Text as="h1" className="font-display text-3xl font-semibold leading-[1.25] sm:text-5xl">{title}</Text>
        {article.excerpt && <Text as="p" className="mt-5 text-lg text-mute">{article.excerpt}</Text>}
      </header>
      {cover && <div className="container-page max-w-4xl"><img src={cover} alt="" className="w-full rounded-xl border border-rule" /></div>}
      <div className="container-read pb-6 pt-4"><BlockRenderer blocks={article.blocks} references={references} baseLang={article.language} /></div>
    </article>
  );
}
