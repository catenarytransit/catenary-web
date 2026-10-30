<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { slide } from 'svelte/transition';
	import { Marker, type Map as MapLibreMap } from 'maplibre-gl';
	import { get } from 'svelte/store';
	import { data_stack_store, geolocation_store, map_pointer_store } from '$root/globalstores';
	import { TripPlannerStack } from '$components/stackenum';
	import { queryEdelweiss, resolveDepartureUnixSeconds, type EdelweissItinerary, isValidPoint, DEFAULT_STREET_ROUTING_SETTINGS, DEFAULT_DIRECT_TRAVEL_TIME_SECONDS, defaultTransitAccessTimeSeconds, formatWalkingPace, walkingPaceToKilometresPerHour, walkingPaceToSliderPosition, walkingSliderPositionToPace, WALKING_PACE_MIN_SECONDS_PER_KM, WALKING_PACE_MAX_SECONDS_PER_KM, type StreetMode } from '$lib/features/directions/edelweiss';
	import DatePicker from '$components/DatePicker.svelte';
	import TripItineraryDetails from '$components/TripItineraryDetails.svelte';
	import JourneyPreviewTimeline from '$components/JourneyPreviewTimeline.svelte';
	import { activeItineraries, activeItineraryIndex, selectedTransferItineraryIndex, fitDirectionsItinerary } from '$lib/features/directions/mapRoutes';
	import { getRecentDirectionsLocations, rememberDirectionsLocation } from '$lib/features/directions/recentLocations';
	import {
		streamDirectionsLocations,
		type DirectionsLocation,
		type DirectionsSearchFocus
	} from '$lib/features/search/state/directionsSearch';

	type Field = 'origin' | 'destination';
	let origin = '';
	let destination = '';
	let originSelection: DirectionsLocation | null = null;
	let destinationSelection: DirectionsLocation | null = null;
	let activeField: Field | null = null;
	let suggestions: DirectionsLocation[] = [];
	let highlighted = -1;
	let loading = false;
	let searchError = false;
	let controller: AbortController | null = null;
	let requestId = 0;
	let routeController: AbortController | null = null;
	let routeRequestId = 0;
	let routingLoading = false;
	let routingError = '';
	let routes: EdelweissItinerary[] = [];
	let selectedRoute = 0;
	let expandedRoute: number | null = null;
	let detailsIndex: number | null = null;
	let originMarker: Marker | null = null;
	let destinationMarker: Marker | null = null;
	let markerMap: MapLibreMap | null = null;
	let departure = Math.floor(Date.now() / 1000);
	let departNow = true;
	let timeMode: 'depart' | 'arrive' = 'depart';
	let streetMode: StreetMode = DEFAULT_STREET_ROUTING_SETTINGS.mode;
	let walkingPace = DEFAULT_STREET_ROUTING_SETTINGS.walkingPaceSecondsPerKm;
	let cyclingSpeed = DEFAULT_STREET_ROUTING_SETTINGS.cyclingSpeedKmH;
	let travelOptionsExpanded = false;
	// Null means the mode-specific 15-minute walking / 30-minute cycling default.
	let maxPreTransitMinutesOverride: number | null = null;
	let maxPostTransitMinutesOverride: number | null = null;
	let maxDirectMinutes = DEFAULT_DIRECT_TRAVEL_TIME_SECONDS / 60;
	$: defaultTransitMinutes = defaultTransitAccessTimeSeconds(streetMode) / 60;
	$: maxPreTransitMinutes = maxPreTransitMinutesOverride ?? defaultTransitMinutes;
	$: maxPostTransitMinutes = maxPostTransitMinutesOverride ?? defaultTransitMinutes;
	$: travelOptionsCustomized =
		streetMode !== DEFAULT_STREET_ROUTING_SETTINGS.mode ||
		walkingPace !== DEFAULT_STREET_ROUTING_SETTINGS.walkingPaceSecondsPerKm ||
		cyclingSpeed !== DEFAULT_STREET_ROUTING_SETTINGS.cyclingSpeedKmH ||
		maxPreTransitMinutes !== defaultTransitMinutes ||
		maxPostTransitMinutes !== defaultTransitMinutes ||
		maxDirectMinutes !== DEFAULT_DIRECT_TRAVEL_TIME_SECONDS / 60;
	let speedChangeDebounce: ReturnType<typeof setTimeout> | null = null;
	function selectStreetMode(mode: StreetMode): void {
		if (streetMode === mode) return;
		streetMode = mode;
		void routeSelectedCoordinates();
	}
	function onSpeedInput(): void {
		if (speedChangeDebounce !== null) clearTimeout(speedChangeDebounce);
		speedChangeDebounce = setTimeout(() => {
			speedChangeDebounce = null;
			void routeSelectedCoordinates();
		}, 300);
	}
	function onSpeedCommit(): void {
		if (speedChangeDebounce !== null) {
			clearTimeout(speedChangeDebounce);
			speedChangeDebounce = null;
		}
		void routeSelectedCoordinates();
	}
	const stackData = get(data_stack_store).at(-1)?.data;
	if (stackData instanceof TripPlannerStack) {
		timeMode = stackData.timeMode === 'arrive' ? 'arrive' : 'depart';
		if (typeof stackData.departure === 'number' && Number.isFinite(stackData.departure) && stackData.departure > 0) {
			departure = Math.floor(stackData.departure);
			departNow = false;
		}
		if (stackData.fromLat != null && stackData.fromLon != null && isValidPoint({lat:stackData.fromLat, lon:stackData.fromLon})) {
			originSelection = { key:'url:from', kind:'place', name:stackData.fromName || 'Start', address:'', lat:stackData.fromLat, lon:stackData.fromLon };
			origin = originSelection.name;
		}
		if (stackData.toLat != null && stackData.toLon != null && isValidPoint({lat:stackData.toLat, lon:stackData.toLon})) {
			destinationSelection = { key:'url:to', kind:'place', name:stackData.toName || 'Destination', address:'', lat:stackData.toLat, lon:stackData.toLon };
			destination = destinationSelection.name;
		}
	}

	function makeEndpointMarker(field: Field, map: MapLibreMap, selected: DirectionsLocation): Marker {
		const element = document.createElement('img');
		element.src = field === 'origin' ? '/icons/start_point.svg' : '/icons/end_point.svg';
		element.alt = field === 'origin' ? 'Drag starting point' : 'Drag destination';
		element.draggable = false;
		element.style.width = '16px';
		element.style.height = '16px';
		element.style.cursor = 'grab';
		// MapLibre requires a position before the marker is added to the map.
		const marker = new Marker({ element, draggable: true, anchor: 'center' })
			.setLngLat([selected.lon, selected.lat])
			.addTo(map);
		marker.on('dragend', () => {
			const { lat, lng: lon } = marker.getLngLat();
			if (!isValidPoint({ lat, lon })) return;
			const updated: DirectionsLocation = {
				key: 'map:' + field + ':' + lat + ',' + lon,
				kind: 'place',
				name: 'Dropped pin',
				address: '',
				lat, lon
			};
			if (field === 'origin') {
				originSelection = updated;
				origin = updated.name;
			} else {
				destinationSelection = updated;
				destination = updated.name;
			}
			requestId++;
			cancelSearch();
			activeField = null;
			suggestions = [];
			updateUrl();
			void routeSelectedCoordinates();
		});
		return marker;
	}

	function syncEndpointMarkers(): void {
		const map = get(map_pointer_store);
		if (map !== markerMap) {
			originMarker?.remove();
			destinationMarker?.remove();
			originMarker = null;
			destinationMarker = null;
			markerMap = map;
		}
		if (!map) return;
		for (const field of ['origin', 'destination'] as const) {
			const selected = field === 'origin' ? originSelection : destinationSelection;
			let marker = field === 'origin' ? originMarker : destinationMarker;
			if (!selected || !isValidPoint(selected)) {
				marker?.remove();
				if (field === 'origin') originMarker = null;
				else destinationMarker = null;
				continue;
			}
			if (!marker) {
				marker = makeEndpointMarker(field, map, selected);
				if (field === 'origin') originMarker = marker;
				else destinationMarker = marker;
			} else {
				// Update markers when suggestions, dragged points, or swapped endpoints change.
				marker.setLngLat([selected.lon, selected.lat]);
			}
		}
	}

	onMount(() => {
		const unsubscribe = map_pointer_store.subscribe(() => syncEndpointMarkers());
		return () => {
			unsubscribe();
			originMarker?.remove();
			destinationMarker?.remove();
			originMarker = null;
			destinationMarker = null;
			markerMap = null;
		};
	});

	function updateUrl(): void {
		data_stack_store.update((stack) => {
			const top = stack.at(-1);
			if (top?.data instanceof TripPlannerStack) {
				const data = top.data;
				data.fromLat = originSelection?.lat ?? null;
				data.fromLon = originSelection?.lon ?? null;
				data.fromName = originSelection?.name ?? null;
				data.toLat = destinationSelection?.lat ?? null;
				data.toLon = destinationSelection?.lon ?? null;
				data.toName = destinationSelection?.name ?? null;
				// Null represents live "Now" so a shared directions URL stays current.
				data.departure = departNow ? null : Math.floor(departure);
				data.timeMode = timeMode;
				return [...stack];
			}
			return stack;
		});
	}

	function clearRoutes(): void {
		routeRequestId++;
		routeController?.abort();
		routeController = null;
		routingLoading = false;
		routingError = '';
		routes = [];
		selectedRoute = 0;
		expandedRoute = null;
		detailsIndex = null;
		activeItineraries.set([]);
		activeItineraryIndex.set(0);
		selectedTransferItineraryIndex.set(null);
	}

	async function routeSelectedCoordinates(): Promise<void> {
		clearRoutes();
		if (!originSelection || !destinationSelection) return;
		const id = ++routeRequestId;
		const current = new AbortController();
		routeController = current;
		routingLoading = true;
		try {
			const found = await queryEdelweiss(originSelection, destinationSelection, resolveDepartureUnixSeconds(departure, departNow), current.signal, timeMode === 'arrive', {
				mode: streetMode,
				walkingPaceSecondsPerKm: walkingPace,
				cyclingSpeedKmH: cyclingSpeed,
				maxPreTransitTimeSeconds: maxPreTransitMinutes * 60,
				maxPostTransitTimeSeconds: maxPostTransitMinutes * 60,
				maxDirectTimeSeconds: maxDirectMinutes * 60
			});
			if (current.signal.aborted || id !== routeRequestId) return;
			routes = found;
			activeItineraries.set(found);
			if (found.length) {
				expandedRoute = 0;
				activeItineraryIndex.set(0);
				const map = get(map_pointer_store);
				if (map) fitDirectionsItinerary(map, found[0]);
			}
		} catch (error) {
			if (!current.signal.aborted && id === routeRequestId) routingError = error instanceof Error ? error.message : 'Routing request failed';
		} finally {
			if (id === routeRequestId) routingLoading = false;
		}
	}

	async function onDepartureChange(): Promise<void> {
		// DatePicker binds its edited value and emits a change event; consume the
		// committed value before persisting or sending the next route request.
		await tick();
		updateUrl();
		void routeSelectedCoordinates();
	}

	function chooseTimeMode(mode: 'depart' | 'arrive'): void {
		if (timeMode === mode) return;
		timeMode = mode;
		updateUrl();
		void routeSelectedCoordinates();
	}

	function showRoute(index: number): void {
		expandedRoute = expandedRoute === index ? null : index;
		selectedRoute = index;
		activeItineraryIndex.set(index);
		selectedTransferItineraryIndex.set(index);
		const map = get(map_pointer_store);
		if (map && routes[index]) fitDirectionsItinerary(map, routes[index]);
	}


	function openDetails(index: number): void {
		if (!routes[index]) return;
		detailsIndex = index;
	}

	function cancelSearch(): void {
		controller?.abort();
		controller = null;
		loading = false;
	}

	function getFocus(): DirectionsSearchFocus {
		const map = get(map_pointer_store);
		const center = map?.getCenter();
		const user = get(geolocation_store);
		return {
			mapLat: center?.lat ?? 0,
			mapLon: center?.lng ?? 0,
			mapZoom: map?.getZoom() ?? 2,
			...(user?.coords ? {
				userLat: user.coords.latitude,
				userLon: user.coords.longitude
			} : {})
		};
	}


	function emptyFieldSuggestions(field: Field): DirectionsLocation[] {
		const result: DirectionsLocation[] = [];
		const focus = getFocus();
		const originIsUserLocation = originSelection?.key === 'user:location';
		if (!(field === 'destination' && originIsUserLocation) &&
			Number.isFinite(focus.userLat) && Number.isFinite(focus.userLon)) {
			result.push({
				key: 'user:location',
				kind: 'place',
				name: 'Your location',
				address: '',
				lat: focus.userLat!,
				lon: focus.userLon!
			});
		}
		const other = field === 'origin' ? destinationSelection : originSelection;
		for (const item of getRecentDirectionsLocations()) {
			if (other && item.lat === other.lat && item.lon === other.lon) continue;
			result.push(item);
		}
		return result;
	}

	function querySuggestions(field: Field): void {
		cancelSearch();
		activeField = field;
		highlighted = -1;
		suggestions = [];
		searchError = false;
		const text = (field === 'origin' ? origin : destination).trim();
		const id = ++requestId;
		if (!text) {
			suggestions = emptyFieldSuggestions(field);
			return;
		}
		loading = true;
		const current = new AbortController();
		controller = current;
		void streamDirectionsLocations(text, getFocus(), current.signal, (items) => {
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
		clearRoutes();
		syncEndpointMarkers();
		updateUrl();
		querySuggestions(field);
	}

	function swapEndpoints(): void {
		requestId++;
		cancelSearch();
		activeField = null;
		suggestions = [];
		highlighted = -1;
		searchError = false;
		const previousOrigin = origin;
		const previousOriginSelection = originSelection;
		origin = destination;
		originSelection = destinationSelection;
		destination = previousOrigin;
		destinationSelection = previousOriginSelection;
		clearRoutes();
		syncEndpointMarkers();
		updateUrl();
		void routeSelectedCoordinates();
	}

	function chooseSuggestion(item: DirectionsLocation): void {
		rememberDirectionsLocation(item);
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
		syncEndpointMarkers();
		updateUrl();
		void routeSelectedCoordinates();
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
		clearRoutes();
		requestId++;
		cancelSearch();
		data_stack_store.update((stack) =>
			stack[stack.length - 1]?.data instanceof TripPlannerStack ? stack.slice(0, -1) : stack
		);
	}

	onDestroy(() => {
		if (speedChangeDebounce !== null) clearTimeout(speedChangeDebounce);
		clearRoutes();
		requestId++;
		cancelSearch();
	});
	if (originSelection && destinationSelection) void routeSelectedCoordinates();
</script>

<section aria-label="Directions / Trip Planner" class="relative flex h-full min-h-0 flex-col overflow-hidden">
	<div class="min-h-0 flex-1 overflow-y-auto px-4 py-4" class:hidden={detailsIndex !== null} aria-hidden={detailsIndex !== null}>
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-lg font-semibold">Directions</h2>
		<button type="button" on:click={closeDirections} aria-label="Exit directions" class="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800">
			<span class="material-symbols-outlined" aria-hidden="true">close</span>
			<span class="text-sm">Exit</span>
		</button>
	</div>

	<div class="relative">
		<!-- Container for inputs and connector graphics -->
		<div class="relative flex flex-col gap-2 pr-12">
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
			<button
				type="button"
				on:click={swapEndpoints}
				aria-label="Swap start and destination"
				title="Swap start and destination"
				class="absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 shadow-sm transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
			>
				<span class="material-symbols-outlined" aria-hidden="true">swap_vert</span>
			</button>
		</div>

		<!-- Floating suggestions overlap the future routing-results area, not the input rows. -->
		{#if activeField && (loading || searchError || suggestions.length > 0)}
			<div
				id="directions-suggestions"
				role="listbox"
				aria-label="Location suggestions"
				class="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
			>
				{#each suggestions as suggestion, index (suggestion.key)}
					<button
						type="button"
						role="option"
						aria-selected={index === highlighted}
						class="flex w-full min-w-0 items-center gap-2 px-3 py-3 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 {index === highlighted ? 'bg-gray-100 dark:bg-gray-800' : ''}"
						on:click={() => chooseSuggestion(suggestion)}
					>
						<span class="material-symbols-outlined shrink-0 {suggestion.key === 'user:location' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}" aria-hidden="true">
							{suggestion.key === 'user:location' ? 'my_location' : suggestion.kind === 'station' ? 'train' : suggestion.kind === 'stop' ? 'directions_bus' : 'place'}
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
	<div class="mt-3" role="group" aria-label="Journey time preference">
		<div class="relative mb-3 grid grid-cols-2 rounded-full bg-gray-100 p-1 dark:bg-gray-800" role="group" aria-label="Depart by or arrive by">
			<div aria-hidden="true" class="pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-sm transition-transform duration-200 ease-out dark:bg-gray-700 {timeMode === 'arrive' ? 'translate-x-full' : ''}"></div>
			<button type="button" aria-pressed={timeMode === 'depart'} on:click={() => chooseTimeMode('depart')}
				class="relative z-10 rounded-full px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 {timeMode === 'depart' ? 'text-gray-950 dark:text-white' : 'text-gray-500 dark:text-gray-300'}">Depart by</button>
			<button type="button" aria-pressed={timeMode === 'arrive'} on:click={() => chooseTimeMode('arrive')}
				class="relative z-10 rounded-full px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 {timeMode === 'arrive' ? 'text-gray-950 dark:text-white' : 'text-gray-500 dark:text-gray-300'}">Arrive by</button>
		</div>
		<p class="mb-1 text-sm font-medium text-gray-700 dark:text-gray-200">{timeMode === 'arrive' ? 'Arrival date and time' : 'Departure date and time'}</p>
		<DatePicker
			bind:unixTime={departure}
			bind:isNow={departNow}
			timezone="Local Time"
			on:change={onDepartureChange}
		/>
	</div>
	<!-- Compact, unobtrusive entry point immediately below the date/time picker. -->
	<div class="mt-3">
		<button
			type="button"
			on:click={() => (travelOptionsExpanded = !travelOptionsExpanded)}
			aria-expanded={travelOptionsExpanded}
			aria-controls="routing-travel-options"
			class="flex w-full items-center gap-2 rounded-xl border border-gray-200 bg-transparent px-3 py-2 text-left transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 dark:border-gray-700 dark:hover:bg-gray-800"
		>
			<span class="inline-flex shrink-0 items-center gap-1" aria-hidden="true">
				<span class="inline-flex items-center -space-x-1" class:text-cyan-700={streetMode === 'WALK'} class:dark:text-cyan-300={streetMode === 'WALK'} class:font-semibold={streetMode === 'WALK'} class:text-gray-400={streetMode !== 'WALK'}>
					<span class="material-symbols-outlined text-lg">directions_walk</span>
					<span class="material-symbols-outlined text-lg">directions_run</span>
				</span>
				<span class="text-xs text-gray-400">/</span>
				<span class="material-symbols-outlined text-lg" class:text-cyan-700={streetMode === 'BIKE'} class:dark:text-cyan-300={streetMode === 'BIKE'} class:text-gray-400={streetMode !== 'BIKE'}>directions_bike</span>
			</span>
			<span class="relative min-w-0 text-sm font-medium text-gray-700 dark:text-gray-200">
				Speed &amp; distance options
				{#if travelOptionsCustomized}<span class="absolute -right-2 -top-1 h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden="true"></span>{/if}
			</span>
			<span class="material-symbols-outlined ml-auto text-lg text-gray-500 dark:text-gray-400" aria-hidden="true">{travelOptionsExpanded ? 'expand_less' : 'expand_more'}</span>
		</button>
		{#if travelOptionsExpanded}
			<div id="routing-travel-options" transition:slide={{ duration: 180 }} class="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/60" aria-label="Travel speed and distance options">
				<div class="mb-3 flex items-center justify-between gap-2">
					<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-100">Travel options</h3>
					<button type="button" on:click={() => (travelOptionsExpanded = false)} aria-label="Collapse travel options" title="Collapse travel options" class="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-700 dark:text-gray-300 dark:hover:bg-gray-700">
						<span class="material-symbols-outlined text-lg" aria-hidden="true">keyboard_arrow_up</span>
					</button>
				</div>
				<div class="relative grid grid-cols-2 rounded-full bg-gray-200 p-1 dark:bg-gray-700" role="group" aria-label="Walking or cycling">
					<div class="pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-sm transition-transform duration-200 ease-out dark:bg-gray-600" class:translate-x-full={streetMode === 'BIKE'} aria-hidden="true"></div>
					<button type="button" class="relative z-10 inline-flex items-center justify-center gap-1 rounded-full px-2 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700" class:text-gray-900={streetMode === 'WALK'} class:dark:text-white={streetMode === 'WALK'} class:text-gray-500={streetMode !== 'WALK'} aria-pressed={streetMode === 'WALK'} on:click={() => selectStreetMode('WALK')}>
						<span class="material-symbols-outlined text-xl" aria-hidden="true">directions_walk</span><span class="material-symbols-outlined text-xl" aria-hidden="true">directions_run</span>Walk / run
					</button>
					<button type="button" class="relative z-10 inline-flex items-center justify-center gap-1.5 rounded-full px-2 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700" class:text-gray-900={streetMode === 'BIKE'} class:dark:text-white={streetMode === 'BIKE'} class:text-gray-500={streetMode !== 'BIKE'} aria-pressed={streetMode === 'BIKE'} on:click={() => selectStreetMode('BIKE')}>
						<span class="material-symbols-outlined text-xl" aria-hidden="true">directions_bike</span>Cycle
					</button>
				</div>
				<div class="mt-3 flex items-center justify-between gap-3">
					<label for="street-speed" class="text-sm font-medium text-gray-700 dark:text-gray-200">{streetMode === 'WALK' ? 'Walking / running pace' : 'Cycling speed'}</label>
					{#if streetMode === 'WALK'}
						<output for="street-speed" class="flex shrink-0 flex-col items-end text-sm font-semibold tabular-nums text-cyan-800 dark:text-cyan-300">
							<span>{formatWalkingPace(walkingPace)}</span>
							<span class="text-xs font-medium text-gray-500 dark:text-gray-400">{walkingPaceToKilometresPerHour(walkingPace).toFixed(1)} km/h</span>
						</output>
					{:else}
						<output for="street-speed" class="text-sm font-semibold tabular-nums text-cyan-800 dark:text-cyan-300">{cyclingSpeed.toFixed(1)} km/h</output>
					{/if}
				</div>
				{#if streetMode === 'WALK'}
					<input
						id="street-speed"
						class="mt-2 w-full accent-cyan-700 dark:accent-cyan-400"
						type="range"
						min={WALKING_PACE_MIN_SECONDS_PER_KM}
						max={WALKING_PACE_MAX_SECONDS_PER_KM}
						step="15"
						value={walkingPaceToSliderPosition(walkingPace)}
						on:input={(event) => {
							walkingPace = walkingSliderPositionToPace(Number(event.currentTarget.value));
							onSpeedInput();
						}}
						on:change={onSpeedCommit}
						aria-label="Walking or running speed, slower on the left and faster on the right"
					/>
					<div class="flex justify-between text-xs text-gray-500 dark:text-gray-400"><span>20:00 min/km · slower</span><span>4:00 min/km · faster</span></div>
				{:else}
					<input id="street-speed" class="mt-2 w-full accent-cyan-700 dark:accent-cyan-400" type="range" min="5" max="45" step="0.5" bind:value={cyclingSpeed} on:input={onSpeedInput} on:change={onSpeedCommit} aria-label="Cycling speed in kilometres per hour" />
					<div class="flex justify-between text-xs text-gray-500 dark:text-gray-400"><span>5 km/h · slower</span><span>45 km/h · faster</span></div>
				{/if}
				<div class="mt-4 space-y-3 border-t border-gray-200 pt-3 dark:border-gray-700">
					<div>
						<div class="flex items-center justify-between gap-2">
							<label for="routing-access-time" class="text-sm font-medium text-gray-700 dark:text-gray-200">Maximum time to reach transit</label>
							<output for="routing-access-time" class="shrink-0 text-sm font-semibold tabular-nums text-cyan-800 dark:text-cyan-300">{maxPreTransitMinutes} min</output>
						</div>
						<input id="routing-access-time" type="range" min="1" max="60" step="1" value={maxPreTransitMinutes} on:input={(event) => { maxPreTransitMinutesOverride = Number(event.currentTarget.value); onSpeedInput(); }} on:change={onSpeedCommit} class="mt-1 w-full accent-cyan-700 dark:accent-cyan-400" aria-label="Maximum minutes before boarding transit" />
					</div>
					<div>
						<div class="flex items-center justify-between gap-2">
							<label for="routing-egress-time" class="text-sm font-medium text-gray-700 dark:text-gray-200">Maximum time after transit</label>
							<output for="routing-egress-time" class="shrink-0 text-sm font-semibold tabular-nums text-cyan-800 dark:text-cyan-300">{maxPostTransitMinutes} min</output>
						</div>
						<input id="routing-egress-time" type="range" min="1" max="60" step="1" value={maxPostTransitMinutes} on:input={(event) => { maxPostTransitMinutesOverride = Number(event.currentTarget.value); onSpeedInput(); }} on:change={onSpeedCommit} class="mt-1 w-full accent-cyan-700 dark:accent-cyan-400" aria-label="Maximum minutes after alighting from transit" />
					</div>
					<div>
						<div class="flex items-center justify-between gap-2">
							<label for="routing-direct-time" class="text-sm font-medium text-gray-700 dark:text-gray-200">Maximum direct {streetMode === 'BIKE' ? 'cycling' : 'walking'} time</label>
							<output for="routing-direct-time" class="shrink-0 text-sm font-semibold tabular-nums text-cyan-800 dark:text-cyan-300">{maxDirectMinutes} min</output>
						</div>
						<input id="routing-direct-time" type="range" min="1" max="60" step="1" bind:value={maxDirectMinutes} on:input={onSpeedInput} on:change={onSpeedCommit} class="mt-1 w-full accent-cyan-700 dark:accent-cyan-400" aria-label="Maximum minutes for a direct walk or cycle without transit" />
					</div>
				</div>
				<p class="mt-3 text-xs text-gray-500 dark:text-gray-400">Limits apply to the selected travel mode. Transfers between transit vehicles remain on foot.</p>
			</div>
		{/if}
	</div>
	<div class="mt-5 flex flex-col gap-3 pb-8" aria-label="Available routes">
		{#if routingLoading}<p role="status" class="text-sm text-gray-500">Finding routes…</p>{/if}
		{#if routingError}<p role="alert" class="text-sm text-red-600">{routingError}</p>{/if}
		{#if !routingLoading && !routingError && originSelection && destinationSelection && routes.length === 0}<p class="text-sm text-gray-500">No routes found for this journey.</p>{/if}
		{#each routes as itinerary, index}
			<div class="w-full rounded-xl border bg-white p-3 shadow-sm transition-all duration-300 ease-out dark:bg-gray-800 {selectedRoute === index ? 'border-cyan-700 ring-1 ring-cyan-700' : 'border-gray-200 dark:border-gray-700'}">
				<button type="button" on:click={() => showRoute(index)} aria-pressed={selectedRoute === index} aria-expanded={expandedRoute === index} aria-label={`Preview journey ${index + 1}`} class="block w-full text-left">
				<JourneyPreviewTimeline {itinerary} />
			</button>
				{#if expandedRoute === index}
					<div transition:slide={{ duration: 240 }} class="mt-2 flex justify-end border-t border-gray-200 pt-2 dark:border-gray-700">
						<button type="button" on:click={() => openDetails(index)} class="inline-flex items-center gap-1 rounded-lg bg-cyan-700 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-cyan-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700">
							Show details <span class="material-symbols-outlined text-base" aria-hidden="true">chevron_right</span>
						</button>
					</div>
				{/if}
			</div>
		{/each}
	</div>
	</div>
	{#if detailsIndex !== null && routes[detailsIndex]}
		<TripItineraryDetails itinerary={routes[detailsIndex]} originName={originSelection?.name || origin} destinationName={destinationSelection?.name || destination} onBack={() => { detailsIndex = null; }} />
	{/if}
</section>

