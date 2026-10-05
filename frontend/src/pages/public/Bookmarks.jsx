import { Link } from "react-router-dom";
import { useI18n } from "../../i18n/index.jsx";
import { useBookmarks } from "../../lib/bookmarks.js";
import { formatDate } from "../../lib/format.js";
import { pickVersion } from "../../lib/versions.js";
import { useMeta } from "../../lib/useMeta.js";
import { Text } from "../../components/ui/Text.jsx";
import { Icon } from "../../components/ui/icons.jsx";
import { EmptyState } from "../../components/ui/feedback.jsx";

export default function Bookmarks() {
  const { t, contentLang } = useI18n();
  const { items, remove } = useBookmarks();
  useMeta({ title: t.nav.bookmarks });

  return (
    <div className="container-read py-12 sm:py-16">
      <h1 className="text-3xl font-bold sm:text-4xl">{t.nav.bookmarks}</h1>
      <p className="mt-3 text-mute">{t.bookmarks.hint}</p>
      <div className="mt-10">
        {items.length === 0 ? (
          <EmptyState>{t.bookmarks.empty}</EmptyState>
        ) : (
          <ul className="space-y-3">
            {items.map((b) => (
              <li key={b.slug} className="flex items-start gap-3 rounded-2xl border border-rule bg-card p-5">
                <Link to={`/article/${b.slug}`} className="min-w-0 flex-1">
                  <Text as="h2" className="font-display text-lg font-bold leading-snug">{pickVersion(b.title, b.titleTr, b.language, contentLang)}</Text>
                  <p className="mt-1.5 text-xs text-mute">{t.bookmarks.savedOn} {formatDate(b.savedAt)}</p>
                </Link>
                <button
                  type="button"
                  onClick={() => remove(b.slug)}
                  aria-label={t.bookmarks.remove}
                  title={t.bookmarks.remove}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-mute transition-colors hover:bg-tint hover:text-ink"
                >
                  <Icon name="trash" size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
