<script lang="ts">
	import { get } from 'svelte/store';
	import {
		data_stack_store,
		map_pointer_store,
		nearby_pick_state_store,
		nearby_user_picks_store
	} from '$root/globalstores';

	export let name: string;
	export let address: string;
	export let lat: number;
	export let lon: number;

	function showNearbyDepartures(): void {
		nearby_pick_state_store.set(1);
		nearby_user_picks_store.set({ latitude: lat, longitude: lon });

		const map = get(map_pointer_store);
		map?.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 15) });

		// NearbyDepartures is the default sidebar screen. Clearing the current
		// OsmItem leaves the selected coordinate in the nearby-pick stores so the
		// departures view opens for this place rather than the user's GPS location.
		data_stack_store.set([]);
	}
</script>

<div class="mx-3 flex flex-col gap-4 py-2">
	<div>
		<h1 class="text-lg font-medium">{name}</h1>
		{#if address}
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">{address}</p>
		{/if}
	</div>

	<button
		type="button"
		class="flex w-fit cursor-pointer items-center gap-2 rounded-full bg-sky-500 px-3 py-1 font-medium text-white hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-500"
		on:click={showNearbyDepartures}
	>
		<span class="material-symbols-outlined text-base">departure_board</span>
		Nearby departures from this point
	</button>
</div>
