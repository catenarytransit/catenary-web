<script lang="ts">
	import type { DepartureRouteFilter } from '$lib/features/departures/routeFilters';
	import StationScreenRouteBadge from './StationScreenRouteBadge.svelte';
	import MtaBullet from './mtabullet.svelte';
	import RatpBullet from './ratpbullet.svelte';
	import { MTA_CHATEAU_ID, isSubwayRouteId } from '../utils/mta_subway_utils';
	import { IDFM_CHATEAU_ID, isRatpRoute } from '../utils/ratp_utils';

	export let filters: DepartureRouteFilter[];
	export let selected: Set<string>;
	export let onToggle: (key: string) => void;
	export let onReset: () => void;
</script>

<div class="flex items-center gap-1 mb-2" role="group" aria-label="Filter routes">
	<div class="catenary-scroll flex flex-1 min-w-0 overflow-x-auto gap-1">
		{#each filters as filter (filter.key)}
			<button
				type="button"
				class="shrink-0 min-h-10 px-1 rounded-sm cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-500"
				style:opacity={selected.size === 0 || selected.has(filter.key) ? 1 : 0.35}
				aria-label={filter.name}
				aria-pressed={selected.has(filter.key)}
				on:click={() => onToggle(filter.key)}
			>
				{#if filter.chateau === MTA_CHATEAU_ID && [...filter.routeIds].some(isSubwayRouteId)}
					<MtaBullet route_short_name={filter.name} matchTextHeight={true} />
				{:else if filter.chateau === IDFM_CHATEAU_ID && isRatpRoute(filter.name)}
					<RatpBullet route_short_name={filter.name} matchTextHeight={true} />
				{:else}
					<StationScreenRouteBadge
						chateau={filter.chateau}
						routeDef={{ ...filter.route, short_name: filter.name }}
					/>
				{/if}
			</button>
		{/each}
	</div>
	{#if selected.size > 0}
		<button
			type="button"
			class="shrink-0 min-h-10 min-w-10 rounded-sm cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-500"
			aria-label="Reset route filters"
			on:click={onReset}
		>
			<span class="material-symbols-outlined" aria-hidden="true">close</span>
		</button>
	{/if}
</div>
