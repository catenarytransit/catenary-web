import type { Writable } from 'svelte/store';
import { get } from 'svelte/store';
import { updateMap } from '../spruce_websocket';

export function fetch_realtime_vehicle_locations(
	layersettings: Record<string, any>,
	chateaus_in_frame: Writable<string[]>,
	chateau_to_realtime_feed_lookup: Record<string, any>,
	map: maplibregl.Map
) {
	const categories_to_request: string[] = [];

	let shortest_screen_width = Math.min(window.screen.width, window.screen.height);

	let bus_threshold = shortest_screen_width < 768 ? 7.5 : 6.5;

	let zoom = Math.round(map.getZoom());

	if (layersettings.bus.visible) {
		if (zoom >= bus_threshold) {
			categories_to_request.push('bus');
		}
	}

	if (zoom >= 3) {
		if (layersettings.intercityrail.visible) {
			categories_to_request.push('rail');
		}
	}

	if (zoom >= 4) {
		if (layersettings.localrail.visible) {
			categories_to_request.push('metro');
		}
	}

	if (zoom >= 3) {
		if (layersettings.other.visible) {
			categories_to_request.push('other');
		}
	}

	// Filter chateaus based on whether they have a realtime feed
	const realtime_chateaus_in_frame = get(chateaus_in_frame).filter((chateau_id: string) => {
		return (
			chateau_to_realtime_feed_lookup[chateau_id] &&
			chateau_to_realtime_feed_lookup[chateau_id].length > 0
		);
	});

	const bounds = bounds_input_calculate(map);

	if (categories_to_request.length > 0) {
		// Send simplified MapViewportUpdate
		updateMap({
			categories: categories_to_request,
			chateaus: realtime_chateaus_in_frame, // Just the list of IDs
			bounds_input: bounds
		});
	}

	return bounds;
}

export function bounds_input_calculate(map: maplibregl.Map) {
	const levels = [5, 7, 8, 12];
	const bounds_input: Record<string, any> = {};

	for (const zoom of levels) {
		const boundaries = get_tile_boundaries(map, zoom);
		const maxTiles = Math.pow(2, zoom) - 1; // Maximum tile index for this zoom level

		let padding = 2;

		if (map.getZoom() > 12) {
			padding = 1;
		}

		if (map.getZoom() > 13) {
			padding = 0;
		}

		bounds_input[`level${zoom}`] = {
			min_x: Math.max(0, boundaries.west - padding),
			max_x: Math.min(maxTiles, boundaries.east + padding),
			min_y: Math.max(0, boundaries.north - padding),
			max_y: Math.min(maxTiles, boundaries.south + padding)
		};
	}

	return bounds_input;
}

export function get_tile_boundaries(map: maplibregl.Map, zoom: number) {
	const bounds = map.getBounds();
	const north = bounds.getNorth();
	const south = bounds.getSouth();
	const east = bounds.getEast();
	const west = bounds.getWest();

	const n = Math.pow(2, zoom);

	const lat_rad_north = (north * Math.PI) / 180;
	const lat_rad_south = (south * Math.PI) / 180;

	const xtile_west = Math.floor(((west + 180) / 360) * n);
	const xtile_east = Math.floor(((east + 180) / 360) * n);

	const ytile_north = Math.floor(
		((1 - Math.log(Math.tan(lat_rad_north) + 1 / Math.cos(lat_rad_north)) / Math.PI) / 2) * n
	);
	const ytile_south = Math.floor(
		((1 - Math.log(Math.tan(lat_rad_south) + 1 / Math.cos(lat_rad_south)) / Math.PI) / 2) * n
	);

	return {
		north: ytile_north,
		south: ytile_south,
		east: xtile_east,
		west: xtile_west
	};
}
