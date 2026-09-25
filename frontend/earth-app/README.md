# Earth Globe Map

Interactive Three.js globe with a Leaflet satellite map and progressively
loaded real geographic boundaries. The 2D map also includes a frontend-only
Live Earth Intelligence / disaster monitoring interface using clearly labelled
mock hazard data.

## Run

```bash
npm install
npm run dev
```

The current dev server is usually served from Vite on `http://127.0.0.1:5173/`
or the next open port.

## Disaster Monitoring UI

The monitoring layer lives in `src/components/disaster-monitoring.js`.

It adds:

- Collapsible left map/hazard controls.
- Live/demo status bars.
- Mock hazard markers and affected-area polygons.
- Mock rainfall zones.
- Hazard filtering and dynamic counters.
- Clickable event queue with map fly-to behavior.
- Right-side hazard details panel.
- Fullscreen mode.

All hazard information is demo data. The UI labels it as `DEMO / MOCK` and does
not claim real disaster monitoring.

## Future ML/API Contract

Replace `hazardDataProvider.getHazards()` with an API or WebSocket source later.
The UI expects an array shaped like:

```json
[
  {
    "id": "LS001",
    "type": "landslide",
    "name": "Landslide Risk",
    "latitude": 22.5,
    "longitude": 73.6,
    "village": "Optional village/locality",
    "district": "Optional district",
    "state": "Optional state",
    "severity": "high",
    "confidence": 88.2,
    "affectedArea": 4.1,
    "status": "active",
    "timestamp": "2026-09-16T12:42:18Z",
    "lastUpdate": "2026-09-16T12:42:18Z",
    "source": "ML backend",
    "polygon": [
      [22.52, 73.58],
      [22.54, 73.64],
      [22.48, 73.67]
    ]
  }
]
```

Supported hazard `type` values are `cloudburst`, `landslide`, `flood`,
`cyclone`, `lightning`, and `rainfall`. Supported `severity` values are `low`,
`moderate`, `high`, and `extreme`.

## Boundary Data

The boundary system lives in `src/components/boundary-system.js`.

It uses two data paths:

1. Local GeoJSON from `public/data/boundaries` when files are present.
2. OpenStreetMap Overpass API for the current viewport when no local data is
   available for the active level.

Only real GeoJSON polygons are rendered as boundaries. OSM point-only places are
shown by the `Point-only Places` layer and are labelled as having no loaded
polygon boundary.

## Local GeoJSON Layout

```text
public/data/boundaries/
  countries.geojson
  india/
    country.geojson
    states.geojson
    districts.geojson
    subdistricts.geojson
    villages.geojson
    localities.geojson
    wards.geojson
    neighbourhoods.geojson
    hamlets.geojson
```

After adding real datasets, copy:

```text
public/data/boundaries/manifest.example.json
```

to:

```text
public/data/boundaries/manifest.json
```

Then adjust the source URLs if your filenames differ.

## Detail Strategy

The app reveals levels by zoom:

- Countries: low zoom.
- States: low/medium zoom.
- Districts: medium zoom.
- Taluka/tehsil and subdistricts: medium/high zoom.
- Villages: high zoom.
- Localities, wards, hamlets, and neighbourhoods: very high zoom.

Loading is debounced, viewport-bounded, cached, deduplicated by OSM/object ID,
and capped per rendered layer to avoid freezing the browser.

## Sources and Attribution

- Satellite imagery remains the existing Esri layer and attribution.
- Labels/search/boundaries are based on OpenStreetMap-derived services/data.
- Preserve OSM attribution and metadata when preprocessing local GeoJSON.

## Scaling Up

GeoJSON is fine for demos and smaller regional files. For full India village,
ward, locality, and hamlet coverage, preprocess OSM or authoritative government
data into vector tiles or PMTiles and render with MapLibre GL JS or a Leaflet
vector-tile layer. Keep the same level model and metadata fields so the UI does
not need to be rewritten.
