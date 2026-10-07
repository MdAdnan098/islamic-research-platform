import { publicApi } from "../../services/public.js";
import { useAsync } from "../../lib/useAsync.js";
import { useNow } from "../../lib/useNow.js";
import { useMeta } from "../../lib/useMeta.js";
import { BackLink } from "../../components/ui/BackLink.jsx";
import { CardSkeletons, ErrorState } from "../../components/ui/feedback.jsx";
import { LiveEmpty, LiveSessionGrid } from "../../components/public/LiveSessions.jsx";

/** /live — every published live session and recording. */
export default function LivePage() {
  useMeta({ title: "Live Sessions" });
  const { data, error, loading, reload } = useAsync((signal) => publicApi.liveSessions({ limit: 48 }, signal), []);
  const now = useNow((data || []).some((s) => s.status === "scheduled"));

  return (
    <div className="container-page py-10 sm:py-14">
      <BackLink to="/">Home</BackLink>
      <h1 className="mt-4 text-3xl font-bold sm:text-4xl">Live Sessions</h1>
      <div className="mt-8">
        {loading && !data ? <CardSkeletons /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : data.length === 0 ? <LiveEmpty /> : <LiveSessionGrid sessions={data} now={now} />}
      </div>
    </div>
  );
}
