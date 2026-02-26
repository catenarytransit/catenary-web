import { layerspercategory } from './layernames';

import { map_pointer_store, stops_to_hide_store } from '../globalstores';
import { get } from 'svelte/store';

export const default_bus_filter = [
	'all',
	['!', ['in', 1, ['get', 'route_types']]],
	['!', ['in', 0, ['get', 'route_types']]],
	['!', ['in', 2, ['get', 'route_types']]]
];

export const default_metro_filter = [
	'all',
	[
		'case',
		['<', ['zoom'], 15],
		['==', null, ['get', 'parent_station']],
		true // Default case: don't filter
	],
	['==', null, ['get', 'osm_station_id']],
	['==', null, ['get', 'osm_platform_id']],
	['any', ['in', 1, ['get', 'route_types']], ['in', 1, ['get', 'children_route_types']]],
	['!', ['in', 2, ['get', 'children_route_types']]]
];

export const default_tram_filter = [
	'all',
	[
		'case',
		['<', ['zoom'], 15],
		['==', null, ['get', 'parent_station']],
		true // Default case: don't filter
	],
	['==', null, ['get', 'osm_station_id']],
	['==', null, ['get', 'osm_platform_id']],
	['!', ['any', ['in', 1, ['get', 'route_types']], ['in', 1, ['get', 'children_route_types']]]],
	['any', ['in', 0, ['get', 'route_types']], ['in', 0, ['get', 'children_route_types']]],
	['!', ['in', 2, ['get', 'children_route_types']]]
];

export const default_interrail_filter = [
	'all',
	[
		'case',
		['<', ['zoom'], 13.5],
		['==', null, ['get', 'parent_station']],
		true // Default case: don't filter
	],
	['==', null, ['get', 'osm_station_id']],
	[
		'all',
		['any', ['>', ['zoom'], 15], ['==', null, ['get', 'parent_station']]],
		['any', ['in', 2, ['get', 'route_types']], ['in', 2, ['get', 'children_route_types']]]
	]
];

export const default_osm_interrail_filter = [
	'all',
	['any', ['==', ['get', 'railway_tag'], 'station'], ['==', ['get', 'railway_tag'], 'halt']],
	['==', ['get', 'station_type'], 'railway'],
	['==', ['get', 'mode_type'], 'intercity']
];

export function make_stops_filter_part_for_chateau(chateau: string, stop_array: string[]) {
	let filter_part = [
		'!',
		[
			'all',
			['in', ['get', 'gtfs_id'], ['literal', [...stop_array]]],
			['==', ['get', 'chateau'], chateau]
		]
	];
	return filter_part;
}

export function refilter_stops() {
	let map_pointer = get(map_pointer_store);
	if (map_pointer) {
		let new_bus_filter = structuredClone(default_bus_filter);
		let new_metro_filter = structuredClone(default_metro_filter);
		let new_tram_filter = structuredClone(default_tram_filter);
		let new_rail_filter = structuredClone(default_interrail_filter);

		let stops_to_hide = get(stops_to_hide_store);

		for (const chateau in stops_to_hide) {
			let stops_to_hide_chateau = stops_to_hide[chateau];
			console.log('chateau', chateau, 'stops_to_hide_chateau', stops_to_hide_chateau);
			let a = make_stops_filter_part_for_chateau(chateau, stops_to_hide_chateau);
			new_bus_filter.push(a);
			new_metro_filter.push(a);
			new_tram_filter.push(a);
			new_rail_filter.push(a);
		}

		console.log('new filter for stops', new_bus_filter);

		if (layerspercategory.bus.stops) {
			map_pointer.setFilter(layerspercategory.bus.stops, new_bus_filter);
			map_pointer.setFilter(layerspercategory.bus.labelstops, new_bus_filter);
		}

		if (layerspercategory.intercityrail.stops) {
			//  map_pointer.setFilter(layerspercategory.intercityrail.stops, new_bus_filter);
			map_pointer.setFilter(layerspercategory.intercityrail.labelstops, new_rail_filter);
		}

		if (layerspercategory.metro.stops) {
			// map_pointer.setFilter(layerspercategory.metro.stops, new_bus_filter);
			map_pointer.setFilter(layerspercategory.metro.labelstops, new_metro_filter);
		}

		if (layerspercategory.tram.stops) {
			//  map_pointer.setFilter(layerspercategory.tram.stops, new_bus_filter);
			map_pointer.setFilter(layerspercategory.tram.labelstops, new_tram_filter);
		}
	}
}

export function delete_filter_stops_background() {
	stops_to_hide_store.set({});
	refilter_stops();
}
