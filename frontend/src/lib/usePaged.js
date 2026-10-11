import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Server-paged list with "Load more". fetchPage(page, signal) -> { items, hasMore }.
 * Restarts from page 1 when `deps` change; items are de-duplicated by key so a page can never show a row twice.
 */
export function usePaged(fetchPage, deps = [], keyOf = (x) => x.id) {
  const [state, setState] = useState({ items: [], page: 0, hasMore: false, loading: true, more: false, error: null });
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const ctrlRef = useRef(null);
  const [tick, setTick] = useState(0);

  const load = useCallback((page, reset) => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setState((s) => ({ ...(reset ? { items: [], page: 0, hasMore: false } : s), loading: reset, more: !reset, error: null }));
    Promise.resolve(fetchRef.current(page, ctrl.signal))
      .then(({ items, hasMore }) => {
        if (ctrl.signal.aborted) return;
        setState((s) => {
          const seen = new Set(s.items.map(keyOf));
          return { items: [...s.items, ...items.filter((x) => !seen.has(keyOf(x)))], page, hasMore: !!hasMore, loading: false, more: false, error: null };
        });
      })
      .catch((error) => {
        if (ctrl.signal.aborted || error?.name === "AbortError") return;
        setState((s) => ({ ...s, loading: false, more: false, error }));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(1, true); return () => ctrlRef.current?.abort(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [...deps, tick]);

  return {
    ...state,
    loadMore: () => !state.loading && !state.more && state.hasMore && load(state.page + 1, false),
    reload: () => setTick((t) => t + 1),
    retryMore: () => load(state.page + 1, false),
  };
}
