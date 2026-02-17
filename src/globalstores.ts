import {
	MapSelectionScreen,
	StackInterface,
	MapSelectionOption,
	SingleTrip,
	VehicleMapSelector,
	RouteStack,
	StopStack,
	RouteMapSelector
} from './components/stackenum';

export const consentGiven = writable<boolean | null>(null);

import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

export const data_stack_store: Writable<StackInterface[]> = writable([]);
export const on_sidebar_trigger_store = writable(0);

export const realtime_vehicle_locations_store: Writable<
	Record<string, Record<string, Record<string, any>>>
> = writable({
	bus: {},
	rail: {},
	metro: {},
	other: {}
});

//category -> chateau -> u32 -> u32 -> string -> any
export const realtime_vehicle_locations_storev2: Writable<
	Record<string, Record<string, Record<number, Record<number, Record<string, any>>>>>
> = writable({
	bus: {},
	rail: {},
	metro: {},
	other: {}
});

export interface CategoryHash {
	bus: number;
	rail: number;
	metro: number;
	other: number;
}

export interface TileBounds {
	min_x: number;
	max_x: number;
	min_y: number;
	max_y: number;
}

export const current_orm_layer_type_store: Writable<string | null> = writable(null);
export const current_orm_layer_theme_is_dark_mode_store: Writable<boolean | null> = writable(null);

export const realtime_vehicle_route_cache_store: Writable<
	Record<string, Record<string, Record<string, any>>>
> = writable({});
export const realtime_vehicle_route_cache_hash_store: Writable<Record<string, CategoryHash>> =
	writable({});

//chateau -> category -> tile bounds
export const previous_tile_boundaries_store: Writable<Record<string, Record<string, TileBounds>>> =
	writable({});

export const realtime_vehicle_locations_last_updated_store: Writable<Record<string, CategoryHash>> =
	writable({});
//chateau -> route_id -> route_data
export const route_cache: Writable<Record<string, Record<string, any>>> = writable({});
//chateau -> route_id_list
export const route_cache_agencies_known: Writable<Record<string, string[]>> = writable({});
export const lock_on_gps_store = writable(false);

export interface NearbySelectionFilterRouteType {
	bus: boolean;
	metro: boolean;
	rail: boolean;
	other: boolean;
}

export const nearby_departures_filter: Writable<NearbySelectionFilterRouteType> = writable({
	bus: true,
	metro: true,
	rail: true,
	other: true
});

//depreciated
export const dark_mode_store = writable(false);

// system, light, dark
export const ui_theme_store: Writable<string> = writable('system');

export const show_zombie_buses_store = writable(false);

export const usunits_store = writable(false);
export const show_my_location_store = writable(true);
export const show_gtfs_ids_store = writable(false);
export const show_stop_codes_store = writable(false);

export interface UIFontsList {
	css_font_stack: string[];
	postscript_font_name: string[];
	regular: string[];
	medium: string[];
	semibold: string[];
	bold: string[];
	italic: string[];
}

const fallback_ui_fonts = ["Noto Sans", "Noto Sans JP", "Noto Sans KR", "Noto Sans SC", "ui-sans-serif", "system-ui", "sans-serif", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"];

export function make_ui_fonts_list(main_font: string, postscript_font_name: string): UIFontsList {
	let unmarked = [main_font].concat(fallback_ui_fonts);
	return {
		css_font_stack: unmarked,
		postscript_font_name: [postscript_font_name],
		regular: [postscript_font_name + "-Regular"],
		medium: [postscript_font_name + "-Medium"],
		semibold: [postscript_font_name + "-SemiBold"],
		bold: [postscript_font_name + "-Bold"],
		italic: [postscript_font_name + "-Italic"],
	};
}

export const ui_font_store: Writable<UIFontsList> = writable(make_ui_fonts_list("Arimo", "Arimo"));

export const custom_icons_category_to_layer_id: Writable<Record<string, string[]>> = writable({});

export const map_pointer_store: Writable<maplibregl.Map | null> = writable(null);

export const geolocation_store: Writable<GeolocationPosition | null> = writable(null);

export const nearby_deps_cache_gps: Writable<any | null> = writable(null);

//0 for user location
//1 for user picks
export const nearby_pick_state_store: Writable<number> = writable(0);

export interface UserPicksNearby {
	longitude: number;
	latitude: number;
}

export const nearby_user_picks_store: Writable<UserPicksNearby | null> = writable(null);

export const chateaus_store: Writable<any | null> = writable(null);

export const show_seconds_store = writable(false);

export const show_topo_global_store = writable(false);

//chateau -> Vec<stop_id>
export const stops_to_hide_store: Writable<Record<string, string[]>> = writable({});

export const show_countdown_to_stop_store = writable(true);
