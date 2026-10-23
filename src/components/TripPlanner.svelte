<script lang="ts">
	import { onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { data_stack_store, geolocation_store, map_pointer_store } from '$root/globalstores';
	import { TripPlannerStack } from '$components/stackenum';
	import {
		streamDirectionsSuggestions,
		type DirectionsSuggestion,
		type SearchFocus
	} from '$lib/features/search/state/searchProviders';

	type Field = 'origin' | 'destination';
	let origin = '';
	let destination = '';
	let originSelection: DirectionsSuggestion | null = null;
	let destinationSelection: DirectionsSuggestion | null = null;
	let activeField: Field | null = null;
	let suggestions: DirectionsSuggestion[] = [];
	let highlighted = -1;
	let loading = false;
	let searchError = false;
	let controller: AbortController | null = null;
	let requestId = 0;

	function cancelSearch(): void {
		controller?.abort();
		controller = null;
		loading = false;
	}

	function getFocus(): SearchFocus | undefined {
		const map = get(map_pointer_store);
		if (!map) return undefined;
		const center = map.getCenter();
		const user = get(geolocation_store);
		return {
			lat: center.lat,
			lon: center.lng,
			zoom: map.getZoom(),
			...(user?.coords ? {
				userLat: user.coords.latitude,
				userLon: user.coords.longitude
			} : {})
		};
	}

	function querySuggestions(field: Field): void {
		cancelSearch();
		activeField = field;
		highlighted = -1;
		suggestions = [];
		searchError = false;
		const text = (field === 'origin' ? origin : destination).trim();
		const id = ++requestId;
		if (!text) return;
		loading = true;
		const current = new AbortController();
		controller = current;
		void streamDirectionsSuggestions(text, getFocus(), current.signal, (items) => {
			if (id === requestId && !current.signal.aborted) {
				suggestions = items;
				highlighted = -1;
			}
		}).catch((error) => {
			if (!current.signal.aborted && id === requestId) {
				searchError = true;
				console.error('Directions location search failed', error);
			}
		}).finally(() => {
			if (id === requestId) loading = false;
		});
	}

	function updateField(field: Field, value: string): void {
		if (field === 'origin') {
			origin = value;
			originSelection = null;
		} else {
			destination = value;
			destinationSelection = null;
		}
		querySuggestions(field);
	}

	function chooseSuggestion(item: DirectionsSuggestion): void {
		if (activeField === 'origin') {
			origin = item.name;
			originSelection = item;
		} else if (activeField === 'destination') {
			destination = item.name;
			destinationSelection = item;
		}
		requestId++;
		cancelSearch();
		activeField = null;
		suggestions = [];
		highlighted = -1;
		// Both selections retain lat/lon for the routing request in a subsequent change.
	}

	function handleKeydown(event: KeyboardEvent, field: Field): void {
		if (event.key === 'Escape') {
			activeField = null;
			requestId++;
			cancelSearch();
			return;
		}
		if (activeField !== field || !suggestions.length) return;
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			highlighted = (highlighted + 1) % suggestions.length;
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			highlighted = (highlighted - 1 + suggestions.length) % suggestions.length;
		} else if (event.key === 'Enter' && highlighted >= 0) {
			event.preventDefault();
			chooseSuggestion(suggestions[highlighted]);
		}
	}

	function closeDirections(): void {
		requestId++;
		cancelSearch();
		data_stack_store.update((stack) =>
			stack[stack.length - 1]?.data instanceof TripPlannerStack ? stack.slice(0, -1) : stack
		);
	}

	onDestroy(() => {
		requestId++;
		cancelSearch();
	});
</script>

<section aria-label="Directions / Trip Planner" class="flex h-full flex-col overflow-visible px-4 py-4">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-lg font-semibold">Directions</h2>
		<button type="button" on:click={closeDirections} aria-label="Exit directions" class="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800">
			<span class="material-symbols-outlined" aria-hidden="true">close</span>
			<span class="text-sm">Exit</span>
		</button>
	</div>

	<div class="relative">
		<!-- Container for inputs and connector graphics -->
		<div class="relative flex flex-col gap-2">
			<div class="absolute bottom-0 left-0 top-0 flex w-6 flex-col items-center py-4" aria-hidden="true">
				<div class="h-3 w-3 rounded-full border-2 border-gray-600 bg-white dark:border-gray-300 dark:bg-gray-900"></div>
				<div class="w-0.5 flex-grow bg-gray-300 dark:bg-gray-600"></div>
				<div class="h-3 w-3 rounded-full border-2 border-gray-600 bg-gray-600 dark:border-gray-300 dark:bg-gray-300"></div>
			</div>

			<div class="flex items-center pl-8">
				<input
					id="routing-origin"
					type="text"
					value={origin}
					on:input={(event) => updateField('origin', event.currentTarget.value)}
					on:focus={() => querySuggestions('origin')}
					on:keydown={(event) => handleKeydown(event, 'origin')}
					autocomplete="off"
					aria-autocomplete="list"
					aria-expanded={activeField === 'origin'}
					aria-controls="directions-suggestions"
					placeholder="Choose start"
					class="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700"
				/>
			</div>

			<div class="flex items-center pl-8">
				<input
					id="routing-destination"
					type="text"
					value={destination}
					on:input={(event) => updateField('destination', event.currentTarget.value)}
					on:focus={() => querySuggestions('destination')}
					on:keydown={(event) => handleKeydown(event, 'destination')}
					autocomplete="off"
					aria-autocomplete="list"
					aria-expanded={activeField === 'destination'}
					aria-controls="directions-suggestions"
					placeholder="Choose destination"
					class="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700"
				/>
			</div>
		</div>

		<!-- Floating suggestions overlap the future routing-results area, not the input rows. -->
		{#if activeField && (loading || searchError || suggestions.length > 0)}
			<div
				id="directions-suggestions"
				role="listbox"
				aria-label="Location suggestions"
				class="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
			>
				{#each suggestions as suggestion, index (suggestion.id)}
					<button
						type="button"
						role="option"
						aria-selected={index === highlighted}
						class="flex w-full min-w-0 items-center gap-2 px-3 py-3 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 {index === highlighted ? 'bg-gray-100 dark:bg-gray-800' : ''}"
						on:click={() => chooseSuggestion(suggestion)}
					>
						<span class="material-symbols-outlined shrink-0 text-gray-500" aria-hidden="true">
							{suggestion.kind === 'station' ? 'train' : suggestion.kind === 'stop' ? 'directions_bus' : 'place'}
						</span>
						<span class="min-w-0 flex-1 truncate">
							<span class="font-medium">{suggestion.name}</span>
							{#if suggestion.address}<span class="text-gray-500 dark:text-gray-400">, {suggestion.address}</span>{/if}
						</span>
					</button>
				{/each}
				{#if loading}<p class="px-3 py-2 text-xs text-gray-500" role="status">Searching locations…</p>{/if}
				{#if searchError}<p class="px-3 py-2 text-xs text-red-600" role="status">Unable to load location suggestions.</p>{/if}
			</div>
		{/if}
	</div>
</section>
