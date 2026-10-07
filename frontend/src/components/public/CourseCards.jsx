import { Link } from "react-router-dom";
import { publicApi } from "../../services/public.js";
import { useAsync } from "../../lib/useAsync.js";
import { mediaUrl } from "../../lib/media.js";
import { formatDate, formatPrice } from "../../lib/format.js";
import { Icon } from "../ui/icons.jsx";
import { CardSkeletons, EmptyState, ErrorState, SectionHeading } from "../ui/feedback.jsx";

export const COURSE_STATUS = {
  enrollment_open: { label: "Enrollment Open", cls: "bg-btn text-on-accent", cta: "Enroll Now" },
  coming_soon: { label: "Coming Soon", cls: "bg-card text-accent border border-accent/30", cta: "View Details" },
  enrollment_closed: { label: "Enrollment Closed", cls: "bg-card text-mute border border-rule", cta: "View Details" },
  completed: { label: "Completed", cls: "bg-card text-mute border border-rule", cta: "View Details" },
};

export function CourseStatusBadge({ status, className = "" }) {
  const s = COURSE_STATUS[status] || COURSE_STATUS.coming_soon;
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${s.cls} ${className}`}>{s.label}</span>;
}

export function CourseCard({ course }) {
  const thumb = mediaUrl(course.thumbnailKey);
  const s = COURSE_STATUS[course.status] || COURSE_STATUS.coming_soon;
  return (
    <Link to={`/courses/${course.slug}`} className="card-lift group flex h-full flex-col rounded-2xl border border-rule bg-card p-3">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-tint">
        {thumb ? (
          <img src={thumb} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" />
        ) : (
          <div className="grid h-full w-full place-items-center text-accent/50"><Icon name="cap" size={44} /></div>
        )}
      </div>

      <div className="flex flex-1 flex-col px-2 pb-2 pt-4">
        <div className="flex items-start justify-between gap-2">
          <h3 dir="auto" className="line-clamp-2 min-w-0 flex-1 font-display text-lg font-bold leading-snug sm:text-xl">{course.title}</h3>
          <CourseStatusBadge status={course.status} className="mt-0.5 shrink-0 whitespace-nowrap" />
        </div>
        {course.teacher && <p dir="auto" className="mt-1 text-sm text-mute">{course.teacher}</p>}
        {course.shortDescription && <p dir="auto" className="mt-3 line-clamp-3 text-sm text-mute">{course.shortDescription}</p>}

        <dl className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {course.startDate && <div className="flex gap-1.5"><dt className="text-mute">Starts</dt><dd className="font-medium">{formatDate(course.startDate)}</dd></div>}
          <div className="flex gap-1.5"><dt className="sr-only">Price</dt><dd className="font-bold text-accent">{formatPrice(course.price, course.currency)}</dd></div>
        </dl>

        <span className={`${course.status === "enrollment_open" ? "btn-primary" : "btn-outline"} mt-auto w-full justify-center [margin-top:1.25rem]`}>
          {s.cta}<Icon name="arrow" size={15} className="rtl:rotate-180" />
        </span>
      </div>
    </Link>
  );
}

/** Compact home-page card: same footprint as the "Latest posts" card (16:9 image + title row, status to the right of the title). */
export function CourseCompactCard({ course }) {
  const thumb = mediaUrl(course.thumbnailKey);
  const meta = [course.teacher, formatPrice(course.price, course.currency)].filter(Boolean).join(" · ");
  return (
    <Link to={`/courses/${course.slug}`} className="card-lift group flex h-full flex-col rounded-2xl border border-rule bg-card p-3">
      <div className="aspect-[16/9] w-full overflow-hidden rounded-xl bg-tint">
        {thumb ? (
          <img src={thumb} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]" />
        ) : (
          <div className="grid h-full w-full place-items-center text-accent/50"><Icon name="cap" size={44} /></div>
        )}
      </div>
      <div className="flex min-h-[6.4rem] flex-1 items-start px-3 pb-3 pt-4 sm:min-h-[6.7rem]">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 dir="auto" className="line-clamp-2 min-w-0 flex-1 font-display text-lg font-bold leading-snug sm:text-xl">{course.title}</h3>
            <CourseStatusBadge status={course.status} className="mt-0.5 shrink-0 whitespace-nowrap" />
          </div>
          {meta && <span dir="auto" className="mt-2 block truncate text-xs text-mute">{meta}</span>}
        </div>
      </div>
    </Link>
  );
}

export function CourseGrid({ courses }) {
  return (
    <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((c) => <CourseCard key={c.id} course={c} />)}
    </div>
  );
}

/** Home page section — loads independently so a failure here never blanks the rest of the page. */
export function CoursesSection() {
  const { data, error, loading, reload } = useAsync((signal) => publicApi.courses(signal), []);
  const visible = (data || []).slice(0, 3);

  return (
    <section className="container-page pb-16 pt-2 sm:pb-24" aria-labelledby="courses-heading">
      <div className="flex items-end justify-between gap-4">
        <SectionHeading title={<span id="courses-heading">Our Courses</span>} />
        {(data?.length || 0) > 0 && (
          <Link to="/courses" className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent/30 px-4 py-1.5 text-sm font-medium text-accent transition hover:bg-btn hover:text-white">
            View all <Icon name="arrow" size={15} className="rtl:rotate-180" />
          </Link>
        )}
      </div>
      <div className="mt-8">
        {loading && !data ? <CardSkeletons /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : visible.length === 0 ? <EmptyState>No courses are available yet. Please check back soon.</EmptyState> : (
          <div className="grid items-stretch gap-5 md:grid-cols-3">
            {visible.map((c, i) => (
              <div key={c.id} className={i === 0 ? "" : "hidden md:block"}>
                <CourseCompactCard course={c} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
