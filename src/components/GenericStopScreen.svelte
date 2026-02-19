<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import HomeButton from './SidebarParts/home_button.svelte';
	import { writable, get } from 'svelte/store';
	import { timezone_to_locale } from './timezone_to_locale';
	import {
		data_stack_store,
		on_sidebar_trigger_store,
		realtime_vehicle_locations_last_updated_store,
		realtime_vehicle_locations_store,
		realtime_vehicle_route_cache_hash_store,
		realtime_vehicle_route_cache_store,
		lock_on_gps_store,
		show_seconds_store,
		usunits_store,
		show_zombie_buses_store,
		show_my_location_store,
		custom_icons_category_to_layer_id,
		map_pointer_store,
		show_gtfs_ids_store,
		ui_theme_store,
		stops_to_hide_store
	} from '../globalstores';
	import TimeDiff from './TimeDiff.svelte';
	import DelayDiff from './DelayDiff.svelte';
	import { locale, _ } from 'svelte-i18n';
	import Clock from './Clock.svelte';
	import StopScreenRow from './StopScreenRow.svelte';
	import StationScreenTrainRow from './StationScreenTrainRow.svelte';
	import { SingleTrip, StackInterface } from './stackenum';
	import { MTA_CHATEAU_ID, isSubwayRouteId } from '../utils/mta_subway_utils';
	import { IDFM_CHATEAU_ID, isRatpRoute } from '../utils/ratp_utils';
	import MtaBullet from './mtabullet.svelte';
	import { booleanPointInPolygon, point } from '@turf/turf';
	import RatpBullet from './ratpbullet.svelte';

	export let buildUrl: (startSec: number, endSec: number) => string;
	export let key: any; // Unique identifier to trigger reset (e.g. stop_id or osm_id)

	// Optional display props - used as fallbacks when data_meta.primary is not available
	export let stationName: string | null = null;
	export let stationLat: number | null = null;
	export let stationLon: number | null = null;
	export let stationTimezone: string | null = null;

	let eurostyle_geojson: any = null;
	let is_inside_eurostyle: boolean = false;

	// ---------- Paging controls ----------
	const OVERLAP_SECONDS = 5 * 60; // small overlap to help dedupe across pages
	const PAGE_REFRESH_MS = 10000; // refresh each page every 10s
	const THRESHOLD_HIGH = 150; // many results → use 2h
	const THRESHOLD_LOW = 40; // sparse → use up to 24h

	// We page forward in time from now. If user toggles previous, we still keep
	// showing earlier items but we don't load older pages by default.
	let pages: Array<{
		id: string;
		startSec: number;
		endSec: number;
		refreshedAt: number;
		loading: boolean;
		error?: string;
	}> = [];

	// Event index with dedupe by newest page refresh
	type EventKey = string; // composed key
	let eventIndex: Map<EventKey, { event: any; pageId: string; refreshedAt: number }>; // merged
	let mergedEvents: any[] = [];

	// dynamic page size in hours (auto-tunes based on density)
	let currentPageHours = 1; // default page size

	let refreshTimer: any;

	// Optimization: Yield to main thread to prevent blocking
	const yieldToMain = () => new Promise((resolve) => setTimeout(resolve, 0));

	let show_seconds = get(show_seconds_store);
	let locale_inside_component = get(locale);
	show_seconds_store.subscribe((value) => (show_seconds = value));

	// UI state
	let filtered_dates_to_events: Record<string, any[]> = {};
	let raw_grouped_events: Record<string, any[]> = {};
	let current_time = 0;
	let fly_to_already = false;
	let data_meta: any = null; // primary/routes/shapes merged from any page

	// Derived display info - uses data_meta.primary if available, otherwise falls back to props
	$: displayName = data_meta?.primary?.stop_name ?? stationName ?? 'Loading...';
	$: displayLat = data_meta?.primary?.stop_lat ?? stationLat;
	$: displayLon = data_meta?.primary?.stop_lon ?? stationLon;
	$: displayTimezone =
		data_meta?.primary?.timezone ?? data_meta?.stops?.[0]?.timezone ?? stationTimezone ?? 'UTC';
	let show_previous_departures = false;
	let previous_count = 0;
	let show_arrivals_only = false; // Add missing state variable

	// Filters
	type Mode = 'rail' | 'metro' | 'bus' | 'other';
	let active_tab: Mode = 'bus'; // default, will auto-correct
	let available_modes: Mode[] = [];

	function get_mode_for_route_type(route_type: number): Mode {
		if ([3, 11, 700].includes(route_type)) return 'bus';
		if ([0, 1, 5, 7, 12, 900].includes(route_type)) return 'metro';
		if ([2, 106, 107, 101, 100, 102, 103].includes(route_type)) return 'rail';
		return 'other';
	}

	$: {
		const modes = new Set<Mode>();
		// Scan all events (mergedEvents contains everything we know about on this page)
		// We should also check data_meta? No, mergedEvents is what defines the "content" we are filtering.
		// If we load more pages, mergedEvents grows, modes might appear.
		for (const ev of mergedEvents) {
			const routeDef = data_meta?.routes?.[ev.chateau]?.[ev.route_id];
			const rType = routeDef?.route_type ?? ev.route_type ?? 3;
			modes.add(get_mode_for_route_type(rType));
		}

		// Stable order
		const order: Mode[] = ['rail', 'metro', 'bus', 'other'];
		available_modes = order.filter((m) => modes.has(m));

		// Auto-select tab logic
		if (available_modes.length > 0) {
			// If current tab is not available, switch to first available
			if (!available_modes.includes(active_tab)) {
				active_tab = available_modes[0];
			}
		}
	}

	// Pre-filter events by mode, time cutoff, and arrivals_only — computed once reactively
	$: filtered_dates_to_events = (() => {
		const result: Record<string, any[]> = {};
		const nowSec = current_time / 1000;
		const cutoff = show_previous_departures ? 1800 : 60;

		for (const [date_code, events] of Object.entries(raw_grouped_events)) {
			const filtered = events.filter((event) => {
				// Time filter
				const relevant_time = event.last_stop
					? event.realtime_arrival || event.scheduled_arrival
					: event.realtime_departure || event.scheduled_departure;
				if (relevant_time < nowSec - cutoff) return false;

				// Arrivals filter
				if (event.last_stop && !show_arrivals_only) return false;

				// Mode filter
				if (available_modes.length > 1) {
					const routeDef = data_meta?.routes?.[event.chateau]?.[event.route_id];
					const rType = routeDef?.route_type ?? event.route_type ?? 3;
					if (get_mode_for_route_type(rType) !== active_tab) return false;
				}

				return true;
			});

			if (filtered.length > 0) {
				result[date_code] = filtered;
			}
		}
		return result;
	})();

	function resetState() {
		// clear paging and data when stop changes
		pages = [];
		eventIndex = new Map();
		mergedEvents = [];
		filtered_dates_to_events = {};
		raw_grouped_events = {};
		data_meta = null;
		fly_to_already = false;
		currentPageHours = 1;
	}

	function pageIdFor(startSec: number, endSec: number) {
		return `${startSec}-${endSec}`;
	}

	// buildUrl is now a prop

	function chooseNextPageHours(count: number): number {
		if (count === 0) {
			const next = currentPageHours * 2;
			return Math.min(24, next);
		}
		return 1;
	}

	function composeEventKey(ev: any): EventKey {
		// Include chateau, trip, stop, service_date, and a stable schedule time fallback
		const sched = ev.scheduled_departure ?? ev.scheduled_arrival ?? 0;
		return `${ev.chateau}|${ev.trip_id}|${ev.stop_id}|${ev.service_date}|${sched}`;
	}

	async function mergePageEvents(pageId: string, incoming: any[], refreshedAt: number) {
		// Optimization: Chunk the indexing loop
		const CHUNK_SIZE = 500;
		for (let i = 0; i < incoming.length; i += CHUNK_SIZE) {
			const chunk = incoming.slice(i, i + CHUNK_SIZE);
			for (const ev of chunk) {
				const key = composeEventKey(ev);
				const existing = eventIndex.get(key);
				if (!existing || refreshedAt > existing.refreshedAt) {
					eventIndex.set(key, { event: ev, pageId, refreshedAt });
				}
			}
			if (incoming.length > CHUNK_SIZE) await yieldToMain();
		}

		// Rebuild merged list sorted by primary time key (RT first, then scheduled)
		// Convert to array first
		const allEvents = Array.from(eventIndex.values()).map((v) => v.event);

		// Sort
		allEvents.sort((a, b) => {
			const ta =
				a.realtime_departure ??
				a.realtime_arrival ??
				a.scheduled_departure ??
				a.scheduled_arrival ??
				0;
			const tb =
				b.realtime_departure ??
				b.realtime_arrival ??
				b.scheduled_departure ??
				b.scheduled_arrival ??
				0;
			return ta - tb;
		});

		mergedEvents = allEvents;

		await yieldToMain();

		// Group by YYYY-MM-DD (CA locale) in stop timezone
		const grouped: Record<string, any[]> = {};
		for (let i = 0; i < mergedEvents.length; i += CHUNK_SIZE) {
			const chunk = mergedEvents.slice(i, i + CHUNK_SIZE);
			for (const ev of chunk) {
				const tz =
					data_meta?.primary?.timezone ??
					data_meta?.stops?.[0]?.timezone ??
					stationTimezone ??
					'UTC';
				const stamp =
					(ev.realtime_departure ||
						ev.realtime_arrival ||
						ev.scheduled_departure ||
						ev.scheduled_arrival) * 1000;
				const code = new Date(stamp).toLocaleDateString('en-CA', tz ? { timeZone: tz } : undefined);
				if (!grouped[code]) grouped[code] = [];
				grouped[code].push(ev);
			}
			// Only yield if we actually have a significant amount of data to process
			if (mergedEvents.length > CHUNK_SIZE) await yieldToMain();
		}
		raw_grouped_events = grouped;
		console.log('Updated raw_grouped_events', Object.keys(grouped).length);

		// Compute previous_count ≤30m ago for header toggle
		const nowSec = Date.now() / 1000;
		previous_count = mergedEvents.filter(
			(ev) => (ev.realtime_departure || ev.scheduled_departure) < nowSec - 60
		).length;
	}

	async function doFetch(
		startSec: number,
		endSec: number,
		page?: { id: string; loading: boolean; refreshedAt: number; error?: string }
	) {
		const id = page?.id ?? pageIdFor(startSec, endSec);
		if (page) page.loading = true;

		try {
			console.log(`Fetching ${id} range ${startSec}-${endSec}`);
			const resp = await fetch(buildUrl(startSec, endSec), { mode: 'cors' });
			// Optimization: Use native json() parser
			const data = await resp.json();
			console.log(`Fetch ${id} returned items:`, data.events?.length);

			let shouldPrimeMap = false;

			// Establish/merge meta (primary/routes/shapes) — keep latest
			if (!data_meta) {
				data_meta = data;
				if (page) page.loading = false;
				shouldPrimeMap = true;
			} else {
				// Optimization: reduce object spread garbage
				if (!data_meta.routes) data_meta.routes = {};
				if (data.routes) {
					for (const [chateau, routes] of Object.entries(data.routes)) {
						if (!data_meta.routes[chateau]) data_meta.routes[chateau] = {};
						Object.assign(data_meta.routes[chateau], routes);
					}
				}

				if (!data_meta.shapes) data_meta.shapes = {};
				if (data.shapes) {
					for (const [chateau, shapes] of Object.entries(data.shapes)) {
						if (!data_meta.shapes[chateau]) data_meta.shapes[chateau] = {};
						Object.assign(data_meta.shapes[chateau], shapes);
					}
				}
				if (!data_meta.primary && data.primary) data_meta.primary = data.primary;

				// Force reactivity
				data_meta = data_meta;
			}

			// Yield after parsing and meta merge
			await yieldToMain();

			const refreshedAt = Date.now();
			if (page) {
				page.refreshedAt = refreshedAt;
				page.loading = false;
			}

			const events = (data.events || []) as any[];

			// Fix for OSM station data: sometimes it marks everything as last_stop
			// If we have a departure time, it's definitely not a last stop for the purpose of this screen
			for (const ev of events) {
				if (ev.last_stop && (ev.scheduled_departure || ev.realtime_departure)) {
					ev.last_stop = false;
				}
			}

			// mergePageEvents is now async
			await mergePageEvents(id, events, refreshedAt);

			// Auto-tune next page size by density (only if it's a primary page fetch)
			if (page) {
				currentPageHours = chooseNextPageHours(events.length);
			}

			await tick();

			if (shouldPrimeMap) {
				setTimeout(() => primeMapContextFromMeta(), 0);
			}

			// Only check for more if this was a driven fetch (page exists) and not a background refresh
			if (page) {
				checkIfMoreNeeded(events.length === 0);
			}
		} catch (e) {
			if (page) {
				page.error = (e as Error).message;
				page.loading = false;
			} else {
				console.warn('Background refresh failed', e);
			}
		}
	}

	async function fetchPage(startSec: number, endSec: number) {
		const id = pageIdFor(startSec, endSec);
		let page = pages.find((p) => p.id === id);
		if (!page) {
			page = { id, startSec, endSec, refreshedAt: 0, loading: true };
			pages.push(page);
		}
		await doFetch(startSec, endSec, page);
	}

	async function refreshAllPages() {
		if (pages.length === 0) return;

		// Sort by startSec
		const sorted = [...pages].sort((a, b) => a.startSec - b.startSec);

		// Merge contiguous or overlapping intervals
		const merged: { start: number; end: number }[] = [];
		if (sorted.length > 0) {
			let current = { start: sorted[0].startSec, end: sorted[0].endSec };

			for (let i = 1; i < sorted.length; i++) {
				const p = sorted[i];
				// If overlap or adjacent (allowing small gaps? No, strictly contiguous/overlap)
				// We definitely want to merge if they overlap.
				if (p.startSec <= current.end) {
					current.end = Math.max(current.end, p.endSec);
				} else {
					merged.push(current);
					current = { start: p.startSec, end: p.endSec };
				}
			}
			merged.push(current);
		}

		// Execute merged fetches
		// We don't pass a 'page' object, so these are silent background updates
		await Promise.all(merged.map((m) => doFetch(m.start, m.end)));
	}

	function primeMapContextFromMeta() {
		const global_map_pointer = get(map_pointer_store);
		if (!global_map_pointer || displayLat == null || displayLon == null) return;

		if (!fly_to_already) {
			global_map_pointer.flyTo({
				center: [displayLon, displayLat],
				zoom: 14
			});
			fly_to_already = true;
		}

		global_map_pointer.getSource('redpin')?.setData({
			type: 'FeatureCollection',
			features: [
				{
					type: 'Feature',
					properties: {},
					geometry: {
						coordinates: [displayLon, displayLat],
						type: 'Point'
					}
				}
			]
		});

		global_map_pointer.getSource('transit_shape_context_for_stop')?.setData({
			type: 'FeatureCollection',
			features: []
		});
		global_map_pointer
			.getSource('transit_shape_context')
			?.setData({ type: 'FeatureCollection', features: [] });
		global_map_pointer
			.getSource('stops_context')
			?.setData({ type: 'FeatureCollection', features: [] });
	}

	async function loadInitialPages() {
		const nowSec = Math.floor(Date.now() / 1000);
		// Start a little bit in the past for continuity
		const start = nowSec - 30 * 60; // 30m back
		const end = start + currentPageHours * 3600;
		await fetchPage(start, end);
	}

	async function loadNextPage() {
		if (pages.length === 0) return loadInitialPages();
		// find max endSec among pages
		let maxEnd = Math.max(...pages.map((p) => p.endSec));
		const start = maxEnd - OVERLAP_SECONDS; // overlap to dedupe
		const end = start + currentPageHours * 3600;
		await fetchPage(start, end);
	}

	// Infinite scroll detection
	let scrollContainer: HTMLDivElement;
	function onScroll(e: Event) {
		const el = e.currentTarget as HTMLDivElement;
		if (!el) return;
		const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 300; // 300px buffer
		if (nearBottom) {
			loadNextPage();
		}
	}

	function checkIfMoreNeeded(isEmpty: boolean) {
		if (!scrollContainer) return;

		// Safety check to prevent runaway parallel fetches or infinite recursion
		if (pages.some((p) => p.loading)) return;

		// If empty or bottom is visible (content height <= client height + tiny buffer), load more
		// We use a small buffer for "visible bottom"
		const bottomVisible = scrollContainer.scrollHeight <= scrollContainer.clientHeight + 50;
		if (isEmpty || bottomVisible) {
			// Avoid infinite loop if we keep getting empty pages forever?
			// The user said "If there are none... load the next hour".
			// We can assume eventual consistency or the user accepts the risk/behavior.
			// But maybe we should check if we are already loading another page?
			// fetchPage sets page.loading=false before calling this.

			// To be safe, maybe limit how far ahead we look?
			// But for now, I will implement exactly as requested.

			// We need to verify we aren't already loading the *next* page.
			// loadNextPage checks pages logic.

			// We delay slightly to ensure UI is stable
			setTimeout(() => {
				// Re-check
				if (scrollContainer.scrollHeight <= scrollContainer.clientHeight + 50 || isEmpty) {
					loadNextPage();
				}
			}, 100);
		}
	}

	// React to input changes
	$: if (key) {
		resetState();
		loadInitialPages();
	}

	function checkEurostyle(lat: number | null, lng: number | null) {
		if (!eurostyle_geojson || lat == null || lng == null) return;
		try {
			const pt = point([lng, lat]);
			let inside = false;
			for (const feature of eurostyle_geojson.features) {
				if (booleanPointInPolygon(pt, feature)) {
					inside = true;
					break;
				}
			}
			is_inside_eurostyle = inside;
		} catch (e) {
			console.error('Error checking eurostyle inclusion', e);
		}
	}

	$: checkEurostyle(displayLat, displayLon);

	onMount(() => {
		current_time = Date.now();
		const tick = setInterval(() => (current_time = Date.now()), 500);

		fetch('/eurostyle-ui-rail.geojson')
			.then((res) => res.json())
			.then((data) => {
				eurostyle_geojson = data;
				checkEurostyle(displayLat, displayLon);
			})
			.catch((e) => console.error('Failed to load eurostyle geojson', e));

		const map = get(map_pointer_store);

		// Start global refresher
		refreshTimer = setInterval(refreshAllPages, PAGE_REFRESH_MS);

		return () => {
			clearInterval(tick);
			clearInterval(refreshTimer);
			const global_map_pointer = get(map_pointer_store);
			global_map_pointer?.getSource('redpin')?.setData({ type: 'FeatureCollection', features: [] });

			if (global_map_pointer) {
				global_map_pointer
					.getSource('transit_shape_context_for_stop')
					?.setData({ type: 'FeatureCollection', features: [] });
				global_map_pointer
					.getSource('transit_shape_context')
					?.setData({ type: 'FeatureCollection', features: [] });
				global_map_pointer
					.getSource('stops_context')
					?.setData({ type: 'FeatureCollection', features: [] });
			}
		};
	});
</script>

<div class="h-full">
	<HomeButton />

	<div
		bind:this={scrollContainer}
		class="catenary-scroll overflow-y-auto pb-64 h-full pr-2"
		on:scroll={onScroll}
	>
		<div class="flex flex-col">
			<div>
				{#if data_meta || (stationName && stationLat != null && stationLon != null)}
					<div class="flex flex-row ml-1">
						<h2 class="text-lg font-bold">{displayName}</h2>
						<p class="ml-auto align-middle">
							<Clock
								time_seconds={current_time / 1000}
								show_seconds={true}
								timezone={displayTimezone}
							/>
						</p>
					</div>
					<p class="text-sm ml-1 mb-2">{displayTimezone}</p>

					{#if available_modes.length > 1}
						<div
							class="flex flex-row flex-wrap gap-2 ml-1 mb-4 items-center border-b border-gray-200 dark:border-gray-700 w-full"
						>
							{#each available_modes as mode}
								{#if mode === 'rail'}
									<button
										class={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${active_tab === 'rail' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
										on:click={() => (active_tab = 'rail')}
									>
										<span class="material-symbols-outlined text-lg">train</span>
										{$_('headingIntercityRail')}
									</button>
								{:else if mode === 'metro'}
									<button
										class={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${active_tab === 'metro' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
										on:click={() => (active_tab = 'metro')}
									>
										<span class="material-symbols-outlined text-lg">tram</span>
										{$_('headingLocalRail')}
									</button>
								{:else if mode === 'bus'}
									<button
										class={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${active_tab === 'bus' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
										on:click={() => (active_tab = 'bus')}
									>
										<span class="material-symbols-outlined text-lg">directions_bus</span>
										{$_('headingBus')}
									</button>
								{:else if mode === 'other'}
									<button
										class={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${active_tab === 'other' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
										on:click={() => (active_tab = 'other')}
									>
										<span class="material-symbols-outlined text-lg">more_horiz</span>
										{$_('headingOther')}
									</button>
								{/if}
							{/each}
						</div>
					{/if}

					{#if previous_count > 0}
						<button
							class="px-0 py-3 font-bold"
							on:click={() => (show_previous_departures = !show_previous_departures)}
						>
							<p class="align-middle flex flex-row">
								<span class="inline-block align-bottom">
									{#if show_previous_departures}
										<span class="material-symbols-outlined"> keyboard_arrow_up </span>
									{:else}
										<span class="material-symbols-outlined"> keyboard_arrow_down </span>
									{/if}
								</span>
								<span>{$_('previous_departures')}</span>
							</p>
						</button>
					{/if}

					{#if Object.keys(filtered_dates_to_events).length > 0}
						{#each Object.keys(filtered_dates_to_events) as date_code}
							<p class="text-md font-semibold mt-0 mb-1 mx-3">
								{new Date(date_code).toLocaleDateString(
									timezone_to_locale(locale_inside_component, displayTimezone),
									{
										year: 'numeric',
										month: 'numeric',
										day: 'numeric',
										weekday: 'long',
										timeZone: 'UTC'
									}
								)}
							</p>

							<!-- Correct Logic Implementation -->
							{#if active_tab === 'rail'}
								<table class="w-full border-collapse">
									<tbody>
										{#each filtered_dates_to_events[date_code] as event}
											<StationScreenTrainRow
												eurostyle={is_inside_eurostyle}
												{event}
												data_from_server={data_meta}
												{current_time}
												{show_seconds}
												use_symbol_sign={true}
												timezone={displayTimezone}
											/>
										{/each}
									</tbody>
								</table>
							{:else}
								<!-- Non-Rail (Div) List -->
								{#each filtered_dates_to_events[date_code] as event}
									{@const shortName =
										data_meta.routes?.[event.chateau]?.[event.route_id]?.short_name}
									{@const longName = data_meta.routes?.[event.chateau]?.[event.route_id]?.long_name}
									{@const routeColor = data_meta.routes?.[event.chateau]?.[event.route_id]?.color}
									{@const textColor =
										data_meta.routes?.[event.chateau]?.[event.route_id]?.text_color}
									{@const isSubway =
										event.chateau === MTA_CHATEAU_ID && isSubwayRouteId(event.route_id)}
									{@const isRatp = event.chateau === IDFM_CHATEAU_ID && isRatpRoute(shortName)}
									<div
										class="mx-1 py-1 border-b-1 border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
										on:click={() => {
											data_stack_store.update((x) => {
												x.push(
													new StackInterface(
														new SingleTrip(
															event.chateau,
															event.trip_id,
															event.route_id,
															null,
															event.service_date.replace(/-/g, ''),
															null,
															null
														)
													)
												);
												return x;
											});
										}}
									>
										<div
											class={`${(event.realtime_departure || event.scheduled_departure) < current_time / 1000 && event.scheduled_departure < current_time / 1000 ? 'opacity-80' : ''} ${event.trip_cancelled ? 'opacity-60' : ''}`}
										>
											<p>
												{#if isSubway && shortName}
													<MtaBullet route_short_name={shortName} matchTextHeight={true} />
												{:else if isRatp && shortName}
													<RatpBullet route_short_name={shortName} matchTextHeight={true} />
												{:else if shortName}
													<span
														class="rounded-xs font-bold px-0.5 mx-1 py-0.5"
														style={`background: ${routeColor}; color: ${textColor};`}
													>
														{shortName}
													</span>
												{:else if longName}
													<span
														class="rounded-xs font-semibold px-0.5 mx-1 py-0.5"
														style={`background: ${routeColor}; color: ${textColor};`}
													>
														{longName}
													</span>
												{/if}
												{#if event.trip_short_name}
													<span class="font-bold">{event.trip_short_name}</span>
												{/if}
												{event.headsign}
											</p>

											{#if event.last_stop}
												<p>
													<span class="ml-1 text-xs font-bold align-middle">
														{$_('last_stop')}</span
													>
												</p>
											{/if}
										</div>

										<StopScreenRow
											{event}
											timezone={displayTimezone}
											{current_time}
											{show_seconds}
											show_arrivals={event.last_stop}
										/>

										{#if event.platform_string_realtime}
											<p>{$_('platform')} {event.platform_string_realtime}</p>
										{/if}
										{#if event.vehicle_number}
											<p>{$_('vehicle')}: {event.vehicle_number}</p>
										{/if}
									</div>
								{/each}
							{/if}
						{/each}

						<!-- Loader / pager hint -->
						<div class="w-full text-center py-4 text-sm opacity-80">
							{#if pages.some((p) => p.loading)}
								<span>{$_('loadingmoredepartures')}…</span>
							{:else}{/if}

							<button class="underline" on:click={loadNextPage}>{$_('Load more')}</button>
						</div>
					{:else}
						<p class="ml-2">Loading…</p>
					{/if}
				{:else}
					<p class="ml-2">Loading …</p>
				{/if}
			</div>
		</div>
	</div>
</div>
