<script lang="ts">
	import haversine from 'haversine-distance';
	import { geolocation_store } from '$root/globalstores';

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

	{#if distanceMetres !== null}
		<p class="cursor-pointer text-xs dark:text-gray-50">
			{distanceMetres > 1000 ? `${(distanceMetres / 1000).toFixed(1)} km` : `${distanceMetres.toFixed(0)} m`}
		</p>
	{/if}
</div>
