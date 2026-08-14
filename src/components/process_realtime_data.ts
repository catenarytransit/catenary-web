import { get } from 'svelte/store';
import {
	realtime_vehicle_locations_store,
	realtime_vehicle_route_cache_store,
	realtime_vehicle_route_cache_hash_store,
	route_cache,
	route_cache_agencies_known,
	realtime_vehicle_locations_last_updated_store,
	usunits_store,
	previous_tile_boundaries_store,
	realtime_vehicle_locations_storev2,
	map_pointer_store
} from '../globalstores';
import {
	add_bunny_layer,
	make_custom_icon_source,
	new_jeans_buses,
	pride_buses
} from './addLayers/customIcons';
import maplibregl from 'maplibre-gl';
import { determineDarkModeToBool } from './determineDarkModeToBool';
import { _ } from 'svelte-i18n';
import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { processVehicleFeature } from './processVehicleFeature';
import type {
	AspenisedVehiclePositionOutput,
	PositionedVehicle,
	PostgresRoute
} from '$lib/types/backend/common';
import type { BoundsInputV3, BulkFetchResponseV2 } from '$lib/types/backend/spruce';

function category_name_to_source_name(category: string): string {
	switch (category) {
		case 'bus':
			return 'buses';
		case 'rail':
			return 'intercityrail';
		case 'metro':
			return 'localrail';
		case 'other':
			return 'other';
	}

	//lets just pretend this will never happen
	return '';
}

const fetches_in_progress: Writable<Set<String>> = writable(new Set());

function fetch_routes_of_chateau_by_agency(
	chateau_id: string,
	agency_id_list: string[],
	rerender_categories: Set<string>
) {
	let stringified_key = chateau_id + ':' + JSON.stringify(agency_id_list.toSorted());

	if (get(fetches_in_progress).has(stringified_key)) {
		return;
	}

	const agencies_known_for_chateau = get(route_cache_agencies_known)[chateau_id] || [];

	const agencies_to_fetch = agency_id_list.filter(
		(agency_id) => !agencies_known_for_chateau.includes(agency_id)
	);

	let agencies_submit_list: string[] | null = agencies_to_fetch;

	if (agencies_to_fetch.length === 0) {
		agencies_submit_list = null;
	}

	const myHeaders = new Headers();
	myHeaders.append('Content-Type', 'application/json');

	const raw = JSON.stringify({
		agency_filter: agencies_submit_list
	});

	const requestOptions: RequestInit = {
		method: 'POST',
		headers: myHeaders,
		body: raw,
		redirect: 'follow'
	};

	fetch(
		`https://birch_routesfetch.catenarymaps.org/getroutesofchateauwithagency/${chateau_id}`,
		requestOptions
	)
		.then((response) => response.json())
		.then((new_routes: PostgresRoute[]) => {
			//remove the key
			fetches_in_progress.update((set) => {
				set.delete(stringified_key);
				return set;
			});

			route_cache.update((cache) => {
				if (!cache[chateau_id]) cache[chateau_id] = {};
				new_routes.forEach((route) => (cache[chateau_id][route.route_id] = route));
				return cache;
			});
			route_cache_agencies_known.update((known) => {
				if (!known[chateau_id]) known[chateau_id] = [];
				known[chateau_id].push(...agencies_to_fetch);
				return known;
			});

			rerender_categories.forEach((rerender_category) => {
				rerender_category_live_dots(rerender_category, get(map_pointer_store));
			});
		})
		.catch((error) => {
			console.log('error fetching routes', error);

			//remove the key
			fetches_in_progress.update((set) => {
				set.delete(stringified_key);
				return set;
			});
		});
}

export function process_realtime_vehicle_locations_v2(
	response_from_birch_vehicles_2: BulkFetchResponseV2,
	map: maplibregl.Map,
	bounds: BoundsInputV3
) {
	let rerender_category: Set<string> = new Set();

	let route_cache_current = get(route_cache);

	realtime_vehicle_locations_storev2.update((realtime_vehicle_locations) => {
		Object.entries(response_from_birch_vehicles_2.chateaus).forEach(
			([chateau_id, chateau_data]) => {
				//console.log('chateau', chateau_id, chateau_data);

				let list_of_agency_ids_to_fetch = [];
				let should_fetch_routes = false;

				if (chateau_data.categories) {
					Object.entries(chateau_data.categories).forEach(([category, category_data]) => {
						if (category_data != null) {
							let bounds_last_fetched_for_this_category = bounds[`level${category_data.z_level}`];

							previous_tile_boundaries_store.update((previous_tile_boundaries) => {
								if (!previous_tile_boundaries[chateau_id]) {
									previous_tile_boundaries[chateau_id] = {};
								}

								previous_tile_boundaries[chateau_id][category] =
									bounds_last_fetched_for_this_category;

								return previous_tile_boundaries;
							});

							if (!realtime_vehicle_locations[category]) {
								realtime_vehicle_locations[category] = {};
							}

							if (!realtime_vehicle_locations[category][chateau_id]) {
								realtime_vehicle_locations[category][chateau_id] = {};
							}

							if (category_data.vehicle_positions) {
								//console.log('agency list', chateau_id, category_data.list_of_agency_ids);
								if (category_data.replaces_all == true) {
									realtime_vehicle_locations[category][chateau_id] =
										category_data.vehicle_positions;

									Object.values(category_data.vehicle_positions).forEach((data_for_x) => {
										Object.values(data_for_x).forEach((data_for_xy) => {
											Object.values(data_for_xy).forEach((vehicle_data) => {
												let route_id = vehicle_data.trip?.route_id;

												if (route_id) {
													if (route_cache_current[chateau_id] == undefined) {
														should_fetch_routes = true;
													} else {
														if (route_cache_current[chateau_id][route_id] == undefined) {
															should_fetch_routes = true;
														}
													}
												}
											});
										});
									});

									// console.log('set all as ', realtime_vehicle_locations[category][chateau_id])
								} else {
									//category_data.vehicle_positions is an x, y structure Record<number, Record<number, Record<string, any>>>
									Object.entries(category_data.vehicle_positions).forEach(([x, data_for_x]) => {
										Object.entries(data_for_x).forEach(([y, data_for_xy]) => {
											if (realtime_vehicle_locations[category][chateau_id][x] == undefined) {
												realtime_vehicle_locations[category][chateau_id][x] = {};
											}

											realtime_vehicle_locations[category][chateau_id][x][y] = data_for_xy;

											Object.entries(data_for_xy).forEach(([rt_id, vehicle_data]) => {
												let route_id = vehicle_data.trip?.route_id;

												if (route_id) {
													if (route_cache_current[chateau_id] == undefined) {
														should_fetch_routes = true;
													} else {
														if (route_cache_current[chateau_id][route_id] == undefined) {
															should_fetch_routes = true;
														}
													}
												}
											});

											if (category_data.list_of_agency_ids) {
												category_data.list_of_agency_ids.forEach((agency_id) => {
													list_of_agency_ids_to_fetch.push(agency_id);
												});
											}
											//console.log('set data for', chateau_id, category, x, y, data_for_xy)
										});
									});
								}

								rerender_category.add(category);
							}
						} else {
							//console.log('no category data for', category, chateau_id);
						}
					});
				}

				if (should_fetch_routes) {
					//console.log('should fetch routes')
					fetch_routes_of_chateau_by_agency(
						chateau_id,
						list_of_agency_ids_to_fetch.filter((v, i, a) => a.indexOf(v) === i),
						rerender_category
					);
				}
			}
		);

		return realtime_vehicle_locations;
	});

	realtime_vehicle_locations_last_updated_store.update(
		(realtime_vehicle_locations_last_updated) => {
			Object.entries(response_from_birch_vehicles_2.chateaus).forEach(
				([chateau_id, chateau_data]) => {
					//console.log('chateau', chateau_id, chateau_data);

					if (chateau_data.categories) {
						Object.entries(chateau_data.categories).forEach(([category, category_data]) => {
							if (category_data != null) {
								if (!realtime_vehicle_locations_last_updated[chateau_id]) {
									realtime_vehicle_locations_last_updated[chateau_id] = {};
								}

								realtime_vehicle_locations_last_updated[chateau_id][category] =
									category_data.last_updated_time_ms;
							} else {
								//console.log('no category data for', category, chateau_id);
							}
						});
					}
				}
			);

			return realtime_vehicle_locations_last_updated;
		}
	);

	//console.log('rerendering', rerender_category);

	rerender_category.forEach((category) => {
		rerender_category_live_dots(category, map);
	});
}

export function rerender_category_live_dots(category: string, map: maplibregl.Map) {
	const darkMode = determineDarkModeToBool();
	const realtime_vehicle_locations = get(realtime_vehicle_locations_storev2);
	const route_cache_data = get(route_cache);
	const usunits = get(usunits_store);
	//console.log( category, 'data contains', realtime_vehicle_locations[category]);

	const source_name: string = category_name_to_source_name(category);

	const source = map.getSource(source_name) as maplibregl.GeoJSONSource;

	//console.log(Object.entries(realtime_vehicle_locations[category]))

	const features = Object.entries(realtime_vehicle_locations[category])
		.map(([chateau_id, grid_data]) => {
			const chateau_vehicles_list: Record<string, AspenisedVehiclePositionOutput> = {};

			if (grid_data) {
				Object.values(grid_data).forEach((y_data) => {
					if (y_data) {
						Object.values(y_data).forEach((vehicles) => {
							if (vehicles) {
								Object.assign(chateau_vehicles_list, vehicles);
							}
						});
					}
				});
			}

			//console.log("chateau_vehicles_list", chateau_vehicles_list)

			return Object.entries(chateau_vehicles_list)
				.filter(
					(entry): entry is [string, PositionedVehicle] => entry[1].position != null
				)
				.filter(([rt_id, vehicle_data]) => {
					if (
						vehicle_data.position.latitude == 34.099503 &&
						vehicle_data.position.longitude == -117.29602
					) {
						return false;
					}
					if (
						vehicle_data.position.latitude == 34.250793 &&
						vehicle_data.position.longitude == -119.205025
					) {
						return false;
					}
					if (
						vehicle_data.position.latitude == 34.05573 &&
						vehicle_data.position.longitude == -118.23351
					) {
						return false;
					} else {
						return true;
					}
				})
				.map(([rt_id, vehicle_data]) => {
					return processVehicleFeature(
						rt_id,
						vehicle_data,
						chateau_id,
						route_cache_data,
						darkMode,
						usunits
					);
				})
				.filter((x) => x != null);
		})
		.flat();

	//	console.log('rerendering', category, 'with', features);

	if (source) {
		//console.log("new features", features);

		source.setData({
			type: 'FeatureCollection',
			features: features
		});
	} else {
		console.error('no source for', source_name);
	}
}

function translate(key: string, options?: Record<string, unknown>): string {
	return get(_)(key, options);
}
