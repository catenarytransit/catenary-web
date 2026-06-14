<script lang="ts">
	// @ts-nocheck
	import { lightenColour } from './lightenDarkColour';
	import {
		MapSelectionScreen,
		StackInterface,
		SingleTrip,
		VehicleMapSelector,
		RouteStack,
		StopStack,
		RouteMapSelector,
		VehicleSelectedStack,
		StopMapSelector,
		OsmStationMapSelector,
		OsmStationStack
	} from '../components/stackenum';
	import HomeButton from './SidebarParts/home_button.svelte';
	import { get } from 'svelte/store';
	import { data_stack_store, show_gtfs_ids_store, show_osm_ids_store } from '../globalstores';
	import { _ } from 'svelte-i18n';
	import {
		fixHeadsignIcon,
		fixRouteName,
		fixRouteNameLong,
		fixRunNumber,
		fixHeadsignText
	} from './agencyspecific';
	import { MTA_CHATEAU_ID, isSubwayRouteId } from '../utils/mta_subway_utils';
	import { IDFM_CHATEAU_ID, isRatpRoute } from '../utils/ratp_utils';
	import { cleanStationName, cleanPlatformName } from '../utils/national_rail_utils';
	import MtaBullet from './mtabullet.svelte';
	import RatpBullet from './ratpbullet.svelte';
	import RouteSymbols from './RouteSymbols.svelte';

	export let map_selection_screen: MapSelectionScreen;
	export let darkMode: boolean;

	let stops_preview_data = null;
	let osm_stations_preview_data = {};

	let show_gtfs_ids = get(show_gtfs_ids_store);

	show_gtfs_ids_store.subscribe((value) => {
		show_gtfs_ids = value;
	});

	let show_osm_ids = get(show_osm_ids_store);

	show_osm_ids_store.subscribe((value) => {
		show_osm_ids = value;
	});

	$: if (map_selection_screen) {
		queryStopsPreview();
		queryOsmStationsPreview();
	}

	function queryStopsPreview() {
		let chateaus_to_query = {};

		map_selection_screen.arrayofoptions.forEach((option) => {
			if (option.data instanceof StopMapSelector) {
				if (option.data.chateau_id in chateaus_to_query) {
					chateaus_to_query[option.data.chateau_id].push(option.data.stop_id);
				} else {
					chateaus_to_query[option.data.chateau_id] = [option.data.stop_id];
				}
			}
		});

		if (Object.keys(chateaus_to_query).length === 0) {
			stops_preview_data = null;
			return;
		}

		fetch('https://birch.catenarymaps.org/stop_preview', {
			body: JSON.stringify({
				chateaus: chateaus_to_query
			}),
			headers: {
				'Content-Type': 'application/json'
			},
			method: 'POST'
		})
			.then((response) => {
				if (response.ok) {
					return response.json();
				} else {
					throw new Error('Network response was not ok');
				}
			})
			.then((data) => {
				stops_preview_data = data;
			});
	}

	function queryOsmStationsPreview() {
		map_selection_screen.arrayofoptions.forEach((option) => {
			if (option.data instanceof OsmStationMapSelector) {
				const osm_id = option.data.osm_id;
				if (osm_stations_preview_data[osm_id]) {
					return;
				}

				fetch(`https://birch.catenarymaps.org/osm_station_preview?osm_station_id=${osm_id}`)
					.then((response) => {
						if (response.ok) {
							return response.json();
						} else {
							throw new Error('Network response was not ok');
						}
					})
					.then((data) => {
						osm_stations_preview_data[osm_id] = data;
					})
					.catch((e) => {
						console.error(e);
					});
			}
		});
	}
</script>

<HomeButton />
<div class="px-4 flex flex-col w-full">
	<h1 class="text-lg md:text-2xl font-semibold leading-tight">
		{map_selection_screen.arrayofoptions.length}
		{$_('itemsselected')}
	</h1>
</div>
<div class="px-4 catenary-scroll overflow-y-auto pr-2 h-full pb-16">
	{#if map_selection_screen.arrayofoptions.filter((x) => x.data instanceof VehicleMapSelector).length > 0}
		<h3 class="text-xl my-1">{$_('vehicles')}</h3>
		<div class="flex flex-col gap-y-1 md:gap-y-2">
			{#each map_selection_screen.arrayofoptions.filter((x) => x.data instanceof VehicleMapSelector) as option}
				<div
					on:click={() => {
						data_stack_store.update((data_stack) => {
							if (option.data.trip_id) {
								data_stack.push(
									new StackInterface(
										new SingleTrip(
											option.data.chateau_id,
											option.data.trip_id,
											option.data.route_id,
											option.data.start_time,
											option.data.start_date,
											option.data.vehicle_id,
											option.data.route_type
										)
									)
								);
							} else {
								data_stack.push(
									new StackInterface(
										new VehicleSelectedStack(
											option.data.chateau_id,
											option.data.vehicle_id,
											option.data.gtfs_id
										)
									)
								);
							}
							return data_stack;
						});
					}}
					role="menuitem"
					tabindex="0"
					class="px-1 py-0.5 md:px-2 md:py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-100 hover:dark:bg-hover text-sm md:text-base leading-snug rounded-lg bg-opacity-80"
				>
					{#if show_gtfs_ids}
						<p>
							<span class="font-mono text-xs dark:text-gray-400 text-gray-500"
								>{option.data.chateau_id}</span
							>
							{#if option.data.route_id}
								<span class="font-mono text-xs dark:text-gray-400 text-gray-500 ml-1 font-semibold"
									>{option.data.route_id}</span
								>
							{/if}
						</p>
					{/if}
					{#if option.data.trip_id}
						{#if option.data.route_long_name || option.data.route_short_name}
							<span
								class="text-md"
								style={`color: ${darkMode ? lightenColour(option.data.colour) : option.data.colour}`}
							>
								{#if option.data.route_long_name && option.data.route_short_name && !option.data.route_long_name.includes(option.data.route_short_name)}
									<span class="font-bold"
										>{fixRouteName(
											option.data.chateau_id,
											option.data.route_short_name,
											option.data.route_id
										)}</span
									>
									<span class="font-normal ml-1"
										>{fixRouteNameLong(
											option.data.chateau_id,
											option.data.route_long_name,
											option.data.route_id
										)}</span
									>
								{:else}
									<span class="font-semibold"
										>{option.data.route_long_name
											? fixRouteNameLong(
													option.data.chateau_id,
													option.data.route_long_name,
													option.data.route_id
												)
											: fixRouteName(
													option.data.chateau_id,
													option.data.route_short_name,
													option.data.route_id
												)}</span
									>
								{/if}
							</span>
						{/if}
					{:else}
						<p>No Trip</p>
					{/if}

					<p class="text-sm lg:text-base mt-1">
						{#if fixRunNumber(option.data.chateau_id, option.data.route_type, option.data.route_id, option.data.trip_short_name, option.data.vehicle_id)}
							<span
								style={`background-color: ${option.data.colour}; color: ${option.data.text_colour};`}
								class="font-bold text-md px-1 py-0.5 mr-1 rounded-sm"
								>{fixRunNumber(
									option.data.chateau_id,
									option.data.route_type,
									option.data.route_id,
									option.data.trip_short_name,
									option.data.vehicle_id
								)}</span
							>
						{/if}
						{#if option.data.headsign && option.data.headsign != option.data.route_long_name && option.data.headsign != option.data.route_short_name}
							<span class="mr-1">
								<span class="material-symbols-outlined mr-0 align-middle -translate-y-0.5"
									>chevron_right</span
								>
								{fixHeadsignText(
									option.data.headsign,
									option.data.chateau_id,
									option.data.route_short_name || option.data.route_long_name
								)}
								{#if fixHeadsignIcon(option.data.headsign)}
									<span class="material-symbols-outlined text-sm align-middle"
										>{fixHeadsignIcon(option.data.headsign)}</span
									>
								{/if}
							</span>
						{/if}
						{#if option.data.vehicle_id && !(option.data.vehicle_id == fixRunNumber(option.data.chateau_id, option.data.route_type, option.data.route_id, option.data.trip_short_name, option.data.vehicle_id))}
							<span class="text-xs lg:text-base bg-gray-200 dark:bg-background px-1 rounded-md">
								<span class="material-symbols-outlined !text-xs">directions_bus</span>
								{option.data.vehicle_id}</span
							>
						{/if}
					</p>
				</div>
			{/each}
		</div>
	{/if}

	{#if map_selection_screen.arrayofoptions.filter((x) => x.data instanceof OsmStationMapSelector).length > 0}
		<h3 class="text-xl my-2">{$_('stations')}</h3>
		<div class="flex flex-col gap-y-1 md:gap-y-2">
			{#each map_selection_screen.arrayofoptions.filter((x) => x.data instanceof OsmStationMapSelector) as option}
				<div
					class="px-1 py-0.5 md:px-2 md:py-2 bg-gray-100 hover:bg-blue-100 dark:bg-gray-800 hover:dark:bg-hover text-sm md:text-base leading-snug rounded-lg bg-opacity-80"
					on:click={() => {
						data_stack_store.update((data_stack) => {
							data_stack.push(
								new StackInterface(
									new OsmStationStack(
										option.data.osm_id,
										option.data.name,
										option.data.mode_type,
										option.data.lat,
										option.data.lon
									)
								)
							);
							return data_stack;
						});
					}}
					role="menuitem"
					tabindex="0"
				>
					<p class="font-semibold">{option.data.name}</p>
					<p class="text-xs text-gray-500 dark:text-gray-400">
						{option.data.mode_type === 'subway'
							? 'Metro'
							: option.data.mode_type === 'rail'
								? 'Rail'
								: option.data.mode_type === 'tram' || option.data.mode_type === 'light_rail'
									? 'Tram'
									: option.data.mode_type}
					</p>
					{#if show_osm_ids}
						<p class="font-mono text-xs dark:text-gray-400 text-gray-500">osm id: {option.data.osm_id}</p>
					{/if}

					{#if osm_stations_preview_data[option.data.osm_id] && osm_stations_preview_data[option.data.osm_id].stops}
						{@const allRouteIds = [
							...new Set(
								Object.values(osm_stations_preview_data[option.data.osm_id].stops)
									.flatMap((layer) => Object.values(layer))
									.flatMap((s) => s.routes || [])
									.sort()
							)
						]}
						{@const networks = osm_stations_preview_data[option.data.osm_id].routes}
						<RouteSymbols
							routeIds={allRouteIds}
							getRouteInfo={(routeId) =>
								Object.values(networks)
									.flatMap((n) => Object.values(n))
									.find((r) => r.route_id === routeId)}
							chateau_id={null}
						/>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	{#if map_selection_screen.arrayofoptions.filter((x) => x.data instanceof StopMapSelector).length > 0}
		<h3 class="text-xl my-2">{$_('stops')}</h3>
		<div class="flex flex-col gap-y-1 md:gap-y-2">
			{#each map_selection_screen.arrayofoptions.filter((x) => x.data instanceof StopMapSelector) as option}
				<div
					class="px-1 py-0.5 md:px-2 md:py-2 bg-gray-100 hover:bg-blue-100 dark:bg-gray-800 hover:dark:bg-hover text-sm md:text-base leading-snug rounded-lg bg-opacity-80"
					on:click={() => {
						data_stack_store.update((data_stack) => {
							data_stack.push(
								new StackInterface(new StopStack(option.data.chateau_id, option.data.stop_id))
							);

							return data_stack;
						});
					}}
				>
					<div>
						{#if show_gtfs_ids}
							<span class="font-mono text-xs dark:text-gray-400 text-gray-500"
								>{option.data.chateau_id}</span
							>
							{#if option.data.stop_id}
								<span class="font-mono text-xs dark:text-gray-400 text-gray-500"
									>{option.data.stop_id}</span
								>
							{/if}{/if}
					</div>

					<p>
						{cleanStationName(option.data.stop_name)}
					</p>

					{#if stops_preview_data}
						{#if stops_preview_data.stops[option.data.chateau_id] && stops_preview_data.stops[option.data.chateau_id][option.data.stop_id]}
							<div>
								{#if stops_preview_data.stops[option.data.chateau_id][option.data.stop_id].level_id}
									<span class="text-sm"
										>{$_('level')}
										{stops_preview_data.stops[option.data.chateau_id][option.data.stop_id]
											.level_id}</span
									>
								{/if}
								{#if stops_preview_data.stops[option.data.chateau_id][option.data.stop_id].platform_code}
									<span class="text-sm"
										>{$_('platform')}
										{cleanPlatformName(
											stops_preview_data.stops[option.data.chateau_id][option.data.stop_id]
												.platform_code
										)}</span
									>
								{/if}
							</div>

							<RouteSymbols
								routeIds={stops_preview_data.stops[option.data.chateau_id][option.data.stop_id]
									.routes}
								getRouteInfo={(routeId) =>
									stops_preview_data.routes[option.data.chateau_id][routeId]}
								chateau_id={option.data.chateau_id}
							/>
						{/if}
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	{#if map_selection_screen.arrayofoptions.filter((x) => x.data instanceof RouteMapSelector).length > 0}
		<h3 class="text-xl my-2">{$_('routes')}</h3>
		<div class="flex flex-col gap-y-1 md:gap-y-2">
			{#each map_selection_screen.arrayofoptions.filter((x) => x.data instanceof RouteMapSelector) as option}
				<div
					class="px-1 py-0.5 md:px-2 md:py-2 bg-gray-100 hover:bg-blue-100 dark:bg-gray-800 hover:dark:bg-hover text-sm md:text-base leading-snug rounded-lg bg-opacity-80"
					on:click={() => {
						data_stack_store.update((data_stack) => {
							data_stack.push(
								new StackInterface(new RouteStack(option.data.chateau_id, option.data.route_id))
							);

							return data_stack;
						});
					}}
				>
					{#if show_gtfs_ids}
						<p>
							<span class="font-mono text-xs dark:text-gray-400 text-gray-500"
								>{option.data.chateau_id}</span
							>
							{#if option.data.route_id}
								<span class="font-mono text-xs dark:text-gray-400 text-gray-500 ml-1 font-semibold"
									>{option.data.route_id.replace(/^\"/, '').replace(/\"$/, '')}</span
								>
							{/if}
						</p>
					{/if}
					{#if isSubwayRouteId(option.data.route_id) && option.data.chateau_id === MTA_CHATEAU_ID}
						<MtaBullet route_short_name={option.data.name} matchTextHeight={false} />
					{:else if option.data.chateau_id === IDFM_CHATEAU_ID && isRatpRoute(option.data.name)}
						<RatpBullet route_short_name={option.data.name} matchTextHeight={false} />
					{:else if option.data.name}
						<span
							style={`color: ${darkMode ? lightenColour(option.data.colour) : option.data.colour}`}
						>
							{option.data.name}
						</span>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
	<br />
	<br />
	<br />
</div>
