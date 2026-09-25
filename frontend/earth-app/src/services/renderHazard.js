import { normalizeHazard } from './hazardService';

export function renderHazard(rawHazard, store) {
  if (!store || !rawHazard) return null;

  const hazard = normalizeHazard(rawHazard);
  const existing = store.getHazards().some((item) => item.id === hazard.id);
  if (existing) {
    return store.updateHazard(hazard.id, hazard);
  }
  return store.addHazard(hazard);
}