import { publicApi } from "../../services/public.js";
import { useAsync } from "../../lib/useAsync.js";
import { useMeta } from "../../lib/useMeta.js";
import { BackLink } from "../../components/ui/BackLink.jsx";
import { CardSkeletons, EmptyState, ErrorState } from "../../components/ui/feedback.jsx";
import { CourseGrid } from "../../components/public/CourseCards.jsx";

/** /courses — all published courses. */
export default function CoursesPage() {
  useMeta({ title: "Our Courses" });
  const { data, error, loading, reload } = useAsync((signal) => publicApi.courses(signal), []);

  return (
    <div className="container-page py-10 sm:py-14">
      <BackLink to="/">Home</BackLink>
      <h1 className="mt-4 text-3xl font-bold sm:text-4xl">Our Courses</h1>
      <div className="mt-8">
        {loading && !data ? <CardSkeletons /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : data.length === 0 ? <EmptyState>No courses are available yet. Please check back soon.</EmptyState> : <CourseGrid courses={data} />}
      </div>
    </div>
  );
}
