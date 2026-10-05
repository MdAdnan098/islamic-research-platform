import { useI18n } from "../../i18n/index.jsx";
import { useMeta } from "../../lib/useMeta.js";

/** Paragraphs for the About page — separate with a blank line. Left empty for now. */
const ABOUT_TEXT = "";

export default function About() {
  const { t } = useI18n();
  useMeta({ title: t.nav.about });
  const paragraphs = ABOUT_TEXT.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className="container-read py-12 sm:py-16">
      <h1 className="text-3xl font-bold sm:text-4xl">{t.nav.about}</h1>
      <div className="mt-8 space-y-5">
        {paragraphs.map((p, i) => <p key={i} className="text-base leading-relaxed">{p}</p>)}
      </div>
    </div>
  );
}
