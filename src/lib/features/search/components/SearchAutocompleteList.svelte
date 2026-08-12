<script lang="ts">
	import { _, locale } from 'svelte-i18n';
	import RouteResultItem from './RouteResultItem.svelte';
	import StopRankingInfo from './StopRankingInfo.svelte';
	import { getTopHistory } from '../state/stationHistory';
	import {
		displayedResults,
		latestCypressResults,
		latestOsmStationResults,
		latestTransitResults,
		searchResultsLoading,
		searchText,
		selectResult,
		selectedResultIndex,
		type SearchResultItem
	} from '../state/searchData';

	export let length = 16;

	function getSubtitle(properties: Record<string, unknown>): string {
		const parts = [
			properties.housenumber,
			properties.street,
			properties.locality,
			properties.region,
			properties.country
		].filter((value): value is string => typeof value === 'string' && value.length > 0);

		if (parts.length > 0) {
			return parts.join(', ');
		}

		return typeof properties.display_name === 'string'
			? properties.display_name
			: typeof properties.layer === 'string'
				? properties.layer
				: '';
	}

	let visibleItems: SearchResultItem[] = [];
	$: currentLocale = $locale ?? 'default';

	$: {
		const items: SearchResultItem[] = [];

		if ($searchText.length > 0) {
			for (const station of $latestOsmStationResults?.results?.slice(0, length) ?? []) {
				items.push({ type: 'osm_station', data: station });
			}

			for (const feature of $latestCypressResults?.features?.slice(0, length) ?? []) {
				items.push({ type: 'cypress', data: feature });
			}

			const routeSection = $latestTransitResults?.routes_section;
			for (const rankedRoute of routeSection?.ranking.slice(0, length) ?? []) {
				const route = routeSection?.routes[rankedRoute.chateau]?.[rankedRoute.gtfs_id];
				if (route) {
					items.push({
						type: 'route',
						data: route,
						chateau: rankedRoute.chateau,
						gtfs_id: rankedRoute.gtfs_id
					});
				}
			}

			const stopSection = $latestTransitResults?.stops_section;
			for (const rankedStop of stopSection?.ranking.slice(0, length) ?? []) {
				const stop = stopSection?.stops[rankedStop.chateau]?.[rankedStop.gtfs_id];
				if (stop && !stop.parent_station && stop.osm_station_id == null) {
					items.push({
						type: 'stop',
						data: stop,
						chateau: rankedStop.chateau,
						gtfs_id: rankedStop.gtfs_id
					});
				}
			}
		} else {
			items.push(...getTopHistory(10));
		}

		visibleItems = items;
		displayedResults.set(items);
	}
</script>

<div id="search-autocomplete" class="flex flex-col">
	{#if visibleItems.length > 0}
		{#each visibleItems as item, index}
			{#if item.type === 'cypress'}
				<button
					on:click={() => selectResult(item)}
					class="px-3 cursor-pointer w-full {index === $selectedResultIndex
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
						{#if item.data.properties.names && item.data.properties.names[currentLocale] && item.data.properties.names[currentLocale].toLowerCase() !== item.data.properties.name.toLowerCase()}
							<p class="text-[11px] text-gray-600 dark:text-gray-400 -mt-0.5 leading-tight">
								{item.data.properties.names[currentLocale]}
							</p>
						{/if}
						<p class="text-[10px] text-gray-800 dark:text-gray-200">
							{getSubtitle(item.data.properties)}
						</p>
					</div>
				</button>
			{:else if item.type === 'route'}
				<div
					class={index === $selectedResultIndex
						? 'bg-gray-200 dark:bg-gray-700'
						: 'hover:bg-gray-200 dark:hover:bg-gray-700'}
				>
					<RouteResultItem
						chateau={item.chateau ?? ''}
						route_id={item.gtfs_id ?? ''}
						routeInfo={item.data}
						onClick={() => selectResult(item)}
					/>
				</div>
			{:else if item.type === 'stop'}
				<button
					class="px-3 cursor-pointer w-full flex flex-col content-start items-start align-left {index ===
					$selectedResultIndex
						? 'bg-gray-200 dark:bg-gray-700'
						: 'hover:bg-gray-200 dark:hover:bg-gray-700'}"
					on:click={() => selectResult(item)}
				>
					{#key item.gtfs_id}
						{#if item.data.osm_station_id == null}
							<StopRankingInfo
								stop={item.data}
								stops_section={$latestTransitResults?.stops_section ||
									((item as any).saved_routes ? { routes: (item as any).saved_routes } : null)}
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
					$selectedResultIndex
						? 'bg-gray-200 dark:bg-gray-700'
						: 'hover:bg-gray-200 dark:hover:bg-gray-700'}"
					on:click={() => selectResult(item)}
				>
					<div class="flex-1 flex flex-col text-left">
						<p class="font-medium dark:text-white leading-tight">
							{item.data.name}
						</p>
						{#if item.data.admin_hierarchy}
							{#if item.data.admin_hierarchy.neighbourhood || item.data.admin_hierarchy.county || item.data.admin_hierarchy.region}
								<p
									class="text-[11px] text-gray-600 dark:text-gray-400 -mt-0.5 leading-tight whitespace-break-spaces"
								>
									{[
										item.data.admin_hierarchy.neighbourhood?.name,
										item.data.admin_hierarchy.county?.name,
										item.data.admin_hierarchy.region?.name
									]
										.filter(Boolean)
										.join(', ')}
								</p>
							{/if}
						{/if}
						<div class="flex flex-row flex-wrap gap-1 mt-1">
							{#if item.data.routes && item.data.routes.length > 0}
								{#each item.data.routes as route}
									<div
										class="px-1.5 py-0.5 text-[10px] font-bold rounded"
										style="background-color: {route.color || '#cccccc'}; color: {route.text_color ||
											'#000000'};"
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

	{#if $searchResultsLoading}
		<div
			class="flex items-center justify-center gap-2 border-t border-gray-200 px-3 py-2 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300"
			role="status"
			aria-live="polite"
		>
			<span
				class="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700 dark:border-gray-600 dark:border-t-gray-200"
				aria-hidden="true"
			></span>
			<span>{$_('search_results_loading')}</span>
		</div>
	{/if}
</div>
