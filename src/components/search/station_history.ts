import type { SearchResultItem } from './search_data';

const HISTORY_KEY = 'station_search_history';
const MAX_HISTORY_ITEMS = 100;

export interface HistoryEntry {
	item: SearchResultItem;
	visits: number[];
}

/**
 * Record a station visit from GenericStopScreen.
 * Supports both GTFS stops (data_meta.primary) and OSM stations (fallback props).
 */
export function recordStationVisit(
	data_meta: any,
	key: string,
	stationName: string | null,
	stationLat: number | null,
	stationLon: number | null
) {
	if (typeof window === 'undefined') return;

	try {
		let history: HistoryEntry[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');

		let item: SearchResultItem;

		const hasPrimary = data_meta?.primary != null;

		// Determine the name and coordinates, using data_meta.primary if available, otherwise fallback props
		const name = data_meta?.primary?.stop_name ?? stationName;
		const lat = data_meta?.primary?.stop_lat ?? stationLat;
		const lon = data_meta?.primary?.stop_lon ?? stationLon;

		if (!name) return; // Cannot record without a name

		// Determine if this is an OSM station or a GTFS stop.
		// OSM stations come through OsmStationScreen where key is the osm_id string.
		// GTFS stops come through StopScreen where data_meta.primary.stop_id exists.
		const hasStopId = hasPrimary && data_meta.primary.stop_id;

		if (hasStopId) {
			// GTFS stop
			const stop_id = data_meta.primary.stop_id;
			let chateau = '';
			if (data_meta.routes && Object.keys(data_meta.routes).length > 0) {
				chateau = Object.keys(data_meta.routes)[0];
			}

			item = {
				type: 'stop',
				gtfs_id: stop_id,
				chateau: chateau,
				data: {
					name: name,
					code: data_meta.primary.stop_code,
					point: lat != null && lon != null ? { x: lon, y: lat } : null,
					routes: data_meta.routes && chateau ? Object.keys(data_meta.routes[chateau]) : [],
					osm_station_id: null
				}
			};

			// Save routes section so StopRankingInfo can display colors
			if (data_meta.routes && chateau) {
				(item as any).saved_routes = { [chateau]: data_meta.routes[chateau] };
			}
		} else {
			// OSM station (or any station opened via OsmStationScreen)
			// key is osm_id string
			const allRoutes: any[] = [];
			if (data_meta?.routes) {
				for (const chateau in data_meta.routes) {
					for (const routeId in data_meta.routes[chateau]) {
						const r = data_meta.routes[chateau][routeId];
						allRoutes.push({
							short_name: r.short_name,
							route_id: routeId,
							color: r.color,
							text_color: r.text_color
						});
					}
				}
			}

			item = {
				type: 'osm_station',
				data: {
					osm_id: parseInt(key) || key,
					name: name,
					point: lat != null && lon != null ? { x: lon, y: lat } : null,
					mode_type: 'station',
					routes: allRoutes
				}
			};
		}

		const id =
			item.type === 'stop' ? `stop-${item.chateau}-${item.gtfs_id}` : `osm-${item.data.osm_id}`;

		let existing = history.find((h) => {
			const hId =
				h.item.type === 'stop'
					? `stop-${h.item.chateau}-${h.item.gtfs_id}`
					: `osm-${h.item.data?.osm_id}`;
			return hId === id;
		});

		const now = Date.now();

		if (existing) {
			// Only record one visit per session (avoid duplicates from page refresh)
			const lastVisit = existing.visits[existing.visits.length - 1];
			if (now - lastVisit < 30000) return; // Skip if last visit was less than 30s ago
			existing.visits.push(now);
			existing.item = item; // Update item in case route colors or name changed
		} else {
			existing = { item, visits: [now] };
			history.push(existing);
		}

		// Sort by most recent visit
		history.sort((a, b) => Math.max(...b.visits) - Math.max(...a.visits));
		if (history.length > MAX_HISTORY_ITEMS) {
			history = history.slice(0, MAX_HISTORY_ITEMS);
		}

		localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
	} catch (e) {
		console.error('Failed to save station history', e);
	}
}

export function getTopHistory(limit: number = 10): SearchResultItem[] {
	if (typeof window === 'undefined') return [];
	try {
		const history: HistoryEntry[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
		const now = Date.now();
		const DECAY_MS = 1000 * 60 * 60 * 24 * 14;

		const scored = history.map((h) => {
			const latestVisit = Math.max(...h.visits);
			const frequencyScore = Math.log(Math.E + h.visits.length);
			const daysSince = Math.max(0, now - latestVisit);
			const recencyScore = Math.exp(-daysSince / DECAY_MS);
			const score = frequencyScore * recencyScore;
			return { ...h, score };
		});

		scored.sort((a, b) => b.score - a.score);

		return scored.slice(0, limit).map((h) => h.item);
	} catch (e) {
		console.error('Failed to load station history', e);
		return [];
	}
}
