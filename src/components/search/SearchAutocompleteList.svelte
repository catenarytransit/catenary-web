<script lang="ts">
	import { map_pointer_store } from './../../globalstores';
	import { get } from 'svelte/store';
	import {
		latest_query_data,
		text_input_store,
		autocomplete_focus_state,
		show_back_button_recalc,
		latest_cypress_data,
		latest_osm_station_data,
		selected_result_index_store,
		displayed_results_store,
		select_result_item,
		type SearchResultItem
	} from './search_data';
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
		custom_icons_category_to_layer_id,
		geolocation_store,
		chateaus_store,
		show_gtfs_ids_store,
		ui_theme_store,
		show_topo_global_store,
		current_orm_layer_type_store
	} from '../../globalstores';
	import StopRankingInfo from './StopRankingInfo.svelte';
	import { locale } from 'svelte-i18n';

	let current_locale_value: string | null = null;
	locale.subscribe((val) => {
		current_locale_value = val;
	});

	import { StopStack, StackInterface, OsmItemStack, RouteStack } from './../stackenum';
	import RouteResultItem from './RouteResultItem.svelte';

	export let length = 16;

	let geolocation: GeolocationPosition | null;

	geolocation_store.subscribe((g) => {
		geolocation = g;
	});

	function getSubtitle(props: any): string {
		let parts = [];
		if (props.housenumber) parts.push(props.housenumber);
		if (props.street) parts.push(props.street);
		if (props.locality) parts.push(props.locality);
		if (props.region) parts.push(props.region);
		if (props.country) parts.push(props.country);

		if (parts.length > 0) return parts.join(', ');
		return props.display_name || props.layer || '';
	}

	let visible_items: SearchResultItem[] = [];

	$: {
		let items: SearchResultItem[] = [];
		if ($text_input_store.length > 0) {
			if ($latest_osm_station_data && $latest_osm_station_data.results) {
				items = items.concat(
					$latest_osm_station_data.results
						.slice(0, length)
						.map((f) => ({ type: 'osm_station', data: f }))
					);
			}

			if ($latest_cypress_data && $latest_cypress_data.features) {
				items = items.concat(
					$latest_cypress_data.features
						.slice(0, length)
						.map((f) => ({ type: 'cypress', data: f }))
					);
			}

			if ($latest_query_data && $latest_query_data.routes_section) {
				$latest_query_data.routes_section.ranking.slice(0, length).forEach((route_ranked) => {
					if (
						$latest_query_data?.routes_section.routes[route_ranked.chateau] &&
						$latest_query_data.routes_section.routes[route_ranked.chateau][route_ranked.gtfs_id]
					) {
						items.push({
							type: 'route',
							data: $latest_query_data.routes_section.routes[route_ranked.chateau][
								route_ranked.gtfs_id
							],
							chateau: route_ranked.chateau,
							gtfs_id: route_ranked.gtfs_id
						});
					}
				});
			}

			if ($latest_query_data && $latest_query_data.stops_section) {
				$latest_query_data.stops_section.ranking.slice(0, length).forEach((stop_ranked) => {
					if (
						$latest_query_data?.stops_section.stops[stop_ranked.chateau] &&
						$latest_query_data.stops_section.stops[stop_ranked.chateau][stop_ranked.gtfs_id]
					) {
						if (
							!$latest_query_data.stops_section.stops[stop_ranked.chateau][stop_ranked.gtfs_id]
								.parent_station &&
							$latest_query_data.stops_section.stops[stop_ranked.chateau][stop_ranked.gtfs_id]
								.osm_station_id == null
						) {
							items.push({
								type: 'stop',
								data: $latest_query_data.stops_section.stops[stop_ranked.chateau][
									stop_ranked.gtfs_id
								],
								chateau: stop_ranked.chateau,
								gtfs_id: stop_ranked.gtfs_id
							});
						}
					}
				});
			}
		}
		visible_items = items;
		displayed_results_store.set(visible_items);
	}
</script>

<div id="search_autocomplete_a flex flex-col">
	{#if visible_items.length > 0}
		{#each visible_items as item, index}
			{#if item.type === 'cypress'}
				<button
					on:click={() => select_result_item(item)}
					class="px-3 cursor-pointer w-full {index === $selected_result_index_store
						? 'bg-gray-200 dark:bg-gray-700'
						: 'hover:bg-gray-200 dark:hover:bg-gray-700'}"
				>
					<div class="align-start flex flex-col content-start items-start text-left">
						<p class="font-medium dark:text-white">
							{item.data.properties.name}
							<span class="font-light text-xs text-gray-700 dark:text-gray-300"
								>{item.data.properties.layer}</span
							>
						</p>
						{#if item.data.properties.names && current_locale_value && item.data.properties.names[current_locale_value] && item.data.properties.names[current_locale_value].toLowerCase() !== item.data.properties.name.toLowerCase()}
							<p class="text-[11px] text-gray-600 dark:text-gray-400 -mt-0.5 leading-tight">
								{item.data.properties.names[current_locale_value]}
							</p>
						{/if}
						<p class="text-[10px] text-gray-800 dark:text-gray-200">
							{getSubtitle(item.data.properties)}
						</p>
					</div>
				</button>
			{:else if item.type === 'route'}
				<div
					class={index === $selected_result_index_store
						? 'bg-gray-200 dark:bg-gray-700'
						: 'hover:bg-gray-200 dark:hover:bg-gray-700'}
				>
					<RouteResultItem
						chateau={item.chateau}
						route_id={item.gtfs_id}
						routeInfo={item.data}
						onClick={() => select_result_item(item)}
					/>
				</div>
			{:else if item.type === 'stop'}
				<button
					class="px-3 cursor-pointer w-full flex flex-col content-start items-start align-left {index ===
					$selected_result_index_store
						? 'bg-gray-200 dark:bg-gray-700'
						: 'hover:bg-gray-200 dark:hover:bg-gray-700'}"
					on:click={() => select_result_item(item)}
				>
					{#key item.gtfs_id}
						{#if item.data.osm.station_id == null}
						<StopRankingInfo
							stop={item.data}
							stops_section={latest_query_data_local?.stops_section}
							stop_ranked={{
								chateau: item.chateau,
								gtfs_id: item.gtfs_id,
								score: 0 // Score not strictly needed for display here
							}}
							
						/>{/if}
					{/key}
				</button>
			{:else if item.type === 'osm_station'}
				<button
					class="px-3 cursor-pointer w-full flex flex-row items-center gap-2 py-2 {index ===
					$selected_result_index_store
						? 'bg-gray-200 dark:bg-gray-700'
						: 'hover:bg-gray-200 dark:hover:bg-gray-700'}"
					on:click={() => select_result_item(item)}
				>
					<div class="flex-1 flex flex-col text-left">
						<p class="font-medium dark:text-white leading-tight">
							{item.data.name}
						</p>
						{#if item.data.admin_hierarchy}
							{#if item.data.admin_hierarchy.neighbourhood || item.data.admin_hierarchy.county || item.data.admin_hierarchy.region}
								<p class="text-[11px] text-gray-600 dark:text-gray-400 -mt-0.5 leading-tight whitespace-break-spaces">
									{[
										item.data.admin_hierarchy.neighbourhood?.name,
										item.data.admin_hierarchy.county?.name,
										item.data.admin_hierarchy.region?.name
									].filter(Boolean).join(', ')}
								</p>
							{/if}
						{/if}
						<div class="flex flex-row flex-wrap gap-1 mt-1">
							{#if item.data.routes && item.data.routes.length > 0}
								{#each item.data.routes as route}
									<div 
										class="px-1.5 py-0.5 text-[10px] font-bold rounded"
										style="background-color: {route.color || '#cccccc'}; color: {route.text_color || '#000000'};"
									>
										{route.short_name || route.route_id}
									</div>
								{/each}
							{/if}
						</div>
					</div>
				</button>
			{/if}
		{/each}
	{/if}
</div>
