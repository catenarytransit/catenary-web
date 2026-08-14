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
	import { onMount } from 'svelte';
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

	export let routeDef: RouteMinimal;
	// export let routeDef.color: string;
	// export let routeDef.text_color: string;

	// export let routeDef.short_name: string | null;
	// export let routeDef.long_name: string | null;
	// export let routeDef.url: string | null = null;

	export let run_number: string | null = null;
	export let icon: string | null = null;
	export let vehicle: string | null = null;

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
		['dbregioag', 'deutschland'].includes(routeDef.chateau) &&
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
			<span class="text-sm align-middle ml-2 text-gray-600 dark:text-gray-400 inline-block">
				<span class="material-symbols-outlined !text-sm align-middle -translate-y-[0.03rem]"
					>{#if routeDef.route_type == 0}
						tram
					{:else if routeDef.route_type == 1}
						subway
					{:else if routeDef.route_type == 2}
						train
					{:else}
						directions_bus
					{/if}</span
				>
				{vehicle}
			</span>
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
