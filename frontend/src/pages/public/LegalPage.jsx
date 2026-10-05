import { useI18n } from "../../i18n/index.jsx";
import { useMeta } from "../../lib/useMeta.js";
import { LEGAL } from "../../config/legal.js";

/** /disclaimer and /privacy */
export default function LegalPage({ kind }) {
  const { t } = useI18n();
  const doc = LEGAL[kind];
  useMeta({ title: t.nav[kind] });
  return (
    <div className="container-read py-12 sm:py-16">
      <h1 className="text-3xl font-bold sm:text-4xl">{doc.title}</h1>
      <div className="mt-10 space-y-8">
        {doc.sections.map((s) => (
          <section key={s.h}>
            <h2 className="font-display text-xl font-bold">{s.h}</h2>
            <p className="mt-2 text-base leading-relaxed text-mute">{s.p}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
