<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { slide } from 'svelte/transition';
	import { Marker, type Map as MapLibreMap } from 'maplibre-gl';
	import { get } from 'svelte/store';
	import { data_stack_store, geolocation_store, map_pointer_store } from '$root/globalstores';
	import { TripPlannerStack } from '$components/stackenum';
	import { queryEdelweiss, itineraryDisplaySegments, allocateTimelinePercentages, itineraryTimeRow, formatWalkSegment, formatJourneyTime, resolveDepartureUnixSeconds, type EdelweissItinerary, isValidPoint } from '$lib/features/directions/edelweiss';
	import MtaBullet from '$components/mtabullet.svelte';
	import RatpBullet from '$components/ratpbullet.svelte';
	import SbbLogo from '$components/SbbLogo.svelte';
	import DatePicker from '$components/DatePicker.svelte';
	import TripItineraryDetails from '$components/TripItineraryDetails.svelte';
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
	let timelineWidth = 320;
	function measureTimeline(node: HTMLDivElement) {
		const measure = () => { timelineWidth = node.clientWidth || 320; };
		measure();
		const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
		observer?.observe(node);
		return { destroy() { observer?.disconnect(); } };
	}
	let departure = Math.floor(Date.now() / 1000);
	let departNow = true;
	const stackData = get(data_stack_store).at(-1)?.data;
	if (stackData instanceof TripPlannerStack) {
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

	function makeEndpointMarker(field: Field, map: MapLibreMap): Marker {
		const element = document.createElement('img');
		element.src = field === 'origin' ? '/icons/start_point.svg' : '/icons/end_point.svg';
		element.alt = field === 'origin' ? 'Drag starting point' : 'Drag destination';
		element.draggable = false;
		element.style.width = '32px';
		element.style.height = '32px';
		element.style.cursor = 'grab';
		const marker = new Marker({ element, draggable: true, anchor: 'center' }).addTo(map);
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
				marker = makeEndpointMarker(field, map);
				if (field === 'origin') originMarker = marker;
				else destinationMarker = marker;
			}
			marker.setLngLat([selected.lon, selected.lat]);
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
			const found = await queryEdelweiss(originSelection, destinationSelection, resolveDepartureUnixSeconds(departure, departNow), current.signal);
			if (current.signal.aborted || id !== routeRequestId) return;
			routes = found;
			activeItineraries.set(found);
			if (found.length) {
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
	<div class="mt-3" role="group" aria-label="Departure date and time">
		<p class="mb-1 text-sm font-medium text-gray-700 dark:text-gray-200">Depart at</p>
		<DatePicker
			bind:unixTime={departure}
			bind:isNow={departNow}
			timezone="Local Time"
			on:change={onDepartureChange}
		/>
	</div>
	<div class="mt-5 flex flex-col gap-3 pb-8" aria-label="Available routes">
		{#if routingLoading}<p role="status" class="text-sm text-gray-500">Finding routes…</p>{/if}
		{#if routingError}<p role="alert" class="text-sm text-red-600">{routingError}</p>{/if}
		{#if !routingLoading && !routingError && originSelection && destinationSelection && routes.length === 0}<p class="text-sm text-gray-500">No routes found for this journey.</p>{/if}
		{#each routes as itinerary, index}
			{@const segments = itineraryDisplaySegments(itinerary)}
			{@const widths = allocateTimelinePercentages(segments, timelineWidth)}
			<div class="w-full rounded-xl border bg-white p-3 shadow-sm transition-all duration-300 ease-out dark:bg-gray-800 {selectedRoute === index ? 'border-cyan-700 ring-1 ring-cyan-700' : 'border-gray-200 dark:border-gray-700'}">
				<button type="button" on:click={() => showRoute(index)} aria-pressed={selectedRoute === index} aria-expanded={expandedRoute === index} aria-label={`Preview journey ${index + 1}`} class="block w-full text-left">
				<div class="flex items-center justify-between gap-1.5 text-sm sm:text-base" aria-label="Journey departure, duration and arrival">
					{#each itineraryTimeRow(itinerary) as item}
						{#if item.kind === 'duration'}
							<span class="min-w-0 shrink text-center text-xs font-medium text-gray-600 dark:text-gray-300" aria-label="Total journey duration">{item.text}</span>
						{:else}
							<time datetime={item.time} class:font-semibold={item.transit} class:font-normal={!item.transit} class="shrink-0 whitespace-nowrap">{formatJourneyTime(item.time)}</time>
						{/if}
					{/each}
				</div>
				<div class="mt-3 w-full max-w-full" use:measureTimeline aria-label="Journey segments">
					<div class="flex w-full min-w-0 items-start overflow-hidden">
						{#each segments as segment, segmentIndex}
							<div class="min-w-0 shrink-0 overflow-visible" style:width={`${widths[segmentIndex]}%`} role="group" aria-label={segment.transfer ? 'Transfer' : segment.walking ? `Walk ${formatWalkSegment(segment)}` : segment.routeName ? `${segment.mode} ${segment.routeName}` : segment.mode}>
								<div class="flex h-6 w-full min-w-0 items-center gap-1">
									{#if !segment.transfer}
										{#if segment.walking}
											<span class="material-symbols-outlined shrink-0 text-black dark:text-white" style:font-size="18px" aria-hidden="true">directions_walk</span>
										{:else}
											<span class="sbb-mode-icon shrink-0 bg-black dark:bg-white" class:sbb-bus={segment.icon === 'bus'} class:sbb-metro={segment.icon === 'metro'} class:sbb-tram={segment.icon === 'tram'} class:sbb-train={segment.icon === 'train' || !segment.icon} aria-hidden="true"></span>
										{/if}
									{/if}
									{#if segment.walking && !segment.transfer}
										<span class="walking-dot-line min-w-0 flex-1" aria-hidden="true"></span>
									{:else}
										<span class="segment-bar min-w-0 flex-1" style:border-top-color={segment.transfer ? undefined : segment.walking ? undefined : /^(?:#000(?:000)?|#fff(?:fff)?)$/i.test(segment.color) ? undefined : segment.color} aria-hidden="true"></span>
									{/if}
								</div>
								{#if !segment.transfer}
									<div class="mt-1 flex min-h-5 w-full min-w-0 items-start justify-start text-xs" title={segment.walking ? formatWalkSegment(segment) : segment.routeName ?? segment.mode}>
										{#if segment.walking}
											<span class="truncate text-gray-600 dark:text-gray-300">{formatWalkSegment(segment)}</span>
										{:else}
											{#if segment.routeName && segment.badgeKind === 'mta'}
												<MtaBullet route_short_name={segment.routeName} matchTextHeight={true} />
											{:else if segment.routeName && segment.badgeKind === 'ratp'}
												<RatpBullet route_short_name={segment.routeName} matchTextHeight={true} />
											{:else}
												<span class="inline-flex max-w-full items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap px-1.5 py-0.5 text-xs font-semibold leading-none" class:rounded-full={segment.badgeKind === 'sbahn'} class:rounded-sm={segment.badgeKind !== 'sbahn'} style:background-color={segment.color} style:color={segment.textColor}>
													{#if segment.badgeKind === 'sbb' && segment.routeName}
														<SbbLogo text={segment.routeName} chateau="schweiz" />
													{:else}
														{segment.routeName || segment.mode}
													{/if}
												</span>
											{/if}
										{/if}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
				<div class="mt-2 flex items-center text-xs text-gray-500 dark:text-gray-400"><span>{itinerary.transfers ?? 0} transfers</span></div>
				</button>
				{#if expandedRoute === index}
					<div transition:slide={{ duration: 240 }} class="mt-3 flex justify-end border-t border-gray-200 pt-3 dark:border-gray-700">
						<button type="button" on:click={() => openDetails(index)} class="inline-flex items-center gap-1 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-cyan-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700">
							Details <span class="material-symbols-outlined text-base" aria-hidden="true">chevron_right</span>
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

<style>
	.segment-bar {
		border-top: 2px solid #9ca3af;
	}
	:global(.dark) .segment-bar {
		border-top-color: #6b7280;
	}
	.walking-dot-line {
		height: 4px;
		background-image: radial-gradient(circle, #9ca3af 1.6px, transparent 1.7px);
		background-size: 8px 4px;
		background-position: left center;
		background-repeat: repeat-x;
	}
	:global(.dark) .walking-dot-line {
		background-image: radial-gradient(circle, #6b7280 1.6px, transparent 1.7px);
	}
	.sbb-mode-icon {
		display: inline-block;
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		mask-position: center;
		mask-size: contain;
		mask-repeat: no-repeat;
		-webkit-mask-position: center;
		-webkit-mask-size: contain;
		-webkit-mask-repeat: no-repeat;
	}
	.sbb-bus {
		mask-image: url('/icons/bus-right-fill-color.svg');
		-webkit-mask-image: url('/icons/bus-right-fill-color.svg');
	}
	.sbb-metro {
		mask-image: url('/icons/metro-right-fill-color.svg');
		-webkit-mask-image: url('/icons/metro-right-fill-color.svg');
	}
	.sbb-train {
		mask-image: url('/icons/train-right-fill-color.svg');
		-webkit-mask-image: url('/icons/train-right-fill-color.svg');
	}
	.sbb-tram {
		mask-image: url('/icons/tram-right-fill-color.svg');
		-webkit-mask-image: url('/icons/tram-right-fill-color.svg');
	}

</style>
