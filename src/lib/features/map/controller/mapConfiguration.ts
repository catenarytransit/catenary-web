import type maplibregl from 'maplibre-gl';
import { getLocationFromLocalStorage } from '$components/previously_known_location';
import { chateaus_store } from '$root/globalstores';

const DEFAULT_CENTER: [number, number] = [10.46, 51.89];

export function getInitialCenter(): [number, number] {
	const previousLocation = getLocationFromLocalStorage();
	if (previousLocation) {
		return [previousLocation.longitude, previousLocation.latitude];
	}

	const cachedIpLocation = localStorage.getItem('cacheipgeolocation');
	if (cachedIpLocation) {
		const [longitude, latitude] = cachedIpLocation.split(',').map(Number);
		if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
			return [longitude, latitude];
		}
	}

	return DEFAULT_CENTER;
}

export async function updateCenterFromIp(map: maplibregl.Map): Promise<void> {
	if (getLocationFromLocalStorage() || localStorage.getItem('cacheipgeolocation')) {
		return;
	}

	try {
		const response = await fetch('https://birch.catenarymaps.org/ip_addr_to_geo/');
		if (!response.ok) {
			return;
		}

		const payload = await response.json();
		const location = payload?.geo_resp;
		if (!location || !Number.isFinite(location.longitude) || !Number.isFinite(location.latitude)) {
			return;
		}

		const center: [number, number] = [location.longitude, location.latitude];
		localStorage.setItem('cacheipgeolocation', center.join(','));
		map.setCenter(center);
	} catch (error) {
		console.warn('Unable to determine an approximate map center from the IP address.', error);
	}
}

export function getMapStyle(searchParams: URLSearchParams, darkMode: boolean): string {
	switch (searchParams.get('style')) {
		case 'midnight':
			return '/pitch-black.json';
		case 'nothing':
			return '/nothing-light.json';
		case 'nothingdark':
			return '/nothing-dark.json';
		case 'dark2025':
			return '/dark-style-old-2025.json';
		default:
			return darkMode ? '/dark-style.json' : '/light-style.json';
	}
}

export function getMarkedPoint(searchParams: URLSearchParams): [number, number] | null {
	const shouldMarkPoint =
		searchParams.get('mp') === 'true' || searchParams.get('framework-point') === 'true';
	if (!shouldMarkPoint) {
		return null;
	}

	const parts = window.location.hash.replace('#pos=', '').split('/').map(Number);
	if (parts.length < 3 || !Number.isFinite(parts[1]) || !Number.isFinite(parts[2])) {
		return null;
	}

	return [parts[2], parts[1]];
}

export async function fetchChateaus(map: maplibregl.Map): Promise<void> {
	try {
		const response = await fetch(
			'https://betula-celtiberica.catenarymaps.org/data/chateaus_simp.json'
		);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}

		const chateaus = await response.json();
		chateaus_store.set(chateaus);
		const source = map.getSource('chateaus') as maplibregl.GeoJSONSource | undefined;
		source?.setData(chateaus);
	} catch (error) {
		console.error('Unable to load chateau coverage data.', error);
	}
}

const ORM_SOURCES: Record<string, maplibregl.VectorSourceSpecification> = {
	openrailwaymap_low: {
		type: 'vector',
		url: 'https://birch_ormproxy.catenarymaps.org/openrailwaymap_proxy/railway_line_high',
		promoteId: 'id'
	},
	standard_railway_text_stations_low: {
		type: 'vector',
		url: 'https://birch_ormproxy.catenarymaps.org/openrailwaymap_proxy/standard_railway_text_stations_low',
		promoteId: 'id'
	},
	standard_railway_text_stations_med: {
		type: 'vector',
		url: 'https://birch_ormproxy.catenarymaps.org/openrailwaymap_proxy/standard_railway_text_stations_med',
		promoteId: 'id'
	},
	high: {
		type: 'vector',
		url: 'https://birch_ormproxy.catenarymaps.org/openrailwaymap_proxy/railway_line_high',
		promoteId: 'id'
	},
	openrailwaymap_standard: {
		type: 'vector',
		url: 'https://birch_ormproxy.catenarymaps.org/openrailwaymap_proxy//standard_railway_turntables,standard_railway_text_stations,standard_railway_grouped_stations,standard_railway_grouped_station_areas,standard_railway_symbols,standard_railway_switch_ref,standard_station_entrances,standard_railway_platforms,standard_railway_platform_edges',
		promoteId: 'id'
	},
	openrailwaymap_signals: {
		type: 'vector',
		url: 'https://birch_ormproxy.catenarymaps.org/openrailwaymap_proxy/signals_railway_signals,signals_signal_boxes',
		promoteId: 'id'
	},
	openrailwaymap_operator: {
		type: 'vector',
		url: 'https://birch_ormproxy.catenarymaps.org/openrailwaymap_proxy/operator_railway_symbols',
		promoteId: 'id'
	}
};

export async function addOpenRailwayMapSources(map: maplibregl.Map): Promise<void> {
	await Promise.all(
		Object.entries(ORM_SOURCES).map(async ([id, source]) => {
			if (map.getSource(id) || !source.url) {
				return;
			}

			try {
				const response = await fetch(source.url);
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}`);
				}
				await response.json();
				if (!map.getSource(id)) {
					map.addSource(id, source);
				}
			} catch (error) {
				console.warn(`Unable to add OpenRailwayMap source ${id}.`, error);
			}
		})
	);
}
