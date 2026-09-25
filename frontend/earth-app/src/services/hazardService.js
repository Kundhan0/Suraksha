import { mockHazards } from '../data/mockHazards';

export const HAZARD_TYPES = {
  all: { label: 'All Hazards', short: 'ALL', color: '#9fb7ff' },
  cloudburst: { label: 'Cloudburst', short: 'CB', color: '#5ecbff' },
  landslide: { label: 'Landslide', short: 'LS', color: '#d8a15f' },
  flood: { label: 'Flood', short: 'FL', color: '#52d6c5' },
  cyclone: { label: 'Cyclone', short: 'CY', color: '#b997ff' },
  lightning: { label: 'Lightning', short: 'LT', color: '#ffe66c' },
  rainfall: { label: 'Extreme Rainfall', short: 'RF', color: '#6ea8ff' },
  wildfire: { label: 'Wildfire', short: 'WF', color: '#ff7a59' },
};

export const SEVERITY = {
  low: { label: 'Low', color: '#5cd685', score: 25 },
  moderate: { label: 'Moderate', color: '#f3d64e', score: 50 },
  high: { label: 'High', color: '#ff9f43', score: 75 },
  extreme: { label: 'Extreme', color: '#ff4d5e', score: 100 },
};

export async function fetchHazards() {
  return mockHazards.map((hazard) => ({ ...hazard, polygon: hazard.polygon ? [...hazard.polygon] : [] }));
}

export function normalizeHazard(raw, tick = 0) {
  const severity = SEVERITY[raw.severity] ? raw.severity : 'low';
  const drift = raw.status === 'active' ? tick % 3 : 0;
  return {
    ...raw,
    id: String(raw.id),
    type: HAZARD_TYPES[raw.type] ? raw.type : 'all',
    severity,
    latitude: Number(raw.latitude),
    longitude: Number(raw.longitude),
    confidence: Number(raw.confidence || 0),
    affectedArea: Number(raw.affectedArea || 0),
    status: raw.status || 'monitoring',
    polygon: Array.isArray(raw.polygon) ? raw.polygon : [],
    lastUpdate: new Date(Date.now() - drift * 1000).toISOString(),
  };
}

export function hazardMatchesFilter(hazard, filter) {
  return filter === 'all' || hazard.type === filter;
}

export function polygonLatLngs(hazard) {
  return (hazard.polygon || []).map(([lat, lng]) => [lat, lng]);
}

export function createHazardStore(initialHazards = []) {
  let hazards = initialHazards.map((hazard) => normalizeHazard(hazard));
  const listeners = new Set();

  const notify = () => listeners.forEach((listener) => listener([...hazards]));

  return {
    subscribe(listener) {
      listeners.add(listener);
      listener([...hazards]);
      return () => listeners.delete(listener);
    },
    setHazards(nextHazards) {
      hazards = nextHazards.map((hazard) => normalizeHazard(hazard));
      notify();
    },
    addHazard(hazard) {
      hazards = [...hazards, normalizeHazard(hazard)];
      notify();
    },
    updateHazard(id, patch) {
      hazards = hazards.map((hazard) => (
        hazard.id === id ? normalizeHazard({ ...hazard, ...patch }) : hazard
      ));
      notify();
    },
    removeHazard(id) {
      hazards = hazards.filter((hazard) => hazard.id !== id);
      notify();
    },
    clearHazards() {
      hazards = [];
      notify();
    },
    getHazards() {
      return [...hazards];
    },
  };
}

export function renderHazard(hazard, store) {
  const normalized = normalizeHazard(hazard);
  const existing = store.getHazards().some((item) => item.id === normalized.id);
  if (existing) store.updateHazard(normalized.id, normalized);
  else store.addHazard(normalized);
  return normalized;
}
