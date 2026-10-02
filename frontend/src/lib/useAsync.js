import { useCallback, useEffect, useRef, useState } from "react";

/** useAsync((signal) => promise, deps) → { data, error, loading, reload, setData } */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve(fnRef.current(ctrl.signal))
      .then((data) => !ctrl.signal.aborted && setState({ data, error: null, loading: false }))
      .catch((error) => {
        if (ctrl.signal.aborted || error?.name === "AbortError") return;
        setState((s) => ({ data: s.data, error, loading: false }));
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === "function" ? updater(s.data) : updater })), []);
  return { ...state, reload, setData };
}
