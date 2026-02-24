<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { fixRouteName, fixRouteNameLong } from './agencyspecific';
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
	import RatpBullet from './ratpbullet.svelte';

	export let color: string;
	export let text_color: string;

	export let short_name: string | null;
	export let long_name: string | null;
	export let url: string | null = null;

	export let run_number: string | null = null;
	export let icon: string | null = null;
	export let vehicle: string | null = null;

	export let route_id: string;
	export let chateau_id: string;

	export let text: string;

	export let compact: boolean = false;
	export let darkMode: boolean;

	export let disable_pdf: boolean = false;
	export let arrow: boolean = false;

	export let window_height_known: number = window.innerHeight || 500;

	export let route_type: number;

	export let gtfs_desc: string | null = null;

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
		if (!route_id || !chateau_id) return;
		const k = keyForRoute(chateau_id, route_id);
		isPinned = readPins().includes(k);
	}
	function togglePin() {
		if (!route_id || !chateau_id) return;
		const k = keyForRoute(chateau_id, route_id);
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

	if (has_schedule_pdf(chateau_id) && !disable_pdf) {
		pdf_url = find_schedule_pdf_initial(chateau_id, route_id);
	}

	if (schedule_pdf_needs_hydration(chateau_id) && !disable_pdf) {
		find_schedule_pdf(chateau_id, route_id)
			.then((answer) => (pdf_url = answer))
			.catch((pdferr) => console.error(pdferr));
	}

	$: (chateau_id, route_id, refreshPinnedState());

	$: isSubway = isSubwayRouteId(route_id) && chateau_id == MTA_CHATEAU_ID;
	$: isRatp = chateau_id === IDFM_CHATEAU_ID && isRatpRoute(short_name);
</script>

{#if !compact}
	<div class="flex items-start justify-between gap-2">
		<h2
			class={`${window_height_known < 600 ? 'text-base' : 'text-lg md:text-xl md:mt-2'} ${
				isSubway ? '' : 'leading-tight'
			}`}
			style={`
				${isSubway ? '' : `color: ${darkMode ? lightenColour(color) : color}`}`}
		>
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
							stack.push(new StackInterface(new RouteStack(chateau_id, route_id)));
							return stack;
						});
					}
				}}
			>
				{#if isSubway && short_name}
					<MtaBullet route_short_name={short_name} matchTextHeight={true} />
				{:else if isRatp && short_name}
					<RatpBullet route_short_name={short_name} matchTextHeight={true} />
				{:else if short_name && (chateau_id !== 'nationalrailuk' || short_name.startsWith('LO-') || short_name === 'XR-ELIZABETH') && chateau_id !== 'metrolinktrains'}
					<span class="font-bold">{fixRouteName(chateau_id, short_name, route_id)}</span>
				{/if}

				{#if long_name}
					<span class={`${short_name ? 'font-normal ml-1' : 'font-bold'}`}>
						{fixRouteNameLong(chateau_id, long_name, route_id)}
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

	{#if gtfs_desc}
		<span>{gtfs_desc}</span>
	{/if}

	<h2
		class={`${window_height_known < 600 ? 'text-base' : 'text-base md:text-lg my-0.5'}  font-medium ${arrow ? '-translate-x-1.5' : ''} leading-tight`}
	>
		{#if arrow}
			<span class="material-symbols-outlined text-2xl align-middle">chevron_right</span>
		{/if}
		<span class="align-middle">
			{text}

			{#if run_number}
				<span class="font-bold text-md px-1 py-0.5 mr-1 rounded-md w-min">{run_number}</span>
			{/if}
			{#if icon}
				<span class="material-symbols-outlined text-xl align-middle -translate-y-0.5 ml-1"
					>{icon}</span
				>
			{/if}
		</span>
		{#if vehicle && vehicle != run_number}
			<span
				style:background-color={color}
				style:color={text_color}
				class="text-sm align-middle ml-1 bg-seashore dark:bg-gray-900 text-white px-1 rounded-md translate-y-0.5 inline-block"
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
				{vehicle}</span
			>
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
		{#if url != null}
			<a target="_blank" href={url}>
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
