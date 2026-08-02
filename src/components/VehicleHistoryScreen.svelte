<script lang="ts">
	import { locale, _ } from 'svelte-i18n';
	import HomeButton from './SidebarParts/home_button.svelte';
	import { data_stack_store } from '../globalstores';
	import { BlockStack, SingleTrip, StackInterface } from './stackenum';
	import { timezone_to_locale } from './timezone_to_locale';
	import VehicleInfo from './vehicle_info.svelte';
	import Clock from './Clock.svelte';

	export let chateau: string;
	export let vehicle: string;
	export let route_id: string | null = null;

	type VehicleHistoryRow = {
		operation_date: string;
		unix_start_time: number | null;
		trip_id: string;
		route_id: string;
		trip_short_name: string | null;
		direction_headsign: string | null;
		block_id: string | null;
	};

	type RouteInfo = {
		short_name?: string | null;
		long_name?: string | null;
		color?: string | null;
		text_color?: string | null;
		route_type?: number | null;
	};

	type VehicleHistoryResponse = {
		trip_history: VehicleHistoryRow[];
		routes: Record<string, RouteInfo>;
		agency_timezone: string;
		agency_name?: string | null;
	};

	let history_data: VehicleHistoryResponse | null = null;
	let grouped_history: Record<string, VehicleHistoryRow[]> = {};
	let loading = true;
	let error: string | null = null;
	let last_lookup_key = '';
	let request_sequence = 0;
	let sort_descending = true;

	function group_history(
		rows: VehicleHistoryRow[],
		descending: boolean
	): Record<string, VehicleHistoryRow[]> {
		const grouped: Record<string, VehicleHistoryRow[]> = {};
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

	function route_name(route: RouteInfo | undefined, fallback: string): string {
		return route?.short_name || route?.long_name || fallback;
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

		data_stack_store.update((stack) => {
			stack.push(
				new StackInterface(
					new SingleTrip(
						chateau,
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

		data_stack_store.update((stack) => {
			stack.push(new StackInterface(new BlockStack(chateau, row.block_id!, row.operation_date)));

			return stack;
		});
	}

	async function load_history() {
		const request_id = ++request_sequence;
		loading = true;
		error = null;
		history_data = null;

		const params = new URLSearchParams({
			vehicle,
			chateau
		});
		if (route_id) params.set('route_id', route_id);

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
		const lookup_key = `${chateau}\u0000${vehicle}\u0000${route_id || ''}`;
		if (chateau && vehicle && lookup_key !== last_lookup_key) {
			last_lookup_key = lookup_key;
			void load_history();
		}
	}

	$: grouped_history = group_history(history_data?.trip_history || [], sort_descending);
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
		<div class="mt-2">
			<VehicleInfo label={vehicle} {chateau} {route_id} />
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
							class="grid grid-cols-[4.5rem_minmax(3.5rem,auto)_minmax(0,1fr)_minmax(2rem,auto)] items-center gap-x-2 border-b border-gray-300 px-2 py-2 text-sm last:border-b-0 dark:border-gray-700"
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
