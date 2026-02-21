<script lang="ts">
	let departure_list: any[] = [];

	// We will hold the parsed data here
	let v3_long_distance: any[] = [];
	let v3_local: any[] = [];
	let v3_routes: Record<string, Record<string, any>> = {};
	let v3_agencies: Record<string, Record<string, any>> = {};
	let v3_stops: Record<string, Record<string, any>> = {};

	// This is the flattened list for main display
	// Type: { type: 'station' | 'route_group', data: any, sortDistance: number }
	let display_items: any[] = [];
	export let usunits: boolean = false;
	export let darkMode: boolean = true;

	import { onMount } from 'svelte';
	import { writable, get } from 'svelte/store';
	import { _, locale } from 'svelte-i18n';
	import DelayDiff from './DelayDiff.svelte';
	import TimeDiff from './TimeDiff.svelte';
	import type { Writable } from 'svelte/store';
	import * as maplibregl from 'maplibre-gl';
	import { booleanPointInPolygon, point } from '@turf/turf';
	import TidbitSidebarCard from './SidebarParts/tidbits.svelte';
	import StationScreenTrainRowCompact from './StationScreenTrainRowCompact.svelte';

	const onbutton = 'bg-blue-300 dark:bg-blue-500 bg-opacity-80';
	const offbutton = '';

	export let is_inside_eurostyle = false;
	let eurostyle_geojson: any = null;

	const TIME_CUTOFF = 64800;
	const TIME_PREVIOUS_CUTOFF = 10 * 60;

	import {
		ui_theme_store,
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
		custom_icons_category_to_layer_id,
		map_pointer_store,
		geolocation_store,
		nearby_deps_cache_gps,
		nearby_departures_filter,
		nearby_pick_state_store,
		nearby_user_picks_store,
		show_gtfs_ids_store
	} from '../globalstores';

	import type { UserPicksNearby, NearbySelectionFilterRouteType } from '../globalstores';

	import haversine from 'haversine-distance';

	// --- Pinned routes (shared with Route page) ---
	const LS_KEY = 'pinned_routes_v1';
	let pinnedSet = new Set<string>();

	function cleanRouteId(id: string) {
		return id?.replace(/^\"/, '').replace(/\"$/, '') ?? id;
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
	function refreshPinnedSet() {
		const next = new Set(readPins());
		if (next.size !== pinnedSet.size) {
			pinnedSet = next;
			return;
		}
		for (const k of next) {
			if (!pinnedSet.has(k)) {
				pinnedSet = next;
				return;
			}
		}
	}
	function isPinnedRoute(chateau_id: string, route_id: string) {
		return pinnedSet.has(keyForRoute(chateau_id, route_id));
	}

	let should_show_symbol_sign_nearby = false;

	let locale_local = get(locale);

	$: if (
		locale_local.startsWith('fr') ||
		locale_local.startsWith('de') ||
		locale_local.startsWith('ja')
	) {
		should_show_symbol_sign_nearby = true;
	}

	// Helper function to get effective departure time for v3 local departures
	// Uses realtime_departure if available, otherwise uses arrival_realtime if it's
	// greater than departure_schedule, otherwise falls back to departure_schedule
	function getEffectiveStationRealtimeDeparture(departure: any): number | null {
		if (departure.realtime_departure != null) {
			return departure.realtime_departure;
		}
		if (
			departure.realtime_arrival != null &&
			departure.realtime_arrival > departure.scheduled_departure
		) {
			return departure.realtime_arrival;
		}
		return null;
	}

	function getEffectiveDepartureTime(trip: any): number | null {
		if (trip.departure_realtime != null) {
			return trip.departure_realtime;
		}
		if (trip.arrival_realtime != null && trip.arrival_realtime > trip.departure_schedule) {
			return trip.arrival_realtime;
		}
		return trip.departure_schedule;
	}

	let current_nearby_pick_state = get(nearby_pick_state_store);

	nearby_pick_state_store.subscribe((x) => {
		current_nearby_pick_state = x;
	});

	function filter_for_route_type(
		route_type: number,
		nearby_departures_filter_local: NearbySelectionFilterRouteType
	) {
		if ([3, 11, 700].includes(route_type)) {
			return nearby_departures_filter_local.bus;
		}
		if ([0, 1, 5, 7, 12, 900].includes(route_type)) {
			return nearby_departures_filter_local.metro;
		}
		if ([2, 106, 107, 101, 100, 102, 103].includes(route_type)) {
			return nearby_departures_filter_local.rail;
		}
		return true; // Default
	}

	import { SingleTrip, StackInterface, StopStack, RouteStack } from './stackenum';
	import jsonwebworkerpkg from '@cheprasov/json-web-worker';
	const { jsonWebWorker, parse, stringify } = jsonwebworkerpkg;
	import { t } from 'svelte-i18n';
	import {
		fixHeadsignText,
		fixRouteName,
		fixRouteNameLong,
		fixStationName
	} from './agencyspecific';
	import { titleCase } from '../utils/titleCase';
	import { lightenColour } from './lightenDarkColour';
	import { MTA_CHATEAU_ID, isSubwayRouteId } from '../utils/mta_subway_utils';
	import { IDFM_CHATEAU_ID, isRatpRoute } from '../utils/ratp_utils';
	import MtaBullet from './mtabullet.svelte';
	import RatpBullet from './ratpbullet.svelte';

	let nearby_departures_filter_local = { rail: true, bus: true, metro: true, other: true };

	let nearby_rail_show = nearby_departures_filter_local.rail;
	let nearby_bus_show = nearby_departures_filter_local.bus;
	let nearby_metro_show = nearby_departures_filter_local.metro;
	let nearby_other_show = nearby_departures_filter_local.other;

	let show_gtfs_ids = get(show_gtfs_ids_store);

	let abort_controller: AbortController | null = null;

	type SortMode = 'alpha' | 'distance';
	const LS_SORT_KEY = 'nearby_sort_mode_v1';

	let sortMode: SortMode =
    typeof window !== 'undefined'
        ? (localStorage.getItem(LS_SORT_KEY) as SortMode) || 'distance'
        : 'distance';

	function setSortMode(next: SortMode) {
		sortMode = next;
		if (typeof window !== 'undefined') localStorage.setItem(LS_SORT_KEY, next);
		refilter();
	}

	function currentReferenceCoord(): { lat: number; lng: number } | null {
		const mode = get(nearby_pick_state_store);
		if (mode === 1) {
			const pick = get(nearby_user_picks_store);
			if (pick?.latitude && pick?.longitude) return { lat: pick.latitude, lng: pick.longitude };
		} else {
			const geo = get(geolocation_store);
			if (geo?.coords?.latitude && geo?.coords?.longitude) {
				return { lat: geo.coords.latitude, lng: geo.coords.longitude };
			}
		}
		return null;
	}

	nearby_departures_filter.subscribe((x) => {
		nearby_departures_filter_local = get(nearby_departures_filter);
		nearby_rail_show = x.rail;
		nearby_bus_show = x.bus;
		nearby_metro_show = x.metro;
		nearby_other_show = x.other;
		refilter();
	});

	function refilter() {
		// 1. Filter Local Routes
		let filtered_local = v3_local
			.filter(
				(x) =>
					Object.keys(x.headsigns).length > 0 &&
					filter_for_route_type(x.route_type, nearby_departures_filter_local)
			)
			.map((x) => ({ type: 'route_group', data: x, sortDistance: x.closest_distance }));

		// 2. Wrap Stations
		let wrapped_stations = v3_long_distance.map((x) => ({
			type: 'station',
			data: x,
			sortDistance: x.distance_m
		}));

		// 3. Sorting Logic:
		let final_list = [];
		wrapped_stations.sort((a, b) => a.sortDistance - b.sortDistance);

		// Check if the closest station meets the 500m threshold for hoisting
		const should_hoist = wrapped_stations.length > 0 && wrapped_stations[0].sortDistance < 500;

		let mixed = [];

		if (should_hoist) {
			// Hoist the closest station to the top
			final_list.push(wrapped_stations[0]);
			// Mix remaining stations with local routes
			mixed = [...wrapped_stations.slice(1), ...filtered_local];
		} else {
			// No hoisting: mix all stations with local routes
			mixed = [...wrapped_stations, ...filtered_local];
		}

		// Sort the mixed portion (or the entire list if nothing was hoisted)
		mixed.sort((a, b) => {
			// Pin logic (applies only to route_groups)
			let ap = a.type === 'route_group' ? isPinnedRoute(a.data.chateau_id, a.data.route_id) : false;
			let bp = b.type === 'route_group' ? isPinnedRoute(b.data.chateau_id, b.data.route_id) : false;

			if (ap !== bp) return (bp ? 1 : 0) - (ap ? 1 : 0);

			if (sortMode === 'alpha') {
				let an = getName(a).toLowerCase();
				let bn = getName(b).toLowerCase();
				return an.localeCompare(bn, undefined, { numeric: true });
			}

			// Distance sorting
			return a.sortDistance - b.sortDistance;
		});

		display_items = [...final_list, ...mixed];
	}

	function getName(item: any) {
		if (item.type === 'station') return item.data.station_name;
		return item.data.short_name || item.data.long_name || '';
	}

	let current_time: number = 0;
	setInterval(() => {
		current_time = Date.now();
	}, 500);

	let first_load = false;
	let first_attempt_sent = false;
	let timeout_first_attempt: NodeJS.Timeout | null = null;
	let loading = false;
	let marker_reference: maplibregl.Marker | null = null;
	let amount_of_ms_total_server_side: number | null = null;
	export let window_height_known: number = 500;
	let show_filter_menu: boolean = false;

	onMount(() => {
		if (typeof window != 'undefined') {
			const storedSort = (localStorage.getItem(LS_SORT_KEY) as SortMode) || 'distance';
			sortMode = storedSort;

			current_time = Date.now();
			refreshPinnedSet();
			const onStorage = (e: StorageEvent) => {
				if (e.key === LS_KEY) {
					refreshPinnedSet();
					refilter();
				}
			};
			window.addEventListener('storage', onStorage);

			fetch('/eurostyle-ui-rail.geojson')
				.then((res) => res.json())
				.then((data) => {
					eurostyle_geojson = data;
					let ref = currentReferenceCoord();
					if (ref) checkEurostyle(ref.lat, ref.lng);
				})
				.catch((e) => console.error('Failed to load eurostyle geojson', e));

			if (current_nearby_pick_state == 1) {
				let map = get(map_pointer_store);
				if (map) {
					let marker_info = get(nearby_user_picks_store);
					if (marker_reference == null) {
						marker_reference = new maplibregl.Marker({ color: '#ac46ff', draggable: true })
							.setLngLat([marker_info?.longitude, marker_info?.latitude])
							.addTo(map);
						marker_reference.on('dragend', onDragEnd);
					}
					let stops_context = map.getSource('stops_context');
					if (stops_context) {
						stops_context.setData({ type: 'FeatureCollection', features: [] });
					}
				}
			}

			window.addEventListener('resize', () => {
				window_height_known = window.innerHeight;
			});
			window_height_known = window.innerHeight;

			if (current_nearby_pick_state == 0) {
				refilter();
			}

			getNearbyDepartures();
			let interval = setInterval(() => {
				getNearbyDepartures();
			}, 30_000);

			setTimeout(() => {
				getNearbyDepartures();
				first_load = true;
			}, 1500);

			timeout_first_attempt = setInterval(() => {
				if (!first_attempt_sent) {
					getNearbyDepartures();
				} else {
					if (timeout_first_attempt) clearInterval(timeout_first_attempt);
				}
			}, 300);

			return () => {
				clearInterval(interval);
				if (timeout_first_attempt) clearInterval(timeout_first_attempt);
				if (marker_reference) marker_reference.remove();
				window.removeEventListener('storage', onStorage);
			};
		}
	});

	function my_location_press() {
		nearby_pick_state_store.set(0);
		getNearbyDepartures();
	}

	function pin_drop_press() {
		nearby_pick_state_store.set(1);
		let map = get(map_pointer_store);
		if (map) {
			let centre = map.getCenter();
			if (marker_reference == null) makeNewMarker();
			getNearbyDepartures();
		}
	}

	function onDragEnd() {
		if (marker_reference) {
			const lngLat = marker_reference.getLngLat();
			nearby_user_picks_store.set({ latitude: lngLat.lat, longitude: lngLat.lng });
			getNearbyDepartures();
		}
	}

	function makeNewMarker() {
		let map = get(map_pointer_store);
		if (map) {
			let centre = map.getCenter();
			if (marker_reference == null) {
				marker_reference = new maplibregl.Marker({ color: '#ac46ff', draggable: true })
					.setLngLat([centre.lng, centre.lat])
					.addTo(map);
				const lngLat = marker_reference.getLngLat();
				nearby_user_picks_store.set({ latitude: lngLat.lat, longitude: lngLat.lng });
				marker_reference.on('dragend', onDragEnd);
			}
		}
	}

	function centre_press() {
		let map = get(map_pointer_store);
		if (map) {
			let centre = map.getCenter();
			if (marker_reference == null) makeNewMarker();
			marker_reference.setLngLat([centre.lng, centre.lat]);
			nearby_user_picks_store.set({ latitude: centre.lat, longitude: centre.lng });
		}
		pin_drop_press();
	}

	async function getNearbyDepartures() {
		loading = true;
		let query_type = get(nearby_pick_state_store);
		let geolocation_of_user = get(geolocation_store);
		let lat = 0;
		let lng = 0;

		if (query_type == 1) {
			let user_picks = get(nearby_user_picks_store);
			if (user_picks != null) {
				lat = user_picks.latitude;
				lng = user_picks.longitude;
			}
		}

		if (query_type == 0 && geolocation_of_user) {
			lat = geolocation_of_user.coords.latitude;
			lng = geolocation_of_user.coords.longitude;
		}

		if (lat != 0 && lng != 0) {
			checkEurostyle(lat, lng);
			first_attempt_sent = true;
			let url = `https://birch_nearby.catenarymaps.org/nearbydeparturesfromcoordsv3?lat=${lat}&lon=${lng}&limit_per_station=30`;

			if (abort_controller) {
				/* abort_controller.abort(); */
			}
			abort_controller = new AbortController();
			let signal = abort_controller.signal;

			fetch(url, { signal: signal })
				.then((response) => response.text())
				.then((text) => jsonWebWorker.parse(text))
				.then((data) => {
					v3_long_distance = data.long_distance || [];
					v3_local = data.local || [];
					loading = false;

					let raw_routes = data.routes || {};
					let raw_agencies = {};
					for (let chateau in raw_routes) {
						if (!raw_agencies[chateau]) raw_agencies[chateau] = {};
						for (let route_id in raw_routes[chateau]) {
							let r = raw_routes[chateau][route_id];
							if (r.agency_name && !r.agency_id) {
								r.agency_id = r.agency_name;
							}
							if (r.agency_id) {
								raw_agencies[chateau][r.agency_id] = { agency_name: r.agency_name };
							}
						}
					}
					v3_routes = raw_routes;
					v3_agencies = raw_agencies;
					v3_stops = data.stops || {};

					refilter();

					// Optional: Map Updates
					let map = get(map_pointer_store);
					if (map && v3_long_distance.length > 0) {
						let stops_context = map.getSource('stops_context');
						if (stops_context) {
							let features = v3_long_distance.map((station) => ({
								type: 'Feature',
								geometry: {
									type: 'Point',
									coordinates: [station.lon, station.lat]
								},
								properties: {
									name: station.station_name,
									id: station.osm_station_id || 'station' // Fallback if ID missing
								}
							}));
							stops_context.setData({
								type: 'FeatureCollection',
								features: features
							});
						}
					}

					if (query_type == 0) {
						nearby_deps_cache_gps.set(data);
					}
				});
		}
	}

	function sort_headsigns(headsigns: Record<string, any[]>) {
		let entries = Object.entries(headsigns);
		entries.sort((a, b) => a[0].localeCompare(b[0]));
		return entries;
	}

	function checkEurostyle(lat: number, lng: number) {
		if (!eurostyle_geojson) return;
		try {
			const pt = point([lng, lat]);
			let inside = false;
			// Iterate over features in FeatureCollection
			for (const feature of eurostyle_geojson.features) {
				if (booleanPointInPolygon(pt, feature)) {
					inside = true;
					break;
				}
			}
			is_inside_eurostyle = inside;
		} catch (e) {
			console.error('Error checking eurostyle inclusion', e);
		}
	}
</script>

{#if current_time != 0}
	<div class="flex flex-row mb-0.5 md:mb-1">
		<div class="flex flex-row gap-x-1 pl-3">
			<div
				on:click={() => {
					my_location_press();
				}}
				class={`border-2 ${current_nearby_pick_state == 0 ? 'bg-green-200 dark:bg-green-800' : ''} rounded-lg border-green-500 px-1.5 py-1`}
			>
				<span class="material-symbols-outlined mx-auto translate-y-1 text-sm select-none"
					>near_me</span
				>
			</div>

			<div
				class={`border-2  ${current_nearby_pick_state == 1 ? 'bg-purple-200 dark:bg-purple-800 ' : ''} rounded-lg border-purple-500 flex flex-row`}
			>
				<div
					class="px-2 py-0.5 border-r border-gray-500 flex flex-row"
					on:click={() => {
						pin_drop_press();
					}}
				>
					<span class="material-symbols-outlined mx-auto translate-y-1 text-sm select-none"
						>pin_drop</span
					>
				</div>

				<div
					class="px-2 py-0.5 flex flex-row"
					on:click={() => {
						centre_press();
					}}
				>
					<span class="material-symbols-outlined mx-auto translate-y-1 text-sm select-none"
						>center_focus_strong</span
					>
				</div>
			</div>
		</div>

		{#if amount_of_ms_total_server_side != null}
			<div class="align-middle ml-1 my-auto">
				<p class="text-gray-800 dark:text-gray-300 text-sm">{amount_of_ms_total_server_side} ms</p>
			</div>
		{/if}

		<div class="ml-auto pr-2 flex items-center gap-2">
			<div class="flex rounded-full overflow-hidden border-2 border-gray-400 dark:border-gray-600">
				<button
					class={`px-2 py-1 text-sm flex items-center gap-1
				${sortMode === 'alpha' ? 'bg-blue-300 dark:bg-blue-500 bg-opacity-80' : 'bg-gray-300 dark:bg-gray-800'}
				text-gray-800 dark:text-gray-200`}
					aria-pressed={sortMode === 'alpha'}
					on:click={() => setSortMode('alpha')}
					title="Sort A–Z"
				>
					<span class="material-symbols-outlined text-base leading-none -translate-y-0.5"
						>sort_by_alpha</span
					>
				</button>
				<button
					class={`px-2 py-1 text-sm flex items-center gap-1 border-l-2 border-gray-400 dark:border-gray-600
				${sortMode === 'distance' ? 'bg-blue-300 dark:bg-blue-500 bg-opacity-80' : 'bg-gray-300 dark:bg-gray-800'}
				text-gray-800 dark:text-gray-200`}
					aria-pressed={sortMode === 'distance'}
					on:click={() => setSortMode('distance')}
					title="Sort by Distance"
				>
					<span class="material-symbols-outlined text-base leading-none -translate-y-0.5"
						>straighten</span
					>
				</button>
			</div>

			<button
				on:click={() => {
					show_filter_menu = !show_filter_menu;
				}}
				class="px-1 py-1 rounded-full bg-gray-300 dark:bg-gray-800 text-gray-800 dark:text-gray-300"
			>
				<span class="material-symbols-outlined translate-y-1">filter_alt</span>
			</button>
		</div>
	</div>

	{#if !first_attempt_sent && current_nearby_pick_state == 0}
		<p class="italic px-3 pb-2">{$_('waitingforgps')}...</p>
		<p class="italic px-3 pt-1 text-xs">{$_('gpsdisclaimer')}</p>
	{/if}

	<div class="w-full">
		{#if loading}
			<div class="h-1 w-full bg-sky-200 dark:bg-sky-900 overflow-hidden">
				<div class="progress w-full h-full bg-seashore left-right"></div>
			</div>
		{:else}
			<div class="h-1"></div>
		{/if}
	</div>

	{#if show_filter_menu}
		<div class="py-0.5 md:py-2 px-3 flex flex-row gap-x-2 text-sm md:text-base">
			<button
				on:click={() => {
					nearby_departures_filter.update((x) => ({ ...x, rail: !x.rail }));
					refilter();
				}}
				class={`px-2 rounded-full border-black dark:border-white border-2 ${nearby_rail_show == true ? onbutton : ''}`}
				>{$_('headingIntercityRail')}</button
			>
			<button
				on:click={() => {
					nearby_departures_filter.update((x) => ({ ...x, metro: !x.metro }));
					refilter();
				}}
				class={`px-2 rounded-full border-black dark:border-white  border-2  ${nearby_metro_show == true ? onbutton : ''}`}
				>{$_('headingLocalRail')}</button
			>
			<button
				on:click={() => {
					nearby_departures_filter.update((x) => ({ ...x, bus: !x.bus }));
					refilter();
				}}
				class={`px-2 rounded-full border-black dark:border-white  border-2  ${nearby_bus_show == true ? onbutton : ''} `}
				>{$_('headingBus')}</button
			>
			<button
				on:click={() => {
					nearby_departures_filter.update((x) => ({ ...x, other: !x.other }));
					refilter();
				}}
				class={`px-2 rounded-full border-black dark:border-white border-2  ${nearby_other_show == true ? onbutton : ''}`}
				>{$_('headingOther')}</button
			>
		</div>
	{/if}

	<div class=" catenary-scroll overflow-y-auto pb-64 h-full">
		<div class="flex flex-col">
			<TidbitSidebarCard />

			{#each display_items as item}
				<!-- STATION CARD -->
				{#if item.type === 'station'}
					{@const station = item.data}
					<div
						class="px-2 py-2 mb-2 bg-gray-100 dark:bg-gray-800 rounded-lg mx-2 border border-gray-300 dark:border-gray-700 shadow-sm"
					>
						<div
							class="flex flex-row justify-between items-center mb-2 border-b border-gray-300 dark:border-gray-600 pb-1"
						>
							<div class="flex flex-col">
								<h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">
									{station.station_name}
								</h3>
								<span class="text-xs text-gray-500 dark:text-gray-400"
									>{(station.distance_m || 0).toFixed(0)}m</span
								>
							</div>
						</div>

						<table class="w-full text-left border-collapse">
							<tbody>
								{#each station.departures.filter((d) => !d.last_stop).slice(0, 5) as departure}
									<StationScreenTrainRowCompact
										platform={departure.platform}
										eurostyle={is_inside_eurostyle}
										event={{
											chateau: departure.chateau_id,
											trip_id: departure.trip_id,
											route_id: departure.route_id,
											headsign: departure.headsign,
											scheduled_departure: departure.scheduled_departure,
											realtime_departure: getEffectiveStationRealtimeDeparture(departure),
											service_date: departure.service_date,

											trip_cancelled: departure.cancelled,
											trip_deleted: false,
											stop_cancelled: false,
											trip_short_name: departure.trip_short_name
										}}
										show_timediff={false}
										show_agency_name={false}
										data_from_server={{
											routes: v3_routes,
											agencies: v3_agencies,
											stops: v3_stops
										}}
										current_time={current_time / 1000}
										show_seconds={false}
										timezone={station.timezone}
									/>
								{/each}
							</tbody>
						</table>

						<!-- More departures now needs CHATEAU and STOP ID. 
                             Using FIRST departure as guess, or disabling if empty. -->
						{#if station.departures.length > 0}
							<button
								class="w-full mt-2 py-1.5 text-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 rounded transition-colors"
								on:click={() => {
									data_stack_store.update((stack) => {
										stack.push(
											new StackInterface(
												new StopStack(
													station.departures[0].chateau_id,
													station.departures[0].stop_id
												)
											)
										);
										return stack;
									});
								}}
							>
								{$_('more_departures')}
							</button>
						{/if}
					</div>

					<!-- LOCAL ROUTE CARD (REVERTED DESIGN) -->
				{:else if item.type === 'route_group'}
					{@const route_group = item.data}
					{@const isSubway =
						route_group.chateau_id === MTA_CHATEAU_ID && isSubwayRouteId(route_group.route_id)}
					{@const isRatp =
						route_group.chateau_id === IDFM_CHATEAU_ID && isRatpRoute(route_group.short_name)}
					{@const isRail = route_group.route_type == 2}

					<div
						class={`${window_height_known < 600 ? 'mt-0 mb-1' : 'mt-1 mb-1 mb:mb-2'} px-1 mx-1 py-1 md:py-2 bg-gray-100 dark:bg-background rounded-md dark:bg-opacity-50`}
					>
						<div class="flex-row gap-x-1">
							<p
								class={`${window_height_known < 600 ? 'text-lg' : 'text-lg'}
                        ml-1 underline decoration-sky-500/80 hover:decoration-sky-500 cursor-pointer inline leading-none`}
								style={`color: ${darkMode ? lightenColour(route_group.color) : route_group.color}`}
								on:click={() => {
									data_stack_store.update((stack) => {
										stack.push(
											new StackInterface(
												new RouteStack(route_group.chateau_id, route_group.route_id)
											)
										);
										return stack;
									});
								}}
							>
								{#if isSubway && route_group.short_name}
									<MtaBullet route_short_name={route_group.short_name} matchTextHeight={true} />
								{:else if isRatp && route_group.short_name}
									<RatpBullet route_short_name={route_group.short_name} matchTextHeight={true} />
								{:else if route_group.short_name}
									<span class="font-bold mr-1">
										{fixRouteName(
											route_group.chateau_id,
											route_group.short_name,
											route_group.route_id
										)}
									</span>
								{/if}

								{#if route_group.long_name && !isSubway && !isRatp}
									{#if route_group.long_name != route_group.short_name}
										<span class="font-medium">
											{fixRouteNameLong(
												route_group.chateau_id,
												route_group.long_name,
												route_group.route_id
											)}
										</span>
									{/if}
								{/if}

								<span class="font-medium align-bottom ml-1">
									{#if route_group.route_type == 0}
										<span
											class="ml-auto material-symbols-outlined leading-none no-underline select-none text-lg"
										>
											<span class="text-base leading-none">tram</span>
										</span>
									{/if}
									{#if route_group.route_type == 1}
										<span
											class="ml-auto material-symbols-outlined leading-none no-underline select-none text-lg"
										>
											<span class="text-base leading-none">subway</span>
										</span>
									{/if}
									{#if route_group.route_type == 2}
										<span
											class="ml-auto material-symbols-outlined leading-none no-underline select-none text-lg"
										>
											<span class="text-base leading-none">train</span>
										</span>
									{/if}
									{#if route_group.route_type == 4}
										<span
											class="ml-auto material-symbols-outlined leading-none no-underline select-none text-lg"
										>
											<span class="text-base leading-none">ferry</span>
										</span>
									{/if}
								</span>
							</p>

							{#if isPinnedRoute(route_group.chateau_id, route_group.route_id)}
								<span
									class="ml-auto material-symbols-outlined leading-none opacity-80 my-auto mb-1 no-underline select-none"
									aria-label="Pinned route"
									title="Pinned route"
								>
									<span class="text-base leading-none">keep</span>
								</span>
							{/if}
						</div>

						{#each sort_headsigns(route_group.headsigns) as [headsign, trips]}
							<p class="font-medium -translate-x-1 mt-1 mb-1 leading-tight">
								<span
									class="material-symbols-outlined text-md align-middle -translate-y-0.5 select-none"
									>chevron_right</span
								>
								{titleCase(fixHeadsignText(headsign, route_group.chateau_id, route_group.route_id))}
								<!-- Stop Name Button - use stop_name from first trip -->
								{#if trips.length > 0}
									<span
										on:click={() => {
											data_stack_store.update((stack) => {
												stack.push(
													new StackInterface(
														new StopStack(route_group.chateau_id, trips[0].stop_id)
													)
												);

												return stack;
											});
										}}
										class="text-sm bg-white dark:bg-gray-900 inline-block px-1 rounded-sm -translate-y-0.5 ml-1"
									>
										<span class="material-symbols-outlined !text-sm align-middle select-none"
											>distance</span
										>
										{fixStationName(trips[0].stop_name || trips[0].stop_id)}
									</span>
								{/if}
							</p>

							<div class="flex flex-row gap-x-1 overflow-x-auto catenary-scroll">
								{#each trips as trip}
									<button
										class="bg-white dark:bg-gray-900
                                         hover:bg-blue-100 hover:dark:bg-hover
                                         mb-0.5 rounded-sm min-w-16 md:min-w-20 flex justify-center"
										on:click={() => {
											data_stack_store.update((stack) => {
												stack.push(
													new StackInterface(
														new SingleTrip(
															route_group.chateau_id,
															trip.trip_id,
															route_group.route_id,
															null,
															trip.service_date,
															null,
															route_group.route_type
														)
													)
												);
												return stack;
											});
										}}
									>
										<div class="text-center">
											<span
												class={`font-semibold leading-none ${getEffectiveDepartureTime(trip) - current_time / 1000 < -60 ? 'text-gray-600 dark:text-gray-400' : trip.departure_realtime != null || (trip.arrival_realtime != null && trip.arrival_realtime > trip.departure_schedule) ? 'text-seashore dark:text-seashoredark' : ''}`}
											>
												{#if !isRail && (getEffectiveDepartureTime(trip) - current_time / 1000 > 60 || getEffectiveDepartureTime(trip) - current_time / 1000 < -60)}
													<TimeDiff
														large={false}
														show_brackets={false}
														show_seconds={false}
														diff={getEffectiveDepartureTime(trip) - current_time / 1000}
														stylesForUnits={'font-medium'}
													/>
												{:else if isRail}
													<!-- Only Time for Local Rail per User Request -->
												{:else}
													<!-- Bus/Metro (not rail) within 60s -->
													<span class="text-md font-bold">{$_('now')}</span>
												{/if}

												{#if trip.departure_realtime != null || (trip.arrival_realtime != null && trip.arrival_realtime > trip.departure_schedule)}
													<!-- Wifi/Realtime Icon -->
												{/if}
											</span>

											<p class="font-medium text-sm leading-none">
												{new Intl.DateTimeFormat('en-GB', {
													hour: 'numeric',
													minute: 'numeric',
													timeZone: v3_stops[route_group.chateau_id]?.[trip.stop_id]?.timezone // Use trip specific TZ if avail
												}).format(new Date(getEffectiveDepartureTime(trip) * 1000))}
												{#if trip.departure_realtime != null || (trip.arrival_realtime != null && trip.arrival_realtime > trip.departure_schedule)}
													<br />
													<DelayDiff
														diff={getEffectiveDepartureTime(trip) - trip.departure_schedule}
														use_symbol_sign={should_show_symbol_sign_nearby}
														unitsclass="font-normal text-xs"
													/>
												{/if}
											</p>
										</div>
									</button>
								{/each}
							</div>
						{/each}
					</div>
				{/if}
			{/each}
		</div>

		{#if v3_long_distance.length == 0 && v3_local.length == 0 && first_load == true && !loading}
			<br />
			<p>No departures.</p>
			<img src="/premium_photo-1671611799147-68a4f9b3f0e1.avif" alt="No departures found" />
		{/if}
	</div>
{/if}
