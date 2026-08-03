<script lang="ts">
	import haversine from 'haversine-distance';
	import MtaBullet from '$components/mtabullet.svelte';
	import { geolocation_store } from '$root/globalstores';
	import { MTA_CHATEAU_ID, isSubwayRouteId } from '$root/utils/mta_subway_utils';

	export let stop: any;
	export let stops_section: any;
	export let stop_ranked: any;

	$: distanceMetres = calculateDistance($geolocation_store, stop);

	function calculateDistance(
		geolocation: GeolocationPosition | null,
		currentStop: any
	): number | null {
		if (!geolocation?.coords || currentStop?.point?.x == null || currentStop?.point?.y == null) {
			return null;
		}

		return haversine(
			{
				latitude: geolocation.coords.latitude,
				longitude: geolocation.coords.longitude
			},
			{
				latitude: currentStop.point.y,
				longitude: currentStop.point.x
			}
		);
	}
</script>

<div>
	<p class="flex cursor-pointer flex-col content-start items-start text-left dark:text-white">
		{stop.name}
		{#if stop.code}
			<span class="font-light">{' '}{stop.code}</span>
		{/if}
	</p>

	<div class="flex w-full flex-row flex-wrap gap-x-0.5 gap-y-1">
		{#if distanceMetres !== null}
			<p class="cursor-pointer text-xs dark:text-gray-50">
				{distanceMetres > 1000
					? `${(distanceMetres / 1000).toFixed(1)} km`
					: `${distanceMetres.toFixed(0)} m`}
			</p>
		{/if}

		{#if stops_section?.routes?.[stop_ranked.chateau]}
			{#each stop.routes ?? [] as routeId}
				{@const routeInfo = stops_section.routes[stop_ranked.chateau][routeId]}
				{#if routeInfo}
					{#if isSubwayRouteId(routeId) && MTA_CHATEAU_ID === stop_ranked.chateau}
						<MtaBullet route_short_name={routeInfo.short_name} matchTextHeight={true} />
					{:else}
						<div
							class="rounded-sm px-0.5 py-0.25 text-xs"
							style={`background-color: ${routeInfo.color}; color: ${routeInfo.text_color};`}
						>
							{#if routeInfo.short_name}
								<span class="font-medium">{routeInfo.short_name}</span>
							{:else if routeInfo.long_name}
								{routeInfo.long_name.replace(' Line', '')}
							{/if}
						</div>
					{/if}
				{/if}
			{/each}
		{/if}
	</div>
</div>
