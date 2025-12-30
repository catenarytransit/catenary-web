<script lang="ts">
	// @ts-nocheck
	import { lightenColour } from './lightenDarkColour';
	import store from 'store2';
	import {
		MapSelectionScreen,
		StackInterface,
		MapSelectionOption,
		SingleTrip,
		VehicleMapSelector,
		RouteStack,
		StopStack,
		RouteMapSelector,
		VehicleSelectedStack,
		StopMapSelector,
		BlockStack,
		OsmItemStack
	} from '../components/stackenum';
	import HomeButton from './SidebarParts/home_button.svelte';
	import BackButton from './SidebarParts/back_button.svelte';
	import { SettingsStack } from '../components/stackenum';
	import SettingsMenu from './SettingsMenu.svelte';
	import NearbyDepartures from './NearbyDepartures.svelte';
	import { writable } from 'svelte/store';
	import { get } from 'svelte/store';
	import { data_stack_store, usunits_store, show_gtfs_ids_store } from '../globalstores';
	import { getLocaleFromNavigator, locale, locales, _ } from 'svelte-i18n';
	import { isLoading } from 'svelte-i18n';
	import SingleTripInfo from './SingleTripInfo.svelte';
	import OsmItemInfo from './OsmItemInfo.svelte';
	import RouteScreen from './RouteScreen.svelte';
	import {
		fixHeadsignIcon,
		fixRouteName,
		fixRouteNameLong,
		fixRunNumber,
		fixHeadsignText,
		fixRouteIcon
	} from './agencyspecific';
	import RouteIcon from './RouteIcon.svelte';
	import { getLocaleStorageOrNav } from '../i18n';
	import TidbitSidebarCard from './SidebarParts/tidbits.svelte';
	import { locales_options, locales_options_lookup } from '../i18n';
	import { MTA_CHATEAU_ID, isSubwayRouteId } from '../utils/mta_subway_utils';
	import MtaBullet from './mtabullet.svelte';

	import VehicleInfo from './vehicle_info.svelte';
	export let latest_item_on_stack: StackInterface | null;
	export let darkMode: boolean;
	export let usunits: boolean;

	let stops_preview_data = null;

	let show_gtfs_ids = get(show_gtfs_ids_store);

	show_gtfs_ids_store.subscribe((value) => {
		show_gtfs_ids = value;
	});
</script>

<div class="md:mt-12"></div>

{#if latest_item_on_stack != null}
	{#if latest_item_on_stack.data instanceof MapSelectionScreen}
		{#await import('./MapSelectionScreen.svelte') then { default: MapSelectionScreenComponent }}
			<MapSelectionScreenComponent map_selection_screen={latest_item_on_stack.data} {darkMode} />
		{:catch error}
			<p class="p-4 text-red-500">Error loading component: {error.message}</p>
		{/await}
	{/if}
	{#if latest_item_on_stack.data instanceof SettingsStack}
		<SettingsMenu />
	{/if}
	{#if latest_item_on_stack.data instanceof BlockStack}
		{#await import('./BlockScreen.svelte') then { default: BlockScreen }}
			<BlockScreen
				chateau={latest_item_on_stack.data.chateau_id}
				block_id={latest_item_on_stack.data.block_id}
				service_date={latest_item_on_stack.data.service_date}
			/>
		{:catch error}
			<p class="p-4 text-red-500">Error loading component: {error.message}</p>
		{/await}
	{/if}
	{#if latest_item_on_stack.data instanceof StopStack}
		{#await import('./StopScreen.svelte') then { default: StopScreen }}
			{#key latest_item_on_stack.data.stop_id}
				<StopScreen
					chateau={latest_item_on_stack.data.chateau_id}
					stop_id={latest_item_on_stack.data.stop_id}
				/>
			{/key}
		{/await}
	{/if}
	{#if latest_item_on_stack.data instanceof VehicleSelectedStack}
		<div class="px-4 sm:px-2 lg:px-4 py-2 flex flex-col h-full">
			<HomeButton />
			<p>Tripless vehicle selected</p>
			<p>
				Chateau: <span class="font-mono text-semibold">{latest_item_on_stack.data.chateau_id}</span>
			</p>
			<p>
				Vehicle ID: <span class="font-mono text-semibold"
					>{latest_item_on_stack.data.vehicle_id}</span
				>
			</p>

			<VehicleInfo
				chateau={latest_item_on_stack.data.chateau_id}
				label={latest_item_on_stack.data.vehicle_id}
				route_id={null}
			/>
		</div>
	{/if}
	{#if latest_item_on_stack.data instanceof SingleTrip}
		<SingleTripInfo
			{usunits}
			{darkMode}
			routetype={latest_item_on_stack.data.route_type}
			trip_selected={latest_item_on_stack.data}
		/>
	{/if}
	{#if latest_item_on_stack.data instanceof OsmItemStack}
		<HomeButton />
		<OsmItemInfo
			osm_class={latest_item_on_stack.data.osm_class}
			osm_id={latest_item_on_stack.data.osm_id}
			osm_type={latest_item_on_stack.data.osm_type}
		/>
	{/if}
	{#if latest_item_on_stack.data instanceof RouteStack}
		<!--{#await import('./RouteScreen.svelte') then { default: RouteScreen }}
			{#key latest_item_on_stack.data}
				<HomeButton />
			{/key}
		{/await}-->

		<RouteScreen {darkMode} routestack={latest_item_on_stack.data} />
	{/if}
{:else if false}
	<p>Loading home page</p>
{:else}
	<!--<div class=" md:mt-3 md:mb-1">
		<a href="https://catenarymaps.org">
			<img
				src="/logo.svg"
				alt="Catenary"
				class="h-5 inline align-middle pl-3 mr-2 -translate-y-2"
			/>
		</a>
		<button
			class="text-seashore dark:text-seashoredark cursor-pointer mx-1"
			on:click={() => {
				window.location.reload();
			}}
			aria-label="Refresh"
			><span class="material-symbols-outlined block"> refresh </span>
		</button>
		<button
			class="text-seashore dark:text-seashoredark cursor-pointer mx-2"
			on:click={() => {
				data_stack_store.update((x) => {
					x.push(new StackInterface(new SettingsStack()));
					return x;
				});
			}}
			aria-label="Settings"
			><span class="material-symbols-outlined block"> settings </span>
		</button>
	</div>-->
	<div class="py-1 flex flex-col h-full">
		<div class="flex flex-col h-full select-text"><NearbyDepartures {usunits} {darkMode} /></div>
		<TidbitSidebarCard />
	</div>
{/if}
