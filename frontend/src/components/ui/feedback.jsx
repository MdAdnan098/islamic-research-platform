import { Link } from "react-router-dom";
import { useI18n } from "../../i18n/index.jsx";

export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-md bg-rule/60 ${className}`} aria-hidden="true" />;
}

export function CardSkeletons({ count = 3 }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-rule bg-card p-5">
          <Skeleton className="h-3 w-20" /><Skeleton className="h-5 w-4/5" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ children }) {
  return <div className="rounded-xl border border-dashed border-rule px-6 py-10 text-center text-sm text-mute">{children}</div>;
}

export function ErrorState({ error, onRetry }) {
  const { t } = useI18n();
  return (
    <div className="rounded-xl border border-rule bg-card px-6 py-10 text-center" role="alert">
      <p className="font-medium">{t.common.error}</p>
      {error?.message && <p className="mt-1 text-sm text-mute">{error.message}</p>}
      {onRetry && <button onClick={onRetry} className="btn-outline mt-5">{t.common.retry}</button>}
    </div>
  );
}

export function NotFoundState({ message }) {
  const { t } = useI18n();
  return (
    <div className="container-read py-28 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 font-display text-3xl font-semibold">{message || t.common.notFound}</h1>
      <Link to="/" className="btn-primary mt-8">{t.common.home}</Link>
    </div>
  );
}

export function SectionHeading({ eyebrow, title, desc, className = "" }) {
  return (
    <div className={className}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 className="mt-1 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{title}</h2>
      {desc && <p className="mt-3 max-w-2xl text-mute">{desc}</p>}
    </div>
  );
}
