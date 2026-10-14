<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { _, locale } from 'svelte-i18n';
	import { data_stack_store, map_pointer_store, nearby_pick_state_store, nearby_user_picks_store } from '$root/globalstores';
	import { recordOsmItemVisit } from '$lib/features/search/state/stationHistory';
	import { OsmSearchResultStack } from './stackenum';
	import type { GeoJSONSource } from 'maplibre-gl';

	export let osm_id: string;
	export let osm_class: string;
	export let osm_type: string | null;
	export let initial_name = '';
	export let initial_address = '';
	export let initial_lat: number | null = null;
	export let initial_lon: number | null = null;

	type OsmElement = {
		type: string;
		id: number;
		tags?: Record<string, string>;
		lat?: number;
		lon?: number;
		center?: { lat: number; lon: number };
	};
	let element: OsmElement | null = null;
	let loading = true;
	let error = '';
	let namesExpanded = false;
	let tagsExpanded = false;
	let abort: AbortController | null = null;

	$: tags = element?.tags ?? {};
	$: name = tags['name:' + ($locale ?? 'en').split('-')[0]] || tags.name || initial_name ||
		'OpenStreetMap ' + osm_class + ' ' + osm_id;
	$: otherNames = Object.entries(tags)
		.filter(([key, value]) => key.startsWith('name:') && value && value !== name)
		.map(([key, value]) => ({ language: key.substring(5), value }));
	$: kind = tags.amenity || tags.shop || tags.tourism || tags.leisure || osm_class;
	$: address = [
		[tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' '),
		tags['addr:postcode'], tags['addr:city'], tags['addr:state'], tags['addr:country']
	].filter(Boolean).join(', ') || initial_address;
	$: lat = Number.isFinite(initial_lat) && initial_lat != null ? initial_lat :
		element?.lat ?? element?.center?.lat ?? null;
	$: lon = Number.isFinite(initial_lon) && initial_lon != null ? initial_lon :
		element?.lon ?? element?.center?.lon ?? null;
	$: website = normalizeWebsite(tags.website || tags['contact:website']);
	$: phone = tags.phone || tags['contact:phone'];
	$: openingHours = tags.opening_hours;
	$: amenities = [
		['wheelchair', 'Wheelchair access'], ['toilets', 'Toilets'],
		['toilets:wheelchair', 'Accessible toilets'], ['indoor_seating', 'Indoor seating'],
		['outdoor_seating', 'Outdoor seating'], ['takeaway', 'Takeaway'],
		['drive_through', 'Drive-through'], ['air_conditioning', 'Air conditioning'],
		['internet_access', 'Internet access'], ['diet:vegan', 'Vegan options'],
		['diet:vegetarian', 'Vegetarian options'], ['payment:cash', 'Cash'],
		['payment:credit_cards', 'Credit cards'], ['payment:debit_cards', 'Debit cards']
	].filter(([key]) => tags[key]).map(([key, label]) => ({ label, value: tags[key] }));

	function normalizeWebsite(value: string | undefined): string | null {
		if (!value) return null;
		try {
			const url = new URL(/^[a-z]+:\/\//i.test(value) ? value : 'https://' + value);
			return ['https:', 'http:'].includes(url.protocol) ? url.toString() : null;
		} catch { return null; }
	}
	function updatePin(longitude: number, latitude: number): void {
		const map = get(map_pointer_store);
		const source = map?.getSource('redpin') as GeoJSONSource | undefined;
		source?.setData({
			type: 'FeatureCollection',
			features: [{ type: 'Feature', properties: {}, geometry: {
				type: 'Point', coordinates: [longitude, latitude]
			}}]
		});
	}
	function showNearby(): void {
		if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
		nearby_pick_state_store.set(1);
		nearby_user_picks_store.set({ latitude: lat, longitude: lon });
		const map = get(map_pointer_store);
		map?.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 15) });
		data_stack_store.set([]);
	}
	async function loadInfo(): Promise<void> {
		abort?.abort();
		abort = new AbortController();
		loading = true;
		error = '';
		try {
			if (!['node', 'way', 'relation'].includes(osm_class) || !/^[1-9][0-9]*$/.test(osm_id)) {
				throw new Error('Invalid OSM object ID');
			}
			const response = await fetch(
				'https://www.openstreetmap.org/api/0.6/' + osm_class + '/' + osm_id + '.json',
				{ signal: abort.signal }
			);
			if (!response.ok) throw new Error('HTTP ' + response.status);
			const payload: { elements?: OsmElement[] } = await response.json();
			element = payload.elements?.find((item) =>
				item.type === osm_class && String(item.id) === osm_id) ?? null;
			if (!element) throw new Error('Object not found');
			const newLat = initial_lat ?? element.lat ?? element.center?.lat;
			const newLon = initial_lon ?? element.lon ?? element.center?.lon;
			if (Number.isFinite(newLat) && Number.isFinite(newLon)) updatePin(newLon!, newLat!);
			recordOsmItemVisit(new OsmSearchResultStack(
				osm_id, osm_class, osm_type, element.tags?.name ?? initial_name,
				initial_address, newLat ?? NaN, newLon ?? NaN
			));
		} catch (e) {
			if (!abort.signal.aborted) error = 'Unable to load OpenStreetMap details. Please try again.';
		} finally {
			if (!abort.signal.aborted) loading = false;
		}
	}
	onMount(() => {
		if (Number.isFinite(initial_lat) && Number.isFinite(initial_lon) &&
			initial_lat != null && initial_lon != null) updatePin(initial_lon, initial_lat);
		void loadInfo();
		return () => abort?.abort();
	});
</script>

<div class="catenary-scroll flex h-full flex-col gap-3 overflow-y-auto px-4 pb-20">
	<div>
		<h1 class="text-xl font-semibold">{name}</h1>
		<p class="text-sm capitalize text-gray-600 dark:text-gray-300">{kind.replaceAll('_', ' ')}</p>
		{#if address}<p class="mt-1 text-sm">{address}</p>{/if}
	</div>

	<button type="button" class="w-full rounded-lg bg-sky-600 px-4 py-3 font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
		disabled={lat == null || lon == null} on:click={showNearby}>
		<span class="material-symbols-outlined mr-2 align-middle">departure_board</span>
		{$_('nearbydepartures')}
	</button>

	{#if loading}<p role="status" class="text-sm">Loading OpenStreetMap details…</p>{/if}
	{#if error}
		<div role="alert" class="rounded-lg bg-gray-100 p-3 dark:bg-gray-800">
			<p>{error}</p>
			<button type="button" class="mt-2 rounded-md bg-sky-600 px-4 py-2 text-white" on:click={() => void loadInfo()}>Retry</button>
		</div>
	{/if}

	{#if otherNames.length}
		<div class="overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
			<button class="flex w-full items-center gap-3 p-4 text-left" type="button"
				aria-expanded={namesExpanded} on:click={() => namesExpanded = !namesExpanded}>
				<span class="material-symbols-outlined">translate</span>
				<span class="flex-1 font-medium">Other names ({otherNames.length})</span>
				<span class="material-symbols-outlined">{namesExpanded ? 'expand_less' : 'expand_more'}</span>
			</button>
			{#if namesExpanded}
				<div class="space-y-2 px-4 pb-4">
					{#each otherNames as entry}
						<p class="text-sm"><span class="mr-2 text-gray-500">{entry.language}</span>{entry.value}</p>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
	{#if website}
		<a href={website} target="_blank" rel="noopener noreferrer"
			class="flex items-center gap-3 rounded-xl bg-gray-100 p-4 dark:bg-gray-800">
			<span class="material-symbols-outlined">language</span>
			<span><span class="block text-xs text-gray-500 dark:text-gray-400">Website</span>{new URL(website).hostname.replace(/^www\./, '')}</span>
		</a>
	{/if}
	{#if phone}
		<a href={'tel:' + phone.split(';')[0].trim()} class="flex items-center gap-3 rounded-xl bg-gray-100 p-4 dark:bg-gray-800">
			<span class="material-symbols-outlined">call</span>
			<span><span class="block text-xs text-gray-500 dark:text-gray-400">Phone number</span>{phone}</span>
		</a>
	{/if}
	{#if openingHours}
		<div class="flex items-center gap-3 rounded-xl bg-gray-100 p-4 dark:bg-gray-800">
			<span class="material-symbols-outlined">schedule</span>
			<span><span class="block text-xs text-gray-500 dark:text-gray-400">Opening hours (OSM)</span>{openingHours}</span>
		</div>
	{/if}
	{#if amenities.length}
		<section class="rounded-xl bg-gray-100 p-4 dark:bg-gray-800">
			<h2 class="mb-2 font-medium">Amenities &amp; accessibility</h2>
			{#each amenities as item}
				<p class="py-1 text-sm">{item.label}: {item.value.replaceAll('_', ' ')}</p>
			{/each}
		</section>
	{/if}
	{#if Object.keys(tags).length}
		<div class="rounded-xl bg-gray-100 p-4 dark:bg-gray-800">
			<button type="button" class="flex w-full justify-between font-medium" aria-expanded={tagsExpanded}
				on:click={() => tagsExpanded = !tagsExpanded}>
				<span>All OSM tags</span><span class="material-symbols-outlined">{tagsExpanded ? 'expand_less' : 'expand_more'}</span>
			</button>
			{#if tagsExpanded}
				<dl class="mt-3 text-xs">
					{#each Object.entries(tags).sort(([a], [b]) => a.localeCompare(b)) as [key, value]}
						<div class="border-t border-gray-300 py-1 dark:border-gray-600">
							<dt class="font-mono text-gray-500">{key}</dt><dd class="break-words">{value}</dd>
						</div>
					{/each}
				</dl>
			{/if}
		</div>
	{/if}
	<a href={'https://www.openstreetmap.org/' + osm_class + '/' + osm_id} target="_blank" rel="noopener noreferrer"
		class="w-fit rounded-lg bg-gray-200 px-3 py-2 text-sm dark:bg-gray-700">View on OpenStreetMap ↗</a>
</div>
