import { writable } from 'svelte/store';
import type { FeatureCollection, LineString } from 'geojson';
import type { Map, GeoJSONSource } from 'maplibre-gl';
import { itinerarySegments, type EdelweissItinerary } from './edelweiss';

export const activeItineraries = writable<EdelweissItinerary[]>([]);
export const activeItineraryIndex = writable(0);
const SOURCE = 'edelweiss-directions';
type DirectionFeatures = FeatureCollection<LineString, { color: string; walking: boolean; active: boolean }>;
const empty = (): DirectionFeatures => ({ type: 'FeatureCollection', features: [] });

export function itineraryGeoJson(itineraries: EdelweissItinerary[], selected: number): DirectionFeatures {
	const features: DirectionFeatures['features'] = [];
	for (let index = 0; index < itineraries.length; index++) {
		for (const segment of itinerarySegments(itineraries[index])) {
			if (segment.coordinates.length < 2) continue;
			features.push({
				type: 'Feature',
				geometry: { type: 'LineString', coordinates: segment.coordinates },
				properties: { color: segment.color, walking: segment.walking, active: index === selected }
			});
		}
	}
	return { type: 'FeatureCollection', features };
}

export function ensureDirectionsLayers(map: Map): void {
	if (!map.isStyleLoaded()) return;
	if (!map.getSource(SOURCE)) map.addSource(SOURCE, { type: 'geojson', data: empty() });
	if (!map.getLayer('edelweiss-alternatives')) {
		map.addLayer({ id: 'edelweiss-alternatives', type: 'line', source: SOURCE,
			filter: ['==', ['get', 'active'], false],
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-opacity': 0.35 }
		});
	}
	if (!map.getLayer('edelweiss-route')) {
		map.addLayer({ id: 'edelweiss-route', type: 'line', source: SOURCE,
			filter: ['all', ['==', ['get', 'active'], true], ['==', ['get', 'walking'], false]],
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: { 'line-color': ['get', 'color'], 'line-width': 6 }
		});
	}
	if (!map.getLayer('edelweiss-walk')) {
		map.addLayer({ id: 'edelweiss-walk', type: 'line', source: SOURCE,
			filter: ['all', ['==', ['get', 'active'], true], ['==', ['get', 'walking'], true]],
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: { 'line-color': '#64748b', 'line-width': 5, 'line-dasharray': [0.2, 2] }
		});
	}
}

export function refreshDirectionsSource(map: Map, itineraries: EdelweissItinerary[], selected: number): void {
	if (!map.isStyleLoaded()) return;
	ensureDirectionsLayers(map);
	(map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(itineraryGeoJson(itineraries, selected));
}

export function fitDirectionsItinerary(map: Map, itinerary: EdelweissItinerary): void {
	const points = itinerarySegments(itinerary).flatMap((s) => s.coordinates);
	if (!points.length) return;
	let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
	for (const [lon, lat] of points) {
		minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
		minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
	}
	map.fitBounds([[minLon, minLat], [maxLon, maxLat]], {
		padding: { top: 85, bottom: 65, left: Math.min(window.innerWidth * 0.42, 520), right: 45 },
		maxZoom: 15, duration: 550
	});
}
