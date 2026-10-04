import { Navigate, useParams } from "react-router-dom";
import { useI18n } from "../../i18n/index.jsx";
import { PATH_TYPE, loadSection } from "../../services/public.js";
import { useAsync } from "../../lib/useAsync.js";
import { useMeta } from "../../lib/useMeta.js";
import { Text } from "../../components/ui/Text.jsx";
import { CardSkeletons, EmptyState, ErrorState } from "../../components/ui/feedback.jsx";
import { TopicCard } from "../../components/public/Cards.jsx";

/** /aqaid and /masail — Category → Topics. */
export default function SectionPage({ section }) {
  const { t, contentLang } = useI18n();
  const type = PATH_TYPE[section];
  const title = section === "aqaid" ? t.nav.aqaid : t.nav.masail;
  useMeta({ title });
  const { data, error, loading, reload } = useAsync((signal) => loadSection(type, { language: contentLang, signal }), [type, contentLang]);
  const multi = (data?.length || 0) > 1;

  return (
    <div className="container-page py-12 sm:py-16">
      <p className="eyebrow">{t.home.sections}</p>
      <h1 className="mt-1 text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
      {!multi && data?.[0]?.description && <Text as="p" className="mt-5 max-w-2xl text-mute">{data[0].description}</Text>}

      <div className="mt-12 space-y-14">
        {loading && !data ? <CardSkeletons /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : data.length === 0 || data.every((c) => !c.topics.length) ? (
          <EmptyState>{t.topic.noTopicsLang}</EmptyState>
        ) : (
          data.filter((c) => c.topics.length).map((c) => (
            <section key={c.id}>
              {multi && (
                <div className="mb-6">
                  <Text as="h2" className="font-display text-2xl font-bold">{c.name}</Text>
                  {c.description && <Text as="p" className="mt-1 text-sm text-mute">{c.description}</Text>}
                </div>
              )}
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {c.topics.map((tp) => <TopicCard key={tp.id} topic={tp} to={`/${section}/${tp.slug}`} />)}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

export function SectionRedirect() {
  const { section } = useParams();
  return <Navigate to={`/${section}`} replace />;
}
