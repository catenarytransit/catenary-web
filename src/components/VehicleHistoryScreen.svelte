<script lang="ts">
	import { locale, _ } from 'svelte-i18n';
	import { onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import HomeButton from './SidebarParts/home_button.svelte';
	import { data_stack_store, map_pointer_store } from '../globalstores';
	import { BlockStack, SingleTrip, StackInterface } from './stackenum';
	import { timezone_to_locale } from './timezone_to_locale';
	import VehicleInfo from './vehicle_info.svelte';
	import Clock from './Clock.svelte';
	import DonationPopup from './DonationPopup.svelte';
	import type { RouteHistoryRow, VehicleHistoryLookupResponse } from '$lib/types/backend/birch';
	import type { AspenisedVehiclePosition, PostgresRoute } from '$lib/types/backend/common';

	export let chateau: string | null = null;
	export let unified_agency_id: string | null = null;
	export let vehicle: string;
	export let route_id: string | null = null;

	type VehicleHistoryResponse = Omit<VehicleHistoryLookupResponse, 'agency_name'> & {
		agency_name: string | null;
	};

	let history_data: VehicleHistoryResponse | null = null;
	let grouped_history: Record<string, RouteHistoryRow[]> = {};
	let loading = true;
	let error: string | null = null;
	let last_lookup_key = '';
	let request_sequence = 0;
	let sort_descending = true;
	let vehicle_info_chateau: string | null = null;
	let current_vehicle: AspenisedVehiclePosition | null = null;
	let current_trip_id: string | null = null;
	let current_trip_row: RouteHistoryRow | null = null;
	let realtime_lookup_key = '';
	let realtime_request_sequence = 0;
	let realtime_interval: ReturnType<typeof setInterval> | null = null;
	let pulse_animation_frame: number | null = null;
	let map_context_key = '';

	const CURRENT_VEHICLE_SOURCE = 'vehicle-history-current-position';
	const CURRENT_VEHICLE_PULSE_LAYER = 'vehicle-history-current-position-pulse';
	const CURRENT_VEHICLE_DOT_LAYER = 'vehicle-history-current-position-dot';

	const empty_feature_collection = () => ({ type: 'FeatureCollection', features: [] });

	function group_history(
		rows: RouteHistoryRow[],
		descending: boolean
	): Record<string, RouteHistoryRow[]> {
		const grouped: Record<string, RouteHistoryRow[]> = {};
		const sorted_rows = [...rows].sort((left, right) => {
			const date_comparison = left.operation_date.localeCompare(right.operation_date);
			if (date_comparison !== 0) {
				return descending ? -date_comparison : date_comparison;
			}

			const left_has_time =
				left.unix_start_time != null && Number.isSafeInteger(left.unix_start_time);
			const right_has_time =
				right.unix_start_time != null && Number.isSafeInteger(right.unix_start_time);

			if (left_has_time !== right_has_time) return left_has_time ? -1 : 1;

			if (left_has_time && right_has_time) {
				const time_comparison = left.unix_start_time! - right.unix_start_time!;
				if (time_comparison !== 0) {
					return descending ? -time_comparison : time_comparison;
				}
			}

			return left.trip_id.localeCompare(right.trip_id);
		});

		for (const row of sorted_rows) {
			if (!grouped[row.operation_date]) grouped[row.operation_date] = [];
			grouped[row.operation_date].push(row);
		}

		return grouped;
	}

	function normalise_colour(value: string | null | undefined, fallback: string): string {
		const colour = value?.trim();
		if (!colour) return fallback;
		return colour.startsWith('#') ? colour : `#${colour}`;
	}

	function route_name(route: PostgresRoute | undefined, fallback: string): string {
		return route?.short_name || route?.long_name || fallback;
	}

	function chateau_for_row(row: RouteHistoryRow): string | null {
		return chateau || history_data?.routes?.[row.route_id]?.chateau || null;
	}

	function local_noon_unix_seconds(operation_date: string, timezone: string): number | null {
		const [year, month, day] = operation_date.split('-').map(Number);
		if (![year, month, day].every(Number.isInteger)) return null;

		const target_wall_clock_ms = Date.UTC(year, month - 1, day, 12, 0, 0);
		let candidate_ms = target_wall_clock_ms;
		const formatter = new Intl.DateTimeFormat('en-CA', {
			timeZone: timezone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hourCycle: 'h23'
		});

		for (let attempt = 0; attempt < 4; attempt += 1) {
			const parts = Object.fromEntries(
				formatter
					.formatToParts(new Date(candidate_ms))
					.map(({ type, value }) => [type, value])
			);
			const rendered_wall_clock_ms = Date.UTC(
				Number(parts.year),
				Number(parts.month) - 1,
				Number(parts.day),
				Number(parts.hour),
				Number(parts.minute),
				Number(parts.second)
			);
			const correction_ms = target_wall_clock_ms - rendered_wall_clock_ms;
			candidate_ms += correction_ms;
			if (correction_ms === 0) break;
		}

		const resolved = Object.fromEntries(
			formatter
				.formatToParts(new Date(candidate_ms))
				.map(({ type, value }) => [type, value])
		);
		if (
			Number(resolved.year) !== year ||
			Number(resolved.month) !== month ||
			Number(resolved.day) !== day ||
			Number(resolved.hour) !== 12 ||
			Number(resolved.minute) !== 0 ||
			Number(resolved.second) !== 0
		) {
			return null;
		}

		return Math.floor(candidate_ms / 1000);
	}

	function gtfs_start_time_from_unix(
		unix_start_time: number | null,
		operation_date: string
	): string | null {
		if (unix_start_time == null || !Number.isSafeInteger(unix_start_time)) return null;

		const local_noon = local_noon_unix_seconds(
			operation_date,
			history_data?.agency_timezone || 'UTC'
		);
		if (local_noon == null) return null;

		const reference_midnight = local_noon - 12 * 60 * 60;
		const gtfs_seconds = unix_start_time - reference_midnight;
		if (!Number.isSafeInteger(gtfs_seconds) || gtfs_seconds < 0) return null;

		const hours = Math.floor(gtfs_seconds / 3600);
		const minutes = Math.floor((gtfs_seconds % 3600) / 60);
		const seconds = gtfs_seconds % 60;

		return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
			seconds
		).padStart(2, '0')}`;
	}

	function open_trip(row: VehicleHistoryRow) {
		const route = history_data?.routes?.[row.route_id];
		const row_chateau = chateau_for_row(row);
		if (!row_chateau) return;

		data_stack_store.update((stack) => {
			stack.push(
				new StackInterface(
					new SingleTrip(
						row_chateau,
						row.trip_id,
						row.route_id,
						gtfs_start_time_from_unix(row.unix_start_time, row.operation_date),
						row.operation_date.replaceAll('-', ''),
						vehicle,
						route?.route_type ?? null
					)
				)
			);

			return stack;
		});
	}

	function open_block(row: VehicleHistoryRow) {
		if (!row.block_id) return;
		const row_chateau = chateau_for_row(row);
		if (!row_chateau) return;

		data_stack_store.update((stack) => {
			stack.push(
				new StackInterface(new BlockStack(row_chateau, row.block_id!, row.operation_date))
			);

			return stack;
		});
	}

	function latest_history_row(): RouteHistoryRow | null {
		const rows = history_data?.trip_history || [];
		if (rows.length === 0) return null;

		return [...rows].sort((left, right) => {
			const left_time = left.unix_start_time ?? Number.NEGATIVE_INFINITY;
			const right_time = right.unix_start_time ?? Number.NEGATIVE_INFINITY;
			if (left_time !== right_time) return right_time - left_time;
			return right.operation_date.localeCompare(left.operation_date);
		})[0];
	}

	function open_current_trip() {
		if (current_trip_row) {
			open_trip(current_trip_row);
			return;
		}

		const realtime_trip = current_vehicle?.trip;
		if (!realtime_trip?.trip_id || !vehicle_info_chateau) return;

		const realtime_route = realtime_trip.route_id
			? history_data?.routes?.[realtime_trip.route_id]
			: undefined;

		data_stack_store.update((stack) => {
			stack.push(
				new StackInterface(
					new SingleTrip(
						vehicle_info_chateau!,
						realtime_trip.trip_id,
						realtime_trip.route_id,
						realtime_trip.start_time,
						realtime_trip.start_date?.replaceAll('-', '') ?? null,
						vehicle,
						current_vehicle?.route_type ?? realtime_route?.route_type ?? null
					)
				)
			);

			return stack;
		});
	}

	function clear_pulse_animation() {
		if (pulse_animation_frame != null) {
			cancelAnimationFrame(pulse_animation_frame);
			pulse_animation_frame = null;
		}
	}

	function start_pulse_animation(map: any) {
		clear_pulse_animation();
		const started_at = performance.now();

		const animate = (now: number) => {
			if (get(map_pointer_store) !== map || !map.getLayer(CURRENT_VEHICLE_PULSE_LAYER)) {
				pulse_animation_frame = null;
				return;
			}

			const phase = (Math.sin((now - started_at) / 350) + 1) / 2;
			map.setPaintProperty(CURRENT_VEHICLE_PULSE_LAYER, 'circle-radius', 11 + phase * 7);
			map.setPaintProperty(CURRENT_VEHICLE_PULSE_LAYER, 'circle-opacity', 0.45 - phase * 0.25);
			pulse_animation_frame = requestAnimationFrame(animate);
		};

		pulse_animation_frame = requestAnimationFrame(animate);
	}

	function ensure_current_vehicle_layers(map: any) {
		if (!map.getSource(CURRENT_VEHICLE_SOURCE)) {
			map.addSource(CURRENT_VEHICLE_SOURCE, {
				type: 'geojson',
				data: empty_feature_collection()
			});
		}

		if (!map.getLayer(CURRENT_VEHICLE_PULSE_LAYER)) {
			map.addLayer({
				id: CURRENT_VEHICLE_PULSE_LAYER,
				type: 'circle',
				source: CURRENT_VEHICLE_SOURCE,
				paint: {
					'circle-radius': 14,
					'circle-color': '#2563eb',
					'circle-opacity': 0.3,
					'circle-stroke-width': 0
				}
			});
		}

		if (!map.getLayer(CURRENT_VEHICLE_DOT_LAYER)) {
			map.addLayer({
				id: CURRENT_VEHICLE_DOT_LAYER,
				type: 'circle',
				source: CURRENT_VEHICLE_SOURCE,
				paint: {
					'circle-radius': 6,
					'circle-color': '#2563eb',
					'circle-stroke-color': '#ffffff',
					'circle-stroke-width': 2
				}
			});
		}
	}

	function show_current_vehicle_position(vehicle_position: AspenisedVehiclePosition) {
		const position = vehicle_position.position;
		if (!position) return;

		const map = get(map_pointer_store) as any;
		if (!map || !map.isStyleLoaded?.()) return;

		try {
			ensure_current_vehicle_layers(map);
			map.getSource(CURRENT_VEHICLE_SOURCE)?.setData({
				type: 'FeatureCollection',
				features: [{
					type: 'Feature',
					properties: { vehicle, trip_id: vehicle_position.trip?.trip_id ?? null },
					geometry: {
						type: 'Point',
						coordinates: [position.longitude, position.latitude]
					}
				}]
			});

			map.getSource('transit_shape_context')?.setData(empty_feature_collection());

			const next_context_key = `position:${vehicle_info_chateau}:${vehicle}`;
			if (map_context_key !== next_context_key) {
				map_context_key = next_context_key;
				map.flyTo({
					center: [position.longitude, position.latitude],
					zoom: Math.max(map.getZoom(), 14),
					duration: 800
				});
			}

			if (pulse_animation_frame == null) start_pulse_animation(map);
		} catch (map_error) {
			console.error('Unable to show vehicle history realtime position', map_error);
		}
	}

	function collect_coordinates(value: any, output: Array<[number, number]>) {
		if (!value) return;
		if (Array.isArray(value)) {
			if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
				output.push([value[0], value[1]]);
				return;
			}
			for (const child of value) collect_coordinates(child, output);
			return;
		}
		if (value.coordinates) collect_coordinates(value.coordinates, output);
		if (value.geometry) collect_coordinates(value.geometry, output);
		if (value.features) collect_coordinates(value.features, output);
	}

	async function show_last_known_route_shape() {
		const map_before_fetch = get(map_pointer_store) as any;
		map_before_fetch?.getSource(CURRENT_VEHICLE_SOURCE)?.setData(empty_feature_collection());
		clear_pulse_animation();

		const row = latest_history_row();
		if (!row) return;

		const route = history_data?.routes?.[row.route_id];
		const shape_id = route?.shapes_list?.find((shape): shape is string => Boolean(shape));
		const row_chateau = chateau_for_row(row);
		if (!route || !shape_id || !row_chateau) return;

		const next_context_key = `shape:${row_chateau}:${shape_id}`;
		if (map_context_key === next_context_key) return;

		try {
			const params = new URLSearchParams({
				chateau: row_chateau,
				shape_id,
				format: 'geojson',
				simplify: '10'
			});
			const response = await fetch(`https://birch.catenarymaps.org/get_shape?${params.toString()}`);
			if (!response.ok) return;

			const shape = await response.json();
			const map = get(map_pointer_store) as any;
			if (!map || !map.isStyleLoaded?.()) return;

			const geometry = shape?.type === 'FeatureCollection'
				? shape.features?.[0]?.geometry
				: shape?.type === 'Feature'
					? shape.geometry
					: shape?.geometry || shape;
			if (!geometry) return;

			map.getSource(CURRENT_VEHICLE_SOURCE)?.setData(empty_feature_collection());
			clear_pulse_animation();
			map.getSource('transit_shape_context')?.setData({
				type: 'FeatureCollection',
				features: [{
					type: 'Feature',
					geometry,
					properties: {
						color: route.color,
						text_color: route.text_color,
						route_label: route.short_name || route.long_name || row.route_id
					}
				}]
			});

			const coordinates: Array<[number, number]> = [];
			collect_coordinates(geometry, coordinates);
			if (coordinates.length > 0) {
				let min_lng = coordinates[0][0];
				let max_lng = coordinates[0][0];
				let min_lat = coordinates[0][1];
				let max_lat = coordinates[0][1];
				for (const [lng, lat] of coordinates) {
					min_lng = Math.min(min_lng, lng);
					max_lng = Math.max(max_lng, lng);
					min_lat = Math.min(min_lat, lat);
					max_lat = Math.max(max_lat, lat);
				}
				map.fitBounds([[min_lng, min_lat], [max_lng, max_lat]], {
					padding: 90,
					duration: 800,
					maxZoom: 13
				});
			}
			map_context_key = next_context_key;
		} catch (shape_error) {
			console.error('Unable to show latest vehicle route shape', shape_error);
		}
	}

	async function load_realtime_vehicle() {
		if (!vehicle_info_chateau || !vehicle) return;
		const request_id = ++realtime_request_sequence;

		try {
			const response = await fetch(
				`https://birch.catenarymaps.org/get_vehicle_information_from_label/${encodeURIComponent(vehicle_info_chateau)}/${encodeURIComponent(vehicle)}`
			);
			if (request_id !== realtime_request_sequence) return;

			if (!response.ok) {
				current_vehicle = null;
				await show_last_known_route_shape();
				return;
			}

			const payload = await response.json().catch(() => null);
			const vehicle_data = Array.isArray(payload?.data) ? payload.data[0] : payload?.data;
			current_vehicle = vehicle_data || null;

			if (current_vehicle?.position) show_current_vehicle_position(current_vehicle);
			else await show_last_known_route_shape();
		} catch (realtime_error) {
			if (request_id !== realtime_request_sequence) return;
			console.error('Unable to load current vehicle position', realtime_error);
			current_vehicle = null;
			await show_last_known_route_shape();
		}
	}

	function start_realtime_updates() {
		if (realtime_interval != null) clearInterval(realtime_interval);
		void load_realtime_vehicle();
		realtime_interval = setInterval(() => void load_realtime_vehicle(), 1_000);
	}

	async function load_history() {
		const request_id = ++request_sequence;
		loading = true;
		error = null;
		history_data = null;

		const params = new URLSearchParams({ vehicle });
		if (chateau) {
			params.set('chateau', chateau);
			if (route_id) params.set('route_id', route_id);
		} else if (unified_agency_id) {
			params.set('unified_agency_id', unified_agency_id);
		} else {
			error = 'Vehicle history requires either chateau or unified_agency_id.';
			loading = false;
			return;
		}

		try {
			const response = await fetch(
				`https://birch.catenarymaps.org/vehicle_history_lookup?${params.toString()}`
			);
			const payload = await response.json().catch(() => null);

			if (request_id !== request_sequence) return;

			if (!response.ok) {
				if (response.status === 404) {
					history_data = {
						trip_history: [],
						routes: {},
						agency_timezone: 'UTC',
						agency_name: null
					};
					return;
				}

				throw new Error(payload?.error?.message || `Vehicle history request failed (${response.status})`);
			}

			history_data = payload as VehicleHistoryResponse;
		} catch (request_error) {
			if (request_id !== request_sequence) return;
			error = request_error instanceof Error ? request_error.message : String(request_error);
		} finally {
			if (request_id === request_sequence) loading = false;
		}
	}

	$: {
		const lookup_key = `${chateau || ''}\u0000${unified_agency_id || ''}\u0000${vehicle}\u0000${
			route_id || ''
		}`;
		if ((chateau || unified_agency_id) && vehicle && lookup_key !== last_lookup_key) {
			last_lookup_key = lookup_key;
			void load_history();
		}
	}

	$: grouped_history = group_history(history_data?.trip_history || [], sort_descending);
	$: vehicle_info_chateau =
		chateau ||
		(latest_history_row()
			? history_data?.routes?.[latest_history_row()!.route_id]?.chateau
			: null) ||
		Object.values(history_data?.routes || {}).find((route) => Boolean(route.chateau))?.chateau ||
		null;

	$: current_trip_id = current_vehicle?.trip?.trip_id ?? null;
	$: {
		const realtime_start_date = current_vehicle?.trip?.start_date || null;
		const normalised_start_date = realtime_start_date?.includes('-')
			? realtime_start_date
			: realtime_start_date?.length === 8
				? `${realtime_start_date.slice(0, 4)}-${realtime_start_date.slice(4, 6)}-${realtime_start_date.slice(6, 8)}`
				: null;
		current_trip_row = current_trip_id == null
			? null
			: history_data?.trip_history.find((row) =>
				row.trip_id === current_trip_id &&
				(normalised_start_date == null || row.operation_date === normalised_start_date)
			) ?? null;
	}

	$: {
		const next_realtime_lookup_key = `${vehicle_info_chateau || ''}\u0000${vehicle}`;
		if (vehicle_info_chateau && vehicle && next_realtime_lookup_key !== realtime_lookup_key) {
			realtime_lookup_key = next_realtime_lookup_key;
			map_context_key = '';
			start_realtime_updates();
		}
	}

	onDestroy(() => {
		if (realtime_interval != null) clearInterval(realtime_interval);
		clear_pulse_animation();
		const map = get(map_pointer_store) as any;
		try {
			map?.getSource(CURRENT_VEHICLE_SOURCE)?.setData(empty_feature_collection());
			map?.getSource('transit_shape_context')?.setData(empty_feature_collection());
			if (map?.getLayer(CURRENT_VEHICLE_DOT_LAYER)) map.removeLayer(CURRENT_VEHICLE_DOT_LAYER);
			if (map?.getLayer(CURRENT_VEHICLE_PULSE_LAYER)) map.removeLayer(CURRENT_VEHICLE_PULSE_LAYER);
			if (map?.getSource(CURRENT_VEHICLE_SOURCE)) map.removeSource(CURRENT_VEHICLE_SOURCE);
		} catch (map_error) {
			console.error('Unable to clean up vehicle history map layers', map_error);
		}
	});
</script>

<HomeButton />

<div class="catenary-scroll grow overflow-y-auto px-3 pb-4">
	<div class="mb-3">
		<div class="flex items-start justify-between gap-3">
			<p class="text-lg font-semibold">
				{$_('vehicle_history', { default: 'Vehicle history' })}
			</p>
			<button
				type="button"
				on:click={() => (sort_descending = !sort_descending)}
				class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-300 text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800 dark:focus:ring-gray-500 dark:focus:ring-offset-gray-950"
				aria-label={sort_descending
					? $_('sort_oldest_first', { default: 'Show oldest first' })
					: $_('sort_newest_first', { default: 'Show newest first' })}
				title={sort_descending
					? $_('sort_oldest_first', { default: 'Show oldest first' })
					: $_('sort_newest_first', { default: 'Show newest first' })}
			>
				<span class="material-symbols-outlined" aria-hidden="true">
					{sort_descending ? 'hourglass_arrow_down' : 'hourglass_arrow_up'}
				</span>
			</button>
		</div>
		{#if history_data?.agency_name}
			<p class="text-sm font-semibold">{history_data.agency_name}</p>
		{/if}
		<p class="text-sm text-gray-600 dark:text-gray-400">
			{$_('vehicle', { default: 'Vehicle' })}: <span class="font-semibold">{vehicle}</span>
		</p>
		{#if vehicle_info_chateau}
			<div class="mt-2">
				<VehicleInfo label={vehicle} chateau={vehicle_info_chateau} {route_id} />
			</div>
		{/if}
		{#if current_vehicle?.trip?.trip_id}
			{@const current_route = current_vehicle.trip.route_id
				? history_data?.routes?.[current_vehicle.trip.route_id]
				: undefined}
			<button
				type="button"
				on:click={open_current_trip}
				class="mt-3 flex w-full items-center gap-3 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-left transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:hover:bg-blue-950/50"
			>
				<span class="relative flex h-3 w-3 shrink-0">
					<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-60"></span>
					<span class="relative inline-flex h-3 w-3 rounded-full bg-blue-600"></span>
				</span>
				<span class="min-w-0 flex-1">
					<span class="block text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
						{$_('current_trip', { default: 'Current trip' })}
					</span>
					<span class="block truncate font-semibold">
						{current_vehicle.trip.trip_headsign || current_vehicle.trip.trip_short_name || current_vehicle.trip.trip_id}
					</span>
					<span class="block truncate text-xs text-gray-600 dark:text-gray-400">
						{route_name(current_route, current_vehicle.trip.route_id || '')}
						{#if current_vehicle.position} · {$_('live_position', { default: 'Live position' })}{/if}
					</span>
				</span>
				<span class="material-symbols-outlined text-blue-700 dark:text-blue-300" aria-hidden="true">chevron_right</span>
			</button>
		{/if}
		<div class="mt-3">
			<DonationPopup
				title="Help us store richer bus history"
				message="Support detailed delay and performance records, and keep them available for longer."
				compact
				dismissible={false}
			/>
		</div>
	</div>

	{#if loading}
		<p class="py-6 text-center text-sm text-gray-500">
			{$_('loading', { default: 'Loading…' })}
		</p>
	{:else if error}
		<p class="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
			{error}
		</p>
	{:else if !history_data || history_data.trip_history.length === 0}
		<p class="py-6 text-center text-sm text-gray-500">
			{$_('no_vehicle_history', { default: 'No history available.' })}
		</p>
	{:else}
		{#each Object.entries(grouped_history) as [date_code, trips]}
			<section class="mb-4">
				<p class="mx-1 mb-1 text-md font-semibold">
					{new Date(date_code).toLocaleDateString(
						timezone_to_locale($locale || 'en', history_data?.agency_timezone || 'UTC'),
						{
							year: 'numeric',
							month: 'numeric',
							day: 'numeric',
							weekday: 'long',
							timeZone: 'UTC'
						}
					)}
				</p>

				<div
					class="grid grid-cols-[4.5rem_minmax(3.5rem,auto)_minmax(0,1fr)_minmax(2rem,auto)] gap-x-2 px-2 pb-1 text-xs font-semibold text-gray-500"
				>
					<span>{$_('time', { default: 'Time' })}</span>
					<span>{$_('route', { default: 'Route' })}</span>
					<span>{$_('headsign', { default: 'Headsign' })}</span>
					<span class="text-right">{$_('block', { default: 'Block' })}</span>
				</div>

				<div class="overflow-hidden rounded-lg border-y border-gray-300 dark:border-gray-700">
					{#each trips as trip}
						{@const route = history_data?.routes?.[trip.route_id]}
						<div
							class={`grid grid-cols-[4.5rem_minmax(3.5rem,auto)_minmax(0,1fr)_minmax(2rem,auto)] items-center gap-x-2 border-b border-gray-300 px-2 py-2 text-sm last:border-b-0 dark:border-gray-700 ${
								current_trip_row === trip
									? 'bg-blue-50 ring-1 ring-inset ring-blue-300 dark:bg-blue-950/30 dark:ring-blue-800'
									: ''
							}`}
						>
							<span class="font-semibold tabular-nums">
								{#if trip.unix_start_time != null && Number.isSafeInteger(trip.unix_start_time)}
									<Clock
										timezone={history_data?.agency_timezone || 'UTC'}
										time_seconds={trip.unix_start_time}
									/>
								{:else}
									—
								{/if}
							</span>

							<span
								class="inline-flex w-fit max-w-full truncate rounded px-1.5 py-0.5 text-xs font-semibold"
								style={`background-color: ${normalise_colour(
									route?.color,
									'#e5e7eb'
								)}; color: ${normalise_colour(route?.text_color, '#111827')};`}
								title={route_name(route, trip.route_id)}
							>
								{route_name(route, trip.route_id)}
							</span>

							<button
								type="button"
								on:click={() => open_trip(trip)}
								class="min-w-0 truncate text-left font-semibold text-blue-800 underline hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
								title={trip.direction_headsign || trip.trip_short_name || trip.trip_id}
							>
								{trip.direction_headsign || trip.trip_short_name || trip.trip_id}
							</button>

							{#if trip.block_id}
								<button
									type="button"
									on:click={() => open_block(trip)}
									class="truncate text-right font-mono text-xs underline hover:text-gray-600 dark:hover:text-gray-300"
									title={trip.block_id}
								>
									{trip.block_id}
								</button>
							{:else}
								<span class="text-right font-mono text-xs">—</span>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{/each}
	{/if}
</div>
