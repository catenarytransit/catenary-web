import type * as maplibregl from 'maplibre-gl';
import { getLocationFromLocalStorage } from '$components/previously_known_location';
import { chateaus_store } from '$root/globalstores';

import { selectInitialCamera, type InitialCamera } from '../initialCamera';

export function getInitialCamera(server: InitialCamera | null): InitialCamera {
	try {
		return selectInitialCamera(getLocationFromLocalStorage(), server);
	} catch {
		// Storage can be blocked or contain malformed JSON. The server camera still works.
		return selectInitialCamera(null, server);
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
		case 'screenshots': 
			return 'light-screenshots.json';
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
