import type { Map, GeoJSONSource } from 'maplibre-gl';
import type { FeatureCollection, Feature, Geometry } from 'geojson';
import { pointOnFeature } from '@turf/turf';
import { darkMode } from '$lib/shared/theme/theme';

export const weatherSymbol = 'flood-alert-symbol';
const outline = 'flood-alert-outline';
const source = 'flood-alerts';
const points = 'flood-alert-points';
const icon = 'flood-alert-icon';
const url = 'https://raw.githubusercontent.com/catenarytransit/weather-alerts-mirror/main/alerts-on-screen.geojson';

// ArcGIS uses lowercase fields; the archive can retain uppercase fields.
function alertTime(value: unknown): number {
	if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
	return typeof value === 'string' ? Date.parse(value) : NaN;
}

export function activeFloodAlerts(data: FeatureCollection, now = Date.now()): FeatureCollection {
	return { type: 'FeatureCollection', features: data.features.filter(({ properties, geometry }) => {
		if (!properties || !geometry || typeof properties.prod_type !== 'string' ||
			! /flood/i.test(properties.prod_type)) return false;
		const onset = alertTime(properties.onset ?? properties.ONSET);
		const ends = alertTime(properties.ends ?? properties.ENDS);
		return onset <= now && now < ends;
	}) };
}

export function alertUrl(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	try {
		const parsed = new URL(value);
		return parsed.origin === 'https://api.weather.gov' && parsed.pathname.startsWith('/alerts/') ? parsed.href : null;
	} catch { return null; }
}

export function alertFeatureUrl(properties: Feature['properties']): string | null {
	return alertUrl(properties?.url) ?? alertUrl(properties?.URL);
}

export function installFloodAlerts(map: Map) {
	let data: FeatureCollection = { type: 'FeatureCollection', features: [] };
	let disposed = false;
	let busy = false;
	let lastActive: Feature<Geometry>[] = [];
	let dark = false;
	const controller = new AbortController();
	const unsubscribe = darkMode.subscribe(value => {
		dark = value;
		if (map.getLayer(weatherSymbol)) {
			map.setPaintProperty(weatherSymbol, 'text-color', dark ? '#ffaaaa' : '#990000');
			map.setPaintProperty(weatherSymbol, 'text-halo-color', dark ? '#202020' : '#ffffff');
		}
	});
	function render() {
		const active = activeFloodAlerts(data);
		if (active.features.length === lastActive.length && active.features.every((feature, i) => feature === lastActive[i])) return;
		lastActive = active.features;
		const markers: Feature<Geometry>[] = [];
		for (const feature of active.features) {
			try { markers.push({ ...pointOnFeature(feature), properties: feature.properties }); }
			catch (error) { console.warn('Unable to place weather alert marker', feature.id, error); }
		}
		(map.getSource(source) as GeoJSONSource | undefined)?.setData(active);
		(map.getSource(points) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: markers });
	}
	async function refresh() {
		if (busy || disposed || !map.getSource(source)) return;
		busy = true;
		try {
			const response = await fetch(url, { signal: controller.signal, cache: 'no-cache' });
			if (!response.ok) throw new Error('Weather alert feed: ' + response.status);
			const next = await response.json();
			if (next.type !== 'FeatureCollection' || !Array.isArray(next.features)) throw new Error('Invalid alert feed');
			if (!disposed) { data = next; render(); }
		} catch (error) { if (!disposed) console.warn('Weather alerts unavailable', error); }
		finally { busy = false; }
	}
	async function setup() {
		const image = await map.loadImage('/icons/red-exclaim-circle.png');
		if (disposed) return;
		if (!map.hasImage(icon)) map.addImage(icon, image.data);
		map.addSource(source, { type: 'geojson', data });
		map.addSource(points, { type: 'geojson', data });
		map.addLayer({ id: outline, type: 'line', source, minzoom: 10,
			filter: ['==', ['geometry-type'], 'Polygon'],
			paint: { 'line-color': '#dd3333', 'line-width': 2 } });
		map.addLayer({ id: weatherSymbol, type: 'symbol', source: points, minzoom: 10,
			layout: { 'icon-image': icon, 'icon-size': 20 / image.data.width,
				'text-field': ['get', 'prod_type'], 'text-font': ['Arimo-Bold'],
				'text-anchor': 'left', 'text-offset': [1, 0], 'text-size': 13,
				'icon-allow-overlap': true, 'text-allow-overlap': true },
			paint: { 'text-color': dark ? '#ffaaaa' : '#990000',
				'text-halo-color': dark ? '#202020' : '#ffffff', 'text-halo-width': 1 } });
		void refresh();
	}
	const tick = window.setInterval(() => { if (!disposed && map.getSource(source)) render(); }, 1000);
	const poll = window.setInterval(() => void refresh(), 60_000);
	map.on('remove', () => {
		disposed = true;
		controller.abort();
		unsubscribe();
		window.clearInterval(tick);
		window.clearInterval(poll);
	});
	void setup().catch(error => { if (!disposed) console.warn('Weather alert layer unavailable', error); });
}
