<script lang="ts">
	import { data_stack_store } from '$root/globalstores';
	import { StackInterface, TripPlannerStack } from './stackenum';
	import {
		isValidCoordinates,
		type DirectionsLocation
	} from '$lib/features/search/state/directionsSearch';
	import { rememberDirectionsLocation } from '$lib/features/directions/recentLocations';
	import { autocompleteFocus } from '$lib/features/search/state/searchData';

	export let name: string;
	export let lat: number | null = null;
	export let lon: number | null = null;
	export let address = '';
	export let kind: DirectionsLocation['kind'] = 'place';
	export let locationKey = '';

	$: available = name.trim().length > 0 && isValidCoordinates(lat ?? NaN, lon ?? NaN);

	function openPlanner(field: 'origin' | 'destination'): void {
		if (!available || lat == null || lon == null) return;
		const location: DirectionsLocation = {
			key: locationKey || kind + ':' + lat + ':' + lon,
			kind, name: name.trim(), address, lat, lon
		};
		rememberDirectionsLocation(location);
		autocompleteFocus.set(false);
		const planner = field === 'origin'
			? new TripPlannerStack(lat, lon, location.name)
			: new TripPlannerStack(null, null, null, lat, lon, location.name);
		// Push, rather than replace, so Exit returns to the same detail screen.
		data_stack_store.update((stack) => [...stack, new StackInterface(planner)]);
	}
</script>

<div class="mx-1 my-2 flex flex-wrap gap-2" role="group" aria-label="Plan a journey from or to this place">
	<button
		type="button"
		disabled={!available}
		on:click={() => openPlanner('origin')}
		class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
	>
		<span class="material-symbols-outlined text-lg" aria-hidden="true">trip_origin</span>
		As origin
	</button>
	<button
		type="button"
		disabled={!available}
		on:click={() => openPlanner('destination')}
		class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-sky-600 bg-white px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:text-sky-300 dark:hover:bg-gray-700"
	>
		<span class="material-symbols-outlined text-lg" aria-hidden="true">place</span>
		As destination
	</button>
</div>
