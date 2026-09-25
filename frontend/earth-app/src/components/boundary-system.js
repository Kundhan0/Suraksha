const BOUNDARY_CONFIG = {
  enabled: true,
  debounceMs: 700,
  cacheLimit: 90,
  maxBoundsDegrees: 7,
  maxFeaturesPerLayer: 650,
  overpassUrl: 'https://overpass-api.de/api/interpreter',
  localManifestUrl: '/data/boundaries/manifest.json',
  levels: {
    country: {
      label: 'Country Boundaries',
      minZoom: 2,
      maxZoom: 6,
      local: ['countries.geojson', 'india/country.geojson'],
      tags: ['rel["boundary"="administrative"]["admin_level"="2"]'],
      style: { color: '#f5f1d5', weight: 2.4, opacity: 0.9, fillOpacity: 0.018 },
    },
    state: {
      label: 'State Boundaries',
      minZoom: 5,
      maxZoom: 8,
      local: ['india/states.geojson'],
      tags: ['rel["boundary"="administrative"]["admin_level"="4"]'],
      style: { color: '#ffd36e', weight: 1.9, opacity: 0.88, fillOpacity: 0.015 },
    },
    district: {
      label: 'District Boundaries',
      minZoom: 8,
      maxZoom: 11,
      local: ['india/districts.geojson'],
      tags: ['rel["boundary"="administrative"]["admin_level"~"^(5|6)$"]'],
      style: { color: '#58d7ca', weight: 1.45, opacity: 0.84, fillOpacity: 0.012 },
    },
    subdistrict: {
      label: 'Taluka/Tehsil Boundaries',
      minZoom: 10,
      maxZoom: 13,
      local: ['india/subdistricts.geojson', 'india/talukas.geojson', 'india/tehsils.geojson'],
      tags: ['rel["boundary"="administrative"]["admin_level"~"^(7|8)$"]'],
      style: { color: '#83aef8', weight: 1.15, opacity: 0.8, fillOpacity: 0.01 },
    },
    village: {
      label: 'Village Boundaries',
      minZoom: 12,
      maxZoom: 15,
      local: ['india/villages.geojson'],
      tags: [
        'rel["place"~"^(village|hamlet|isolated_dwelling)$"]',
        'way["place"~"^(village|hamlet|isolated_dwelling)$"]',
        'rel["boundary"="administrative"]["admin_level"~"^(9|10)$"]',
      ],
      style: { color: '#ff9b78', weight: 1, opacity: 0.82, fillOpacity: 0.01 },
    },
    locality: {
      label: 'Locality Boundaries',
      minZoom: 14,
      maxZoom: 18,
      local: ['india/localities.geojson', 'india/wards.geojson'],
      tags: [
        'rel["place"~"^(locality|suburb|quarter|borough)$"]',
        'way["place"~"^(locality|suburb|quarter|borough)$"]',
        'rel["boundary"]["name"]["admin_level"~"^(10|11)$"]',
      ],
      style: { color: '#e49cff', weight: 0.9, opacity: 0.78, fillOpacity: 0.008 },
    },
    neighbourhood: {
      label: 'Neighbourhood Boundaries',
      minZoom: 15,
      maxZoom: 20,
      local: ['india/neighbourhoods.geojson', 'india/hamlets.geojson'],
      tags: [
        'rel["place"~"^(neighbourhood|hamlet|isolated_dwelling)$"]',
        'way["place"~"^(neighbourhood|hamlet|isolated_dwelling)$"]',
      ],
      style: { color: '#98e07b', weight: 0.85, opacity: 0.72, fillOpacity: 0.006 },
    },
    pointPlaces: {
      label: 'Point-only Places',
      minZoom: 14,
      maxZoom: 20,
      pointOnly: true,
      tags: [
        'node["place"~"^(village|hamlet|locality|neighbourhood|suburb|quarter|isolated_dwelling)$"]["name"]',
      ],
      style: { color: '#ffffff', weight: 1, opacity: 0.86, fillOpacity: 0.36 },
    },
  },
};

const LOCAL_DATA_ROOT = '/data/boundaries/';

function debounce(fn, wait) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function featureId(feature) {
  const props = feature.properties || {};
  if (props.osm_type && props.osm_id) return `${props.osm_type}/${props.osm_id}`;
  if (props.id) return String(props.id);
  if (feature.id) return String(feature.id);
  const name = props.name || props['name:en'];
  const type = props.place || props.boundary || props.admin_level || props.type;
  return name && type ? `${type}:${name}` : null;
}

function propsFromTags(element) {
  const tags = element.tags || {};
  return {
    ...tags,
    osm_id: element.id,
    osm_type: element.type,
    source: tags.source || 'OpenStreetMap',
    type: tags.place || tags.boundary || tags.admin_level || 'boundary',
  };
}

function closeRing(ring) {
  if (ring.length < 3) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
}

function coordsFromGeometry(geometry) {
  return closeRing((geometry || []).map((point) => [point.lon, point.lat]));
}

function nodeToFeature(element) {
  if (typeof element.lat !== 'number' || typeof element.lon !== 'number') return null;
  return {
    type: 'Feature',
    properties: { ...propsFromTags(element), boundary_status: 'point_only' },
    geometry: { type: 'Point', coordinates: [element.lon, element.lat] },
  };
}

function wayToFeature(element) {
  if (!element.geometry || element.geometry.length < 4) return null;
  return {
    type: 'Feature',
    properties: propsFromTags(element),
    geometry: { type: 'Polygon', coordinates: [coordsFromGeometry(element.geometry)] },
  };
}

function relationToFeature(element) {
  const outerRings = [];
  const innerRings = [];

  (element.members || []).forEach((member) => {
    if (!member.geometry || member.geometry.length < 4) return;
    const ring = coordsFromGeometry(member.geometry);
    if (member.role === 'inner') innerRings.push(ring);
    if (member.role === 'outer' || !member.role) outerRings.push(ring);
  });

  if (outerRings.length === 0) return null;
  if (outerRings.length === 1) {
    return {
      type: 'Feature',
      properties: propsFromTags(element),
      geometry: { type: 'Polygon', coordinates: [outerRings[0], ...innerRings] },
    };
  }

  return {
    type: 'Feature',
    properties: propsFromTags(element),
    geometry: { type: 'MultiPolygon', coordinates: outerRings.map((ring) => [ring]) },
  };
}

export function overpassToGeoJSON(osmData) {
  const seen = new Set();
  const features = (osmData.elements || [])
    .map((element) => {
      if (element.type === 'node') return nodeToFeature(element);
      if (element.type === 'way') return wayToFeature(element);
      if (element.type === 'relation') return relationToFeature(element);
      return null;
    })
    .filter((feature) => {
      if (!feature?.geometry) return false;
      const props = feature.properties || {};
      if (!props.name && !props['name:en']) return false;
      const id = featureId(feature);
      if (!id) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

  return { type: 'FeatureCollection', features };
}

function getActiveLevels(zoom, enabledLevels) {
  return Object.entries(BOUNDARY_CONFIG.levels)
    .filter(([key, level]) => enabledLevels[key] && zoom >= level.minZoom && zoom <= level.maxZoom)
    .map(([key]) => key);
}

function boundsToQueryBBox(bounds) {
  return [
    bounds.getSouth().toFixed(5),
    bounds.getWest().toFixed(5),
    bounds.getNorth().toFixed(5),
    bounds.getEast().toFixed(5),
  ].join(',');
}

function cacheKey(levelKey, bounds) {
  const center = bounds.getCenter();
  const latBucket = Math.round(center.lat * 5) / 5;
  const lonBucket = Math.round(center.lng * 5) / 5;
  return `${levelKey}:${latBucket}:${lonBucket}`;
}

function buildOverpassQuery(levelKey, bounds) {
  const bbox = boundsToQueryBBox(bounds);
  const clauses = BOUNDARY_CONFIG.levels[levelKey].tags.map((tag) => `${tag}(${bbox});`).join('');
  return `[out:json][timeout:20];(${clauses});out geom;`;
}

function geometryType(feature) {
  return feature.geometry?.type || '';
}

function isPolygonFeature(feature) {
  const type = geometryType(feature);
  return type === 'Polygon' || type === 'MultiPolygon';
}

function isPointFeature(feature) {
  return geometryType(feature) === 'Point';
}

function styleForFeature(levelKey, selectedId) {
  return (feature) => {
    const base = BOUNDARY_CONFIG.levels[levelKey].style;
    if (featureId(feature) === selectedId) {
      return { ...base, color: '#ffffff', weight: base.weight + 1.25, fillOpacity: 0.11 };
    }
    return base;
  };
}

function pointStyle(selected) {
  return {
    radius: selected ? 7 : 4,
    color: '#ffffff',
    weight: selected ? 2 : 1,
    fillColor: '#5aa0ff',
    fillOpacity: selected ? 0.68 : 0.42,
  };
}

function formatFeatureTitle(feature) {
  const props = feature.properties || {};
  return props.name || props['name:en'] || 'Unnamed place';
}

function formatFeatureType(feature) {
  const props = feature.properties || {};
  if (props.place) return props.place.replace(/_/g, ' ');
  if (props.admin_level) return `admin level ${props.admin_level}`;
  return props.boundary || props.type || (isPointFeature(feature) ? 'point-only place' : 'boundary');
}

function tooltipText(feature) {
  const props = feature.properties || {};
  const lines = [
    formatFeatureTitle(feature),
    `Type: ${formatFeatureType(feature)}`,
    props.admin_level ? `Admin level: ${props.admin_level}` : '',
    isPointFeature(feature) ? 'Boundary: not available in loaded data' : '',
    props.source ? `Source: ${props.source}` : '',
  ];
  return lines.filter(Boolean).map(escapeHtml).join('<br>');
}

function featureCenter(feature, layer) {
  try {
    if (layer.getBounds) {
      const center = layer.getBounds().getCenter();
      return `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`;
    }
    if (layer.getLatLng) {
      const center = layer.getLatLng();
      return `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`;
    }
  } catch {
    return '';
  }
  return '';
}

function panelHtml(feature, layer) {
  const props = feature.properties || {};
  const rows = [
    ['Type', formatFeatureType(feature)],
    ['Boundary', isPolygonFeature(feature) ? 'Real polygon geometry' : 'No polygon boundary in loaded data'],
    ['Admin level', props.admin_level],
    ['District', props.district || props['addr:district']],
    ['Taluka/Tehsil', props.subdistrict || props.taluka || props.tehsil],
    ['State', props.state || props['addr:state']],
    ['Country', props.country || props['addr:country']],
    ['Coordinates', featureCenter(feature, layer)],
    ['OSM object', props.osm_type && props.osm_id ? `${props.osm_type}/${props.osm_id}` : ''],
    ['Data source', props.source],
  ].filter(([, value]) => value);

  const body = rows
    .map(([label, value]) => (
      `<div class="boundary-info-row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`
    ))
    .join('');
  return `<div class="place-title">${escapeHtml(formatFeatureTitle(feature))}</div>${body}`;
}

function addBoundaryControls(enabledLevels, onChange) {
  const existing = document.getElementById('boundaryToggle');
  if (existing) existing.remove();

  const container = document.createElement('div');
  container.id = 'boundaryToggle';
  container.innerHTML = Object.entries(BOUNDARY_CONFIG.levels)
    .map(([key, level]) => (
      `<label><input type="checkbox" data-boundary-level="${key}" ${enabledLevels[key] ? 'checked' : ''}> ${escapeHtml(level.label)}</label>`
    ))
    .join('');
  document.body.appendChild(container);

  container.addEventListener('change', (event) => {
    const input = event.target;
    if (!input?.dataset?.boundaryLevel) return;
    enabledLevels[input.dataset.boundaryLevel] = input.checked;
    onChange();
  });
}

function addBoundaryStyles() {
  if (document.getElementById('boundarySystemStyle')) return;
  const style = document.createElement('style');
  style.id = 'boundarySystemStyle';
  style.textContent = `
    #boundaryToggle {
      position: absolute;
      top: 122px;
      right: 16px;
      z-index: 1000;
      display: none;
      grid-template-columns: 1fr;
      gap: 4px;
      background: rgba(15, 20, 28, 0.9);
      color: #eef2f6;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 10px;
      padding: 9px 11px;
      font: 12px system-ui, sans-serif;
      box-shadow: 0 8px 24px rgba(0,0,0,0.35);
    }
    body:has(#mapLayer.visible) #boundaryToggle { display: grid; }
    #boundaryToggle label {
      display: flex;
      align-items: center;
      gap: 7px;
      min-height: 22px;
      white-space: nowrap;
    }
    #boundaryToggle input { accent-color: #5aa0ff; }
    #boundaryStatus {
      position: absolute;
      left: 16px;
      bottom: 16px;
      z-index: 1000;
      display: none;
      background: rgba(15, 20, 28, 0.88);
      color: #eef2f6;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 10px;
      padding: 8px 11px;
      font: 12px system-ui, sans-serif;
      max-width: min(420px, calc(100vw - 32px));
    }
    #boundaryStatus.visible { display: block; }
    .boundary-info-row {
      display: grid;
      grid-template-columns: 112px 1fr;
      gap: 10px;
      padding: 7px 0;
      border-top: 1px solid rgba(255,255,255,0.08);
      font-size: 12px;
      line-height: 1.35;
      text-align: left;
    }
    .boundary-info-row strong { color: rgba(238,242,246,0.62); font-weight: 500; }
    .boundary-info-row span { min-width: 0; overflow-wrap: anywhere; }
  `;
  document.head.appendChild(style);
}

function createStatusEl() {
  let status = document.getElementById('boundaryStatus');
  if (!status) {
    status = document.createElement('div');
    status.id = 'boundaryStatus';
    document.body.appendChild(status);
  }
  return status;
}

function setPanelContent(feature, layer) {
  const panel = document.getElementById('placePanel');
  const body = document.getElementById('placePanelBody');
  if (!panel || !body) return;
  body.innerHTML = panelHtml(feature, layer);
  panel.classList.add('visible');
}

function boundsTooLarge(bounds) {
  return Math.abs(bounds.getEast() - bounds.getWest()) > BOUNDARY_CONFIG.maxBoundsDegrees ||
    Math.abs(bounds.getNorth() - bounds.getSouth()) > BOUNDARY_CONFIG.maxBoundsDegrees;
}

function featureBounds(feature) {
  const coords = [];
  const visit = (value) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      coords.push(value);
      return;
    }
    value.forEach(visit);
  };
  visit(feature.geometry?.coordinates);
  if (coords.length === 0) return null;
  return coords.reduce((acc, coord) => ({
    west: Math.min(acc.west, coord[0]),
    south: Math.min(acc.south, coord[1]),
    east: Math.max(acc.east, coord[0]),
    north: Math.max(acc.north, coord[1]),
  }), { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity });
}

function intersectsBounds(feature, bounds) {
  const fb = featureBounds(feature);
  if (!fb) return false;
  return fb.east >= bounds.getWest() &&
    fb.west <= bounds.getEast() &&
    fb.north >= bounds.getSouth() &&
    fb.south <= bounds.getNorth();
}

function normalizedFeatureCollection(data, sourceLabel) {
  const features = data?.type === 'FeatureCollection' ? data.features : [];
  return {
    type: 'FeatureCollection',
    features: features
      .filter((feature) => feature?.geometry && (feature.properties?.name || feature.properties?.['name:en']))
      .map((feature) => ({
        ...feature,
        properties: { source: sourceLabel, ...(feature.properties || {}) },
      })),
  };
}

async function tryFetchJson(url, optional = false) {
  const response = await fetch(url);
  if (!response.ok) {
    if (optional && response.status === 404) return null;
    throw new Error(`${url} responded with HTTP ${response.status}`);
  }
  return response.json();
}

async function loadLocalManifest() {
  try {
    const manifest = await tryFetchJson(BOUNDARY_CONFIG.localManifestUrl, true);
    return manifest?.sources || {};
  } catch (error) {
    console.warn('Boundary manifest unavailable:', error);
    return {};
  }
}

function localUrlsForLevel(levelKey, manifestSources) {
  const fromManifest = manifestSources[levelKey] || [];
  const normalizedManifest = Array.isArray(fromManifest) ? fromManifest : [fromManifest];
  const fromConfig = BOUNDARY_CONFIG.levels[levelKey].local || [];
  return [...normalizedManifest, ...fromConfig]
    .map((entry) => (typeof entry === 'string' ? entry : entry.url))
    .filter(Boolean)
    .map((url) => (url.startsWith('/') || /^https?:/.test(url) ? url : `${LOCAL_DATA_ROOT}${url}`));
}

function mergeFeatureCollections(collections, bounds) {
  const seen = new Set();
  const features = [];
  collections.forEach((collection) => {
    (collection.features || []).forEach((feature) => {
      if (!intersectsBounds(feature, bounds)) return;
      const id = featureId(feature);
      if (id && seen.has(id)) return;
      if (id) seen.add(id);
      features.push(feature);
    });
  });
  return { type: 'FeatureCollection', features };
}

export function initBoundarySystem() {
  if (!BOUNDARY_CONFIG.enabled) return;
  const api = window.__earthGlobeApi;
  if (!window.L || !api?.getMap) return;

  const map = api.getMap();
  if (!map || map.__boundarySystemReady) return;
  map.__boundarySystemReady = true;

  addBoundaryStyles();
  const statusEl = createStatusEl();
  const enabledLevels = Object.fromEntries(Object.keys(BOUNDARY_CONFIG.levels).map((key) => [key, true]));
  const cache = new Map();
  const localCache = new Map();
  const activeLayers = new Map();
  let selectedId = null;
  let manifestSources = {};
  let requestSerial = 0;

  function setStatus(text) {
    statusEl.textContent = text || '';
    statusEl.classList.toggle('visible', Boolean(text));
  }

  function trimCache() {
    while (cache.size > BOUNDARY_CONFIG.cacheLimit) cache.delete(cache.keys().next().value);
  }

  function clearInactiveLayers(activeLevelKeys) {
    Array.from(activeLayers.keys()).forEach((key) => {
      if (activeLevelKeys.includes(key)) return;
      map.removeLayer(activeLayers.get(key));
      activeLayers.delete(key);
    });
  }

  function attachFeatureEvents(layer, levelKey) {
    layer.eachLayer((featureLayer) => {
      const feature = featureLayer.feature;
      featureLayer.bindTooltip(tooltipText(feature), { sticky: true, opacity: 0.92 });
      featureLayer.on('mouseover', () => {
        if (featureLayer.setStyle) {
          featureLayer.setStyle({
            ...styleForFeature(levelKey, selectedId)(feature),
            weight: BOUNDARY_CONFIG.levels[levelKey].style.weight + 1,
            fillOpacity: 0.12,
          });
          featureLayer.bringToFront();
        }
      });
      featureLayer.on('mouseout', () => {
        if (featureLayer.setStyle) featureLayer.setStyle(styleForFeature(levelKey, selectedId)(feature));
      });
      featureLayer.on('click', () => {
        selectedId = featureId(feature);
        setPanelContent(feature, featureLayer);
        if (isPolygonFeature(feature) && featureLayer.getBounds) {
          try {
            map.fitBounds(featureLayer.getBounds(), { maxZoom: Math.max(map.getZoom(), 13), padding: [30, 30] });
          } catch {
            // Malformed feature bounds should not break the map.
          }
        } else if (featureLayer.getLatLng) {
          map.flyTo(featureLayer.getLatLng(), Math.max(map.getZoom(), 15), { duration: 0.8 });
        }
        activeLayers.forEach((activeLayer, activeLevelKey) => {
          if (activeLayer.setStyle) activeLayer.setStyle(styleForFeature(activeLevelKey, selectedId));
        });
      });
    });
  }

  async function loadLocalLevel(levelKey, bounds) {
    const urls = localUrlsForLevel(levelKey, manifestSources);
    const collections = [];
    for (const url of urls) {
      if (!localCache.has(url)) {
        try {
          const data = await tryFetchJson(url, true);
          localCache.set(url, data ? normalizedFeatureCollection(data, url) : null);
        } catch (error) {
          console.warn('Local boundary dataset failed:', url, error);
          localCache.set(url, null);
        }
      }
      const collection = localCache.get(url);
      if (collection) collections.push(collection);
    }
    return mergeFeatureCollections(collections, bounds);
  }

  async function loadOverpassLevel(levelKey, bounds) {
    const key = cacheKey(levelKey, bounds);
    if (cache.has(key)) return cache.get(key);

    const query = buildOverpassQuery(levelKey, bounds);
    const response = await fetch(BOUNDARY_CONFIG.overpassUrl, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!response.ok) throw new Error(`Overpass ${response.status}`);

    const osm = await response.json();
    const geojson = overpassToGeoJSON(osm);
    cache.set(key, geojson);
    trimCache();
    return geojson;
  }

  async function loadLevel(levelKey, bounds) {
    const localGeoJSON = await loadLocalLevel(levelKey, bounds);
    if (localGeoJSON.features.length > 0) return localGeoJSON;
    return loadOverpassLevel(levelKey, bounds);
  }

  function renderLayer(levelKey, geojson) {
    if (activeLayers.has(levelKey)) map.removeLayer(activeLayers.get(levelKey));
    const limitedGeoJSON = {
      type: 'FeatureCollection',
      features: geojson.features.slice(0, BOUNDARY_CONFIG.maxFeaturesPerLayer),
    };
    const layer = window.L.geoJSON(limitedGeoJSON, {
      style: styleForFeature(levelKey, selectedId),
      filter: (feature) => {
        if (!feature.geometry || !formatFeatureTitle(feature)) return false;
        return BOUNDARY_CONFIG.levels[levelKey].pointOnly ? isPointFeature(feature) : isPolygonFeature(feature);
      },
      pointToLayer: (feature, latlng) => window.L.circleMarker(latlng, pointStyle(featureId(feature) === selectedId)),
    }).addTo(map);
    attachFeatureEvents(layer, levelKey);
    activeLayers.set(levelKey, layer);
    return geojson.features.length > limitedGeoJSON.features.length;
  }

  async function refreshBoundaries() {
    if (!document.getElementById('mapLayer')?.classList.contains('visible')) return;

    const serial = ++requestSerial;
    const zoom = map.getZoom();
    const bounds = map.getBounds();
    const activeLevelKeys = getActiveLevels(zoom, enabledLevels);
    clearInactiveLayers(activeLevelKeys);

    if (activeLevelKeys.length === 0) {
      setStatus('');
      return;
    }

    if (boundsTooLarge(bounds)) {
      setStatus('Zoom in for detailed boundaries');
      return;
    }

    setStatus('Loading geographic boundaries...');
    try {
      let clipped = false;
      for (const levelKey of activeLevelKeys) {
        const geojson = await loadLevel(levelKey, bounds);
        if (serial !== requestSerial) return;
        clipped = renderLayer(levelKey, geojson) || clipped;
      }
      setStatus(clipped ? 'Showing a limited feature set. Zoom in for more detail.' : '');
    } catch (error) {
      console.error('Unable to load detailed boundaries:', error);
      setStatus('Unable to load detailed boundaries. Please try again.');
    }
  }

  const debouncedRefresh = debounce(refreshBoundaries, BOUNDARY_CONFIG.debounceMs);
  addBoundaryControls(enabledLevels, refreshBoundaries);
  map.on('moveend zoomend', debouncedRefresh);
  window.__boundarySystem = { refresh: refreshBoundaries, config: BOUNDARY_CONFIG };

  loadLocalManifest().then((sources) => {
    manifestSources = sources;
    refreshBoundaries();
  });
}

export { BOUNDARY_CONFIG };
