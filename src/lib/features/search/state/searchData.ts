import type { GeoJSONSource, Map } from 'maplibre-gl';
import { get, writable, type Writable } from 'svelte/store';
import { data_stack_store, geolocation_store, map_pointer_store } from '$root/globalstores';
import {
	OsmItemStack,
	OsmStationStack,
	RouteStack,
	StackInterface,
	StopStack
} from '$components/stackenum';

export interface OsmStationSearchResult {
	osm_id: number;
	name: string | null;
	point: { x: number; y: number } | null;
	mode_type: string;
	operator: string | null;
	network: string | null;
	admin_hierarchy: any;
	routes: any[];
	confidence: number;
}

interface OsmStationSearchResponse {
	results: OsmStationSearchResult[];
}

interface RankedTransitItem {
	gtfs_id: string;
	score: number;
	chateau: string;
}

interface StopsSection {
	stops: Record<string, Record<string, any>>;
	routes: Record<string, Record<string, any>>;
	ranking: RankedTransitItem[];
}

interface RoutesSection {
	routes: Record<string, Record<string, any>>;
	ranking: RankedTransitItem[];
}

export interface SearchQueryResponse {
	stops_section: StopsSection;
	routes_section: RoutesSection;
}

interface CypressFeature {
	type: 'Feature';
	geometry: {
		type: 'Point';
		coordinates: [number, number];
	};
	properties: {
		id: string;
		layer: string;
		name: string;
		names?: Record<string, string>;
		confidence?: number;
		categories?: string[];
		[key: string]: any;
	};
}

interface CypressFeatureCollection {
	type: 'FeatureCollection';
	features: CypressFeature[];
}

export interface SearchResultItem {
	type: 'cypress' | 'route' | 'stop' | 'osm_station';
	data: any;
	chateau?: string;
	gtfs_id?: string;
}

const transitQueryCache: Writable<Record<string, SearchQueryResponse>> = writable({});
const osmStationQueryCache: Writable<Record<string, OsmStationSearchResponse>> = writable({});
const cypressQueryCache: Writable<Record<string, CypressFeatureCollection>> = writable({});

export const latestTransitResults = writable<SearchQueryResponse | null>(null);
export const latestCypressResults = writable<CypressFeatureCollection | null>(null);
export const latestOsmStationResults = writable<OsmStationSearchResponse | null>(null);
export const searchText = writable('');
export const autocompleteFocus = writable(false);
export const showBackButton = writable(false);
export const selectedResultIndex = writable(-1);
export const displayedResults = writable<SearchResultItem[]>([]);

let activeQuery: AbortController | null = null;

function pushScreen(screen: unknown): void {
	data_stack_store.update((stack) => [...stack, new StackInterface(screen)]);
}

function updateCypressSource(map: Map | null, data: CypressFeatureCollection): void {
	const source = map?.getSource('cypress_results') as GeoJSONSource | undefined;
	if (source && data.type === 'FeatureCollection' && Array.isArray(data.features)) {
		source.setData(data);
	}
}

function stopActiveQuery(): AbortController {
	if (activeQuery && !activeQuery.signal.aborted) {
		activeQuery.abort(new DOMException('Superseded by a newer search query', 'AbortError'));
	}

	activeQuery = new AbortController();
	return activeQuery;
}

function resetResults(): void {
	latestTransitResults.set(null);
	latestCypressResults.set(null);
	latestOsmStationResults.set(null);
	selectedResultIndex.set(-1);
	displayedResults.set([]);
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
	const response = await fetch(url, { mode: 'cors', signal });
	if (!response.ok) {
		throw new Error(`Search request failed with status ${response.status}`);
	}
	return response.json() as Promise<T>;
}

function reportSearchError(label: string, error: unknown): void {
	if (error instanceof DOMException && error.name === 'AbortError') {
		return;
	}
	console.error(`${label} search failed`, error);
}

export function recalculateBackButton(): void {
	showBackButton.set(
		typeof window !== 'undefined' && window.innerWidth < 768 && get(autocompleteFocus)
	);
}

export function selectResult(item: SearchResultItem): void {
	const map = get(map_pointer_store) as Map | null;
	autocompleteFocus.set(false);
	recalculateBackButton();

	switch (item.type) {
		case 'cypress': {
			const feature = item.data as CypressFeature;
			const [osmKind, osmId = '0'] = String(feature.properties.id ?? '').split('/');
			const osmType = osmKind === 'relation' ? 'R' : osmKind === 'way' ? 'W' : 'N';
			const category = feature.properties.categories?.[0] ?? feature.properties.layer;
			pushScreen(new OsmItemStack(osmId, category, osmType));

			if (feature.geometry?.coordinates) {
				map?.flyTo({ center: feature.geometry.coordinates, zoom: 16 });
			}
			break;
		}
		case 'route':
			if (item.chateau && item.gtfs_id) {
				pushScreen(new RouteStack(item.chateau, item.gtfs_id));
			}
			break;
		case 'stop':
			if (item.chateau && item.gtfs_id) {
				pushScreen(new StopStack(item.chateau, item.gtfs_id));
			}
			break;
		case 'osm_station': {
			const point = item.data.point;
			pushScreen(
				new OsmStationStack(
					String(item.data.osm_id),
					item.data.name,
					item.data.mode_type,
					point?.y ?? null,
					point?.x ?? null
				)
			);
			if (point) {
				map?.flyTo({ center: [point.x, point.y], zoom: 16 });
			}
			break;
		}
	}
}

export function performAutocompleteQuery(rawText: string): void {
	const text = rawText.trim();
	const query = stopActiveQuery();

	if (text.length === 0) {
		resetResults();
		return;
	}

	const map = get(map_pointer_store) as Map | null;
	if (!map) {
		return;
	}

	const center = map.getCenter();
	const zoom = Math.round(map.getZoom());
	const geolocation = get(geolocation_store);
	const hasGeolocation = typeof geolocation?.coords?.latitude === 'number';
	const focusWeight = zoom > 13 ? 5 : zoom > 10 ? 4 : zoom < 7 ? 2 : 3;

	const transitUrl = new URL('https://birch_search.catenarymaps.org/text_search_v1');
	transitUrl.searchParams.set('text', text);
	transitUrl.searchParams.set('map_lat', String(center.lat));
	transitUrl.searchParams.set('map_lon', String(center.lng));
	transitUrl.searchParams.set('map_z', String(zoom));
	if (hasGeolocation && geolocation) {
		transitUrl.searchParams.set('user_lat', String(geolocation.coords.latitude));
		transitUrl.searchParams.set('user_lon', String(geolocation.coords.longitude));
	}

	const cypressSubdomains = ['cypress', 'cypress1', 'cypress2'];
	const cypressHost = cypressSubdomains[Math.floor(Math.random() * cypressSubdomains.length)];
	const cypressUrl = new URL(`https://${cypressHost}.catenarymaps.org/v2/search`);
	cypressUrl.searchParams.set('text', text);
	cypressUrl.searchParams.set('focus.point.lat', String(center.lat));
	cypressUrl.searchParams.set('focus.point.lon', String(center.lng));
	cypressUrl.searchParams.set('focus.point.weight', String(focusWeight));

	const osmStationUrl = new URL('https://birch_search.catenarymaps.org/osm_station_search');
	osmStationUrl.searchParams.set('text', text);
	if (hasGeolocation) {
		osmStationUrl.searchParams.set('focus_lat', String(center.lat));
		osmStationUrl.searchParams.set('focus_lon', String(center.lng));
		osmStationUrl.searchParams.set('focus_weight', String(focusWeight));
	}

	const cachedCypress = get(cypressQueryCache)[text];
	if (cachedCypress) {
		latestCypressResults.set(cachedCypress);
		selectedResultIndex.set(-1);
		updateCypressSource(map, cachedCypress);
	}

	void fetchJson<CypressFeatureCollection>(cypressUrl.toString(), query.signal)
		.then((data) => {
			cypressQueryCache.update((cache) => ({ ...cache, [text]: data }));
			if (get(searchText).trim() === text) {
				latestCypressResults.set(data);
				selectedResultIndex.set(-1);
				updateCypressSource(map, data);
			}
		})
		.catch((error) => reportSearchError('Cypress', error));

	const cachedStations = get(osmStationQueryCache)[text];
	if (cachedStations) {
		latestOsmStationResults.set(cachedStations);
	} else {
		void fetchJson<OsmStationSearchResponse>(osmStationUrl.toString(), query.signal)
			.then((data) => {
				osmStationQueryCache.update((cache) => ({ ...cache, [text]: data }));
				if (get(searchText).trim() === text) {
					latestOsmStationResults.set(data);
				}
			})
			.catch((error) => reportSearchError('OSM station', error));
	}

	const cachedTransit = get(transitQueryCache)[text];
	if (cachedTransit) {
		latestTransitResults.set(cachedTransit);
	}

	void fetchJson<SearchQueryResponse>(transitUrl.toString(), query.signal)
		.then((data) => {
			transitQueryCache.update((cache) => ({ ...cache, [text]: data }));
			if (get(searchText).trim() === text) {
				latestTransitResults.set(data);
				selectedResultIndex.set(-1);
			}
		})
		.catch((error) => reportSearchError('Transit', error));
}
