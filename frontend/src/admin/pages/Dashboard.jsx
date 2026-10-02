import { Link } from "react-router-dom";
import { adminApi } from "../../services/admin.js";
import { useAsync } from "../../lib/useAsync.js";
import { formatDate } from "../../lib/format.js";
import { ErrorBox, PageHeader, Spinner, StatusBadge } from "../components/ui.jsx";

export default function Dashboard() {
  const { data, error, loading, reload } = useAsync(async (signal) => {
    const [articles, categories, references] = await Promise.all([
      adminApi.articles.list({ limit: 100 }, signal),
      adminApi.categories.list({}, signal),
      adminApi.references.list({ limit: 100 }, signal),
    ]);
    return { articles, categories, references };
  }, []);

  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  const { articles, categories, references } = data;
  const count = (s) => articles.filter((a) => a.status === s).length;
  const stats = [["Published", count("published")], ["Drafts", count("draft")], ["Archived", count("archived")], ["Categories", categories.length], ["References", references.length]];
  const recent = [...articles].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 6);

  return (
    <>
      <PageHeader title="Dashboard" desc="Overview of your research library.">
        <Link to="/admin/articles/new" className="a-btn-primary">New article</Link>
      </PageHeader>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {stats.map(([l, v]) => <div key={l} className="a-card p-4"><p className="text-xs text-ad-mute">{l}</p><p className="mt-1 text-2xl font-semibold">{v}</p></div>)}
      </div>
      <h2 className="mb-3 mt-8 text-sm font-semibold">Recently updated</h2>
      <div className="a-card divide-y divide-ad-rule">
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
