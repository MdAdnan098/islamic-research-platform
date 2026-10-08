import { useParams } from "react-router-dom";
import { publicApi } from "../../services/public.js";
import { useAsync } from "../../lib/useAsync.js";
import { useMeta } from "../../lib/useMeta.js";
import { mediaUrl } from "../../lib/media.js";
import { formatDate, formatPrice } from "../../lib/format.js";
import { Icon } from "../../components/ui/icons.jsx";
import { BackLink } from "../../components/ui/BackLink.jsx";
import { ErrorState, NotFoundState, Skeleton } from "../../components/ui/feedback.jsx";
import { CourseStatusBadge } from "../../components/public/CourseCards.jsx";
import { EnrollPanel } from "../../components/public/EnrollPanel.jsx";
import { EnrollmentRequestPanel } from "../../components/public/EnrollmentRequestPanel.jsx";

/** /courses/:slug — course details plus the enrollment / payment panel. */
export default function CoursePage() {
  const { slug } = useParams();
  const { data: course, error, loading, reload } = useAsync((signal) => publicApi.course(slug, signal), [slug]);
  useMeta({ title: course?.title, description: course?.shortDescription || course?.description?.slice(0, 160), image: mediaUrl(course?.thumbnailKey) });

  if (loading && !course) {
    return (
      <div className="container-page space-y-4 py-10 sm:py-14" aria-busy="true">
        <Skeleton className="h-4 w-24" /><Skeleton className="h-9 w-2/3" /><Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (error && !course) {
    if (error.status === 404) return <NotFoundState message="Course not found" />;
    return <div className="container-page py-10 sm:py-14"><BackLink to="/courses">All courses</BackLink><div className="mt-6"><ErrorState error={error} onRetry={reload} /></div></div>;
  }

  const thumb = mediaUrl(course.thumbnailKey);
  return (
    <div className="container-page py-10 sm:py-14">
      <BackLink to="/courses">All courses</BackLink>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <CourseStatusBadge status={course.status} />
          <h1 dir="auto" className="mt-3 font-display text-3xl font-bold leading-tight sm:text-4xl">{course.title}</h1>
          {course.teacher && <p dir="auto" className="mt-2 text-lg text-mute">{course.teacher}</p>}
          {thumb && <img src={thumb} alt="" decoding="async" className="mt-6 aspect-[16/9] w-full rounded-2xl border border-rule object-cover" />}
        </div>

        <aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-24">
          <div className="rounded-2xl border border-rule bg-card p-5 shadow-elev">
            <p className="text-3xl font-bold text-accent">{formatPrice(course.price, course.currency)}</p>
            <dl className="mt-3 space-y-1.5 text-sm">
              {course.startDate && <div className="flex justify-between gap-3"><dt className="text-mute">Starts</dt><dd className="font-medium">{formatDate(course.startDate)}</dd></div>}
              {course.endDate && <div className="flex justify-between gap-3"><dt className="text-mute">Ends</dt><dd className="font-medium">{formatDate(course.endDate)}</dd></div>}
              <div className="flex justify-between gap-3"><dt className="text-mute">Classes</dt><dd className="flex items-center gap-1.5 font-medium"><Icon name="monitor" size={15} />Online</dd></div>
            </dl>
            <div className="mt-5 border-t border-rule pt-5">
              {/* Pay-first panel only once the server reports online payments are configured; otherwise the enrollment request form. */}
              {course.paymentsEnabled && course.price > 0 ? <EnrollPanel course={course} /> : <EnrollmentRequestPanel course={course} />}
            </div>
          </div>
        </aside>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          {course.shortDescription && <p dir="auto" className="text-lg">{course.shortDescription}</p>}
          {course.description && (
            <div dir="auto" className="mt-4 space-y-3 text-mute">
              {course.description.split(/\n{2,}/).map((para, i) => <p key={i} className="whitespace-pre-line">{para}</p>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
