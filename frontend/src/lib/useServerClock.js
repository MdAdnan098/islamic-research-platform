import { useEffect, useMemo, useRef, useState } from "react";

const MAX_TIMEOUT = 2 ** 31 - 1;

/**
 * A clock aligned to the SERVER, for display only.
 *
 * - `serverTime` (from the API response) fixes the offset between this device's clock and the server's, so a
 *   wrong device clock / timezone cannot shift a countdown.
 * - The 1 s tick only re-renders; it never decides a state change.
 * - At `nextTransitionAt` (the next exact configured timestamp, also from the server) and every `pollMs`
 *   while the tab is visible, `onSync` re-fetches the authoritative state. If the server has not crossed the
 *   boundary yet, the new response simply schedules the next attempt.
 *
 * Returns the current server-aligned time in epoch ms.
 */
export function useServerClock({ serverTime, nextTransitionAt, onSync, tick = true, pollMs = 60_000 }) {
  const [, setBeat] = useState(0);
  const offset = useMemo(() => {
    const t = Date.parse(serverTime);
    return Number.isFinite(t) ? t - Date.now() : 0;
  }, [serverTime]);
  const offsetRef = useRef(offset);
  offsetRef.current = offset;
  const syncRef = useRef(onSync);
  syncRef.current = onSync;

  useEffect(() => {
    if (!tick) return undefined;
    const id = setInterval(() => setBeat((b) => b + 1), 1000);
    return () => clearInterval(id);
  }, [tick]);

  useEffect(() => {
    const target = Date.parse(nextTransitionAt);
    if (!Number.isFinite(target)) return undefined;
    const delay = target - (Date.now() + offsetRef.current);
    const wait = delay > 0 ? Math.min(delay + 300, MAX_TIMEOUT) : 2000;
    const id = setTimeout(() => syncRef.current?.(), wait);
    return () => clearTimeout(id);
  }, [nextTransitionAt, serverTime]);

  useEffect(() => {
    const visible = () => typeof document === "undefined" || document.visibilityState === "visible";
    const id = setInterval(() => { if (visible()) syncRef.current?.(); }, pollMs);
    const onVisibility = () => { if (visible()) syncRef.current?.(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisibility); };
  }, [pollMs]);

  return Date.now() + offset;
}

/** Same clock for a list of public courses: re-syncs at the earliest upcoming transition of any of them. */
export function useCourseListClock(courses, onSync) {
  const serverTime = courses?.[0]?.serverTime;
  const next = (courses || []).map((c) => Date.parse(c.lifecycle?.nextTransitionAt)).filter(Number.isFinite).sort((a, b) => a - b)[0];
  return useServerClock({ serverTime, nextTransitionAt: next ? new Date(next).toISOString() : null, onSync, tick: false });
}
