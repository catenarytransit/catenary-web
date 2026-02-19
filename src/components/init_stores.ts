import {
	data_stack_store,
	on_sidebar_trigger_store,
	realtime_vehicle_locations_last_updated_store,
	realtime_vehicle_locations_store,
	realtime_vehicle_route_cache_hash_store,
	realtime_vehicle_route_cache_store,
	lock_on_gps_store,
	usunits_store,
	show_zombie_buses_store,
	show_my_location_store,
	custom_icons_category_to_layer_id,
	map_pointer_store,
	geolocation_store,
	chateaus_store,
	show_gtfs_ids_store,
	ui_theme_store,
	ui_font_store,
	show_seconds_store,
	show_topo_global_store,
	show_stop_codes_store,
	make_ui_fonts_list
} from '../globalstores';

export function init_stores() {
	if (typeof window != 'undefined') {
		if (window.localStorage.getItem('usunits') == 'true') {
			usunits_store.set(true);
		} else {
			usunits_store.set(false);
		}

		if (window.localStorage.getItem('topography') == 'true') {
			show_topo_global_store.set(true);
		}

		show_topo_global_store.subscribe((value) => {
			window.localStorage.setItem('topography', value.toString());
		});


		if (window.localStorage.getItem('show_gtfs_ids') == 'true') {
			show_gtfs_ids_store.set(true);
		} else {
			show_gtfs_ids_store.set(false);
		}

		if (window.localStorage.getItem('show_stop_codes') == 'true') {
			show_stop_codes_store.set(true);
		} else {
			show_stop_codes_store.set(false);
		}

		if (window.localStorage.getItem('show_seconds') == 'true') {
			show_seconds_store.set(true);
		}

		if (window.localStorage.show_gtfs_ids == true) {
			show_gtfs_ids_store.set(true);
		}

		let ui_theme_grab = window.localStorage.getItem('ui_theme_store');
		if (ui_theme_grab) {
			ui_theme_store.set(ui_theme_grab);
		}

		ui_theme_store.subscribe((value) => {
			window.localStorage.setItem('ui_theme_store', value);
		});

		let ui_font_css_grab = window.localStorage.getItem('ui_font_css_name');
		let ui_font_postscript_grab = window.localStorage.getItem('ui_font_postscript_name');
		if (ui_font_css_grab && ui_font_postscript_grab) {
			ui_font_store.set(make_ui_fonts_list(ui_font_css_grab, ui_font_postscript_grab));
		}

		ui_font_store.subscribe((value) => {
			window.localStorage.setItem('ui_font_css_name', value.main_font_css_name);
			window.localStorage.setItem('ui_font_postscript_name', value.main_font_postscript_name);
		});

		show_seconds_store.subscribe((value) => {
			window.localStorage.setItem('show_seconds', String(value));
		});
	}
}
