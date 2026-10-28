import { writable } from 'svelte/store';
import type { FeatureCollection, LineString, Point } from 'geojson';
import type { Map, GeoJSONSource } from 'maplibre-gl';
import { isValidPoint, isWalkingLeg, itinerarySegments, type EdelweissItinerary } from './edelweiss';

export const activeItineraries = writable<EdelweissItinerary[]>([]);
export const activeItineraryIndex = writable(0);
/** Null until a journey card is explicitly clicked; route lines can still preview itinerary 0. */
export const selectedTransferItineraryIndex = writable<number | null>(null);
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

const STOPS_SOURCE = 'edelweiss-directions-stops';
type StopFeatures = FeatureCollection<Point, { kind: 'transfer' }>;
const emptyStops = (): StopFeatures => ({ type: 'FeatureCollection', features: [] });

/** Only show the transfer positions between transit legs, never the initial/final stops. */
export function itineraryStopGeoJson(itinerary: EdelweissItinerary | undefined): StopFeatures {
	const features: StopFeatures['features'] = [];
	if (!itinerary) return emptyStops();
	const transit = itinerary.legs.filter((leg) => !isWalkingLeg(leg.mode));
	const seen = new Set<string>();
	for (let i = 1; i < transit.length; i++) {
		// Both sides of an interchange can be distinct stops when walking is required.
		for (const point of [transit[i - 1].to, transit[i].from]) {
			if (!isValidPoint(point)) continue;
			const key = point.lon.toFixed(6) + ':' + point.lat.toFixed(6);
			if (seen.has(key)) continue;
			seen.add(key);
			features.push({
				type: 'Feature', id: key,
				geometry: { type: 'Point', coordinates: [point.lon, point.lat] },
				properties: { kind: 'transfer' }
			});
		}
	}
	return { type: 'FeatureCollection', features };
}

export function ensureDirectionsLayers(map: Map): void {
	if (!map.isStyleLoaded()) return;
	if (!map.getSource(SOURCE)) map.addSource(SOURCE, { type: 'geojson', data: empty() });
	if (!map.getSource(STOPS_SOURCE)) map.addSource(STOPS_SOURCE, { type: 'geojson', data: emptyStops() });
	if (!map.getLayer('edelweiss-alternatives')) {
		map.addLayer({ id: 'edelweiss-alternatives', type: 'line', source: SOURCE,
			filter: ['==', ['get', 'active'], false],
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: { 'line-color': '#a8adb4', 'line-width': 4, 'line-opacity': 0.55 }
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
	// No station labels. A subtle filled grey circle with a white border is enough.
	if (!map.getLayer('edelweiss-direction-stops')) {
		map.addLayer({ id: 'edelweiss-direction-stops', type: 'circle', source: STOPS_SOURCE,
			paint: { 'circle-radius': 7, 'circle-color': '#808080',
				'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.5 }
		});
	}
}

/** Keep directions above every application overlay, including layers added after map load. */
export function raiseDirectionsLayers(map: Map): void {
	if (!map.isStyleLoaded()) return;
	for (const id of ['edelweiss-alternatives','edelweiss-route','edelweiss-walk',
		'edelweiss-direction-stops']) {
		if (map.getLayer(id)) map.moveLayer(id);
	}
}

export function refreshDirectionsSource(map: Map, itineraries: EdelweissItinerary[], selected: number, selectedTransfers: number | null = null): void {
	if (!map.isStyleLoaded()) return;
	ensureDirectionsLayers(map);
	(map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(itineraryGeoJson(itineraries, selected));
	(map.getSource(STOPS_SOURCE) as GeoJSONSource | undefined)?.setData(
		itineraryStopGeoJson(selectedTransfers === null ? undefined : itineraries[selectedTransfers])
	);
	raiseDirectionsLayers(map);
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
