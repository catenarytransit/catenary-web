// Entirely separate MapLibre sources and layers; never update the itinerary sources.
import type { Map, GeoJSONSource } from 'maplibre-gl';
import type { FeatureCollection, LineString, Point } from 'geojson';
import type { DebugFootpaths } from './footpathDebug';

const LINES = 'routing-debug-footpath-lines';
const STOPS = 'routing-debug-footpath-stops';
const LINE_LAYER = 'routing-debug-footpath-edges';
const CIRCLE_LAYER = 'routing-debug-footpath-circles';
const LABEL_LAYER = 'routing-debug-footpath-labels';
const empty = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] });

export function clearFootpathLayers(map: Map): void {
  for (const id of [LABEL_LAYER, CIRCLE_LAYER, LINE_LAYER]) if (map.getLayer(id)) map.removeLayer(id);
  for (const id of [LINES, STOPS]) if (map.getSource(id)) map.removeSource(id);
}

export function drawFootpathLayers(map: Map, result: DebugFootpaths, incoming: boolean, outgoing: boolean): void {
  if (!map.isStyleLoaded()) return;
  const center = result.stop;
  const lineFeatures: FeatureCollection<LineString>['features'] = [];
  const stopFeatures: FeatureCollection<Point>['features'] = [];
  const seen = new Set<string>();
  const add = (stop: DebugFootpaths['stop'], label: string, direction: string) => {
    const key = direction + ':' + stop.stopIndex;
    if (seen.has(key)) return;
    seen.add(key);
    stopFeatures.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [stop.lon, stop.lat] },
      properties: { label, direction, stopIndex: stop.stopIndex }
    });
  };
  add(center, `${center.name} · selected #${center.stopIndex}`, 'selected');
  for (const [direction, enabled, edges] of [
    ['incoming', incoming, result.incoming],
    ['outgoing', outgoing, result.outgoing]
  ] as const) {
    if (!enabled) continue;
    for (const edge of edges) {
      const other = edge.target;
      lineFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: direction === 'incoming'
            ? [[other.lon, other.lat], [center.lon, center.lat]]
            : [[center.lon, center.lat], [other.lon, other.lat]]
        },
        properties: { direction, seconds: edge.seconds }
      });
      add(other, `${other.name} · ${edge.seconds}s · #${other.stopIndex}`, direction);
    }
  }
  if (!map.getSource(LINES)) map.addSource(LINES, { type: 'geojson', data: empty() });
  if (!map.getSource(STOPS)) map.addSource(STOPS, { type: 'geojson', data: empty() });
  (map.getSource(LINES) as GeoJSONSource).setData({ type: 'FeatureCollection', features: lineFeatures });
  (map.getSource(STOPS) as GeoJSONSource).setData({ type: 'FeatureCollection', features: stopFeatures });
  if (!map.getLayer(LINE_LAYER)) map.addLayer({
    id: LINE_LAYER, type: 'line', source: LINES,
    paint: { 'line-color': ['match', ['get', 'direction'], 'incoming', '#e67e22', '#10b981'], 'line-width': 3, 'line-opacity': 0.8 }
  });
  if (!map.getLayer(CIRCLE_LAYER)) map.addLayer({
    id: CIRCLE_LAYER, type: 'circle', source: STOPS,
    paint: {
      'circle-radius': ['match', ['get', 'direction'], 'selected', 9, 6],
      'circle-color': ['match', ['get', 'direction'], 'incoming', '#e67e22', 'outgoing', '#10b981', '#2563eb'],
      'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2
    }
  });
  if (!map.getLayer(LABEL_LAYER)) map.addLayer({
    id: LABEL_LAYER, type: 'symbol', source: STOPS,
    layout: { 'text-field': ['get', 'label'], 'text-size': 11, 'text-offset': [0, 1.4], 'text-anchor': 'top', 'text-allow-overlap': false },
    paint: { 'text-color': '#111827', 'text-halo-color': '#ffffff', 'text-halo-width': 2 }
  });
  for (const id of [LINE_LAYER, CIRCLE_LAYER, LABEL_LAYER]) map.moveLayer(id);
}
