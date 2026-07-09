<script lang="ts">
	import type { RouteMinimal } from '../utils/models';
	import { MTA_CHATEAU_ID, isSubwayRouteId } from '../utils/mta_subway_utils';
	import { IDFM_CHATEAU_ID, isRatpRoute } from '../utils/ratp_utils';
	import MtaBullet from './mtabullet.svelte';
	import RatpBullet from './ratpbullet.svelte';
	import StationScreenRouteBadge from './StationScreenRouteBadge.svelte';

	export let connections: { chateau_id: string; route_id: string; route: RouteMinimal }[] = [];
	export let darkMode: boolean = false;
	export let text_size_class: string = "text-[10px]";

	$: national_rail_connections = connections.filter((c) => c.chateau_id === 'nationalrailuk');

	$: gwr_routes = national_rail_connections.filter((c) => c.route.agency_id === 'GW');
	$: sw_routes = national_rail_connections.filter((c) => c.route.agency_id === 'SW');
	$: sn_routes = national_rail_connections.filter((c) => c.route.agency_id === 'SN');
	$: cc_routes = national_rail_connections.filter((c) => c.route.agency_id === 'CC');
	$: le_routes = national_rail_connections.filter((c) => c.route.agency_id === 'LE');

	$: grouped_route_ids = new Set([
		...gwr_routes.map((c) => c.route_id),
		...sw_routes.map((c) => c.route_id),
		...sn_routes.map((c) => c.route_id),
		...cc_routes.map((c) => c.route_id),
		...le_routes.map((c) => c.route_id)
	]);
</script>

{#if gwr_routes.length > 0}
	<div class="flex flex-row items-center mr-2 bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded">
		<img
			src="/agencyicons/GreaterWesternRailway.svg"
			alt="Great Western Railway"
			class="h-3 inline-block dark:hidden mr-1"
		/>
		<img
			src="/agencyicons/GreaterWesternRailwayBrighter.svg"
			alt="Great Western Railway"
			class="h-3 hidden dark:inline-block mr-1"
		/>
		<span class="text-xs font-semibold">Great Western Railway</span>
	</div>
{/if}

{#if sw_routes.length > 0}
	<div class="flex flex-row items-center mr-2 bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded">
		<img
			src="/agencyicons/SouthWesternRailway.svg"
			alt="South Western Railway"
			class="h-3 inline-block mr-1"
		/>
		<span class="text-xs font-semibold">South Western Railway</span>
	</div>
{/if}

{#if sn_routes.length > 0}
	<div class="flex flex-row items-center mr-2 bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded">
		<img src="/agencyicons/SouthernIcon.svg" alt="Southern" class="h-3 inline-block mr-1" />
		<span class="text-xs font-semibold">Southern</span>
	</div>
{/if}

{#if cc_routes.length > 0}
	<div class="flex flex-row items-center mr-2 bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded">
		<img src="/agencyicons/c2c_logo.svg" alt="c2c" class="h-3 inline-block mr-1" />
		<span class="text-xs font-semibold">c2c</span>
	</div>
{/if}

{#if le_routes.length > 0}
	<div class="flex flex-row items-center mr-2 bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded">
		<span class="text-xs font-semibold">Greater Anglia</span>
	</div>
{/if}

{#each connections as conn}
	{#if !grouped_route_ids.has(conn.route_id) || conn.chateau_id !== 'nationalrailuk'}
		<StationScreenRouteBadge
			routeDef={conn.route}
			chateau={conn.chateau_id}
			fallback_long_name={true}
			{text_size_class}
			is_route_only={true}
		/>
	{/if}
{/each}
