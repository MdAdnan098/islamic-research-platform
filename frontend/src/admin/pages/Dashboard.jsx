import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../../services/admin.js";
import { useAsync } from "../../lib/useAsync.js";
import { formatDate } from "../../lib/format.js";
import { ErrorBox, Spinner, StatusBadge } from "../components/ui.jsx";
import { Icon } from "../../components/ui/icons.jsx";
import AdminSearch from "../components/AdminSearch.jsx";

export default function Dashboard() {
  // The search waits a moment after the last key, then asks the server (all published articles, not just the ones shown below).
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 350);
    return () => clearTimeout(t);
  }, [text]);

  const { data, error, loading, reload } = useAsync(async (signal) => {
    const [drafts, published] = await Promise.all([
      adminApi.articles.listPage({ status: "draft", sort: "updated", limit: 6 }, signal), // last edited drafts first
      adminApi.articles.listPage({ status: "published", sort: "updated", limit: 6 }, signal),
    ]);
    return { drafts: drafts.articles, draftTotal: drafts.total, published: published.articles };
  }, []);
  const found = useAsync((signal) => (q ? adminApi.articles.listPage({ status: "published", q, limit: 20 }, signal) : Promise.resolve(null)), [q]);

  const searching = !!q;
  const row = (a, extra) => (
    <Link key={a.id} to={`/admin/articles/${a.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-ad-bg">
      <span dir="auto" className="min-w-0 truncate text-sm font-medium">{a.title}</span>
      <span className="flex shrink-0 items-center gap-3 text-xs text-ad-mute">{extra}{formatDate(a.updatedAt)}</span>
    </Link>
  );

  return (
    <>
      <AdminSearch value={text} onChange={setText} placeholder="Published article search karein…" className="mx-auto mb-3 w-full max-w-xl" />
      <div className="mb-6 flex justify-center"><Link to="/admin/articles/new" className="a-btn-primary btn-cta"><Icon name="edit" size={15} />Write article</Link></div>

      {searching ? (
        found.loading && !found.data ? <Spinner /> : found.error && !found.data ? <ErrorBox error={found.error} onRetry={found.reload} /> : (
          <div className="a-card divide-y divide-ad-rule overflow-hidden">
            {(found.data?.articles || []).length === 0 && <p className="p-6 text-center text-sm text-ad-mute">Koi published article nahi mila.</p>}
            {(found.data?.articles || []).map((a) => row(a))}
          </div>
        )
      ) : loading && !data ? <Spinner /> : error && !data ? <ErrorBox error={error} onRetry={reload} /> : (
        <>
          {data.drafts.length > 0 && (<>
          <h2 className="mb-2 text-lg font-bold">Drafts</h2>
          <div className="a-card divide-y divide-ad-rule overflow-hidden">
            {data.drafts.map((a, i) => row(a, i === 0 && <span className="font-semibold text-ad-ink">Last edited</span>))}
            {data.draftTotal > data.drafts.length && <Link to="/admin/articles" className="block px-4 py-2 text-center text-xs text-ad-mute hover:bg-ad-bg">Saare {data.draftTotal} drafts Articles page par dekhein →</Link>}
          </div>
          </>)}
          <h2 className={`mb-2 text-lg font-bold ${data.drafts.length > 0 ? "mt-6" : ""}`}>Recently published</h2>
          <div className="a-card divide-y divide-ad-rule overflow-hidden">
            {data.published.length === 0 && <p className="p-6 text-center text-sm text-ad-mute">Abhi koi article publish nahi hua.</p>}
            {data.published.map((a) => row(a, <StatusBadge status={a.status} />))}
          </div>
        </>
      )}
    </>
  );
}
