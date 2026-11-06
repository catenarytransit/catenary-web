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

<div class="mx-1 my-2 flex gap-2 overflow-x-auto" role="group" aria-label="Plan a journey from or to this place">
	<button
		type="button"
		disabled={!available}
		on:click={() => openPlanner('origin')}
		class="inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-gray-500 bg-transparent px-6 text-sm font-medium text-sky-700 enabled:hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-400 dark:text-sky-300 dark:enabled:hover:bg-gray-700 dark:focus-visible:ring-offset-gray-900"
	>
		<svg class="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
			<path d="M16,12 L23,12 M16,12 A7,7 0,1 0,2 12 A7,7 0,1 0,16 12 M12.5,12 A3.5,3.5 0,1 0,5.5 12 A3.5,3.5 0,1 0,12.5 12" />
		</svg>
		As origin
	</button>
	<button
		type="button"
		disabled={!available}
		on:click={() => openPlanner('destination')}
		class="inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-gray-500 bg-transparent px-6 text-sm font-medium text-sky-700 enabled:hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-400 dark:text-sky-300 dark:enabled:hover:bg-gray-700 dark:focus-visible:ring-offset-gray-900"
	>
		<svg class="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" aria-hidden="true">
			<path fill="none" stroke="currentColor" stroke-width="1.5" d="M1,12 L8,12 M22,12 A7,7 0,1 0,8 12 A7,7 0,1 0,22 12" />
			<path fill="currentColor" d="M18.5,12 A3.5,3.5 0,1 0,11.5 12 A3.5,3.5 0,1 0,18.5 12" />
		</svg>
		As destination
	</button>
</div>
