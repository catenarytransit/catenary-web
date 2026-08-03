<script lang="ts">
	import {
		BlockStack,
		MapSelectionScreen,
		OsmItemStack,
		OsmStationStack,
		RouteStack,
		SettingsStack,
		SingleTrip,
		StopStack,
		VehicleHistoryStack,
		VehicleSelectedStack,
		type StackInterface
	} from '$components/stackenum';
	import HomeButton from '$components/SidebarParts/home_button.svelte';
	import SettingsMenu from '$components/SettingsMenu.svelte';
	import NearbyDepartures from '$components/NearbyDepartures.svelte';
	import SingleTripInfo from '$components/SingleTripInfo.svelte';
	import OsmItemInfo from '$components/OsmItemInfo.svelte';
	import RouteScreen from '$components/RouteScreen.svelte';
	import DonationPopup from '$components/DonationPopup.svelte';
	import VehicleInfo from '$components/vehicle_info.svelte';

	export let latest_item_on_stack: StackInterface | null;
	export let darkMode: boolean;
	export let usunits: boolean;
	export let showDonationPopup = false;
	export let dismissDonationPopup: () => void = () => {};
</script>

<div class="md:mt-12"></div>

{#if latest_item_on_stack != null}
	{#if latest_item_on_stack.data instanceof MapSelectionScreen}
		{#await import('$components/MapSelectionScreen.svelte') then { default: MapSelectionScreenComponent }}
			<MapSelectionScreenComponent map_selection_screen={latest_item_on_stack.data} {darkMode} />
		{:catch error}
			<p class="p-4 text-red-500">Error loading component: {error.message}</p>
		{/await}
	{/if}

	{#if latest_item_on_stack.data instanceof SettingsStack}
		<SettingsMenu />
	{/if}

	{#if latest_item_on_stack.data instanceof BlockStack}
		{#await import('$components/BlockScreen.svelte') then { default: BlockScreen }}
			<BlockScreen
				chateau={latest_item_on_stack.data.chateau_id}
				block_id={latest_item_on_stack.data.block_id}
				service_date={latest_item_on_stack.data.service_date}
			/>
		{:catch error}
			<p class="p-4 text-red-500">Error loading component: {error.message}</p>
		{/await}
	{/if}

	{#if latest_item_on_stack.data instanceof VehicleHistoryStack}
		{#await import('$components/VehicleHistoryScreen.svelte') then { default: VehicleHistoryScreen }}
			<VehicleHistoryScreen
				chateau={latest_item_on_stack.data.chateau_id}
				vehicle={latest_item_on_stack.data.vehicle_id}
				route_id={latest_item_on_stack.data.route_id}
			/>
		{:catch error}
			<p class="p-4 text-red-500">Error loading component: {error.message}</p>
		{/await}
	{/if}

	{#if latest_item_on_stack.data instanceof StopStack}
		{#await import('$components/StopScreen.svelte') then { default: StopScreen }}
			{#key latest_item_on_stack.data.stop_id}
				<StopScreen
					chateau={latest_item_on_stack.data.chateau_id}
					stop_id={latest_item_on_stack.data.stop_id}
					initial_is_now={latest_item_on_stack.data.is_now}
					initial_selected_unix_time={latest_item_on_stack.data.selected_unix_time}
				/>
			{/key}
		{/await}
	{/if}

	{#if latest_item_on_stack.data instanceof OsmStationStack}
		{#await import('$components/OsmStationScreen.svelte') then { default: OsmStationScreen }}
			{#key latest_item_on_stack.data.osm_id}
				<OsmStationScreen
					osm_id={latest_item_on_stack.data.osm_id}
					stationName={latest_item_on_stack.data.name}
					stationLat={latest_item_on_stack.data.lat}
					stationLon={latest_item_on_stack.data.lon}
					initial_is_now={latest_item_on_stack.data.is_now}
					initial_selected_unix_time={latest_item_on_stack.data.selected_unix_time}
				/>
			{/key}
		{/await}
	{/if}

	{#if latest_item_on_stack.data instanceof VehicleSelectedStack}
		<div class="flex h-full flex-col px-4 py-2 sm:px-2 lg:px-4">
			<HomeButton />
			<p>Tripless vehicle selected</p>
			<p>
				Chateau: <span class="font-mono text-semibold"
					>{latest_item_on_stack.data.chateau_id}</span
				>
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
		<HomeButton />
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
		<HomeButton />
		<RouteScreen {darkMode} routestack={latest_item_on_stack.data} />
	{/if}
{:else}
	<div class="flex h-full flex-col py-1">
		<div class="flex h-full flex-col select-text">
			{#if showDonationPopup}
				<div class="mx-3 mb-2 hidden md:block">
					<DonationPopup
						title="Help keep Catenary Maps running"
						message="Our aging server is reaching its limits. Your support helps us replace it and add the computing power needed to release trip planning and navigation."
						on:dismiss={dismissDonationPopup}
					/>
				</div>
			{/if}

			<NearbyDepartures
				{usunits}
				{darkMode}
				initial_is_now={true}
				initial_selected_unix_time={Date.now() / 1000}
			/>
		</div>
	</div>
{/if}
