export function createHazardStore(initialHazards = []) {
  let hazards = [...initialHazards];
  const listeners = new Set();

  function publish() {
    const snapshot = [...hazards];
    listeners.forEach((listener) => listener(snapshot));
  }

  return {
    getHazards() {
      return [...hazards];
    },

    subscribe(listener) {
      listeners.add(listener);
      listener([...hazards]);
      return () => listeners.delete(listener);
    },

    setHazards(nextHazards) {
      hazards = Array.isArray(nextHazards) ? [...nextHazards] : [];
      publish();
    },

    addHazard(hazard) {
      hazards = [...hazards, hazard];
      publish();
      return hazard;
    },

    updateHazard(id, updates) {
      hazards = hazards.map((hazard) => (
        hazard.id === id ? { ...hazard, ...updates } : hazard
      ));
      publish();
      return hazards.find((hazard) => hazard.id === id);
    },

    removeHazard(id) {
      hazards = hazards.filter((hazard) => hazard.id !== id);
      publish();
    },

    clearHazards() {
      hazards = [];
      publish();
    },
  };
}