import { updateMap } from '../spruce_websocket';
import type {
	BoundsInputPerLevel,
	BoundsInputV3,
	RealtimeCategory,
	SubscribeMapV2Params
} from '$lib/types/backend/spruce';

export interface RealtimeLayerSettings {
	bus: { visible: boolean };
	intercityrail: { visible: boolean };
	localrail: { visible: boolean };
	other: { visible: boolean };
}

export interface TileBoundaries {
	north: number;
	south: number;
	east: number;
	west: number;
}

export function fetch_realtime_vehicle_locations(
	layersettings: RealtimeLayerSettings,
	map: maplibregl.Map
): BoundsInputV3 {
	const categories_to_request: RealtimeCategory[] = [];
	const shortest_screen_width = Math.min(window.screen.width, window.screen.height);
	const bus_threshold = shortest_screen_width < 768 ? 7.5 : 6.5;
	const zoom = Math.round(map.getZoom());

	if (layersettings.bus.visible && zoom >= bus_threshold) {
		categories_to_request.push('bus');
	}

	if (layersettings.intercityrail.visible && zoom >= 3) {
		categories_to_request.push('rail');
	}

	if (layersettings.localrail.visible && zoom >= 4) {
		categories_to_request.push('metro');
	}

	if (layersettings.other.visible && zoom >= 3) {
		categories_to_request.push('other');
	}

	const bounds = bounds_input_calculate(map);
	const params: SubscribeMapV2Params = {
		categories: categories_to_request,
		bounds_input: bounds
	};

	updateMap(params);
	return bounds;
}

function bounds_for_zoom(map: maplibregl.Map, zoom: number): BoundsInputPerLevel {
	const boundaries = get_tile_boundaries(map, zoom);
	const maxTiles = Math.pow(2, zoom) - 1;
	const padding = map.getZoom() > 13 ? 0 : map.getZoom() > 12 ? 1 : 2;

	return {
		min_x: Math.max(0, boundaries.west - padding),
		max_x: Math.min(maxTiles, boundaries.east + padding),
		min_y: Math.max(0, boundaries.north - padding),
		max_y: Math.min(maxTiles, boundaries.south + padding)
	};
}

export function bounds_input_calculate(map: maplibregl.Map): BoundsInputV3 {
	return {
		level5: bounds_for_zoom(map, 5),
		level7: bounds_for_zoom(map, 7),
		level8: bounds_for_zoom(map, 8),
		level12: bounds_for_zoom(map, 12)
	};
}

export function get_tile_boundaries(map: maplibregl.Map, zoom: number): TileBoundaries {
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
