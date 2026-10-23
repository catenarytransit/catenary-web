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

    <!-- Container for inputs and connector graphics -->
    <div class="relative flex flex-col gap-2">
        <!-- Visual Connector Column -->
        <div class="absolute left-0 top-0 bottom-0 flex w-6 flex-col items-center py-4" aria-hidden="true">
            <!-- Top Circle (Origin) -->
            <div class="h-3 w-3 rounded-full border-2 border-gray-600 bg-white dark:border-gray-300 dark:bg-gray-900"></div>
            <!-- Connecting Line -->
            <div class="w-0.5 flex-grow bg-gray-300 dark:bg-gray-600"></div>
            <!-- Bottom Circle (Destination) -->
            <div class="h-3 w-3 rounded-full border-2 border-gray-600 bg-gray-600 dark:border-gray-300 dark:bg-gray-300"></div>
        </div>

        <!-- Input Rows -->
        <div class="flex items-center pl-8">
            <input 
                id="routing-origin" 
                type="text" 
                bind:value={origin} 
                placeholder="Choose start" 
                class="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700" 
            />
        </div>

        <div class="flex items-center pl-8">
            <input 
                id="routing-destination" 
                type="text" 
                bind:value={destination} 
                placeholder="Choose destination" 
                class="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700" 
            />
        </div>
    </div>
</section>