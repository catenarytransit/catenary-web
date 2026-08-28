# catenary-frontend

This is the Svelte JS (and eventually Rust WASM) version of Catenary Maps. Catenary Maps allows users to discover public transport routes and track vehicles on public transport networks in countries around the world including the United States, Canada, EU Countries like Ireland, Germany, France, Spain, Switzerland, Portugal, Norway, Finland, Sweden, Belgium, Netherlands, and United Kingdom, Japan, Australia, and New Zealand. Data such as the speed and vehicle numbers is on Catenary, not shown on other map apps. We also collect realtime data from proprietary sources and convert them to GTFS. All data processing, ingestion, and queries are handled by https://github.com/catenarytransit/catenary-backend, which is written in Pure Rust.

Current site URL: https://maps.catenarymaps.org

## Install Dependenices

```bash
npm install --force
```

## Build and Run catenary-frontend

```bash
npm run build
npm run preview
```

or

```bash
npm run dev
```

### Developers

Catenary Maps Web version.

Maprender: Maplibre https://maplibre.org/maplibre-gl-js/docs/

Base layers:
https://github.com/wipfli/esa-worldcover-polygons with data from https://esa-worldcover.org/en
OpenFreeMap https://openfreemap.org/ with data from https://OpenStreetMap.org

For the seperate but concurrent Kotlin Compose Rust project: https://github.com/catenarytransit/catenary0compose

The project to replicate Loom (line ordering optimised maps) by Patrick Brosi, PhD is a backend project, with minimal involvement with the frontend.
