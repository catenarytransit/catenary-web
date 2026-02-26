import maplibregl from 'maplibre-gl';
import type { Writable } from 'svelte/store';
import { writable, get } from 'svelte/store';
import { data_stack_store, on_sidebar_trigger_store } from '../globalstores';
import {
	MapSelectionScreen,
	StackInterface,
	MapSelectionOption,
	SingleTrip,
	VehicleMapSelector,
	RouteStack,
	StopStack,
	RouteMapSelector,
	StopMapSelector,
	OsmStationMapSelector
} from './stackenum';

export function setup_click_handler(
	map: maplibregl.Map,
	layerspercategory: Record<string, any>,
	setSidebarOpen: () => void
) {
	// Precompute interactive layers array
	map.on('click', (e) => {
		console.log('click');
		var interactiveLayers = Object.values(layerspercategory)
			.flatMap((category) => Object.values(category))
			.filter(Boolean);

		console.log('interactiveLayers', interactiveLayers);

		interactiveLayers.push('ferryshapes');

		let current_layers = map.getStyle().layers;

		console.log('current_layers', current_layers);

		for (const layer of current_layers) {
			if (layer.source == 'stops_context') {
				interactiveLayers.push(layer.id);
				console.log('push', layer.id);
			}
		}

		const clickBbox: [maplibregl.PointLike, maplibregl.PointLike] = [
			[e.point.x - 5, e.point.y - 5],
			[e.point.x + 5, e.point.y + 5]
		];

		try {
			const selectedFeatures = map.queryRenderedFeatures(clickBbox, { layers: interactiveLayers });
			console.log('selectedFeatures', map.queryRenderedFeatures(clickBbox));

			const selected_vehicles_raw = selectedFeatures.filter(
				(x: Record<string, any>) =>
					x.source === 'buses' ||
					x.source === 'localrail' ||
					x.source === 'intercityrail' ||
					x.source === 'other' ||
					x.source === 'livedots_context'
			);

			const selected_vehicles_key_unique = new Set();

			const selected_vehicles: MapSelectionOption[] = selected_vehicles_raw
				.map((x: any) => {
					let key = x.properties.vehicleIdLabel + x.properties.chateau;

					if (selected_vehicles_key_unique.has(key)) {
						return null;
					}

					selected_vehicles_key_unique.add(key);

					return new MapSelectionOption(
						new VehicleMapSelector(
							x.properties.chateau,
							x.properties.vehicleIdLabel,
							x.properties.routeId,
							x.properties.headsign,
							x.properties.tripIdLabel,
							x.properties.color,
							x.properties.route_short_name,
							x.properties.route_long_name,
							x.properties.routeType,
							x.properties.trip_short_name,
							x.properties.text_color,
							x.properties.rt_id,
							x.properties.trip_id,
							x.properties.start_time,
							x.properties.start_date
						)
					);
				})
				.filter((x: MapSelectionOption | null) => x != null);

			const selected_routes_raw = selectedFeatures.filter(
				(x: any) =>
					x.source === 'busshapes' ||
					x.source === 'localcityrailshapes' ||
					x.source === 'intercityrailshapes' ||
					x.source == 'othershapes' ||
					x.layer.id === 'ferryshapes'
			);

			const selected_routes_key_unique = new Set();

			const selected_routes = selected_routes_raw
				.map((x: any) => {
					const key = x.properties.chateau + x.properties.route_label;

					if (selected_routes_key_unique.has(key)) {
						return null;
					}

					if (x.properties) {
						if (x.properties.routes) {
							if (!x.properties.routes.replace('{', '').replace('}', '')) {
								return null;
							}

							selected_routes_key_unique.add(key);

							return new MapSelectionOption(
								new RouteMapSelector(
									x.properties.chateau,
									x.properties.routes.replace('{', '').replace('}', '').split(',')[0],
									`#${x.properties.color}`,
									x.properties.route_label
								)
							);
						}
					}

					return null;
				})
				.filter((x: MapSelectionOption | null) => x != null);

			// console.log('selected shapes', selected_routes_raw);

			const selected_stops_raw = selectedFeatures.filter(
				(x: any) => x.source === 'busstops' || x.source === 'railstops' || x.source === 'otherstops'
			);

			const context_stop_raw = selectedFeatures.filter((x: any) => x.source === 'stops_context');

			const selected_stops_key_unique = new Set();

			const selected_stops_obj = {};

			let children_stop_keys: Record<string, []> = {};

			selected_stops_raw.forEach((x: any) => {
				const key = x.properties.chateau + x.properties.gtfs_id;

				selected_stops_obj[key] = x;

				let children_ids_str = x.properties.children_ids;

				if (children_ids_str) {
					if (children_stop_keys[x.properties.chateau] == undefined) {
						children_stop_keys[x.properties.chateau] = [];
					}

					let split_array = children_ids_str.replace('{', '').replace('}', '').split(',');

					children_stop_keys[x.properties.chateau].push(...split_array);
				}
			});

			console.log('selected stops obj', selected_stops_obj);

			var selected_stops_edited = selected_stops_raw.filter((x) => {
				if (x.properties.parent_station) {
					let key_of_parent_station = x.properties.chateau + x.properties.parent_station;

					if (selected_stops_key_unique.has(key_of_parent_station)) {
						return false;
					}

					if (children_stop_keys[x.properties.chateau]) {
						if (children_stop_keys[x.properties.chateau].includes(x.properties.gtfs_id)) {
							return false;
						}
					}
				}

				return true;
			});

			console.log('selected_stops_edited', selected_stops_edited);

			let selected_stops = selected_stops_edited
				.map((x: any) => {
					const key = x.properties.chateau + x.properties.gtfs_id;

					if (selected_stops_key_unique.has(key)) {
						return null;
					}
					selected_stops_key_unique.add(key);

					return new MapSelectionOption(
						new StopMapSelector(
							x.properties.chateau,
							x.properties.gtfs_id,
							x.properties.displayname
						)
					);
				})
				.filter((x: MapSelectionOption | null) => x != null);

			console.log('selected_stops', selected_stops);

			selected_stops.push(
				...context_stop_raw
					.map((x: any) => {
						const key = x.properties.chateau + x.properties.stop_id;

						if (selected_stops_key_unique.has(key)) {
							return null;
						}

						selected_stops_key_unique.add(key);

						return new MapSelectionOption(
							new StopMapSelector(x.properties.chateau, x.properties.stop_id, x.properties.label)
						);
					})
					.filter((x: MapSelectionOption | null) => x != null)
			);

			// OSM Stations (excluding platforms - only station_type === 'station')
			const selected_osm_stations_raw = selectedFeatures.filter(
				(x: any) =>
					x.source === 'osmstations' &&
					(x.properties.station_type === 'station' ||
						x.properties.station_type === 'tram_stop' ||
						x.properties.station_type === 'halt')
			);

			const selected_osm_stations_key_unique = new Set();

			const selected_osm_stations = selected_osm_stations_raw
				.map((x: any) => {
					const key = x.properties.osm_id;

					if (selected_osm_stations_key_unique.has(key)) {
						return null;
					}
					selected_osm_stations_key_unique.add(key);

					// Extract lat/lon from point geometry
					const coords = x.geometry?.coordinates;
					const lon = coords?.[0] ?? null;
					const lat = coords?.[1] ?? null;

					return new MapSelectionOption(
						new OsmStationMapSelector(
							x.properties.osm_id,
							x.properties.name,
							x.properties.mode_type,
							lat,
							lon
						)
					);
				})
				.filter((x: MapSelectionOption | null) => x != null);

			let MapSelectionOptions = new Array<MapSelectionOption>();

			MapSelectionOptions = MapSelectionOptions.concat(selected_vehicles);
			MapSelectionOptions = MapSelectionOptions.concat(selected_routes);
			MapSelectionOptions = MapSelectionOptions.concat(selected_stops);
			MapSelectionOptions = MapSelectionOptions.concat(selected_osm_stations);

			if (MapSelectionOptions.length > 0) {
				const data_stack = get(data_stack_store);

				data_stack.push(new StackInterface(new MapSelectionScreen(MapSelectionOptions)));

				data_stack_store.update((data_stack_pointer) => data_stack);

				if (data_stack.length > 25) {
					//only use latest 25 entries
					data_stack_store.update((data_stack_pointer) =>
						data_stack_pointer.slice(data_stack.length - 25)
					);
				}

				// console.log('data stack now', get(data_stack_store));
				on_sidebar_trigger_store.update((x) => x + 1);

				setSidebarOpen();
			}
		} catch (e) {
			console.error(e);
		}
	});
}
