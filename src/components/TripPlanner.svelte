<script lang="ts">
	import { data_stack_store } from '$root/globalstores';
	import { TripPlannerStack } from '$components/stackenum';

	let origin = '';
	let destination = '';

	function closeDirections(): void {
		data_stack_store.update((stack) =>
			stack[stack.length - 1]?.data instanceof TripPlannerStack ? stack.slice(0, -1) : stack
		);
	}
</script>

<section aria-label="Directions / Trip Planner" class="flex h-full flex-col overflow-y-auto px-4 py-4">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-lg font-semibold">Directions</h2>
		<button type="button" on:click={closeDirections} aria-label="Exit directions" class="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800">
			<span class="material-symbols-outlined" aria-hidden="true">close</span>
			<span class="text-sm">Exit</span>
		</button>
	</div>
	<div class="flex flex-col gap-2">
		<label for="routing-origin" class="text-sm">From</label>
		<input id="routing-origin" type="text" bind:value={origin} placeholder="Choose a starting point" class="rounded-lg border border-gray-300 bg-transparent px-3 py-2 dark:border-gray-600" />
		<label for="routing-destination" class="text-sm">To</label>
		<input id="routing-destination" type="text" bind:value={destination} placeholder="Choose a destination" class="rounded-lg border border-gray-300 bg-transparent px-3 py-2 dark:border-gray-600" />
		<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Route search is not available yet.</p>
	</div>
</section>
