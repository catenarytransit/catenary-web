<script lang="ts">
	import { _ } from 'svelte-i18n';
	import SbbLogo from './SbbLogo.svelte';
	import { lightenColour } from './lightenDarkColour';
	import {
		find_schedule_pdf,
		find_schedule_pdf_initial,
		has_schedule_pdf,
		schedule_pdf_needs_hydration
	} from './pdf_schedules';
	import { createEventDispatcher, onMount } from 'svelte';
	import {
		data_stack_store,
		// ... other imports
		usunits_store,
		show_zombie_buses_store,
		show_my_location_store,
		show_gtfs_ids_store,
		custom_icons_category_to_layer_id,
		map_pointer_store,
		stops_to_hide_store
	} from '../globalstores';
	import { RouteStack, SingleTrip, StackInterface, StopStack } from './stackenum';
	import { MTA_CHATEAU_ID, isSubwayRouteId } from '../utils/mta_subway_utils';
	import { IDFM_CHATEAU_ID, isRatpRoute } from '../utils/ratp_utils';
	import MtaBullet from './mtabullet.svelte';
	import StationScreenRouteBadge from './StationScreenRouteBadge.svelte';
	import RatpBullet from './ratpbullet.svelte';

	const dispatch = createEventDispatcher<{ vehicle: void }>();

	export let routeDef: RouteMinimal;
	// export let routeDef.color: string;
	// export let routeDef.text_color: string;

	// export let routeDef.short_name: string | null;
	// export let routeDef.long_name: string | null;
	// export let routeDef.url: string | null = null;

	export let run_number: string | null = null;
	export let icon: string | null = null;
	export let vehicle: string | null = null;
	export let vehicle_history_clickable: boolean = false;

	export let is_route_only: boolean;

	// export let routeDef.route_id: string;
	// export let routeDef.chateau: string;
	// export let routeDef.agency_id: string | null = null;
	export let agency_name: string | null = null;
	export let trip_short_name: string | null = null;

	export let text: string;

	export let compact: boolean = false;
	export let darkMode: boolean;

	export let disable_pdf: boolean = false;
	export let arrow: boolean = false;

	export let window_height_known: number = window.innerHeight || 500;

	// export let routeDef.route_type: number;

	// export let routeDef.gtfs_desc: string | null = null;

	export let make_clickable_route_name: boolean = false;

	export let pin_route_setting_shown: boolean = false;

	export let show_route_dropdown: boolean = false;

	let showOverflowMenu = false;
	let showExportModal = false;
	let selectedFormat: 'geojson' | 'kml' | 'gpx' = 'geojson';
	let includeStops = false;

	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				if (node.parentNode) {
					node.parentNode.removeChild(node);
				}
			}
		};
	}

	function triggerExport() {
		const cleanRoute = cleanRouteId(route_id);
		let exportUrl = `https://birch.catenarymaps.org/export_route_geom?chateau=${encodeURIComponent(chateau_id)}&route_id=${encodeURIComponent(cleanRoute)}&format=${selectedFormat}`;
		if (includeStops) {
			exportUrl += `&include_stops=true`;
		}
		window.open(exportUrl, '_blank');
		showExportModal = false;
	}

	let isPinned = false;
	const LS_KEY = 'pinned_routes_v1';

	function cleanRouteId(id: string) {
		return id?.replace(/^\"/, '').replace(/\"$/, '') ?? id;
	}
	function keyForRoute(chateau_id: string, route_id: string) {
		return `${chateau_id}:${cleanRouteId(route_id)}`;
	}
	function readPins(): string[] {
		if (typeof window === 'undefined') return [];
		try {
			return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
		} catch {
			return [];
		}
	}
	function writePins(pins: string[]) {
		if (typeof window === 'undefined') return;
		localStorage.setItem(LS_KEY, JSON.stringify([...new Set(pins)]));
	}
	function refreshPinnedState() {
		if (!routeDef.route_id || !routeDef.chateau) return;
		const k = keyForRoute(routeDef.chateau, routeDef.route_id);
		isPinned = readPins().includes(k);
	}
	function togglePin() {
		if (!routeDef.route_id || !routeDef.chateau) return;
		const k = keyForRoute(routeDef.chateau, routeDef.route_id);
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

	onMount(() => {
		window.addEventListener('resize', () => {
			window_height_known = window.innerHeight;
		});

		refreshPinnedState();
		const onStorage = (e: StorageEvent) => {
			if (e.key === LS_KEY) refreshPinnedState();
		};
		window.addEventListener('storage', onStorage);

		window.addEventListener('resize', () => {
			window_height_known = window.innerHeight;
		});

		return () => {
			window.removeEventListener('storage', onStorage);
		};
	});
	let pdf_url: string | undefined;

	if (has_schedule_pdf(routeDef.chateau) && !disable_pdf) {
		pdf_url = find_schedule_pdf_initial(routeDef.chateau, routeDef.route_id);
	}

	if (schedule_pdf_needs_hydration(routeDef.chateau) && !disable_pdf) {
		find_schedule_pdf(routeDef.chateau, routeDef.route_id)
			.then((answer) => (pdf_url = answer))
			.catch((pdferr) => console.error(pdferr));
	}

	$: (routeDef.chateau, routeDef.route_id, refreshPinnedState());

	$: isSubway = isSubwayRouteId(routeDef.route_id) && routeDef.chateau == MTA_CHATEAU_ID;
	$: isRatp = routeDef.chateau === IDFM_CHATEAU_ID && isRatpRoute(routeDef.short_name);
	$: is_sbahn =
		['vbb', 'dbregioag', 'deutschland'].includes(routeDef.chateau) &&
		(routeDef.short_name || '').match(/^S\d+/) !== null;
	
	import db_train_lookup from '../../static/fernverkehr_2026_train_lookup.json';
	import type { RouteMinimal } from '../utils/models';

	$: is_db_fernverkehr = routeDef.chateau === 'deutschland' && routeDef.agency_id && ['12681', '13557', '10918'].includes(routeDef.agency_id.toString());
	$: trip_short_name_no_zeros = trip_short_name ? trip_short_name.replace(/^0+/, '') : null;
	$: db_train_data = is_db_fernverkehr && trip_short_name_no_zeros ? (db_train_lookup as Record<string, any[]>)[trip_short_name_no_zeros] : null;
	$: db_display_name = db_train_data ? db_train_data[0].display_name : trip_short_name;
	$: effective_trip_short_name = db_display_name || trip_short_name || run_number;

	$: showLongName = !!(
		routeDef.long_name &&
		(!routeDef.short_name ||
			(routeDef.long_name.trim().toLowerCase() !== routeDef.short_name.trim().toLowerCase() &&
				routeDef.long_name.trim().toLowerCase() !== `${routeDef.short_name.trim().toLowerCase()} line`))
	);
</script>

{#if !compact}
	<div class="flex items-start justify-between gap-2">
		<h2
			class={`${window_height_known < 600 ? 'text-sm' : 'text-base md:text-lg md:mt-1'} ${
				isSubway ? '' : 'leading-tight'
			}`}
			style={`
				${isSubway || is_db_fernverkehr ? '' : `color: ${darkMode ? lightenColour(routeDef.color) : routeDef.color}`}`}
		>
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions, a11y_no_noninteractive_element_interactions, a11y_consider_explicit_label (FIXME) -->
			<span
				class={`
					${
						make_clickable_route_name
							? 'cursor-pointer  underline decoration-sky-500/80 hover:decoration-sky-500'
							: ''
					}
				`}
				on:click={() => {
					if (make_clickable_route_name) {
						data_stack_store.update((stack) => {
							stack.push(new StackInterface(new RouteStack(routeDef.chateau, routeDef.route_id)));
							return stack;
						});
					}
				}}
			>
				<StationScreenRouteBadge
					{routeDef}
					chateau={routeDef.chateau}
					text_size_class="text-base"
					db_show_linie={true}
					{is_route_only}
					{db_train_data}
				/>

				{#if showLongName}
					<span class={`${routeDef.short_name ? 'font-normal ml-1' : 'font-bold'}`}>
						{routeDef.long_name}
					</span>
				{/if}
			</span>
		</h2>

		<div class="flex flex-row items-center gap-2">
			{#if pin_route_setting_shown}
				<button
					class={`shrink-0 rounded-full leading-none text-sm px-1 hover:bg-gray-100 dark:hover:bg-gray-700 border-2 border-gray-500 ${
						isPinned ? 'bg-blue-500' : ''
					}`}
					aria-pressed={isPinned}
					aria-label={isPinned ? 'Unpin route' : 'Pin route'}
					title={isPinned ? 'Unpin route' : 'Pin route'}
					on:click={togglePin}
				>
					{#if isPinned}
						<span class="material-symbols-outlined leading-none">
							<span class="text-base leading-none">keep</span>
						</span>
					{:else}
						<span class="material-symbols-outlined leading-none">
							<span class="text-base leading-none">keep_off</span>
						</span>
					{/if}
				</button>

				{#if show_route_dropdown}
					<div class="relative inline-block text-left">
						<button
							class="shrink-0 rounded-full leading-none text-sm px-1 hover:bg-gray-100 dark:hover:bg-gray-700 border-2 border-gray-500 flex items-center justify-center"
							aria-label="More options"
							title="More options"
							on:click|stopPropagation={() => (showOverflowMenu = !showOverflowMenu)}
						>
							<span class="material-symbols-outlined text-base leading-none"> more_vert </span>
						</button>

						{#if showOverflowMenu}
							<!-- Backdrop to close dropdown on click outside -->
							<div class="fixed inset-0 z-40" on:click={() => (showOverflowMenu = false)}></div>

							<div
								class="absolute right-0 mt-1 w-44 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50 py-1"
							>
								<button
									class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
									on:click={() => {
										showOverflowMenu = false;
										showExportModal = true;
									}}
								>
									<span class="material-symbols-outlined text-base">download</span>
									Export geometry
								</button>
							</div>
						{/if}
					</div>
				{/if}
			{/if}
			<slot name="controls" />
		</div>
	</div>

	{#if routeDef.gtfs_desc}
		<span>{routeDef.gtfs_desc}</span>
	{/if}

	<h2
		class={`${window_height_known < 600 ? 'text-xs' : 'text-sm md:text-base my-0.5'}  font-medium ${arrow ? '-translate-x-1.5' : ''} leading-tight`}
	>
		{#if effective_trip_short_name}
			<span class="font-bold ml-1 align-middle">{effective_trip_short_name}</span>
		{/if}
		{#if arrow}
			<span class="material-symbols-outlined text-2xl align-middle">chevron_right</span>
		{/if}
		<span class="align-middle">
			{text}

			
			{#if icon}
				<span class="material-symbols-outlined text-xl align-middle -translate-y-0.5 ml-1"
					>{icon}</span
				>
			{/if}
		</span>
		{#if vehicle && vehicle != run_number}
			{#if vehicle_history_clickable}
				<button
					type="button"
					on:click={() => dispatch('vehicle')}
					class="ml-2 inline-block bg-transparent p-0 text-sm align-middle text-gray-600 underline decoration-sky-500/80 hover:decoration-sky-500 dark:text-gray-400"
				>
					<span class="material-symbols-outlined !text-sm align-middle -translate-y-[0.03rem]"
						>{#if route_type == 0}
							tram
						{:else if route_type == 1}
							subway
						{:else if route_type == 2}
							train
						{:else}
							directions_bus
						{/if}</span
					>
					{vehicle}
				</button>
			{:else}
				<span class="text-sm align-middle ml-2 text-gray-600 dark:text-gray-400 inline-block">
					<span class="material-symbols-outlined !text-sm align-middle -translate-y-[0.03rem]"
						>{#if route_type == 0}
							tram
						{:else if route_type == 1}
							subway
						{:else if route_type == 2}
							train
						{:else}
							directions_bus
						{/if}</span
					>
					{vehicle}
				</span>
			{/if}
		{/if}
	</h2>

	<div class="flex flex-row gap-x-2">
		{#if pdf_url != null}
			<a target="_blank" href={pdf_url}>
				<div
					class="px-2 py-0.5 my-1 border-seashore dark:border-seashoredark text-seashore dark:text-seashoredark flex flex-row align-middle justify-center rounded-xl border-2 hover:text-white hover:bg-seashore hover:transition-colors"
				>
					<span class="material-symbols-outlined font-medium text-2xl align-middle">
						attachment
					</span>
					<span class="font-medium text-base md:text-lg pl-2">PDF</span>
				</div>
			</a>
		{/if}
		{#if routeDef.url != null}
			<a target="_blank" href={routeDef.url}>
				<div
					class="px-2 py-0.5 my-1 border-seashore dark:border-seashoredark text-seashore dark:text-seashoredark flex flex-row align-middle justify-center rounded-xl border-2 hover:text-white hover:bg-seashore hover:transition-colors"
				>
					<span class="material-symbols-outlined font-medium text-2xl align-middle"> globe </span>
					<span class="font-medium text-base md:text-lg pl-2">URL</span>
				</div>
			</a>
		{/if}
	</div>
{/if}

{#if showExportModal}
	<!-- Backdrop over entire window screen -->
	<div
		use:portal
		class="fixed inset-0 w-screen h-screen bg-black/50 dark:bg-black/70 z-[9999] transition-opacity"
		on:click={() => (showExportModal = false)}
	></div>

	<!-- Centered Modal across the entire window screen -->
	<div
		use:portal
		class="fixed inset-0 w-screen h-screen z-[10000] flex items-center justify-center p-4 pointer-events-none"
	>
		<div
			class="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-xl shadow-2xl p-6 w-full max-w-md pointer-events-auto border border-gray-200 dark:border-gray-700 space-y-5"
			on:click|stopPropagation
		>
			<div
				class="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-3"
			>
				<h3 class="text-lg font-bold flex items-center gap-2">
					<span class="material-symbols-outlined text-blue-600 dark:text-blue-400">download</span>
					Export geometry
				</h3>
				<button
					class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full p-1 transition-colors"
					on:click={() => (showExportModal = false)}
					aria-label="Close modal"
				>
					<span class="material-symbols-outlined text-xl leading-none">close</span>
				</button>
			</div>

			<div class="space-y-4">
				<div>
					<label class="block text-sm font-semibold mb-2">Format</label>
					<div class="grid grid-cols-3 gap-2">
						{#each ['geojson', 'kml', 'gpx'] as fmt}
							<button
								type="button"
								class={`py-2 px-3 text-sm font-medium rounded-lg border transition-all text-center ${
									selectedFormat === fmt
										? 'border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-bold ring-1 ring-blue-600 dark:ring-blue-500'
										: 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
								}`}
								on:click={() => (selectedFormat = fmt)}
							>
								{#if fmt == 'geojson'}
									<span>GeoJSON</span>
								{:else}
									<span class="uppercase">{fmt}</span>
								{/if}
							</button>
						{/each}
					</div>
				</div>

				<div class="pt-2">
					<label class="flex items-center space-x-3 cursor-pointer select-none">
						<input
							type="checkbox"
							bind:checked={includeStops}
							class="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:bg-gray-700"
						/>
						<span class="text-sm font-medium">Include stops</span>
					</label>
				</div>
			</div>

			<div class="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
				<button
					type="button"
					class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
					on:click={() => (showExportModal = false)}
				>
					Cancel
				</button>
				<button
					type="button"
					class="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
					on:click={triggerExport}
				>
					<span class="material-symbols-outlined text-base">download</span>
					Export
				</button>
			</div>
		</div>
	</div>
{/if}
