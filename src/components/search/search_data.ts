import { writable, get } from 'svelte/store';
import type { Writable } from 'svelte/store';

import {
	show_my_location_store,
	geolocation_store,
	map_pointer_store,
	data_stack_store
} from '../../globalstores';
import { StackInterface, OsmItemStack, RouteStack, StopStack } from '../stackenum';

interface SearchQueryResponse {
	stops_section: StopsSection;
	routes_section: RoutesSection;
}

interface StopsSection {
	stops: Record<string, Record<string, any>>;
	routes: Record<string, Record<string, any>>;
	ranking: Array<StopsRanking>;
}

interface RoutesSection {
	routes: Record<string, Record<string, any>>;
	ranking: Array<RoutesRanking>;
}

interface StopsRanking {
	gtfs_id: string;
	score: number;
	chateau: string;
}

interface RoutesRanking {
	gtfs_id: string;
	score: number;
	chateau: string;
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
		[key: string]: any;
	};
}

interface CypressFeatureCollection {
	type: 'FeatureCollection';
	features: CypressFeature[];
}

export const data_store_text_queries: Writable<Record<string, SearchQueryResponse>> = writable({});
export const cypress_response_queries: Writable<Record<string, CypressFeatureCollection>> =
	writable({});

export const latest_query_data: Writable<SearchQueryResponse | null> = writable(null);
export const latest_cypress_data: Writable<CypressFeatureCollection | null> = writable(null);

let geolocation: GeolocationPosition | null;

export const show_back_button_store: Writable<boolean> = writable(false);

export const text_input_store: Writable<string> = writable('');

export const text_input_matches_current_result: Writable<boolean> = writable(true);

export interface SearchResultItem {
	type: 'cypress' | 'route' | 'stop';
	data: any;
	chateau?: string;
	gtfs_id?: string;
}

export const selected_result_index_store: Writable<number> = writable(-1);
export const displayed_results_store: Writable<SearchResultItem[]> = writable([]);

export function select_result_item(item: SearchResultItem) {
	let map = get(map_pointer_store);
	autocomplete_focus_state.set(false);
	show_back_button_recalc();

	if (item.type === 'cypress') {
		const feature = item.data;
		data_stack_store.update((data_stack) => {
			let osm_type = 'N';
			let osm_id = '0';

			if (feature.properties.id) {
				const parts = feature.properties.id.split('/');
				if (parts.length == 2) {
					if (parts[0] == 'relation') osm_type = 'R';
					if (parts[0] == 'way') osm_type = 'W';
					osm_id = parts[1];
				}
			}

			let category = feature.properties.layer;
			if (feature.properties.categories && feature.properties.categories.length > 0) {
				category = feature.properties.categories[0];
			}

			data_stack.push(new StackInterface(new OsmItemStack(osm_id, category, osm_type)));
			return data_stack;
		});

		if (feature.geometry && feature.geometry.coordinates) {
			map.flyTo({
				center: feature.geometry.coordinates,
				zoom: 16
			});
		}
	} else if (item.type === 'route') {
		if (item.chateau && item.gtfs_id) {
			data_stack_store.update((data_stack) => {
				data_stack.push(new StackInterface(new RouteStack(item.chateau!, item.gtfs_id!)));
				return data_stack;
			});
		}
	} else if (item.type === 'stop') {
		if (item.chateau && item.gtfs_id) {
			data_stack_store.update((data_stack) => {
				data_stack.push(new StackInterface(new StopStack(item.chateau!, item.gtfs_id!)));
				return data_stack;
			});
		}
	}
}

geolocation_store.subscribe((g) => {
	geolocation = g;
});

export function show_back_button_recalc() {
	if (window.innerWidth < 768) {
		if (get(autocomplete_focus_state) == true) {
			show_back_button_store.set(true);
		} else {
			show_back_button_store.set(false);
		}
	} else {
		show_back_button_store.set(false);
	}
}

//on desktop, either the input is still selected
export const autocomplete_focus_state: Writable<boolean> = writable(false);

let abortController = new AbortController();

export function new_query(text: string) {
	abortController.abort();
	abortController = new AbortController();

	let map = get(map_pointer_store);

	text_input_matches_current_result.set(false);

	const centerCoordinates = map.getCenter();
	const zoom = Math.round(map.getZoom());

	let geolocation_active = false;

	if (geolocation) {
		if (geolocation.coords) {
			if (typeof geolocation.coords.latitude == 'number') {
				geolocation_active = true;
			}
		}
	}

	let url = '';

	if (geolocation_active) {
		url = `https://birch_search.catenarymaps.org/text_search_v1?text=${text}&user_lat=${geolocation?.coords?.latitude}&user_lon=${geolocation.coords.longitude}&map_lat=${centerCoordinates.lat}&map_lon=${centerCoordinates.lng}&map_z=${zoom}`;
	} else {
		url = `https://birch_search.catenarymaps.org/text_search_v1?text=${text}&map_lat=${centerCoordinates.lat}&map_lon=${centerCoordinates.lng}&map_z=${zoom}`;
	}

	// Calculate focus weight
	let focus_weight = 3.0;
	if (zoom > 13) {
		focus_weight = 5.0;
	} else if (zoom > 10) {
		focus_weight = 4.0;
	} else if (zoom < 7) {
		focus_weight = 2.0;
	}

	const cypressSubdomains = ['cypress', 'cypress1', 'cypress2'];
	const randomCypressSubdomain =
		cypressSubdomains[Math.floor(Math.random() * cypressSubdomains.length)];

	// Cypress Autocomplete
	// Check cache first
	const cached_data = get(cypress_response_queries)[text];
	if (cached_data) {
		latest_cypress_data.set(cached_data);
		selected_result_index_store.set(-1);
		if (map && map.getSource('cypress_results')) {
			if (cached_data.type === 'FeatureCollection' && Array.isArray(cached_data.features)) {
				(map.getSource('cypress_results') as maplibregl.GeoJSONSource).setData(cached_data);
			}
		}
	}

	const cypressUrl = new URL(`https://${randomCypressSubdomain}.catenarymaps.org/v1/autocomplete`);
	cypressUrl.searchParams.append('text', text);
	cypressUrl.searchParams.append('focus.point.lat', centerCoordinates.lat.toString());
	cypressUrl.searchParams.append('focus.point.lon', centerCoordinates.lng.toString());
	cypressUrl.searchParams.append('focus.point.weight', focus_weight.toString());

	fetch(cypressUrl.toString(), {
		mode: 'cors',
		signal: abortController.signal
	})
		.then((response) => response.json())
		.then((data: CypressFeatureCollection) => {
			cypress_response_queries.update((existing_map) => {
				existing_map[text] = data;
				return existing_map;
			});

			// Update if the input text starts with the query text (allow intermediate results)
			// This fixes the issue where fast typing prevents results from showing.
			const current_input = get(text_input_store);
			if (current_input.startsWith(text)) {
				latest_cypress_data.set(data);
				selected_result_index_store.set(-1);

				// Update Map source if it exists
				if (map && map.getSource('cypress_results')) {
					if (data && data.type === 'FeatureCollection' && Array.isArray(data.features)) {
						(map.getSource('cypress_results') as maplibregl.GeoJSONSource).setData(data);
					}
				}
			}
			console.log('Cypress data', data);
		})
		.catch((e) => {
			if (e.name !== 'AbortError') {
				console.error('Cypress fetch error', e);
			}
		});

	fetch(url, { signal: abortController.signal })
		.then((response) => response.json())
		.then((data) => {
			data_store_text_queries.update((existing_map) => {
				existing_map[text] = data;
				return existing_map;
			});

			if (get(text_input_store) == text) {
				latest_query_data.set(data);
				text_input_matches_current_result.set(true);
				selected_result_index_store.set(-1);
			} else {
				if (get(text_input_matches_current_result) == false) {
					latest_query_data.set(data);
				}
			}
		});
}

export function perform_full_search(text: string) {
	abortController.abort();
	abortController = new AbortController();

	const cypressSubdomains = ['cypress', 'cypress1', 'cypress2'];
	const randomCypressSubdomain =
		cypressSubdomains[Math.floor(Math.random() * cypressSubdomains.length)];
	// Optional: Call this when user hits enter if explicit search behavior is different
	// For now new_query handles the main interaction via autocomplete
	fetch(`https://${randomCypressSubdomain}.catenarymaps.org/v1/search?text=${text}`, {
		mode: 'cors',
		signal: abortController.signal
	})
		.then((response) => response.json())
		.then((data: CypressFeatureCollection) => {
			if (get(text_input_store) == text) {
				latest_cypress_data.set(data);
				let map = get(map_pointer_store);
				if (map && map.getSource('cypress_results')) {
					(map.getSource('cypress_results') as maplibregl.GeoJSONSource).setData(data);
				}
			}
		});
}
