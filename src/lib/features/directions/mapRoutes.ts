import { writable } from 'svelte/store';
import type { FeatureCollection, LineString, Point } from 'geojson';
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

const STOPS_SOURCE = 'edelweiss-directions-stops';
type StopFeatures = FeatureCollection<Point, { name: string; kind: 'boarding' | 'alighting' | 'transfer'; color: string }>;
export function itineraryStopGeoJson(itinerary: EdelweissItinerary | undefined): StopFeatures {
	const features: StopFeatures['features'] = [];
	if (!itinerary) return {type:'FeatureCollection',features};
	const transit = itinerary.legs.filter(leg => !['WALK','FOOT','PEDESTRIAN'].includes(leg.mode.toUpperCase()));
	for (let i = 0; i < transit.length; i++) {
		const leg = transit[i];
		for (const [point,kind] of [[leg.from, i === 0 ? 'boarding' : 'transfer'],[leg.to, i === transit.length - 1 ? 'alighting' : 'transfer']] as const) {
			if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lon) || Math.abs(point.lat) > 90 || Math.abs(point.lon) > 180) continue;
			const key = point.lat.toFixed(6) + ':' + point.lon.toFixed(6) + ':' + kind;
			if (features.some(f => f.id === key)) continue;
			features.push({ type:'Feature', id:key,
				geometry:{type:'Point',coordinates:[point.lon,point.lat]},
				properties:{name:point.name || 'Stop',kind,color:'#087b8b'} });
		}
	}
	return {type:'FeatureCollection',features};
}

export function ensureDirectionsLayers(map: Map): void {
	if (!map.isStyleLoaded()) return;
	if (!map.getSource(SOURCE)) map.addSource(SOURCE, { type: 'geojson', data: empty() });
	if (!map.getSource(STOPS_SOURCE)) map.addSource(STOPS_SOURCE,{type:'geojson',data:{type:'FeatureCollection',features:[]}});
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
	if (!map.getLayer('edelweiss-direction-stops')) {
		map.addLayer({ id:'edelweiss-direction-stops',type:'circle',source:STOPS_SOURCE,
			paint:{'circle-radius':['case',['==',['get','kind'],'transfer'],7,5],
				'circle-color':'#ffffff','circle-stroke-color':'#087b8b','circle-stroke-width':2.5} });
	}
	if (!map.getLayer('edelweiss-direction-stop-labels')) {
		map.addLayer({ id:'edelweiss-direction-stop-labels',type:'symbol',source:STOPS_SOURCE,
			layout:{'text-field':['get','name'],'text-size':11,'text-offset':[0,1.5],
				'text-anchor':'top','text-optional':true},
			paint:{'text-color':'#17212b','text-halo-color':'#ffffff','text-halo-width':2} });
	}
}

export function refreshDirectionsSource(map: Map, itineraries: EdelweissItinerary[], selected: number): void {
	if (!map.isStyleLoaded()) return;
	ensureDirectionsLayers(map);
	(map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(itineraryGeoJson(itineraries, selected));
	(map.getSource(STOPS_SOURCE) as GeoJSONSource | undefined)?.setData(itineraryStopGeoJson(itineraries[selected]));
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
