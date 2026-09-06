import { useCallback, useEffect, useState } from 'react';
import { appDataClient, type JourneyDetail } from './app-data';

type DetailState = { id: string; status: 'loading' | 'ready' | 'error'; data: JourneyDetail | null; message?: string };

// A route owns its request. A late response cannot replace a newer Journey or
// update a popped screen; refreshing an alias keeps the existing detail visible.
export function useJourneyDetail(id: string) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<DetailState>({ id, status: 'loading', data: null });
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let alive = true;
    setState(current => ({ id, status: 'loading', data: current.id === id ? current.data : null }));
    void appDataClient.journey(id, revision > 0).then(
      data => { if (alive) setState({ id, status: 'ready', data }); },
      () => { if (alive) setState(current => ({ ...current, status: 'error', message: 'This journey could not be loaded. Try again.' })); },
    );
    return () => { alive = false; };
  }, [id, revision]);
  // Params can change before the effect runs. Never expose the previous ID.
  return { state: state.id === id ? state : { id, status: 'loading' as const, data: null }, refresh };
}
