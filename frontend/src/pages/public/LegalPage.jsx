import { useI18n } from "../../i18n/index.jsx";
import { useMeta } from "../../lib/useMeta.js";
import { LEGAL, TAGLINE } from "../../config/legal.js";

/** /about, /disclaimer and /privacy — text lives in config/legal.js */
export default function LegalPage({ kind }) {
  const { t } = useI18n();
  const doc = LEGAL[kind];
  useMeta({ title: t.nav[kind] });
  return (
    <div className="container-read py-12 sm:py-16">
      <h1 className="text-3xl font-bold sm:text-4xl">{doc.title}</h1>

      {doc.intro?.length > 0 && (
        <div className="mt-8 space-y-4">
          {doc.intro.map((p, i) => <p key={i} className="text-base leading-relaxed">{p}</p>)}
        </div>
      )}

      <div className="mt-10 space-y-8">
        {doc.sections.map((s) => (
          <section key={s.h}>
            <h2 className="font-display text-xl font-bold">{s.h}</h2>
            {s.p?.map((p, i) => <p key={i} className="mt-2 text-base leading-relaxed text-mute">{p}</p>)}
            {s.list?.length > 0 && (
              <ul className="mt-3 list-disc space-y-2 ps-6 text-base leading-relaxed text-mute marker:text-accent">
                {s.list.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            )}
          </section>
        ))}
      </div>

      <div className="mt-12 border-t border-rule pt-6 text-center text-sm text-mute">
        {doc.updated && <p className="mb-2">{doc.updated}</p>}
        <p className="font-semibold">{TAGLINE}</p>
      </div>
    </div>
  );
}
