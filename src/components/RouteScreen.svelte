<script lang="ts">
	import { batchFetchShapes } from '../utils/shape_api';
	import { json } from '@sveltejs/kit';
	import { RouteStack, SingleTrip, StackInterface, StopStack } from './stackenum';
	import { onDestroy, onMount } from 'svelte';
	import { date, locale, locales } from 'svelte-i18n';
	import { isLoading } from 'svelte-i18n';
	import { _ } from 'svelte-i18n';
	import RouteIcon from './RouteIcon.svelte';
	import { titleCase } from './../utils/titleCase';
	import { lightenColour } from './lightenDarkColour';
	import DelayDiff from './DelayDiff.svelte';
	import TimeDiff from './TimeDiff.svelte';
	import AlertBox from './serviceAlerts.svelte';
	import { writable, get } from 'svelte/store';
	import {
		fixHeadsignIcon,
		fixHeadsignText,
		fixRouteIcon,
		fixRouteName,
		fixRouteNameLong,
		fixRunNumber,
		fixStationName
	} from './agencyspecific';
	let is_loading_trip_data: boolean = true;
	let trip_data: Record<string, any> | null = null;
	let init_loaded = 0;
	let timezones: string[] = [];
	let error: string | null = '';
	let stoptimes_cleaned_dataset: Array<Record<string, any>> = [];
	let current_time: number = Date.now();
	let fetchtimeout: NodeJS.Timeout | null = null;
	let updatetimecounter: NodeJS.Timeout | null = null;
	let show_previous_stops: boolean = false;
	let bind_scrolling_div: null | HTMLElement = null;

	import {
		has_schedule_pdf,
		find_schedule_pdf_initial,
		schedule_pdf_needs_hydration,
		find_schedule_pdf
	} from './pdf_schedules';

	import {
		data_stack_store,
		on_sidebar_trigger_store,
		realtime_vehicle_locations_last_updated_store,
		realtime_vehicle_locations_store,
		realtime_vehicle_route_cache_hash_store,
		realtime_vehicle_route_cache_store,
		lock_on_gps_store,
		usunits_store,
		show_zombie_buses_store,
		show_my_location_store,
		show_gtfs_ids_store,
		custom_icons_category_to_layer_id,
		map_pointer_store,
		stops_to_hide_store
	} from '../globalstores';
	import { determineDarkModeToBool } from './determineDarkModeToBool';
	import { refilter_stops, delete_filter_stops_background } from './makeFiltersForStop';
	import { occupancy_to_symbol } from './occupancy_to_symbol';
	import TripDataForVehicleOnRouteScreen from './TripDataForVehicleOnRouteScreen.svelte';
	import ConsolidatedRouteList from './ConsolidatedRouteList.svelte';
	import HomeButton from './SidebarParts/home_button.svelte';
	import CopyLinkButton from './CopyLinkButton.svelte';

	let activePattern: string = '';

	let show_gtfs_ids = get(show_gtfs_ids_store);

	show_gtfs_ids_store.subscribe((value) => {
		show_gtfs_ids = value;
	});

	let stop_id_to_alert_ids: Record<string, string[]> = {};

	let alerts: Record<string, any> = {};

	export let routestack: RouteStack;

	export let darkMode: boolean = determineDarkModeToBool();

	let initial_data_load = {};

	let loaded = false;

	let route_data: any = null;

	let pdf_url: string | null = null;

	let vehicle_interval: NodeJS.Timeout | null = null;

	let vehicle_positions: Record<string, any> = null;

	let trip_updates_by_trip_id: Record<string, any[]> = {};

	let vehicles_under_direction_id: Record<string, string[]> = {};

	let vehicles_under_direction_id_parent: Record<string, string[]> = {};

	let count_per_direction_store: Record<string, number> = {};
	let count_per_direction_parent_store: Record<string, number> = {};

	let stop_connections: Record<string, any[]> = {};

	let route_rt_last_updated: null | number = null;

	let new_directions_from_parent_store: Record<string, string[]> = {};

	let sort_order_of_dir_parents_store: string[] = [];

	let fetched_shapes: Record<string, any> = {};

	function fix_route_url(x: string): string {
		if (x.includes('foothilltransit.org') && !x.includes('www.foothilltransit.org')) {
			return x.replace('foothilltransit.org', 'www.foothilltransit.org');
		} else {
			return x;
		}
	}

	let isPinned = false;
	const LS_KEY = 'pinned_routes_v1';

	function cleanRouteId(id: string) {
		return id.replace(/^\"/, '').replace(/\"$/, '');
	}
	function keyForRoute(chateau_id: string, route_id: string) {
		return `${chateau_id}:${cleanRouteId(route_id)}`;
	}
	function readPins(): string[] {
		try {
			return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
		} catch {
			return [];
		}
	}
	function writePins(pins: string[]) {
		localStorage.setItem(LS_KEY, JSON.stringify([...new Set(pins)]));
	}
	function refreshPinnedState() {
		if (!routestack) return;
		const k = keyForRoute(routestack.chateau_id, routestack.route_id);
		isPinned = readPins().includes(k);
	}
	function togglePin() {
		if (!routestack) return;
		const k = keyForRoute(routestack.chateau_id, routestack.route_id);
		const pins = readPins();
		if (pins.includes(k)) {
			writePins(pins.filter((p) => p !== k));
			isPinned = false;
		} else {
			pins.push(k);
			writePins(pins);
			isPinned = true;
		}
	}

	async function fetch_shape(chateau: string, shape_id: string) {
		if (fetched_shapes[shape_id]) {
			return fetched_shapes[shape_id];
		}

		try {
			const result = await batchFetchShapes([{ chateau, shape_id }], {
				format: 'geojson',
				simplify: 10
			});
			// result is { [shape_id]: geometry }
			if (result[shape_id]) {
				const data = result[shape_id];
				fetched_shapes[shape_id] = data;
				return data;
			}
		} catch (e) {
			console.error('Error fetching shape', e);
		}
		return null;
	}

	async function change_active_pattern(pattern: string) {
		activePattern = pattern;

		let map = get(map_pointer_store);

		let directionIdFirst = new_directions_from_parent_store[pattern][0];
		let directionReference = route_data.direction_patterns[directionIdFirst];

		let shape_id = directionReference.direction_pattern.gtfs_shape_id;

		//console.log('shapeid', shape_id);

		if (shape_id) {
			let geojson_polyline: any = null;

			// Check if we have the shape, or fetch it
			if (fetched_shapes[shape_id]) {
				geojson_polyline = fetched_shapes[shape_id];
			} else {
				// Fetch it
				let shape_data = await fetch_shape(routestack.chateau_id, shape_id);
				if (shape_data) {
					geojson_polyline = shape_data;
				}
			}

			if (geojson_polyline) {
				// The new backend returns a Geometry (if asking for geojson), we need to wrap it in a Feature
				// Or if it returns the full geojson structure from the tool description it says:
				// "Default to GeoJSON ... GeoJson::Geometry(geometry)" which is just the geometry object if to_string() is called on that variant directly?
				// Wait, the user provided backend says: `GeoJson::Geometry(geometry)` and `body(geojson.to_string())`.
				// GeoJson enum to_string() usually produces `{"type": "LineString", "coordinates": [...]}` if it's a geometry variant.
				// So we need to wrap it in a Feature.

				let feature = {
					type: 'Feature',
					geometry: geojson_polyline.type ? geojson_polyline : geojson_polyline.geometry, // Handle if it returns geometry directly or wrapped
					properties: {
						text_color: route_data.text_color,
						color: route_data.color,
						route_label: route_data.route_short_name || route_data.route_long_name
					}
				};

				// Double check if fetch_shape returns the geometry directly or a feature.
				// The backend returns `GeoJson::Geometry`.
				// So `data` will be `{ "type": "LineString", "coordinates": [...] }`.

				if (!feature.geometry && geojson_polyline.coordinates) {
					feature.geometry = geojson_polyline;
				}

				let geojson_source_new = {
					type: 'FeatureCollection',
					features: [feature]
				};

				if (map.getSource('transit_shape_context')) {
					map.getSource('transit_shape_context').setData(geojson_source_new);
				}

				if (map.getSource('transit_shape_context_detour')) {
					map.getSource('transit_shape_context_detour').setData({
						type: 'FeatureCollection',
						features: []
					});
				}
			}

			//now work on stops

			let already_seen_stop_ids: string[] = [];

			let stops_features = directionReference.rows
				.filter((eachstoptime: any) => {
					if (already_seen_stop_ids.indexOf(eachstoptime.stop_id) === -1) {
						already_seen_stop_ids.push(eachstoptime.stop_id);
						return true;
					}
					return false;
				})
				.map((eachstoptime: any) => {
					let parentStopOrStopId = eachstoptime.stop_id;

					if (route_data.stops[eachstoptime.stop_id]) {
						if (route_data.stops[eachstoptime.stop_id].parent_station) {
							parentStopOrStopId = route_data.stops[eachstoptime.stop_id].parent_station;
						}
					}

					let refStop = route_data.stops[parentStopOrStopId];

					return {
						type: 'Feature',
						properties: {
							label: refStop.name
								.replace('Station ', '')
								.replace(' Station', '')
								.replace(', Bahnhof', '')
								.replace(' Banhhof', '')
								.replace('Estación de tren ', '')
								.replace(' Metrolink', '')
								.replace('Northbound', 'N.B.')
								.replace('Eastbound', 'E.B.')
								.replace('Southbound', 'S.B.')
								.replace('Westbound', 'W.B.')
								.replace(' (Railway) ', '')
								.replace(' Light Rail', '')
								.replace(' Amtrak', '')
								.replace(' Transportation Center', ''),
							stop_id: eachstoptime.stop_id,
							chateau: eachstoptime.chateau_id,
							stop_route_type: route_data.route_type
						},
						geometry: {
							coordinates: [refStop.longitude, refStop.latitude],
							type: 'Point'
						}
					};
				});

			let stop_source_new = {
				type: 'FeatureCollection',
				features: stops_features
			};

			if (map.getSource('stops_context')) {
				map.getSource('stops_context').setData(stop_source_new);
			}

			//hide from background

			stops_to_hide_store.set({
				[routestack.chateau_id]: directionReference.rows.map(
					(eachstoptime: any) => eachstoptime.stop_id
				)
			});

			refilter_stops();
		}
	}

	async function fetch_vehicles_for_route() {
		let map = get(map_pointer_store);

		//console.log('fetch vehicles for route', routestack.chateau_id, routestack.route_id);

		if (routestack.chateau_id && routestack.route_id) {
			let url = new URL(
				`https://birch_rt.catenarymaps.org/get_rt_of_single_route?chateau=${encodeURIComponent(routestack.chateau_id)}&route_id=${encodeURIComponent(routestack.route_id.replace(/^\"/, '').replace(/\"$/, ''))}${route_rt_last_updated ? '&last_updated_time_ms=' + route_rt_last_updated : ''}`
			);

			await fetch(url.toString()).then(async (response) => {
				let text = await response.text();
				try {
					const data = JSON.parse(text);

					//	console.log('data', data);

					if (data.vehicle_positions) {
						vehicle_positions = data.vehicle_positions;
					}

					route_rt_last_updated = data.last_updated_time_ms;

					let trip_updates_by_trip_id_tmp: Record<string, any[]> = {};

					let count_per_direction_id: Record<string, number> = {};
					let count_per_direction_id_parent: Record<string, number> = {};

					let vehicles_under_direction_id_temp: Record<string, string[]> = {};

					let vehicles_under_direction_id_parent_temp: Record<string, string[]> = {};

					for (const vehicle_update_key in vehicle_positions) {
						//console.log(vehicle_update_key)

						let trip_id = vehicle_positions[vehicle_update_key].trip.trip_id;

						if (trip_id) {
							let trip_compressed = data.trips_to_trips_compressed[trip_id];

							if (trip_compressed) {
								let direction_id =
									data.itinerary_to_direction_id[trip_compressed.itinerary_pattern_id];

								let direction_parent =
									route_data.direction_patterns[direction_id].direction_pattern
										.direction_pattern_id_parents ||
									route_data.direction_patterns[direction_id].direction_pattern
										.direction_pattern_id;

								//console.log('direction parent', direction_parent);

								if (count_per_direction_id_parent[direction_parent] == undefined) {
									count_per_direction_id_parent[direction_parent] = 1;
								} else {
									count_per_direction_id_parent[direction_parent] =
										count_per_direction_id_parent[direction_parent] + 1;
								}

								if (count_per_direction_id[direction_id] == undefined) {
									count_per_direction_id[direction_id] = 1;
								} else {
									count_per_direction_id[direction_id] = count_per_direction_id[direction_id] + 1;
								}

								if (vehicles_under_direction_id_temp[direction_id] == undefined) {
									vehicles_under_direction_id_temp[direction_id] = [vehicle_update_key];
								} else {
									vehicles_under_direction_id_temp[direction_id].push(vehicle_update_key);
								}

								if (vehicles_under_direction_id_parent_temp[direction_parent] == undefined) {
									vehicles_under_direction_id_parent_temp[direction_parent] = [vehicle_update_key];
								} else {
									vehicles_under_direction_id_parent_temp[direction_parent].push(
										vehicle_update_key
									);
								}
							}
						}
					}

					for (const trip_update of data.trip_updates) {
						if (trip_updates_by_trip_id_tmp[trip_update.trip.trip_id] == undefined) {
							trip_updates_by_trip_id_tmp[trip_update.trip.trip_id] = [trip_update];
						} else {
							trip_updates_by_trip_id_tmp[trip_update.trip.trip_id].push(trip_update);
						}
					}

					//console.log(count_per_direction_id);

					count_per_direction_store = count_per_direction_id;
					vehicles_under_direction_id = vehicles_under_direction_id_temp;
					vehicles_under_direction_id_parent = vehicles_under_direction_id_parent_temp;
					trip_updates_by_trip_id = trip_updates_by_trip_id_tmp;
					count_per_direction_parent_store = count_per_direction_id_parent;
				} catch (e) {}
			});
		}
	}

	async function fetch_route_selected() {
		let map = get(map_pointer_store);

		map.getSource('transit_shape_context').setData({
			type: 'FeatureCollection',
			features: []
		});

		map.getSource('stops_context').setData({
			type: 'FeatureCollection',
			features: []
		});

		//insert pdf urls

		if (has_schedule_pdf(routestack.chateau_id)) {
			pdf_url = find_schedule_pdf_initial(routestack.chateau_id, routestack.route_id);
		}

		if (schedule_pdf_needs_hydration(routestack.chateau_id)) {
			find_schedule_pdf(routestack.chateau_id, routestack.route_id)
				.then((answer) => (pdf_url = answer))
				.catch((pdferr) => console.error(pdferr));
		}

		let url = new URL(
			`https://birch.catenarymaps.org/route_info_v2?chateau=${encodeURIComponent(routestack.chateau_id)}&route_id=${encodeURIComponent(routestack.route_id.replace(/^\"/, '').replace(/\"$/, ''))}`
		);

		await fetch(url.toString()).then(async (response) => {
			let text = await response.text();
			try {
				//console.log('route text', text);
				const data = JSON.parse(text);
				//console.log('route data', data);

				let map_pointer = get(map_pointer_store);

				if (map_pointer) {
					//
					//	data.bounding_box looks like {min: {x: -118.2673293111, y: 34.0328646001}, max: {x: -118.0409533505, y: 34.08138}}

					let current_bounds = map_pointer.getBounds();

					if (
						(data.bounding_box &&
							current_bounds.contains([data.bounding_box.min.x, data.bounding_box.min.y]) &&
							current_bounds.contains([data.bounding_box.max.x, data.bounding_box.max.y])) ||
						map.getZoom() < 4
					) {
						//do nothing, already in bounds
					} else if (data.bounding_box) {
						map_pointer.fitBounds([
							[data.bounding_box.min.x, data.bounding_box.min.y],
							[data.bounding_box.max.x, data.bounding_box.max.y]
						]);
					}
				}

				route_data = data;

				// build a per-stop connection map from connections_per_stop + connecting_routes
				let tmp_stop_connections: Record<string, any[]> = {};

				if (route_data.connections_per_stop && route_data.connecting_routes) {
					for (const [base_stop_id, per_chateau] of Object.entries(
						route_data.connections_per_stop as Record<string, Record<string, string[]>>
					)) {
						for (const [chateau_id, route_ids] of Object.entries(
							per_chateau as Record<string, string[]>
						)) {
							const routesForChateau = route_data.connecting_routes[chateau_id] || {};
							for (const route_id of route_ids as string[]) {
								const routeInfo = routesForChateau[route_id];
								if (!routeInfo) continue; // backend might not have details for all

								if (!tmp_stop_connections[base_stop_id]) {
									tmp_stop_connections[base_stop_id] = [];
								}

								tmp_stop_connections[base_stop_id].push({
									chateau_id,
									route_id,
									route: routeInfo
								});
							}
						}
					}
				}

				// Sort connections
				for (const base_stop_id in tmp_stop_connections) {
					tmp_stop_connections[base_stop_id].sort((a, b) => {
						const typeOrder: Record<number, number> = {
							2: 1, // Rail
							1: 2, // Subway, Metro
							0: 3, // Tram, Streetcar, Light rail
							4: 4 // Ferry
						};

						const a_type = a.route.route_type;
						const b_type = b.route.route_type;

						const a_order = typeOrder[a_type] ?? 5;
						const b_order = typeOrder[b_type] ?? 5;

						if (a_order !== b_order) {
							return a_order - b_order;
						}

						// Secondary sort by name
						const a_name = a.route.short_name || a.route.long_name || '';
						const b_name = b.route.short_name || b.route.long_name || '';
						return a_name.localeCompare(b_name);
					});
				}

				stop_connections = tmp_stop_connections;

				//make an object based on the direction pattern of parents

				let new_directions_from_parent: Record<string, string[]> = {};

				//iter route_data.direction_patterns

				Object.values(route_data.direction_patterns).forEach((direction_pattern: any) => {
					//console.log('direction pattern', direction_pattern)

					let parent_id =
						direction_pattern.direction_pattern.direction_pattern_id_parents ||
						direction_pattern.direction_pattern.direction_pattern_id;

					new_directions_from_parent[parent_id] = [];

					new_directions_from_parent[parent_id].push(
						direction_pattern.direction_pattern.direction_pattern_id
					);
				});

				new_directions_from_parent_store = new_directions_from_parent;

				console.log('new dirs', Object.entries(new_directions_from_parent_store));

				let sort_order_of_dir_parents = [...Object.keys(new_directions_from_parent_store)];

				sort_order_of_dir_parents.sort((a, b) => {
					let reference_direction_id_a = new_directions_from_parent_store[a][0];
					let reference_direction_id_b = new_directions_from_parent_store[b][0];

					let reference_direction_a = route_data.direction_patterns[reference_direction_id_a];
					let reference_direction_b = route_data.direction_patterns[reference_direction_id_b];

					return reference_direction_a.direction_pattern.headsign_or_destination <
						reference_direction_b.direction_pattern.headsign_or_destination
						? -1
						: 1;
				});

				sort_order_of_dir_parents_store = sort_order_of_dir_parents;

				if (activePattern == '') {
					change_active_pattern(sort_order_of_dir_parents[0]);
				}

				alerts = data.alert_id_to_alert;

				Object.keys(alerts).forEach((alert_id) => {
					let alert = alerts[alert_id];
					alert.informed_entity.forEach((each_entity: any) => {
						if (each_entity.stop_id) {
							if (stop_id_to_alert_ids[each_entity.stop_id] == undefined) {
								stop_id_to_alert_ids[each_entity.stop_id] = [alert_id];
							} else {
								stop_id_to_alert_ids[each_entity.stop_id].push(alert_id);
							}
						}
					});
				});

				loaded = true;
			} catch (err) {
				console.error(err);
			}
		});
	}

	$: if (routestack) {
		fetch_route_selected();

		fetch_vehicles_for_route();

		vehicle_interval = setInterval(() => {
			fetch_vehicles_for_route();
		}, 1000);
	}

	onMount(() => {
		console.log('component mounted');

		fetch_route_selected();

		fetch_vehicles_for_route();

		refreshPinnedState();
		const onStorage = (e: StorageEvent) => {
			if (e.key === LS_KEY) refreshPinnedState();
		};
		window.addEventListener('storage', onStorage);

		return () => {
			delete_filter_stops_background();
			clearInterval(vehicle_interval);
			window.removeEventListener('storage', onStorage);

			let map = get(map_pointer_store);

			if (map) {
				let transit_shape_context_for_stop = map?.getSource('transit_shape_context_for_stop');

				transit_shape_context_for_stop?.setData({ type: 'FeatureCollection', features: [] });

				map
					.getSource('transit_shape_context')
					?.setData({ type: 'FeatureCollection', features: [] });
			}
		};
	});
</script>

{#if loaded == true}
	<div class=" catenary-scroll overflow-y-auto grow" bind:this={bind_scrolling_div}>
		<div class="flex flex-row items-center gap-1 px-3">
			<HomeButton />
			<div class="flex flex-row gap-2 ml-auto mr-2">
				<CopyLinkButton screen="route" chateau={routestack.chateau_id} route_id={routestack.route_id} />
			</div>
		</div>

		<div class="px-3">
			{#await import('./RouteHeading.svelte') then { default: RouteHeading }}
				<RouteHeading
					color={route_data.color}
					route_id={routestack.route_id}
					chateau_id={routestack.chateau_id}
					text={route_data.agency_name}
					compact={false}
					short_name={route_data.short_name}
					long_name={route_data.long_name}
					url={route_data.url}
					{darkMode}
					route_type={route_data.route_type}
					gtfs_desc={route_data.gtfs_desc}
					text_color={route_data.text_color}
					pin_route_setting_shown={true}
				/>
			{:catch error}
				<p class="p-4 text-red-500">Error loading component: {error.message}</p>
			{/await}
		</div>

		{#if show_gtfs_ids}
			<div class="font-mono px-3">
				<div class="text-sm font-mono text-gray-500 dark:text-gray-400">
					Château: <span class="font-bold">{routestack.chateau_id}</span>
					<br />
					Route:
					<span class="font-bold">{routestack.route_id.replace(/^\"/, '').replace(/\"$/, '')}</span>
					<br />
					Feed ID: <span class="font-bold">{route_data.onestop_feed_id}</span>
				</div>
			</div>
		{/if}

		<div class="px-2"><AlertBox chateau={routestack.chateau_id} {alerts} /></div>

		<p class="px-3 text-xl my-1">Directions</p>
		<div class="flex flex-col mr-2 ml-2">
			{#each sort_order_of_dir_parents_store as directionparentid, index}
				{@const directionIdFirst = new_directions_from_parent_store[directionparentid][0]}
				{@const directionReference = route_data.direction_patterns[directionIdFirst]}

				<div
					on:click={() => change_active_pattern(directionparentid)}
					class={`border border-gray-500 py-1 px-1 text-sm  hover:bg-seashore flex rounded-md min-w-36  leading-tight ${directionparentid == activePattern ? 'bg-seashore' : 'bg-white dark:bg-slate-800'}`}
				>
					<p>
						<span>{titleCase(directionReference.direction_pattern.headsign_or_destination)}</span>
						<span class="text-xs"
							>{' ('}{directionReference.rows.length}{' '}{$_('stops')}{' )'}</span
						>
						{#if count_per_direction_parent_store[directionparentid]}
							<span class="relative">
								<span
									class="absolute w-full h-full animate-ping bg-blue-500 rounded-full opacity-30"
								></span>
								<span class="ml-auto rounded-full bg-blue-500 text-white px-1.5"
									>{count_per_direction_parent_store[directionparentid]}</span
								>
							</span>
						{/if}
					</p>
				</div>
			{/each}
		</div>

		<div class="px-3">
			<p class="text-xl my-1">
				{count_per_direction_parent_store[activePattern]
					? count_per_direction_parent_store[activePattern]
					: 0}
				{$_('vehicles')}
			</p>

			<div>
				{#if vehicles_under_direction_id_parent[activePattern]}
					<div class="flex flex-col gap-y-2">
						{#each vehicles_under_direction_id_parent[activePattern].sort() as vehicle_id}
							{#if vehicle_positions[vehicle_id]}
								<div
									class="rounded-md bg-gray-100 dark:bg-gray-800 py-1 px-1"
									on:click={() => {
										data_stack_store.update((data_stack) => {
											data_stack.push(
												new StackInterface(
													new SingleTrip(
														routestack.chateau_id,
														vehicle_positions[vehicle_id].trip.trip_id,
														vehicle_positions[vehicle_id].trip.route_id,
														vehicle_positions[vehicle_id].trip.start_time,
														vehicle_positions[vehicle_id].trip.start_date,
														vehicle_positions[vehicle_id].vehicle?.label,
														null
													)
												)
											);

											return data_stack;
										});
									}}
								>
									<p>
										{#if vehicle_positions[vehicle_id].vehicle}
											{#if vehicle_positions[vehicle_id].vehicle.label}
												{vehicle_positions[vehicle_id].vehicle.label}
											{/if}
										{/if}
									</p>

									{#if trip_updates_by_trip_id[vehicle_positions[vehicle_id].trip.trip_id]}
										<TripDataForVehicleOnRouteScreen
											vehicle={vehicle_positions[vehicle_id]}
											stops={route_data.stops}
											possible_trip_list={trip_updates_by_trip_id[
												vehicle_positions[vehicle_id].trip.trip_id
											]}
										/>
									{/if}

									{#if vehicle_positions[vehicle_id].occupancy_status != null}
										<p
											class={`text-xs ${vehicle_positions[vehicle_id].occupancy_status == 3 ? 'text-amber-600 dark:text-amber-400' : ''} ${[4, 5, 6, 8].includes(vehicle_positions[vehicle_id].occupancy_status) ? 'text-red-600 dark:text-red-400' : ''}`}
										>
											{$_('occupancy_status')}:
											<span class="rounded-full px-0.5 py-0.5"
												>{occupancy_to_symbol(vehicle_positions[vehicle_id].occupancy_status)}</span
											>
											{#if vehicle_positions[vehicle_id].occupancy_status == 0}
												{$_('occupancy_status_empty')}
											{:else if vehicle_positions[vehicle_id].occupancy_status == 1}
												{$_('occupancy_status_many_seats_available')}
											{:else if vehicle_positions[vehicle_id].occupancy_status == 2}
												{$_('occupancy_status_few_seats_available')}
											{:else if vehicle_positions[vehicle_id].occupancy_status == 3}
												{$_('occupancy_status_standing_room_only')}
											{:else if vehicle_positions[vehicle_id].occupancy_status == 4}
												{$_('occupancy_status_crushed_standing_room_only')}
											{:else if vehicle_positions[vehicle_id].occupancy_status == 5}
												{$_('occupancy_status_full')}
											{:else if vehicle_positions[vehicle_id].occupancy_status == 6}
												{$_('occupancy_status_not_accepting_passengers')}
											{:else if vehicle_positions[vehicle_id].occupancy_status == 7}
												{$_('occupancy_status_no_data')}
											{:else if vehicle_positions[vehicle_id].occupancy_status == 8}
												{$_('occupancy_status_not_boardable')}
											{/if}
										</p>{/if}

									<!--

							<button class="rounded-full bg-blue-500 px-1 py-1 text-xs w-6 h-6 flex flex-col "
							on:click={() => {
								data_stack_store.update(
									(data_stack) => {
										data_stack.push(
											new StackInterface(
												new SingleTrip(
													routestack.chateau_id,
													vehicle_positions[vehicle_id].trip.trip_id,
													vehicle_positions[vehicle_id].trip.route_id,
													vehicle_positions[vehicle_id].trip.start_time,
													vehicle_positions[vehicle_id].trip.start_date,
													null,
													null
												)
											)
										);

										return data_stack;
									}
								)
							}}
							>
								<span class="material-symbols-outlined align-middle leading-none" style="
    line-height: 0;
">
							<span class="text-sm">open_in_new</span>
							</span>
							</button>-->
								</div>
							{/if}
						{/each}
					</div>
				{:else}{/if}
			</div>
		</div>

		<div class="grow pt-2 flex flex-col">
			{#if activePattern != ''}
				{@const directionIdFirst = new_directions_from_parent_store[activePattern][0]}
				{@const directionReference = route_data.direction_patterns[directionIdFirst]}
				{#each directionReference.rows as stop, index}
					{@const stopRefOriginal = route_data.stops[stop.stop_id]}
					{#if stopRefOriginal != undefined}
						{@const stopRefParentId = route_data.stops[stop.stop_id].parent_station}
						{@const stopRefToUse = stopRefParentId
							? route_data.stops[stopRefParentId]
							: stopRefOriginal}

						{@const stopKeyParent = stopRefParentId}
						{@const stopKeyChild = stop.stop_id}
						{@const connectionKey =
							stopKeyParent && stop_connections[stopKeyParent]
								? stopKeyParent
								: stop_connections[stopKeyChild]
									? stopKeyChild
									: null}

						<div
							aria-label={'Go to stop' + stopRefToUse.name}
							class="relative px-3 underline decoration-sky-500/80 hover:decoration-sky-500 cursor-pointer"
							on:click={() => {
								data_stack_store.update((stack) => {
									stack.push(
										new StackInterface(new StopStack(routestack.chateau_id, stop.stop_id))
									);

									return stack;
								});
							}}
							on:keydown={(e) => {
								if (e.key == 'Enter') {
									data_stack_store.update((stack) => {
										stack.push(
											new StackInterface(new StopStack(routestack.chateau_id, stopRefToUse))
										);

										return stack;
									});
								}
							}}
						>
							{#if index != directionReference.rows.length - 1}
								{#if index != 0}
									<div
										class={`absolute top-0 bottom-0 left-3 w-2 h-full z-30 `}
										style:background-color={route_data.color}
									></div>
								{/if}
							{:else}
								<div
									class={`absolute top-0 h-[16px] left-3 w-2 z-30 rounded-b-full`}
									style:background-color={route_data.color}
								></div>
							{/if}

							{#if index == 0}
								<div
									class={`top-[8px] rounded-t-full absolute bottom-0 left-3 w-2 h-full z-30 `}
									style:background-color={route_data.color}
								></div>
							{/if}
							<div
								class={`absolute top-[8px] bottom-1/2 left-2.5 w-3 h-3 rounded-full bg-white z-40 border-2`}
								style:border-color={route_data.color}
							></div>
							<span class="text-sm relative ml-[16px] translate-y-px"
								>{fixStationName(stopRefToUse.name)}</span
							>
							{#if stopRefToUse.code}
								<span
									class="text-sm relative ml-1 translate-y-px font-light dark:text-gray-400 text-gray-700"
									>{' ['}{fixStationName(stopRefToUse.code)}{']'}</span
								>
							{/if}
							{#if show_gtfs_ids}
								<span class="text-xs text-gray-600 dark:text-gray-200 bg-blue-200 dark:bg-blue-900"
									>{stop.stop_id}</span
								>
							{/if}

							{#if connectionKey}
								<div class="flex flex-row flex-wrap gap-x-1 gap-y-1 ml-4 mt-1 font-sm">
									<ConsolidatedRouteList connections={stop_connections[connectionKey]} {darkMode} />
								</div>
							{/if}
						</div>
					{/if}
				{/each}
			{/if}

			<br />

			<br />
		</div>
	</div>
{:else}
	<div class="w-full p-2 flex flex-col gap-y-2">
		<div class="h-5 w-1/2 bg-slate-400 dark:bg-slate-800 rounded-lg animate-pulse"></div>
		<div class="h-3 w-1/4 bg-slate-400 dark:bg-slate-800 rounded-lg animate-pulse"></div>
		<div class="h-3 w-2/5 bg-slate-400 dark:bg-slate-800 rounded-lg animate-pulse"></div>
	</div>
{/if}
