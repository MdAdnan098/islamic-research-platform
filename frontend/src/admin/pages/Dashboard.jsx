import { Link } from "react-router-dom";
import { adminApi } from "../../services/admin.js";
import { useAsync } from "../../lib/useAsync.js";
import { formatDate } from "../../lib/format.js";
import { ErrorBox, PageHeader, Spinner, StatusBadge } from "../components/ui.jsx";

export default function Dashboard() {
  const { data, error, loading, reload } = useAsync(async (signal) => {
    const [{ articles, counts }, drafts, stats, categories, references] = await Promise.all([
      adminApi.articles.listWithCounts({ limit: 6, sort: "updated" }, signal), // 6 recently edited + the real totals from the server
      adminApi.articles.listPage({ status: "draft", sort: "updated", limit: 6 }, signal).then((d) => d.articles), // last edited drafts first
      adminApi.dashboard.stats(signal).catch((e) => { if (e?.name === "AbortError") throw e; return null; }), // numbers only: never blocks the dashboard
      adminApi.categories.list({}, signal),
      adminApi.references.list({ limit: 100 }, signal),
    ]);
    return { articles, counts, drafts, stats, categories, references };
  }, []);

  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  const { articles: recent, counts, drafts, stats: extra, categories, references } = data;
  const n = (v) => (v === undefined || v === null ? "—" : v);
  const side = [
    ["Enrollments", n(extra?.enrollments.total), extra ? `${extra.enrollments.pending} pending` : ""],
    ["Payments", n(extra?.payments.paid), extra ? `paid · ${extra.payments.total} total` : ""],
    ["Live sessions", n(extra?.liveSessions.total), extra ? `${extra.liveSessions.live} live · ${extra.liveSessions.upcoming} upcoming` : ""],
  ];
  const stats = [["Total articles", counts.total], ["Published", counts.published], ["Drafts", counts.draft], ["Archived", counts.archived], ["Categories", categories.length], ["References", references.length]];

  return (
    <>
      <PageHeader title="Dashboard" desc="Overview of your research library.">
        {drafts[0] && <Link to={`/admin/articles/${drafts[0].id}`} title={drafts[0].title} className="a-btn btn-cta">Continue draft</Link>}
        <Link to="/admin/articles/new" className="a-btn-primary btn-cta">New article</Link>
      </PageHeader>
      <div className="grid grid-cols-2 items-stretch gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {stats.map(([l, v]) => <div key={l} className="a-card flex h-full min-h-[96px] flex-col justify-between p-4"><p className="text-sm text-ad-mute">{l}</p><p className="mt-1 text-3xl font-bold">{v}</p></div>)}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {side.map(([l, v, sub]) => <div key={l} className="a-card p-4"><p className="text-sm text-ad-mute">{l}</p><p className="mt-1 text-3xl font-bold">{v}</p>{sub && <p className="text-xs text-ad-mute">{sub}</p>}</div>)}
      </div>
      <h2 className="mb-3 mt-8 text-lg font-bold">Drafts</h2>
      <div className="a-card divide-y divide-ad-rule overflow-hidden">
        {drafts.length === 0 && <p className="p-6 text-center text-sm text-ad-mute">Koi draft nahi hai.</p>}
        {drafts.map((a, i) => (
          <Link key={a.id} to={`/admin/articles/${a.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-ad-bg">
            <span dir="auto" className="min-w-0 truncate text-sm font-medium">{a.title}</span>
            <span className="flex shrink-0 items-center gap-3 text-xs text-ad-mute">{i === 0 && <span className="font-semibold text-ad-ink">Last edited</span>}{formatDate(a.updatedAt)}</span>
          </Link>
        ))}
        {counts.draft > drafts.length && <Link to="/admin/articles" className="block px-4 py-2 text-center text-xs text-ad-mute hover:bg-ad-bg">Saare {counts.draft} drafts Articles page par dekhein →</Link>}
      </div>
      <h2 className="mb-3 mt-8 text-lg font-bold">Recently updated</h2>
      <div className="a-card divide-y divide-ad-rule overflow-hidden">
        {recent.length === 0 && <p className="p-6 text-center text-sm text-ad-mute">No articles yet.</p>}
        {recent.map((a) => (
          <Link key={a.id} to={`/admin/articles/${a.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-ad-bg">
            <span dir="auto" className="min-w-0 truncate text-sm font-medium">{a.title}</span>
            <span className="flex shrink-0 items-center gap-3 text-xs text-ad-mute">{formatDate(a.updatedAt)}<StatusBadge status={a.status} /></span>
          </Link>
        ))}
      </div>
    </>
  );
}
