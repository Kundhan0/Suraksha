# Boundary data directory

This directory is the optional static-data path for the map boundary system.
The app works without these files by querying OpenStreetMap through Overpass for
the current viewport, but production-scale village/locality coverage should use
preprocessed GeoJSON, PMTiles, or vector tiles.

## GeoJSON layout

Place GeoJSON files here:

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

Each file should be a GeoJSON `FeatureCollection`. Polygon features are rendered
as boundaries. Point features are shown only by the `Point-only Places` layer and
are never treated as boundaries.

Recommended properties:

```json
{
  "name": "Place name",
  "place": "village",
  "admin_level": "10",
  "district": "District name",
  "state": "State name",
  "country": "India",
  "source": "OpenStreetMap",
  "osm_id": "123",
  "osm_type": "relation"
}
```

## Manifest

Copy `manifest.example.json` to `manifest.json` after adding real datasets. The
app loads manifest URLs first, filters them by the current viewport, deduplicates
by OSM ID or feature ID, and only falls back to Overpass when no local features
exist for the active level.

## Data sources

OpenStreetMap is the default live source. If you preprocess OSM data, preserve
OSM attribution and object IDs. Do not convert place points into fake polygons.
For very large India village/locality datasets, generate vector tiles or PMTiles
instead of serving one massive GeoJSON file.
