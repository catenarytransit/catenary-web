<script lang="ts">
	// @ts-nocheck
	import { isSubwayRouteId, MTA_CHATEAU_ID } from '../utils/mta_subway_utils';
	import { IDFM_CHATEAU_ID, isRatpRoute } from '../utils/ratp_utils';
	import MtaBullet from './mtabullet.svelte';
	import RatpBullet from './ratpbullet.svelte';
	import { getAgencyInfo } from '../utils/national_rail_utils';

	import { _ } from 'svelte-i18n';
	import StationScreenRouteBadge from './StationScreenRouteBadge.svelte';

	import type { Route } from '../utils/models';

	// Route type categories: Rail (2), Metro (1), Tram (0), Bus (3), Other (everything else)
	function getRouteCategory(
		routeType: number | undefined
	): 'rail' | 'metro' | 'tram' | 'bus' | 'other' {
		switch (routeType) {
			case 2:
				return 'rail';
			case 1:
				return 'metro';
			case 0:
				return 'tram';
			case 3:
				return 'bus';
			default:
				return 'other';
		}
	}

	// Props
	export let routeIds: string[] = [];
	export let getRouteInfo: (routeId: string) => Route | undefined;
	// For GTFS stops, pass the chateau_id. For OSM stations, pass null/undefined
	export let chateau_id: string | null = null;

	// Computed values for UK National Rail grouping
	// Computed values for UK National Rail grouping
	$: agency_lookups = routeIds.map((r) => {
		const info = getRouteInfo(r);
		return {
			r,
			agency: getAgencyInfo(info?.agency_id)
		};
	});

	$: grouped_agencies = (() => {
		const unique = new Map();
		agency_lookups.forEach((item) => {
			if (item.agency) {
				unique.set(item.agency.name, item.agency);
			}
		});
		return Array.from(unique.values());
	})();

	$: handled_route_ids = new Set(
		agency_lookups.filter((item) => item.agency).map((item) => item.r)
	);

	// Filter out grouped routes and sort by route type category
	$: ungrouped_routes = routeIds.filter((r) => !handled_route_ids.has(r));
	$: rail_routes = ungrouped_routes.filter(
		(r) => getRouteCategory(getRouteInfo(r)?.route_type) === 'rail'
	);
	$: metro_routes = ungrouped_routes.filter(
		(r) => getRouteCategory(getRouteInfo(r)?.route_type) === 'metro'
	);
	$: tram_routes = ungrouped_routes.filter(
		(r) => getRouteCategory(getRouteInfo(r)?.route_type) === 'tram'
	);
	$: bus_routes = ungrouped_routes.filter(
		(r) => getRouteCategory(getRouteInfo(r)?.route_type) === 'bus'
	);
	$: other_routes = ungrouped_routes.filter(
		(r) => getRouteCategory(getRouteInfo(r)?.route_type) === 'other'
	);

	// Track which categories have content (including UK rail grouped routes for rail category)
	$: has_rail = grouped_agencies.length > 0 || rail_routes.length > 0;
	$: has_metro = metro_routes.length > 0;
	$: has_tram = tram_routes.length > 0;
	$: has_bus = bus_routes.length > 0;
	$: has_other = other_routes.length > 0;

	// Check if a route should show MTA bullet
	function shouldShowMtaBullet(routeId: string, routeInfo: Route | undefined): boolean {
		if (!isSubwayRouteId(routeId)) return false;
		// For GTFS stops, check chateau_id
		if (chateau_id) return chateau_id === MTA_CHATEAU_ID;
		// For OSM stations, check agency_id
		return routeInfo?.agency_id === 'Metropolitan Transportation Authority';
	}

	// Check if a route should show RATP bullet
	function shouldShowRatpBullet(routeInfo: Route | undefined): boolean {
		if (!routeInfo?.short_name || !isRatpRoute(routeInfo.short_name)) return false;
		// For GTFS stops, check chateau_id
		if (chateau_id) return chateau_id === IDFM_CHATEAU_ID;
		// For OSM stations, check agency_id
		return routeInfo?.agency_id?.includes('Île-de-France') ?? false;
	}
</script>

<div class="flex flex-row gap-x-0.5 w-full flex-wrap gap-y-1 items-center">
	{#if has_rail}
		<div class="font-bold text-sm mr-1">{$_('headingRail')}:</div>
	{/if}
	<!-- RAIL category (UK grouped routes + rail_routes) -->
	<!-- RAIL category (UK grouped routes + rail_routes) -->
	{#each grouped_agencies as agency}
		<div class="flex flex-row items-center mr-2 bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded">
			{#if agency.icon}
				<img
					src={`https://maps.catenarymaps.org/agencyicons/${agency.icon}`}
					alt={agency.name}
					class="h-3 inline-block mr-1"
				/>
			{/if}
			<span class="text-xs font-semibold">{agency.name}</span>
		</div>
	{/each}

	{#each rail_routes as routeId}
		{@const routeInfo = getRouteInfo(routeId)}
		{#if routeInfo}
			<StationScreenRouteBadge
				routeDef={routeInfo}
				chateau={routeInfo.chateau}
				fallback_long_name={true}
				text_size_class="text-xs"
				is_route_only={true}
			/>
		{/if}
	{/each}

	<!-- Separator after RAIL -->
	{#if has_rail && (has_metro || has_tram || has_bus || has_other)}
		<span class="text-gray-400 dark:text-gray-600 mx-1">|</span>
	{/if}

	{#if has_metro}
		<div class="font-bold text-sm mr-1">{$_('headingMetro')}:</div>
	{/if}

	<!-- METRO category -->
	{#each metro_routes as routeId}
		{@const routeInfo = getRouteInfo(routeId)}
		{#if routeInfo}
			<StationScreenRouteBadge
				routeDef={routeInfo}
				chateau={routeInfo.chateau}
				fallback_long_name={true}
				text_size_class="text-xs"
				is_route_only={true}
			/>
		{/if}
	{/each}

	<!-- Separator after METRO -->
	{#if has_metro && (has_tram || has_bus || has_other)}
		<span class="text-gray-400 dark:text-gray-600 mx-1">|</span>
	{/if}

	{#if has_tram}
		<div class="font-bold text-sm mr-1">{$_('headingTram')}:</div>
	{/if}

	<!-- TRAM category -->
	{#each tram_routes as routeId}
		{@const routeInfo = getRouteInfo(routeId)}
		{#if routeInfo}
			<StationScreenRouteBadge
				routeDef={routeInfo}
				chateau={routeInfo.chateau}
				fallback_long_name={true}
				text_size_class="text-xs"
				is_route_only={true}
			/>
		{/if}
	{/each}

	<!-- Separator after TRAM -->
	{#if has_tram && (has_bus || has_other)}
		<span class="text-gray-400 dark:text-gray-600 mx-1">|</span>
	{/if}

	{#if has_bus}
		<div class="font-bold text-sm mr-1">{$_('headingBus')}:</div>
	{/if}

	<!-- BUS category -->
	{#each bus_routes as routeId}
		{@const routeInfo = getRouteInfo(routeId)}
		{#if routeInfo}
			<StationScreenRouteBadge
				routeDef={routeInfo}
				chateau={routeInfo.chateau}
				fallback_long_name={true}
				text_size_class="text-xs"
				is_route_only={true}
			/>
		{/if}
	{/each}

	<!-- Separator after BUS -->
	{#if has_bus && has_other}
		<span class="text-gray-400 dark:text-gray-600 mx-1">|</span>
	{/if}

	{#if has_other}
		<div class="font-bold text-sm mr-1">{$_('headingOther')}:</div>
	{/if}

	<!-- OTHER category -->
	{#each other_routes as routeId}
		{@const routeInfo = getRouteInfo(routeId)}
		{#if routeInfo}
			<StationScreenRouteBadge
				routeDef={routeInfo}
				chateau={routeInfo.chateau}
				fallback_long_name={true}
				text_size_class="text-xs"
				is_route_only={true}
			/>
		{/if}
	{/each}
</div>
