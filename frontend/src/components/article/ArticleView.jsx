import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n/index.jsx";
import { formatDate } from "../../lib/format.js";
import { mediaUrl } from "../../lib/media.js";
import { useMeta } from "../../lib/useMeta.js";
import { Text } from "../ui/Text.jsx";
import { BlockRenderer } from "./BlockRenderer.jsx";
import { pickVersion } from "../../lib/versions.js";
import { ArticleLanguage } from "../public/Controls.jsx";
import { useFontSize } from "../../context/FontSizeContext.jsx";
import { useNoPattern } from "../../lib/useNoPattern.js";
import { FloatingReaderControls } from "./FontSizeControl.jsx";

// Admin-only: loaded on demand, so public visitors never download the highlight toolbar.
const HighlightToolbar = lazy(() => import("../../admin/components/HighlightToolbar.jsx"));

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
export function ArticleView({ article, references, crumbs = [], banner, sectionBase, editor, inline, edit, select, titleNode, hideLanguage = false, showFontControls = true }) {
  useNoPattern(); // post pages: plain page colour, no geometric pattern
  const bodyRef = useRef(null);
  const { t, contentLang } = useI18n();
  const { scale } = useFontSize();
  const title = pickVersion(article.title, article.titleTr, article.language, contentLang);
  const cover = mediaUrl(article.coverKey);
  useMeta({ title: article.seoTitle || title, description: article.seoDescription || article.excerpt, image: cover });

  return (
    <article className="select-text" style={{ "--reading-font-scale": scale }}>
      <ReadingProgress />
      {banner && <div className="bg-accent/10 px-4 py-2 text-center text-sm font-medium text-accent">{banner}</div>}
      <header className="article-col pb-6 pt-10 sm:pt-14">
        {/* One line: language dropdown on the left, post date on the right. (The post path / breadcrumb is not shown.) */}
        <div dir="ltr" className="mb-4 flex flex-nowrap items-center justify-between gap-3">
          {!hideLanguage ? <ArticleLanguage /> : <span />}
          <span className="shrink-0 text-xs text-mute">{formatDate(article.publishedAt || article.createdAt)}</span>
        </div>
        {titleNode ?? <Text as="h1" className="font-display article-title text-2xl font-semibold leading-[1.25] sm:text-5xl">{title}</Text>}
        {article.excerpt && <Text as="p" className="article-excerpt mt-5 text-lg text-mute">{article.excerpt}</Text>}
      </header>
      {cover && <div className="article-col"><img src={cover} alt="" className="block h-auto w-full rounded-xl border border-rule" /></div>}
      <div ref={bodyRef} className={`article-col pb-6 pt-6 ${editor?.enabled ? "hl-editing" : ""}`}>
        <BlockRenderer blocks={article.blocks} references={references} baseLang={article.language} hlEdit={!!editor?.enabled} inline={inline} edit={edit} select={select} />
      </div>
      {editor?.enabled && (
        <Suspense fallback={null}>
          <HighlightToolbar containerRef={bodyRef} blocks={article.blocks} baseLang={article.language} onApply={editor.onApply} onTransform={editor.onTransform} onAlign={editor.onAlign} />
        </Suspense>
      )}
      {showFontControls && <FloatingReaderControls />}
    </article>
  );
}
