import { useCallback, useEffect, useState } from 'react';

export function useAsync(task, dependencies = [], immediate = true) {
  const [state, setState] = useState({ data: null, loading: immediate, error: null });
  const run = useCallback(async (...args) => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const data = await task(...args);
      setState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      setState({ data: null, loading: false, error });
      throw error;
    }
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (immediate) run().catch(() => {});
  }, [run, immediate]);
  return { ...state, run, setState };
}
