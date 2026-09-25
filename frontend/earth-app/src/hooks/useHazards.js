import { useCallback, useEffect, useMemo, useState } from 'react';
import { createHazardStore, fetchHazards, hazardMatchesFilter, renderHazard } from '../services/hazardService';

export function useHazards() {
  const store = useMemo(() => createHazardStore(), []);
  const [hazards, setHazardsState] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => store.subscribe(setHazardsState), [store]);

  useEffect(() => {
    fetchHazards().then((items) => store.setHazards(items));
  }, [store]);

  const visibleHazards = useMemo(
    () => hazards.filter((hazard) => hazardMatchesFilter(hazard, filter)),
    [hazards, filter],
  );

  return {
    hazards,
    visibleHazards,
    filter,
    setFilter,
    setHazards: store.setHazards,
    addHazard: store.addHazard,
    updateHazard: store.updateHazard,
    removeHazard: store.removeHazard,
    clearHazards: store.clearHazards,
    renderHazard: useCallback((hazard) => renderHazard(hazard, store), [store]),
  };
}
