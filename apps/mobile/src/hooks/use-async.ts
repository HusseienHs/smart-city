import { useCallback, useEffect, useState } from 'react';

export type AsyncState<T> =
  { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'success'; data: T };

export interface AsyncControls {
  /** Loads again, showing the loading state (e.g. a retry after an error). */
  reload: () => void;
  /** Loads again in the background, keeping the current data visible until the result. */
  refresh: () => void;
}

/**
 * Runs `load` when `key` changes (null = idle) and exposes loading/error/success plus retry.
 * Results of superseded requests are ignored.
 */
export function useAsync<T>(
  key: string | null,
  load: () => Promise<T>,
): AsyncState<T> & AsyncControls {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (key === null) return;
    let active = true;
    load().then(
      (data) => active && setState({ status: 'success', data }),
      (error: unknown) => active && setState({ status: 'error', error }),
    );
    return () => {
      active = false;
    };
    // `load` is recreated each render; `key` and `attempt` decide when to run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);
  const refresh = useCallback(() => setAttempt((value) => value + 1), []);

  return { ...state, reload, refresh };
}
