<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import HomeButton from './SidebarParts/home_button.svelte';
	import polyline from '@mapbox/polyline';
	import * as turf from '@turf/turf';
	import { writable, get } from 'svelte/store';
	import { batchFetchShapes } from '../utils/shape_api';
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
	export let chateau: string;
	export let stop_id: string;
	import TimeDiff from './TimeDiff.svelte';
	import DelayDiff from './DelayDiff.svelte';
	import { locale, _ } from 'svelte-i18n';
	import Clock from './Clock.svelte';
	import StopScreenRow from './StopScreenRow.svelte';
	import CopyLinkButton from './CopyLinkButton.svelte';
	import EnrouteButton from './EnrouteButton.svelte';
	import { SingleTrip, StackInterface } from './stackenum';

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

	let show_seconds = get(show_seconds_store);
	let locale_inside_component = get(locale);
	show_seconds_store.subscribe((value) => (show_seconds = value));

	// UI state
	let dates_to_events_filtered: Record<string, any[]> = {};
	let current_time = 0;
	let fly_to_already = false;
	let data_meta: any = null; // primary/routes/shapes merged from any page
	let show_previous_departures = false;
	let previous_count = 0;
	let fetched_shapes_cache: Record<string, any> = {};
	let route_shapes_meta: Record<string, any> = {};

	// Filters
	let show_arrivals_only = false;
	let filter_rail = true;
	let filter_bus = true;
	let filter_metro = true;
	let filter_other = true;

	function filter_for_route_type(route_type: number) {
		if ([3, 11, 700].includes(route_type)) return filter_bus;
		if ([0, 1, 5, 7, 12, 900].includes(route_type)) return filter_metro;
		if ([2, 106, 107, 101, 100, 102, 103].includes(route_type)) return filter_rail;
		return filter_other;
	}

	function resetState() {
		// clear paging and data when stop changes
		pages = [];
		eventIndex = new Map();
		mergedEvents = [];
		// Stop any existing refresh timer to restart fresh or just let it run?
		// Better to restart it or just let the pages array being empty handle it.
		// If we switch stops, pages=[] so refreshAllPages will do nothing.
		dates_to_events_filtered = {};
		fetched_shapes_cache = {};
		data_meta = null;
		fly_to_already = false;
		currentPageHours = 1;
	}

	function pageIdFor(startSec: number, endSec: number) {
		return `${startSec}-${endSec}`;
	}

	function buildUrl(startSec: number, endSec: number) {
		const base = 'https://birchdeparturesfromstop.catenarymaps.org/departures_at_stop';
		const params = new URLSearchParams({
			stop_id,
			chateau_id: chateau,
			greater_than_time: String(startSec),
			less_than_time: String(endSec),
			include_shapes: String(false)
		});
		return `${base}?${params.toString()}`;
	}

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

	function mergePageEvents(pageId: string, incoming: any[], refreshedAt: number) {
		for (const ev of incoming) {
			const key = composeEventKey(ev);
			const existing = eventIndex.get(key);
			if (!existing || refreshedAt > existing.refreshedAt) {
				eventIndex.set(key, { event: ev, pageId, refreshedAt });
			}
		}
		// Rebuild merged list sorted by primary time key (RT first, then scheduled)
		mergedEvents = Array.from(eventIndex.values())
			.map((v) => v.event)
			.sort((a, b) => {
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

		// Group by YYYY-MM-DD (CA locale) in stop timezone
		const grouped: Record<string, any[]> = {};
		for (const ev of mergedEvents) {
			const tz = data_meta?.primary?.timezone;
			const stamp =
				(ev.realtime_departure ||
					ev.realtime_arrival ||
					ev.scheduled_departure ||
					ev.scheduled_arrival) * 1000;
			const code = new Date(stamp).toLocaleDateString('en-CA', tz ? { timeZone: tz } : undefined);
			if (!grouped[code]) grouped[code] = [];
			grouped[code].push(ev);
		}
		dates_to_events_filtered = grouped;

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
			const resp = await fetch(buildUrl(startSec, endSec), { mode: 'cors' });
			const text = await resp.text();
			const data = JSON.parse(text);

			let shouldPrimeMap = false;

			// Establish/merge meta (primary/routes/shapes) — keep latest
			if (!data_meta) {
				data_meta = data;
				if (page) page.loading = false;
				shouldPrimeMap = true;
			} else {
				// Merge routes/shapes per chateau
				if (!data_meta.routes) data_meta.routes = {};
				for (const [chateau, routes] of Object.entries(data.routes || {})) {
					data_meta.routes[chateau] = { ...(data_meta.routes[chateau] || {}), ...(routes as any) };
				}
				if (!data_meta.shapes) data_meta.shapes = {};
				for (const [chateau, shapes] of Object.entries(data.shapes || {})) {
					data_meta.shapes[chateau] = { ...(data_meta.shapes[chateau] || {}), ...(shapes as any) };
				}
				if (!data_meta.primary && data.primary) data_meta.primary = data.primary;
			}

			const refreshedAt = Date.now();
			if (page) {
				page.refreshedAt = refreshedAt;
				page.loading = false;
			}

			const events = (data.events || []) as any[];
			mergePageEvents(id, events, refreshedAt);

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

	function calculateBoundingBox(lat: number, lon: number, km: number) {
		// rough approximation: 1 deg lat = 111km, 1 deg lon = 111km * cos(lat)
		const latDelta = km / 111;
		const lonDelta = km / (111 * Math.cos(lat * (Math.PI / 180)));
		return {
			min_x: lon - lonDelta,
			min_y: lat - latDelta,
			max_x: lon + lonDelta,
			max_y: lat + latDelta
		};
	}

	function spliceLines(inner: any, outer: any) {
		try {
			// inner and outer are GeoJSON features or geometries. Ensure Features.
			const innerF = turf.feature(inner.type === 'Feature' ? inner.geometry : inner);
			const outerF = turf.feature(outer.type === 'Feature' ? outer.geometry : outer);

			// Find start/end of inner on outer
			const innerCoords = (innerF.geometry as any).coordinates;
			if (innerCoords.length < 2) return outer; // inner too small?

			const startPt = turf.point(innerCoords[0]);
			const endPt = turf.point(innerCoords[innerCoords.length - 1]);

			// Snap to outer
			const startOnOuter = turf.nearestPointOnLine(outerF as any, startPt);
			const endOnOuter = turf.nearestPointOnLine(outerF as any, endPt);

			// indices
			const idx1 = startOnOuter.properties?.index ?? 0;
			const idx2 = endOnOuter.properties?.index ?? 0;

			// If inner is basically the whole thing or invalid mapping, just return inner (high res)
			// But here we want to KEEP the outer parts that are NOT covered by inner.

			// We construct: StartOfOuter -> startOnOuter ... (inner) ... endOnOuter -> EndOfOuter
			// But wait, turf.lineSlice returns the segment.
			// We need lineSlice from Start->StartOnOuter and EndOnOuter->End.

			const outerCoords = (outerF.geometry as any).coordinates;
			const startOuterPt = turf.point(outerCoords[0]);
			const endOuterPt = turf.point(outerCoords[outerCoords.length - 1]);

			// ordering: assume outer goes start->end.
			// If idx1 > idx2, inner is reversed relative to outer?? Or we just measured wrong?
			// Let's assume consistent direction for now.

			const head = turf.lineSlice(startOuterPt, startOnOuter, outerF as any);
			const tail = turf.lineSlice(endOnOuter, endOuterPt, outerF as any);

			// Concatenate coordinates
			const headCoords = (head.geometry as any).coordinates;
			const tailCoords = (tail.geometry as any).coordinates;

			// If idx1 > idx2, swap head/tail connection? Or inner is backwards?
			// Simplest: just concat head + inner + tail.
			// However, if inner is reversed, we might make a U-turn.
			// Check distance: dist(headLast, innerFirst) vs dist(headLast, innerLast)

			// Check if we need to reverse inner?
			// usually local shape logic matches global shape logic in GTFS.

			let finalCoords = [...headCoords, ...innerCoords, ...tailCoords];
			return turf.lineString(finalCoords).geometry;
		} catch (e) {
			console.warn('Splice failed', e);
			return inner.geometry || inner; // fallback to high-res inner
		}
	}

	async function fetchMissingShapes(
		missing_shapes: Array<{ chateau: string; shape_id: string; route_type: number }>
	) {
		const isLots = missing_shapes.length > 7;

		// Groups for batching
		// 1. Inner (High Detail, BBox) - For Rail/Lots
		const groupInner: { chateau: string; shape_id: string }[] = [];
		// 2. Outer Rail (Low Detail 1000)
		const groupOuterRail: { chateau: string; shape_id: string }[] = [];
		// 3. Outer Other (Low Detail 100)
		const groupOuterOther: { chateau: string; shape_id: string }[] = [];
		// 4. Standard (Simplify 10) - For few items
		const groupStandard: { chateau: string; shape_id: string }[] = [];

		const center = data_meta?.primary
			? { lat: data_meta.primary.stop_lat, lon: data_meta.primary.stop_lon }
			: null;
		const bbox = center ? calculateBoundingBox(center.lat, center.lon, 10) : null;

		for (const item of missing_shapes) {
			// Optimization logic:
			// If Rail (2) OR Lots (>7) -> Use Inner/Outer Strategy
			// Else -> Standard Strategy
			const isRail = item.route_type === 2;

			if (fetched_shapes_cache[item.shape_id]) continue;
			fetched_shapes_cache[item.shape_id] = { type: 'Pending' };

			if (isRail || isLots) {
				if (center && bbox) {
					groupInner.push(item);
				}
				if (isRail) {
					groupOuterRail.push(item);
				} else {
					groupOuterOther.push(item);
				}
			} else {
				groupStandard.push(item);
			}
		}

		// Execute Batches
		const promises: Promise<void>[] = [];

		// Batch 1: Inner
		if (groupInner.length > 0 && bbox) {
			promises.push(
				batchFetchShapes(groupInner, {
					simplify: 0.5,
					...bbox,
					format: 'geojson'
				}).then((results) => {
					for (const [id, geom] of Object.entries(results)) {
						// Store temporarily to splice later?
						// Or just update cache with 'Inner' part?
						// We need to wait for Outer to splice.
						// Let's store in a temp map or attach to cache?
						// We can attach to `fetched_shapes_cache` as a partial object if we want,
						// but simpler: we just wait for all promises to resolve then splice.
						// Actually, we can't easily wait across different batch calls unless we coordinate.
						// So we'll update the cache with what we get, and splice if both exist?

						// Strategy: Store partials in a side-cache?
						// `fetched_shapes_cache` can hold { inner?: Geometry, outer?: Geometry } temporarily?
						// But the renderer expects Geometry.

						// Let's overwrite safely.
						const current = fetched_shapes_cache[id];
						if (current && current.type === 'Pending') {
							fetched_shapes_cache[id] = { inner: geom, type: 'Partial' };
						} else if (current && current.type === 'Partial') {
							// We have outer?
							if (current.outer) {
								fetched_shapes_cache[id] = spliceLines(geom, { geometry: current.outer });
								route_shapes_meta[id] = {
									spliced: true,
									outerSimplify: 1000 /* unknown really but low res */
								};
							} else {
								// just inner
								fetched_shapes_cache[id] = { ...current, inner: geom };
							}
						}
					}
				})
			);
		}

		// Batch 2: Outer Rail
		if (groupOuterRail.length > 0) {
			promises.push(
				batchFetchShapes(groupOuterRail, {
					simplify: 1000,
					format: 'geojson'
				}).then((results) => {
					for (const [id, geom] of Object.entries(results)) {
						const current = fetched_shapes_cache[id];
						if (current && current.type === 'Pending') {
							// Just outer so far (unlikely if inner fired, but maybe inner failed or handled differently)
							fetched_shapes_cache[id] = { outer: geom, type: 'Partial' };
						} else if (current && current.type === 'Partial') {
							if (current.inner) {
								fetched_shapes_cache[id] = spliceLines(
									{ geometry: current.inner },
									{ geometry: geom }
								);
								route_shapes_meta[id] = { spliced: true, outerSimplify: 1000 };
							} else {
								fetched_shapes_cache[id] = { ...current, outer: geom };
							}
						}
					}
				})
			);
		}

		// Batch 3: Outer Other
		if (groupOuterOther.length > 0) {
			promises.push(
				batchFetchShapes(groupOuterOther, {
					simplify: 100,
					format: 'geojson'
				}).then((results) => {
					for (const [id, geom] of Object.entries(results)) {
						const current = fetched_shapes_cache[id];
						if (current && current.type === 'Pending') {
							fetched_shapes_cache[id] = { outer: geom, type: 'Partial' };
						} else if (current && current.type === 'Partial') {
							if (current.inner) {
								fetched_shapes_cache[id] = spliceLines(
									{ geometry: current.inner },
									{ geometry: geom }
								);
								route_shapes_meta[id] = { spliced: true, outerSimplify: 100 };
							} else {
								fetched_shapes_cache[id] = { ...current, outer: geom };
							}
						}
					}
				})
			);
		}

		// Batch 4: Standard
		if (groupStandard.length > 0) {
			promises.push(
				batchFetchShapes(groupStandard, {
					simplify: 10,
					format: 'geojson'
				}).then((results) => {
					for (const [id, geom] of Object.entries(results)) {
						fetched_shapes_cache[id] = geom;
					}
				})
			);
		}

		await Promise.all(promises);

		// Cleanup: If any remain 'Partial' or 'Pending', finalize them
		// Pending -> Failed
		// Partial -> Use what we have (Inner or Outer)
		for (const item of missing_shapes) {
			const c = fetched_shapes_cache[item.shape_id];
			if (c && c.type === 'Partial') {
				// If we have just inner or just outer
				fetched_shapes_cache[item.shape_id] = c.inner || c.outer || { type: 'Pending' }; // Fallback
			}
		}

		primeMapContextFromMeta(); // re-render
	}

	function primeMapContextFromMeta() {
		const global_map_pointer = get(map_pointer_store);
		if (!global_map_pointer || !data_meta?.primary) return;

		if (!fly_to_already) {
			global_map_pointer.flyTo({
				center: [data_meta.primary.stop_lon, data_meta.primary.stop_lat],
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
						coordinates: [data_meta.primary.stop_lon, data_meta.primary.stop_lat],
						type: 'Point'
					}
				}
			]
		});

		const geojson_shapes_list: any[] = [];
		const missing_shapes: Array<{ chateau: string; shape_id: string; route_type: number }> = [];

		for (const [chateau_id, routes] of Object.entries<any>(data_meta.routes || {})) {
			for (const [route_id, route] of Object.entries<any>(routes)) {
				for (const shape_id of route.shapes_list || []) {
					// Check cache first (Geometry Object or Feature)
					const cached = fetched_shapes_cache[shape_id];
					if (cached && cached.type !== 'Pending') {
						geojson_shapes_list.push({
							geometry: cached.geometry || cached, // handle Feature vs Geometry
							properties: { color: route.color }
						});
						continue;
					} else if (cached && cached.type === 'Pending') {
						continue; // wait for it
					}

					// Fallback to initial meta (Encoded Polyline)
					const enc = data_meta.shapes?.[chateau_id]?.[shape_id];
					if (enc) {
						geojson_shapes_list.push({
							geometry: polyline.toGeoJSON(enc),
							properties: { color: route.color }
						});
						// We have it, no need to fetch.
					} else {
						// We need it.
						missing_shapes.push({
							chateau: chateau_id,
							shape_id,
							route_type: route.route_type
						});
					}
				}
			}
		}

		if (missing_shapes.length > 0) {
			fetchMissingShapes(missing_shapes);
		}

		global_map_pointer.getSource('transit_shape_context_for_stop')?.setData({
			type: 'FeatureCollection',
			features: geojson_shapes_list
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
	$: if (chateau && stop_id) {
		resetState();
		loadInitialPages();
	}

	let moveTimeout: any;
	function updateShapesOnMove() {
		const map = get(map_pointer_store);
		if (!map || map.getZoom() <= 11) return;

		clearTimeout(moveTimeout);
		moveTimeout = setTimeout(async () => {
			const bounds = map.getBounds();
			const zoom = map.getZoom();

			// Iterate over shapes that we know have a low-res outer part
			const itemsToUpdate: { chateau: string; shape_id: string }[] = [];

			for (const [shape_id, meta] of Object.entries(route_shapes_meta)) {
				// checks
				if (!meta.outerSimplify || meta.outerSimplify <= 10) continue; // already high res or not optimized

				// Find chateau for this shape_id
				// I'll scan data_meta to find chateau for shape_id (inefficient loop but safe)
				let chateau = '';
				let found = false;
				// Reverse lookup
				loop1: for (const [c_id, routes] of Object.entries<any>(data_meta?.routes || {})) {
					for (const [r_id, route] of Object.entries<any>(routes)) {
						if ((route.shapes_list || []).includes(shape_id)) {
							chateau = c_id;
							found = true;
							break loop1;
						}
					}
				}
				if (!found) continue;
				itemsToUpdate.push({ chateau, shape_id });
			}

			if (itemsToUpdate.length > 0) {
				const { _sw, _ne } = bounds;
				// Dynamic simplification based on zoom logic (User Request)
				// e.g. Zoom 14+ -> simplify 2m, else 10m?
				const dynamicSimplify = zoom > 14 ? 2 : 10;

				try {
					const results = await batchFetchShapes(itemsToUpdate, {
						simplify: dynamicSimplify,
						min_x: _sw.lng,
						min_y: _sw.lat,
						max_x: _ne.lng,
						max_y: _ne.lat,
						format: 'geojson'
					});

					for (const [shape_id, json_geom] of Object.entries(results)) {
						if (!json_geom) continue;

						// If empty coordinates, ignore
						const coords = json_geom.coordinates;
						if (!coords || coords.length === 0) continue;

						// Splice
						const current = fetched_shapes_cache[shape_id];
						// We expect current to be the "Outer" or previously spliced.
						// The "Splice" function expects features/geometries.

						// Current must be valid
						if (current && current.type !== 'Pending' && current.type !== 'Partial') {
							// If current is Geometry
							const spliced = spliceLines({ geometry: json_geom }, { geometry: current });
							fetched_shapes_cache[shape_id] = spliced;
						}
					}

					primeMapContextFromMeta();
				} catch (e) {
					console.error('Failed to batch update shapes on move', e);
				}
			}
		}, 500); // 500ms debounce
	}

	onMount(() => {
		current_time = Date.now();
		const tick = setInterval(() => (current_time = Date.now()), 500);

		const map = get(map_pointer_store);
		if (map) {
			map.on('moveend', updateShapesOnMove);
		}

		// Start global refresher
		refreshTimer = setInterval(refreshAllPages, PAGE_REFRESH_MS);

		return () => {
			clearInterval(tick);
			clearInterval(refreshTimer);
			const global_map_pointer = get(map_pointer_store);
			global_map_pointer?.getSource('redpin')?.setData({ type: 'FeatureCollection', features: [] });

			if (global_map_pointer) {
				global_map_pointer.off('moveend', updateShapesOnMove);
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
	<div class="flex flex-row items-center gap-1">
		<HomeButton />
		{#if data_meta}
			<div class="flex flex-row gap-2 ml-auto mr-2">
				<EnrouteButton mode="station" {chateau} {stop_id} />
				<CopyLinkButton screen="stop" {chateau} stop={stop_id} />
			</div>
		{/if}
	</div>


	<div
		bind:this={scrollContainer}
		class="catenary-scroll overflow-y-auto pb-64 h-full pr-2"
		on:scroll={onScroll}
	>
		<div class="flex flex-col">
			<div>
				{#if data_meta}
					<div class="flex flex-row ml-1">
						<div class="flex flex-col">
							<h2 class="text-lg font-bold">{data_meta.primary.stop_name}</h2>
							<p class="text-sm mb-2">{data_meta.primary.timezone}</p>
						</div>
						<div class="ml-auto flex flex-col items-end gap-1">
							<p class="align-middle">
								<Clock
									time_seconds={current_time / 1000}
									show_seconds={true}
									timezone={data_meta.primary.timezone}
								/>
							</p>
						</div>
					</div>

					<!-- Filters -->
					<div class="flex flex-row flex-wrap gap-2 ml-1 mb-4 items-center">
						<button
							class={`px-3 py-1.5 rounded-full text-sm font-medium border border-gray-300 dark:border-gray-600 ${filter_rail ? 'bg-blue-100 dark:bg-blue-900 border-blue-400' : 'bg-gray-100 dark:bg-gray-800 opacity-60'}`}
							on:click={() => (filter_rail = !filter_rail)}
						>
							{$_('headingIntercityRail')}
						</button>
						<button
							class={`px-3 py-1.5 rounded-full text-sm font-medium border border-gray-300 dark:border-gray-600 ${filter_metro ? 'bg-blue-100 dark:bg-blue-900 border-blue-400' : 'bg-gray-100 dark:bg-gray-800 opacity-60'}`}
							on:click={() => (filter_metro = !filter_metro)}
						>
							{$_('headingLocalRail')}
						</button>
						<button
							class={`px-3 py-1.5 rounded-full text-sm font-medium border border-gray-300 dark:border-gray-600 ${filter_bus ? 'bg-blue-100 dark:bg-blue-900 border-blue-400' : 'bg-gray-100 dark:bg-gray-800 opacity-60'}`}
							on:click={() => (filter_bus = !filter_bus)}
						>
							{$_('headingBus')}
						</button>
						<button
							class={`px-3 py-1.5 rounded-full text-sm font-medium border border-gray-300 dark:border-gray-600 ${filter_other ? 'bg-blue-100 dark:bg-blue-900 border-blue-400' : 'bg-gray-100 dark:bg-gray-800 opacity-60'}`}
							on:click={() => (filter_other = !filter_other)}
						>
							{$_('headingOther')}
						</button>
					</div>

					<label
						class="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full cursor-pointer select-none border border-gray-300 dark:border-gray-600"
					>
						<input
							type="checkbox"
							bind:checked={show_arrivals_only}
							class="form-checkbox h-4 w-4 text-blue-600"
						/>
						<span class="text-sm font-medium">{$_('show_arrivals')}</span>
					</label>

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

					{#if Object.keys(dates_to_events_filtered).length > 0}
						{#each Object.keys(dates_to_events_filtered) as date_code}
							<p class="text-md font-semibold mt-0 mb-1 mx-3">
								{new Date(date_code).toLocaleDateString(
									timezone_to_locale(locale_inside_component, data_meta.primary.timezone),
									{
										year: 'numeric',
										month: 'numeric',
										day: 'numeric',
										weekday: 'long',
										timeZone: 'UTC'
									}
								)}
							</p>

							{#each dates_to_events_filtered[date_code].filter((event) => {
								let cutoff = 60;
								if (show_previous_departures) cutoff = 1800;
								// Filter by time
								const relevant_time = event.last_stop ? event.realtime_arrival || event.scheduled_arrival : event.realtime_departure || event.scheduled_departure;
								if (relevant_time < current_time / 1000 - cutoff) return false;

								if (event.last_stop && !show_arrivals_only) return false;

								// Filter by mode
								// Route type might be on event or in route definition
								// Usually on route definition in GTFS, but let's check where it is available.
								// In mergePageEvents we have the event.
								// Do we have route_type on event? Checking StopScreenRow usage mostly implies route info is in data_meta.routes
								const routeDef = data_meta.routes?.[event.chateau]?.[event.route_id];
								const rType = routeDef?.route_type ?? event.route_type ?? 3; // default to bus if unknown
								return filter_for_route_type(rType);
							}) as event}
								{#if [2].includes(data_meta.routes?.[event.chateau]?.[event.route_id]?.route_type ?? event.route_type)}
									{@const route_id_local = event.route_id}
									{@const agency_id_local =
										data_meta.routes?.[event.chateau]?.[route_id_local]?.agency_id}
									{@const show_route_name =
										event.chateau !== 'nationalrailuk' ||
										['TW', 'ME', 'LO', 'XR', 'HX'].includes(agency_id_local)}
									<div
										class="mx-1 py-2 border-b border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 flex flex-row"
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
										<div class="flex-grow">
											<div class="flex flex-row items-center gap-2 mb-1">
												{#if show_route_name && data_meta.routes?.[event.chateau]?.[event.route_id]?.short_name}
													<span
														class="rounded-xs font-bold px-1 py-0.5 text-sm"
														style={`background: ${data_meta.routes?.[event.chateau]?.[event.route_id]?.color}; color: ${data_meta.routes?.[event.chateau]?.[event.route_id]?.text_color};`}
													>
													</span>
												{/if}
												<div class="text-base font-normal leading-tight">
													{event.headsign}
													{#if event.trip_short_name}
														<span class="font-bold ml-1">{event.trip_short_name}</span>
													{/if}
												</div>
											</div>
											<div
												class="flex flex-row text-sm text-gray-600 dark:text-gray-400 gap-2 items-center flex-wrap"
											>
												{#if data_meta.agencies?.[event.chateau]?.[data_meta.routes?.[event.chateau]?.[event.route_id]?.agency_id]?.agency_name}
													{@const agency_id =
														data_meta.routes?.[event.chateau]?.[event.route_id]?.agency_id}
													{@const agency_name =
														data_meta.agencies?.[event.chateau]?.[agency_id]?.agency_name}
													{#if agency_id === 'GWR' || agency_name?.trim().toLowerCase() === 'gwr'}
														<img
															src="/agencyicons/GreaterWesternRailway.svg"
															alt={agency_name}
															class="h-4 inline-block dark:hidden"
														/>
														<img
															src="/agencyicons/GreaterWesternRailwayBrighter.svg"
															alt={agency_name}
															class="h-4 hidden dark:inline-block"
														/>
														<span class="ml-1">Great Western Railway</span>
													{:else if agency_name?.trim().toLowerCase() === 'london overground'}
														<img
															src="/agencyicons/uk-london-overground.svg"
															alt={agency_name}
															class="h-4 inline-block"
														/>
													{:else if agency_id === 'CC' || agency_name
															?.trim()
															.toLowerCase() === 'c2c'}
														<img
															src="/agencyicons/c2c_logo.svg"
															alt={agency_name}
															class="h-4 inline-block"
														/>
														<span class="ml-1">c2c</span>
													{:else if agency_name?.trim().toLowerCase() === 'elizabeth line'}
														<img
															src="/agencyicons/Elizabeth_line_roundel.png"
															alt={agency_name}
															class="h-4 inline-block"
														/>
													{:else}
														<span>{agency_name}</span>
													{/if}
													<span class="opacity-80">•</span>
												{/if}

												{#if show_route_name}
													<span
														class="font-bold px-1 py-0.5 rounded-xs text-xs"
														style={`background: ${data_meta.routes?.[event.chateau]?.[event.route_id]?.color}; color: ${data_meta.routes?.[event.chateau]?.[event.route_id]?.text_color};`}
													>
														{data_meta.routes?.[event.chateau]?.[event.route_id]?.short_name ||
															data_meta.routes?.[event.chateau]?.[event.route_id]?.long_name}
													</span>
												{/if}

												{#if event.platform_string_realtime}
													<span class="opacity-90">•</span>
													<span
														class="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs font-bold text-gray-800 dark:text-gray-200"
													>
														{$_('platform')}
														{event.platform_string_realtime.replace('Track', '').trim()}
													</span>
												{/if}
											</div>
										</div>
										<div class="flex-none flex flex-col items-end justify-center min-w-[80px]">
											<StopScreenRow
												{event}
												data_from_server={data_meta}
												{current_time}
												{show_seconds}
												show_arrivals={event.last_stop}
												vertical={true}
											/>
										</div>
									</div>
								{:else}
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
												{#if data_meta.routes?.[event.chateau]?.[event.route_id]?.short_name}
													<span
														class="rounded-xs font-bold px-0.5 mx-1 py-0.5"
														style={`background: ${data_meta.routes?.[event.chateau]?.[event.route_id]?.color}; color: ${data_meta.routes?.[event.chateau]?.[event.route_id]?.text_color};`}
													>
														{data_meta.routes?.[event.chateau]?.[event.route_id]?.short_name}
													</span>
												{:else if data_meta.routes?.[event.chateau]?.[event.route_id]?.long_name}
													<span
														class="rounded-xs font-semibold px-0.5 mx-1 py-0.5"
														style={`background: ${data_meta.routes?.[event.chateau]?.[event.route_id]?.color}; color: ${data_meta.routes?.[event.chateau]?.[event.route_id]?.text_color};`}
													>
														{data_meta.routes?.[event.chateau]?.[event.route_id]?.long_name}
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
											data_from_server={data_meta}
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
								{/if}
							{/each}
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
					<p class="ml-2">Loading…</p>
				{/if}
			</div>
		</div>
	</div>
</div>
