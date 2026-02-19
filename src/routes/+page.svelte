<script lang="ts">
	//@ts-nocheck
	import maplibregl from 'maplibre-gl';
	import mlcontour from 'maplibre-contour';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { onMount } from 'svelte';
	import { writable, get } from 'svelte/store';
	import type { Writable } from 'svelte/store';
	import Realtimelabel from '../realtimelabel.svelte';
	import { createGeoJSONCircle, componentToHex } from '../geoMathsAssist';
	import SidebarInternals from '../components/sidebarInternals.svelte';
	import { init_locales } from '../i18n';
	import { _ } from 'svelte-i18n';
	import { isLoading } from 'svelte-i18n';
	import { update_geolocation_source } from '../user_location_lib';
	import { init_stores } from '../components/init_stores';
	import { refreshUIMaplibre } from '../components/transitionDarkAndLight';
	import { layerspercategory } from '../components/layernames';
	import { start_location_watch } from '../user_location_lib';
	import SearchBar from '../components/search/SearchBar.svelte';
	import { autocomplete_focus_state } from '../components/search/search_data';
	import { deep_link_url_reader } from '../components/deeplinkreader';
	import { add_image_pedestrian_pattern } from '../components/pedestrian_layer';
	import {
		applyVehicleFilters,
		additional_filter_for_vehicles_store,
		resetAdditionalVehicleFilter
	} from '../components/filterState';
	import { isChromiumDesktop } from '../browserinfo';
	import {
		getLocationFromLocalStorage,
		saveLocationToLocalStorage
	} from '../components/previously_known_location';
	import {
		bus_label_with_headsign,
		bus_label_no_headsign
	} from '../components/addLayers/addLiveDots';

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
		show_topo_global_store,
		consentGiven,
		current_orm_layer_type_store,
		ui_font_store
	} from '../globalstores';
	import Layerbutton from '../components/layerbutton.svelte';
	import {
		MapSelectionScreen,
		StackInterface,
		MapSelectionOption,
		SingleTrip,
		VehicleMapSelector,
		RouteStack,
		StopStack,
		RouteMapSelector,
		OsmStationStack
	} from '../components/stackenum';
	import { switch_orm_layers } from '../components/openrailwaymap';
	import { setup_click_handler } from '../components/mapClickHandler';
	import { setup_load_map } from '../components/setup_load_map';
	import { interpretLabelsToCode } from '../components/rtLabelsToMapboxStyle';
	import { locale, locales } from 'svelte-i18n';
	import { determineFeedsUsingChateaus } from '../maploaddata';
	import CloseButton from '../components/CloseButton.svelte';
	import Layerselectionbox from '../components/layerselectionbox.svelte';
	import { determineDarkModeToBool } from '../components/determineDarkModeToBool';
	import { checkClockSync } from '../components/checkClockSync';
	import SearchAutocompleteList from '../components/search/SearchAutocompleteList.svelte';

	import ConsentBanner from '../components/ConsentBanner.svelte';
	import AndroidDownloadPopup from '../components/AndroidDownloadPopup.svelte';
	import { startSantaTracking } from '../components/santa_tracker';
	const enabledlayerstyle =
		'text-black dark:text-white bg-blue-200 dark:bg-gray-700 border border-blue-800 dark:border-blue-200 text-sm md:text-sm';

	let centerinit: LngLatLike = [10.46, 51.89];

	let zoominit = 3;

	/*
	const decode = (textToDecode: string) => {
		try {
			return new TextDecoder().decode(decodeToAry(textToDecode));
		} catch (e) {
			return 'Decode failed: Invalid input';
		}
	};*/
	init_locales();
	init_stores();
	let sidebarOpen: string = 'middle';
	let sidebar_height_output: string = '100vh';
	//percentage
	let sidebar_height_number: number = 40;
	//percentage
	let sidebar_height_target: number = 40;
	let previous_form_factor: string = 'mobile';
	let start_of_move_pointer_height: number | null = null;
	let start_of_move_sidebar_height: number | null = null;
	let last_sidebar_release: number | null = null;
	let current_locale: string = 'default';
	let last_sidebar_interval_id: number | null = null;
	let previous_click_on_sidebar_dragger: number | null = null;
	let previous_y_velocity_sidebar: number | null = null;
	let layersettingsBox = false;
	const layersettingsnamestorage = 'layersettingsv7';
	let LayerSettingsBox: any;
	$: if (layersettingsBox) {
		LayerSettingsBox = import('../components/LayerSettingsBox.svelte');
	}
	let currently_holding_sidebar_grabber: boolean = false;
	let maplat: number, maplng: number, mapzoom: number;
	let translate_x_sidebar: string = '0px';
	let translate_x_sidebar_number: number = 0;
	let translate_y_searchbar: number = 0;
	let collapser_left_offset_number: number = 380;
	let collapser_left_offset: string = '380px';
	let top_margin_collapser_sidebar: string = '0px';
	let showAndroidDownloadPopup = false;
	let isAndroid: boolean = false;
	let isChrome: boolean = false;

	let autocomplete_focus_state_local = get(autocomplete_focus_state);

	let geolocation: GeolocationPosition | null;

	let darkMode = determineDarkModeToBool();
	let lockongps = false;

	const lockonconst = 14.5;
	let firstmove = false;
	let secondrequestlockgps = false;

	let current_orm_layer_type: string | null = null;

	if (typeof window !== 'undefined') {
		geolocation_store.subscribe((g) => {
			geolocation = g;
		});

		lock_on_gps_store.subscribe((value) => {
			lockongps = value;
		});

		autocomplete_focus_state.subscribe((new_data) => {
			autocomplete_focus_state_local = new_data;
		});

		consentGiven.subscribe((value) => {
			// Wait until gtag is loaded
			if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;

			if (value === true) {
				// 1) Update consent
				window.gtag('consent', 'update', {
					analytics_storage: 'granted'
				});

				// 2) (Optional but common) re-run config so GA4 starts logging
				window.gtag('config', 'G-QJRT4Q71T1');
			} else {
				// If you also support "reject" later:
				window.gtag('consent', 'update', {
					analytics_storage: 'denied'
				});
			}
		});

		locale.subscribe((value) => {
			if (typeof window != 'undefined') {
				window.localStorage.language = value;
			}
		});

		top_margin_collapser_sidebar = `${window.innerHeight / 2 - 15}px`;

		if (window.localStorage.language) {
			locale.set(window.localStorage.language);
		}

		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ({ matches }) => {
			let ui_theme_grab = get(ui_theme_store);

			if (ui_theme_grab == 'system') {
				if (matches) {
					console.log('change to dark mode!');
					darkMode = true;
					refreshUIMaplibre();
				} else {
					console.log('change to light mode!');

					darkMode = false;

					refreshUIMaplibre();
				}
			}
		});

		if (ui_theme_store) {
			let ui_theme_grab = get(ui_theme_store);

			if (ui_theme_grab == 'system') {
				const checkIsDarkSchemePreferred = () =>
					window?.matchMedia?.('(prefers-color-scheme:dark)')?.matches ?? false;

				darkMode = checkIsDarkSchemePreferred();
			} else if (ui_theme_grab == 'dark') {
				darkMode = true;
			} else {
				darkMode = false;
			}

			if (darkMode) {
				document.body.classList.add('dark');
			} else {
				document.body.classList.remove('dark');
			}

			ui_theme_store.subscribe((value) => {
				if (value == 'system') {
					const checkIsDarkSchemePreferred = () =>
						window?.matchMedia?.('(prefers-color-scheme:dark)')?.matches ?? false;

					darkMode = checkIsDarkSchemePreferred();
				} else if (value == 'dark') {
					darkMode = true;
				} else {
					darkMode = false;
				}

				if (darkMode) {
					document.body.classList.add('dark');
				} else {
					document.body.classList.remove('dark');
				}

				refreshUIMaplibre();
			});

			ui_font_store.subscribe((value) => {
				document.documentElement.style.setProperty('--font-sans', value.css_font_stack);
			});

			console.log('dark mode ', darkMode, 'system theme', ui_theme_grab);
		}
	}

	//false means use metric, true means use us units
	let usunits = false;

	usunits_store.subscribe((value) => {
		usunits = value;
	});

	let announcermode = false;
	//stores geojson data for currently rendered GeoJSON realtime vehicles data, indexed by realtime feed id
	let geometryObj: Record<string, any> = {};
	let lasttimeofnorth = 0;
	let westOfMinus52 = true;
	let feed_id_to_chateau_lookup: Record<string, string> = {};
	let chateau_to_realtime_feed_lookup: Record<string, string[]> = {};
	let pending_chateau_rt_request: Record<string, number> = {};
	let on_sidebar_trigger = 0;

	on_sidebar_trigger_store.subscribe((value) => {
		on_sidebar_trigger = value;
	});

	let data_stack: StackInterface[] = [];
	let latest_item_on_stack: StackInterface | null = null;

	data_stack_store.subscribe((value) => {
		data_stack = value;
		latest_item_on_stack = data_stack[data_stack.length - 1];
	});

	function skyRefresh(map: maplibregl.Map, darkMode: boolean) {
		if (darkMode) {
			map.setSky({
				'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 2, 0.4, 7, 0.1, 9, 0],
				'sky-color': 'hsl(214, 20%, 19%)',
				'sky-horizon-blend': 0.4,
				'horizon-color': [
					'interpolate',
					['exponential', 1.2],
					['zoom'],
					5.5,
					'hsla(214, 15%, 19%, 0.2)',
					6,
					'hsla(214, 15%, 21%, 0.2)'
				],
				'horizon-fog-blend': 0.3,
				'fog-color': [
					'interpolate',
					['exponential', 1.2],
					['zoom'],
					5.5,
					'hsl(214, 15%, 10%)',
					6,
					'hsl(214, 30%, 5%)'
				],
				'fog-ground-blend': 0.9
			});
		} else {
			map.setSky({
				'sky-color': '#199EF3', // the color of the sky
				'sky-horizon-blend': 1, // a value between 0 and 1. 0 is the horizon, 1 is map-height / 2
				'horizon-color': '#ffffff', // the second sky color at the horizon, default is sky-color
				'horizon-fog-blend': 1, // with a value from 0 to 1. 0 is no blend, 1 is blend to height/2 (e.g. max visible sky at max pitch)
				'fog-color': '#0000ff', // the color of the fog
				'fog-ground-blend': 1, // with a value from 0 to 1. 0 is the map-center, 1 is the far-clipping-plane. This setting works only in 3d-mode, also fog is faded out when lowering pitch and disappears below pitch 60
				'atmosphere-blend': [
					'interpolate', // interpolate the atmosphere blend using expressions
					['linear'],
					['zoom'],
					0,
					0, // z0 - 1 - fully visible atmosphere
					10,
					0.1, // z10 - 1 - fully visible atmosphere
					12,
					0 // z12 - 0 - no atmosphere
				]
			});
		}
	}

	let mapglobal: maplibregl.Map | null = null;

	current_orm_layer_type_store.subscribe((value) => {
		current_orm_layer_type = value;

		if (mapglobal) {
			switch_orm_layers(mapglobal, value, darkMode);
		}
	});

	const urlParams =
		typeof window !== 'undefined'
			? new URLSearchParams(window.location.search)
			: new URLSearchParams();
	let debugmode = !!urlParams.get('debug');

	let fpsmode = !!urlParams.get('fps');

	let embedmode = urlParams.get('framework') == 'true';

	let desktopapp = urlParams.get('desktop') == 'true';
	let mobileapp = urlParams.get('utm_source') == 'pwa';

	let markLoadInPoint = urlParams.get('mp') == 'true' || urlParams.get('framework-point') == 'true';
	let markedPointCoords: number[];

	let showzombiebuses = false;

	show_zombie_buses_store.subscribe((value) => {
		showzombiebuses = value;
	});

	let show_my_location = true;

	show_my_location_store.subscribe((value) => {
		show_my_location = value;
	});

	if (typeof window != 'undefined') {
		let cached_show_my_location_settings = localStorage.getItem('show-my-location');

		if (cached_show_my_location_settings == 'false') {
			show_my_location_store.set(false);
		}

		let cached_show_zombie_buses_settings = localStorage.getItem('showzombiebuses');

		if (cached_show_zombie_buses_settings == 'true') {
			show_zombie_buses_store.set(true);
		}

		if (markLoadInPoint) {
			markedPointCoords = window.location.hash
				.replace('#pos=', '')
				.split('/')
				.map((x) => parseFloat(x));
		}

		let osm_station_param = urlParams.get('osmstation');
		if (osm_station_param) {
			data_stack_store.update((stack) => {
				stack.push(new StackInterface(new OsmStationStack(osm_station_param, null, null)));
				return stack;
			});
		}
	}

	let current_map_heading = 0;

	let static_feeds_in_frame: Record<string, any> = {};
	let operators_in_frame: Record<string, any> = {};
	let realtime_feeds_in_frame: Record<string, any> = {};

	let lastrunmapcalc = 0;
	let mapboundingbox: number[][] = [
		[0, 0],
		[0, 0],
		[0, 0],
		[0, 0],
		[0, 0],
		[0, 0],
		[0, 0],
		[0, 0],
		[0, 0]
	];
	let mapboundingboxstring: String = '';

	//frame render duration in ms
	let last_render_start: number = 0;
	let frame_render_duration = 0;
	let fps = 0;
	let fps_array: number[] = [];

	let chateaus: any = null;
	let chateaus_in_frame: Writable<string[]> = writable([]);

	let layersettings: Record<string, any> = {
		bus: {
			visible: true,
			labelshapes: true,
			stops: true,
			shapes: true,
			stoplabels: true,
			label: {
				route: true,
				trip: false,
				vehicle: false,
				headsign: false,
				direction: false,
				speed: false,
				occupancy: true,
				delay: true
			}
		},
		localrail: {
			visible: true,
			stops: true,
			labelshapes: true,
			stoplabels: true,
			shapes: true,
			label: {
				route: true,
				trip: false,
				vehicle: false,
				headsign: false,
				direction: false,
				speed: false,
				occupancy: true,
				delay: true
			}
		},
		intercityrail: {
			visible: true,
			stops: true,
			labelshapes: true,
			stoplabels: true,
			shapes: true,
			label: {
				route: true,
				trip: true,
				vehicle: false,
				headsign: false,
				direction: false,
				speed: false,
				occupancy: true,
				delay: true
			}
		},
		other: {
			visible: true,
			stops: true,
			labelshapes: true,
			stoplabels: true,
			shapes: true,
			label: {
				route: true,
				trip: false,
				vehicle: false,
				headsign: false,
				direction: false,
				speed: false,
				occupancy: true,
				delay: true
			}
		},
		more: {
			foamermode: {
				infra: false,
				maxspeed: false,
				signalling: false,
				electrification: false,
				gauge: false,
				dummy: true
			},
			showstationentrances: true,
			showstationart: false,
			showbikelanes: false,
			showcoords: false
		}
	};

	function get_shortest_screen_dimension() {
		if (typeof window != 'undefined') {
			if (window.innerWidth < window.innerHeight) {
				return window.innerWidth;
			} else {
				return window.innerHeight;
			}
		} else {
			return 0;
		}
	}

	function togglelayerfeature() {
		layersettingsBox = !layersettingsBox;
	}

	function changeCategory(
		category: string,
		categoryvalues: Record<string, any>,
		this_layer_settings: any
	) {
		if (mapglobal) {
			let shape = mapglobal.getLayer(categoryvalues.shapes);

			//console.log('processing settings',eachcategory, this_layer_settings)

			if (shape) {
				if (this_layer_settings.shapes) {
					mapglobal.setLayoutProperty(categoryvalues.shapes, 'visibility', 'visible');
				} else {
					mapglobal.setLayoutProperty(categoryvalues.shapes, 'visibility', 'none');
				}

				if (this_layer_settings.labelshapes) {
					mapglobal.setLayoutProperty(categoryvalues.labelshapes, 'visibility', 'visible');
				} else {
					mapglobal.setLayoutProperty(categoryvalues.labelshapes, 'visibility', 'none');
				}

				if (category === 'other') {
					if (this_layer_settings.shapes) {
						mapglobal.setLayoutProperty('ferryshapes', 'visibility', 'visible');
					} else {
						mapglobal.setLayoutProperty('ferryshapes', 'visibility', 'none');
					}
				}
			} else {
				console.error('could not fetch shapes layer', category);
			}

			let stoplayer = mapglobal.getLayer(categoryvalues.stops);
			if (stoplayer) {
				if (this_layer_settings.stops) {
					mapglobal.setLayoutProperty(categoryvalues.stops, 'visibility', 'visible');
				} else {
					mapglobal.setLayoutProperty(categoryvalues.stops, 'visibility', 'none');
				}
			} else {
				console.error('no stop layer found for', category);
			}

			let stopslabellayer = mapglobal.getLayer(categoryvalues.labelstops);
			if (stopslabellayer) {
				if (this_layer_settings.stoplabels) {
					mapglobal.setLayoutProperty(categoryvalues.labelstops, 'visibility', 'visible');
				} else {
					mapglobal.setLayoutProperty(categoryvalues.labelstops, 'visibility', 'none');
				}
			} else {
				console.error('no stops label layer found for ', category);
			}

			if (categoryvalues.osmstops) {
				let stoplayer = mapglobal.getLayer(categoryvalues.osmstops);
				if (stoplayer) {
					if (this_layer_settings.stops) {
						mapglobal.setLayoutProperty(categoryvalues.osmstops, 'visibility', 'visible');
					} else {
						mapglobal.setLayoutProperty(categoryvalues.osmstops, 'visibility', 'none');
					}
				}
			}

			if (categoryvalues.osmlabelstops) {
				let stopslabellayer = mapglobal.getLayer(categoryvalues.osmlabelstops);
				if (stopslabellayer) {
					if (this_layer_settings.stoplabels) {
						mapglobal.setLayoutProperty(categoryvalues.osmlabelstops, 'visibility', 'visible');
					} else {
						mapglobal.setLayoutProperty(categoryvalues.osmlabelstops, 'visibility', 'none');
					}
				}
			}

			let dotcirclelayer = mapglobal.getLayer(categoryvalues.livedots);
			let dotlabel = mapglobal.getLayer(categoryvalues.labeldots);

			[
				categoryvalues.pointing,
				categoryvalues.pointingshell,
				categoryvalues.labeldots,
				categoryvalues.livedots
			].forEach((x) => {
				if (mapglobal?.getLayer(x)) {
					let resulting_vis = this_layer_settings.visible ? 'visible' : 'none';
					mapglobal.setLayoutProperty(x, 'visibility', resulting_vis);
				} else {
					console.error('could not find layer', x);
				}
			});

			if (categoryvalues.labeldots === layerspercategory.bus.labeldots) {
				if (this_layer_settings.label.headsign) {
					mapglobal.setLayoutProperty(
						layerspercategory.bus.labeldots,
						'text-size',
						bus_label_with_headsign
					);

					let shortest_side = get_shortest_screen_dimension();

					if (shortest_side >= 1600) {
						mapglobal.setLayoutProperty(categoryvalues.labeldots, 'text-font', {
							stops: [
								[6, get(ui_font_store).medium],
								[12, get(ui_font_store).semibold]
							]
						});
					} else {
						mapglobal.setLayoutProperty(categoryvalues.labeldots, 'text-font', {
							stops: [
								[6, get(ui_font_store).regular],
								[14.5, get(ui_font_store).medium]
							]
						});
					}
				} else {
					mapglobal.setLayoutProperty(categoryvalues.labeldots, 'text-font', {
						stops: [
							[6, get(ui_font_store).medium],
							[11, get(ui_font_store).semibold]
						]
					});

					mapglobal.setLayoutProperty(
						layerspercategory.bus.labeldots,
						'text-size',
						bus_label_no_headsign
					);
				}
			}

			mapglobal.setLayoutProperty(
				categoryvalues.labeldots,
				'text-field',
				interpretLabelsToCode(this_layer_settings.label, usunits)
			);

			if (category == 'bus') {
				mapglobal.setLayoutProperty(
					'livedots_context_bus_major_label',
					'text-field',
					interpretLabelsToCode(this_layer_settings.label, usunits)
				);
			}

			applyVehicleFilters(categoryvalues);
		} else {
			console.error('no map found');
		}
	}

	function runSettingsAdapt() {
		//console.log('run settings adapt', layersettings);
		if (mapglobal) {
			const visibility = show_my_location ? 'visible' : 'none';
			const layersToToggle = [
				'nobearing_position',
				'geolocationheadingshell',
				'km_text',
				'km_line',
				'userpositionacclayer'
			];

			layersToToggle.forEach((layerId) => {
				if (mapglobal.getLayer(layerId)) {
					mapglobal.setLayoutProperty(layerId, 'visibility', visibility);
				}
			});

			if (mapglobal.getLayer('foamershapes')) {
				if (layersettings.more.foamermode.infra) {
					mapglobal.setLayoutProperty('foamershapes', 'visibility', 'visible');
				} else {
					mapglobal.setLayoutProperty('foamershapes', 'visibility', 'none');
				}

				if (layersettings.more.foamermode.maxspeed) {
					mapglobal.setLayoutProperty('maxspeedshapes', 'visibility', 'visible');
				} else {
					mapglobal.setLayoutProperty('maxspeedshapes', 'visibility', 'none');
				}

				if (layersettings.more.foamermode.signalling) {
					mapglobal.setLayoutProperty('signallingshapes', 'visibility', 'visible');
				} else {
					mapglobal.setLayoutProperty('signallingshapes', 'visibility', 'none');
				}

				if (layersettings.more.foamermode.electrification) {
					mapglobal.setLayoutProperty('electrificationshapes', 'visibility', 'visible');
				} else {
					mapglobal.setLayoutProperty('electrificationshapes', 'visibility', 'none');
				}

				if (layersettings.more.foamermode.gauge) {
					mapglobal.setLayoutProperty('gaugeshapes', 'visibility', 'visible');
				} else {
					mapglobal.setLayoutProperty('gaugeshapes', 'visibility', 'none');
				}
			}

			Object.entries(layerspercategory).forEach((eachcategory) => {
				let category_name = eachcategory[0];
				let category_values = eachcategory[1];

				if (category_name == 'metro' || category_name == 'tram') {
					let this_layer_settings = layersettings['localrail'];
					changeCategory('metro', category_values, this_layer_settings);
					changeCategory('tram', category_values, this_layer_settings);
				} else {
					let this_layer_settings = layersettings[category_name];
					changeCategory(category_name, category_values, this_layer_settings);
				}
			});

			localStorage.setItem(layersettingsnamestorage, JSON.stringify(layersettings));

			//handle custom icons
			let get_custom_icons_category_to_layer_id = get(custom_icons_category_to_layer_id);

			Object.entries(get_custom_icons_category_to_layer_id).forEach((x) => {
				let category = x[0];
				x[1].forEach((layer_id) => {
					let layer = mapglobal.getLayer(layer_id);

					if (layer) {
						if (layersettings[category].visible) {
							mapglobal.setLayoutProperty(layer_id, 'visibility', 'visible');
							console.log('set', layer_id, 'to show');
						} else {
							mapglobal.setLayoutProperty(layer_id, 'visibility', 'none');
							console.log('hide', layer_id);
						}
					}
				});
			});

			true;
		}
	}

	additional_filter_for_vehicles_store.subscribe((value) => {
		if (mapglobal) {
			runSettingsAdapt();
		}
	});

	if (typeof window != 'undefined') {
		let get_layers_from_local = localStorage.getItem(layersettingsnamestorage);

		if (get_layers_from_local) {
			let parsed = JSON.parse(get_layers_from_local);

			if (parsed) {
				layersettings = parsed;

				runSettingsAdapt();
			}
		}
	}

	function getSidebarOpenPercentage() {
		if (window.innerWidth >= 640) {
			return 0.55;
		} else {
			return 0.33;
		}
	}

	function gpsbutton_bottom_offset_calc() {
		if (typeof window != 'undefined') {
			if (window.innerWidth >= 640) {
				return '32px';
			} else {
				let sidebar = document.getElementById('catenary-sidebar');

				if (sidebar) {
					return `${32 - dragger + sidebar.offsetHeight}px`;
				} else {
					return '32px';
				}
			}
		} else {
			return '32px';
		}
	}

	const dragger = 24;

	let style: string = darkMode ? '/dark-style.json' : '/light-style.json';

	if (urlParams.get('style') == 'midnight') {
		style = '/pitch-black.json';
	} else {
		if (urlParams.get('style') == 'nothing') {
			style = '/nothing-light.json';
		}
		if (urlParams.get('style') == "nothingdark") {
			style = '/nothing-dark.json';
		}
		if (urlParams.get('style') == 'dark2025') {
			style = '/dark-style-old-2025.json';
		}
	}

	function recompute_map_padding() {
		let sidebar = document.getElementById('catenary-sidebar');

		if (sidebar) {
			if (mapglobal) {
				if (innerWidth < 640) {
					let bottom_padding = sidebar.offsetHeight;

					if (sidebarOpen == 'none') {
						bottom_padding = 0;
					}

					if (sidebarOpen == 'middle') {
						bottom_padding = window.innerHeight / 2;
					}

					let padding = { bottom: bottom_padding, left: 0 };
					if (mapglobal) {
						mapglobal.easeTo({ padding: padding, duration: 200 });
					}
				} else {
					if (innerWidth < 768) {
						let padding = { left: sidebar.offsetWidth, bottom: 0 };
						mapglobal.easeTo({ padding: padding, duration: 200 });
					} else {
						if (sidebarOpen == 'full') {
							let padding = {
								left: sidebar.offsetWidth,
								bottom: 0
							};
							mapglobal.easeTo({ padding: padding, duration: 200 });
						} else {
							let padding = { left: 0 };
							mapglobal.easeTo({ padding: padding, duration: 200 });
						}
					}
				}
			}
		}
	}

	function mousemovesidebar(e: TouchEvent | MouseEvent) {
		if (last_sidebar_interval_id) {
			clearInterval(last_sidebar_interval_id);
		}
		//	console.log('sidebar mouse move' ,e)
		//console.log('mousemovesidebar', Date.now(), e);

		//calculate y velocity

		let y_velocity = 0;

		let clientY = 0;
		if (e instanceof MouseEvent) {
			clientY = e.clientY;
		} else {
			clientY = e.touches[0].clientY;
		}

		if (previous_click_on_sidebar_dragger != null) {
			y_velocity = clientY - previous_click_on_sidebar_dragger;
			previous_y_velocity_sidebar = y_velocity;
		}

		previous_click_on_sidebar_dragger = clientY;

		//	console.log("previous_y_velocity_sidebar", previous_y_velocity_sidebar);

		if (window.innerWidth < 768) {
			if (start_of_move_pointer_height != null && start_of_move_sidebar_height != null) {
				let y_velocity = previous_y_velocity_sidebar || 0;
				//	console.log('difference and velocity', start_of_move_pointer_height - clientY, y_velocity)
				let difference = start_of_move_pointer_height - clientY - y_velocity;
				//console.log('sidebar new difference', difference);
				sidebar_height_number = start_of_move_sidebar_height + difference;
				//console.log('sidebar new height', sidebar_height_number);

				sidebar_height_output = sidebar_height_number + 'px';

				/*
                if (clientY < dragger) {
                    sidebar_height_number = window.innerHeight - dragger;
                sidebar_height_output = window.innerHeight - dragger + "px";
                } else {
                //	console.log('below top bound')
                    //sidebar_height_output = sidebar_height_number + "px";
                    if (clientY > window.innerHeight - dragger) {
                    //	console.log('at bottom bound')
                        sidebar_height_number = dragger;
                        sidebar_height_output = dragger + "px";
                    } else {
                    //	console.log('nominal')
                        sidebar_height_number = sidebar_height_number;
                        sidebar_height_output = sidebar_height_number + "px";
                    }
                }*/

				if (clientY + 10 * y_velocity > 0.7 * window.innerHeight) {
					sidebarOpen = 'none';
				} else {
					if (clientY + 10 * y_velocity < 0.3 * window.innerHeight) {
						sidebarOpen = 'full';
					} else {
						sidebarOpen = 'middle';
					}
				}
			}
		}

		//console.log('sidebar new target', sidebarOpen, clientY);
	}

	function startmovesidebar(e: TouchEvent | MouseEvent) {
		currently_holding_sidebar_grabber = true;
		if (e instanceof MouseEvent) {
			start_of_move_pointer_height = e.clientY;
		} else {
			start_of_move_pointer_height = e.touches[0].clientY;
		}

		let sidebar = document.getElementById('catenary-sidebar');

		if (sidebar) {
			start_of_move_sidebar_height = sidebar.offsetHeight;
		}

		console.log('start moving sidebar');
	}

	function setSidebarOpen() {
		if (sidebarOpen == 'full') {
			sidebarOpen = 'full';
		} else {
			if (window.innerWidth < 768) {
				sidebarOpen = 'middle';
			} else {
				sidebarOpen = 'full';
			}
		}

		moveToPos({});
	}

	function moveToPos(values: any) {
		let sidebar = document.getElementById('catenary-sidebar');

		if (sidebar) {
			last_sidebar_release = performance.now();

			let sidebar_width = sidebar.offsetWidth || 0;

			if (last_sidebar_interval_id != null) {
				clearInterval(last_sidebar_interval_id);
			}

			recompute_map_padding();

			last_sidebar_interval_id = setInterval(() => {
				if (window.innerWidth < 768) {
					if (sidebarOpen == 'full') {
						if (translate_y_searchbar > -50) {
							translate_y_searchbar += -3;
						}
					} else {
						if (translate_y_searchbar < 0) {
							translate_y_searchbar += 3;
						}
					}

					translate_x_sidebar_number = 0;
					translate_x_sidebar = '0px';
					let target = 0.55 * window.innerHeight;

					if (sidebarOpen == 'full') {
						target = window.innerHeight - dragger;
					} else {
						if (sidebarOpen == 'none') {
							target = dragger;
						}
					}

					if (sidebar_height_number > innerHeight) {
						sidebar_height_number = innerHeight;
					}

					if (sidebar_height_number < dragger) {
						sidebar_height_number = dragger;
					}

					if (sidebar_height_number < target) {
						sidebar_height_number += 0.15 * (target - sidebar_height_number);
						sidebar_height_output = sidebar_height_number + 'px';
					} else {
						if (sidebar_height_number > target) {
							sidebar_height_number -= 0.15 * (sidebar_height_number - target);
							sidebar_height_output = sidebar_height_number + 'px';
						} else {
							clearInterval(last_sidebar_interval_id);
						}
					}
				} else {
					translate_y_searchbar = 0;

					if (sidebarOpen == 'full') {
						if (translate_x_sidebar_number < -0.001) {
							translate_x_sidebar_number += 0.1 * Math.abs(translate_x_sidebar_number);
							translate_x_sidebar = `${translate_x_sidebar_number}px`;

							collapser_left_offset_number = sidebar_width - Math.abs(translate_x_sidebar_number);
							collapser_left_offset = `${collapser_left_offset_number}px`;
						} else {
							clearInterval(last_sidebar_interval_id);
						}
					}

					if (sidebarOpen == 'none') {
						if (translate_x_sidebar_number > 0 - sidebar_width) {
							translate_x_sidebar_number -= 0.1 * Math.abs(sidebar_width);

							translate_x_sidebar = `${translate_x_sidebar_number}px`;

							collapser_left_offset_number -= 0.1 * Math.abs(sidebar_width);
							collapser_left_offset = `${collapser_left_offset_number}px`;
						} else {
							clearInterval(last_sidebar_interval_id);
						}
					}
				}
			}, 0.5);
		}
	}

	function letgosidebar(e: Event) {
		recompute_map_padding();
		moveToPos({ event: e });
	}

	function gonorth() {
		if (mapglobal) {
			lasttimeofnorth = performance.now();
			mapglobal.resetNorth();
		}
	}

	function gpsbutton() {
		if (geolocation) {
			if (mapglobal) {
				let target: any = {
					center: [geolocation.coords.longitude, geolocation.coords.latitude],
					essential: true // this animation is considered essential with respect to prefers-reduced-motion
				};

				if (firstmove === false || lockongps === true) {
					target.zoom = lockonconst;
					secondrequestlockgps = true;
				}

				lock_on_gps_store.set(true);

				mapglobal.flyTo(target);
			}
		}
	}

	function gpsupdate() {
		if (geolocation) {
			if (mapglobal) {
				//get url param pos
				let emptyhash = !window.location.hash.includes('pos');

				if (lockongps === true || (firstmove === false && emptyhash === true)) {
					let target: any = {
						center: [geolocation.coords.longitude, geolocation.coords.latitude],
						essential: true // this animation is considered essential with respect to prefers-reduced-motion
					};

					if (lasttimeofnorth > performance.now() - 6000) {
						target.bearing = 0;
					}

					if (secondrequestlockgps === true || firstmove === false) {
						target.zoom = lockonconst;
					}

					if (firstmove === false) {
						lock_on_gps_store.set(true);
						secondrequestlockgps = true;
					}

					mapglobal.easeTo(target, { duration: 500 });
				}
			}
		}
	}

	if (typeof window != 'undefined') {
		if (window.innerWidth < 768) {
			sidebarOpen = 'middle';
			sidebar_height_output = getSidebarOpenPercentage() * window.innerHeight + 'px';
			//px from bottom
			sidebar_height_number = dragger;
			//px from bottom
			sidebar_height_target = dragger;
			previous_form_factor = 'mobile';
		} else {
			sidebarOpen = 'full';
			sidebar_height_output = '100vh';
			//px from bottom
			sidebar_height_number = window.innerHeight - dragger;
			//px from bottom
			sidebar_height_target = window.innerHeight - dragger;
			previous_form_factor = 'desktop';
		}

		addEventListener('resize', (e) => {
			top_margin_collapser_sidebar = `${window.innerHeight / 2 - 15}px`;

			if (previous_form_factor == 'mobile') {
				if ((sidebarOpen = 'full')) {
					sidebarOpen = 'middle';
				}
			}

			if (previous_form_factor == 'desktop') {
				if (sidebarOpen == 'middle') {
					sidebarOpen = 'full';
				}
			}

			if (window.innerWidth < 768) {
				previous_form_factor = 'mobile';
				if (sidebarOpen == 'full') {
					sidebar_height_output = window.innerHeight + 'px';
				}
				if (sidebarOpen == 'middle') {
					sidebar_height_output = getSidebarOpenPercentage() * window.innerHeight + 'px';
				} else {
					if (sidebarOpen == 'none') {
						sidebar_height_output = '20px';
					}
				}
			} else {
				previous_form_factor = 'desktop';
				sidebar_height_output = '100vh';
			}

			recompute_map_padding();
		});

		addEventListener('touchmove', (e) => {
			if (currently_holding_sidebar_grabber) {
				console.log('sidebar touchmove', e);
				mousemovesidebar(e);
			}
		});

		addEventListener('mousemove', (e) => {
			if (currently_holding_sidebar_grabber) {
				mousemovesidebar(e);
			}
		});

		let sidebar_grabber = document.getElementById('catenary-grabber');

		if (sidebar_grabber != null) {
			sidebar_grabber.addEventListener('touchstart', (e) => {
				startmovesidebar(e);
			});

			sidebar_grabber.addEventListener('mousedown', (e) => {
				startmovesidebar(e);
			});
		} else {
		}

		addEventListener('touchend', (e) => {
			if (currently_holding_sidebar_grabber) {
				currently_holding_sidebar_grabber = false;
				letgosidebar(e);
			}
		});

		addEventListener('mouseup', (e) => {
			if (currently_holding_sidebar_grabber) {
				currently_holding_sidebar_grabber = false;
				letgosidebar(e);
			}
		});
	}

	start_location_watch();

	async function new_map() {
		console.log('new map created');
		//#region On the fly IP geolocation

		let cachegeostored = localStorage.getItem('cacheipgeolocation');

		let prev_known_location = getLocationFromLocalStorage();

		if (prev_known_location) {
			if (mapglobal) {
				//mapglobal.setCenter([prev_known_location.longitude, prev_known_location.latitude]);
			}
			centerinit = [prev_known_location.longitude, prev_known_location.latitude];
		} else {
			if (cachegeostored) {
				const [long, lat] = cachegeostored.split(',');
				centerinit = [parseFloat(long), parseFloat(lat)];
				if (mapglobal) {
					mapglobal.setCenter(centerinit);
					mapglobal.setZoom(13);
				}
			} else {
				try {
					/**
					 * Use GeoLite2 database on Catenary servers
					 *
					 * adding a pin with this provided lat/long would prob freak a few people out
					 * and even mapping sites (google, bing, etc) don't do it either on default
					 * -q
					 */
					fetch('https://birch.catenarymaps.org/ip_addr_to_geo/')
						.then((response) => response.json())
						// the text will be `lat,long`
						.then((geo_api_response) => {
							if (geo_api_response) {
								console.log('ip addr', geo_api_response);
								if (typeof geo_api_response.geo_resp == 'object') {
									centerinit = [
										geo_api_response.geo_resp.longitude,
										geo_api_response.geo_resp.latitude
									];

									// set the center of the map to the user's location
									// in case the map is already initialized (rare), set the center to the user's location
									if (mapglobal) {
										mapglobal.setCenter(centerinit);
									}

									// store the user's location in localStorage, as we do with regular browser provided geolocation
									localStorage.setItem(
										'cacheipgeolocation',
										`${geo_api_response.geo_resp.longitude},${geo_api_response.geo_resp.latitude}`
									);
								}
							}
						});
				} catch (e) {
					console.error('Failed to get IP location, defaulting to LA');
				}
			}
		}

		// #endregion

		// https://raw.githubusercontent.com/catenarytransit/betula-celtiberica-cdn/refs/heads/main/data/chateaus.json
		// https://birch.catenarymaps.org/getchateaus
		fetch('https://birch.catenarymaps.org/getchateaus')
			.then(function (response) {
				return response.json();
			})
			.then(function (json) {
				chateaus = json;

				json.features.forEach((feature: any) => {
					const this_realtime_feeds_list: string[] = feature.properties.realtime_feeds;
					const this_schedule_feeds_list: string[] = feature.properties.schedule_feeds;

					this_realtime_feeds_list.forEach((realtime) => {
						feed_id_to_chateau_lookup[realtime] = feature.properties.chateau;
					});

					chateau_to_realtime_feed_lookup[feature.properties.chateau] = this_realtime_feeds_list;

					this_schedule_feeds_list.forEach(
						(sched) => (feed_id_to_chateau_lookup[sched] = feature.properties.chateau)
					);
				});

				let chateaus_source = mapglobal.getSource('chateaus');

				if (chateaus_source) {
					chateaus_source.setData(json);
				} else {
					console.log("source doesn't exist");
				}

				chateaus_store.set(json);
			})
			.catch((err) => console.error(err));

		if (navigator.hardwareConcurrency > 10) {
			maplibregl.setWorkerCount(navigator.hardwareConcurrency);
		} else {
			maplibregl.setWorkerCount(4);
		}

		let desync = true;

		let is_chrome = navigator.userAgent.match(/Chrome\/\d+/) !== null;

		if (is_chrome == true && isChromiumDesktop()) {
			console.log('chromium dekstop, disabling desyncronised rendering');
			desync = false;
		}

		const map = new maplibregl.Map({
			canvasContextAttributes: {
				antialias: false,
				powerPreference: 'high-performance',
				desynchronized: desync
			},
			container: 'map',
			localIdeographFontFamily: false,
			light: { anchor: 'viewport', color: 'white', intensity: 0.4 },
			hash: 'pos',
			pixelRatio: window.devicePixelRatio * get_shortest_screen_dimension() > 800 ? 2 : 1.5,
			maxPitch: window.innerHeight / window.innerWidth > 1.5 ? 60 : 85,
			validateStyle: true,
			fadeDuration: 100,
			style: style, // stylesheet location
			center: centerinit, // starting position [lng, lat]
			zoom: zoominit // starting zoom (must be greater than 8.1)
		});

		mapglobal = map;

		function remove_listener() {
			media.removeEventListener('change', updatePixelRatio);
		}

		const updatePixelRatio = () => {
			map.setPixelRatio(window.devicePixelRatio * 1.4);
		};
		const mqString = `(resolution: ${window.devicePixelRatio}dppx)`;
		const media = matchMedia(mqString);
		media.addEventListener('change', updatePixelRatio);

		//map tile bounds

		if (urlParams.get('tilebounds')) {
			map.showTileBoundaries = true;
			//  map.showParseStatus = true;
		}

		map_pointer_store.set(map);

		if (markedPointCoords) {
			new maplibregl.Marker().setLngLat([markedPointCoords[2], markedPointCoords[1]]).addTo(map);
		}

		if (darkMode) {
		}

		const demSource = new mlcontour.DemSource({
			//url: 'https://birchtiles123.catenarymaps.org/terrain_tiles_proxy_aws/{z}/{x}/{y}',
			url: 'https://birchtiles123.catenarymaps.org/maptiler_terrain_tiles_proxy/{z}/{x}/{y}.webp',
			//url: "https://api.maptiler.com/tiles/terrain-rgb-v2/{z}/{x}/{y}.webp?key=B265xPhJaYe2kWHOLHTG",
			encoding: 'mapbox',
			cacheSize: 2048,
			maxzoom: 14,
			// offload contour line computation to a web worker
			worker: true
		});

		map.on('load', () => {
			checkClockSync();

			deep_link_url_reader();

			add_image_pedestrian_pattern(map);

			const orm_sources = {
				openrailwaymap_low: {
					type: 'vector',
					url: 'https://birch_ormproxy.catenarymaps.org/openrailwaymap_proxy/railway_line_high',
					promoteId: 'id'
				},
				standard_railway_text_stations_low: {
					type: 'vector',
					url: 'https://birch_ormproxy.catenarymaps.org/openrailwaymap_proxy/standard_railway_text_stations_low',
					promoteId: 'id'
				},
				standard_railway_text_stations_med: {
					type: 'vector',
					url: 'https://birch_ormproxy.catenarymaps.org/openrailwaymap_proxy/standard_railway_text_stations_med',
					promoteId: 'id'
				},
				high: {
					type: 'vector',
					url: 'https://birch_ormproxy.catenarymaps.org/openrailwaymap_proxy/railway_line_high',
					promoteId: 'id'
				},
				openrailwaymap_standard: {
					type: 'vector',
					url: 'https://birch_ormproxy.catenarymaps.org/openrailwaymap_proxy//standard_railway_turntables,standard_railway_text_stations,standard_railway_grouped_stations,standard_railway_grouped_station_areas,standard_railway_symbols,standard_railway_switch_ref,standard_station_entrances,standard_railway_platforms,standard_railway_platform_edges',
					promoteId: 'id'
				},
				openrailwaymap_signals: {
					type: 'vector',
					url: 'https://birch_ormproxy.catenarymaps.org/openrailwaymap_proxy/signals_railway_signals,signals_signal_boxes',
					promoteId: 'id'
				},
				openrailwaymap_electrification: {
					type: 'vector',
					url: '	https://openrailwaymap.app/electrification_signals,electrification_catenary,electrification_railway_symbols',
					promoteId: 'id'
				},
				openrailwaymap_operator: {
					type: 'vector',
					url: 'https://birch_ormproxy.catenarymaps.org/openrailwaymap_proxy/operator_railway_symbols',
					promoteId: 'id'
				}
			};

			try {
				Object.entries(orm_sources).forEach(async ([key, value]) => {
					if (value.url) {
						try {
							const response = await fetch(value.url);
							if (response.ok) {
								await response.json(); // Will throw an error if not valid JSON
								console.log(`Successfully validated and added source: ${key}`);
								map.addSource(key, value);
							} else {
								console.error(
									`Failed to fetch source ${key}: ${response.status} ${response.statusText}`
								);
							}
						} catch (e) {
							console.error(`Error adding source ${key} with url ${value.url}:`, e);
						}
					}
				});
			} catch (e) {
				console.error(e);
			}

			// Assuming 'map' is your MapLibre GL JS map instance
			map.on('webglcontextlost', (event) => {
				console.log('WebGL context lost.');
			});

			map.on('webglcontextrestored', (event) => {
				console.log('WebGL context restored.');
				// A timeout may be necessary to ensure the canvas is fully ready.
				setTimeout(() => {
					new_map();
				}, 0);
			});

			switch_orm_layers(map, get(current_orm_layer_type_store), true);

			console.log('map coords', map.getCenter());

			let prev_known_location = getLocationFromLocalStorage();

			if (prev_known_location) {
				//map.setCenter([prev_known_location.longitude, prev_known_location.latitude]);
				//map.setZoom(15);
			} else {
				fetch('https://birch.catenarymaps.org/ip_addr_to_geo/')
					.then((response) => response.json())
					// the text will be `lat,long`
					.then((geo_api_response) => {
						console.log('ip addr', geo_api_response);
						if (geo_api_response.geo_resp) {
							localStorage.setItem(
								'cacheipgeolocation',
								`${geo_api_response.geo_resp.longitude},${geo_api_response.geo_resp.latitude}`
							);
						}
					});
			}

			let coords = map.getCenter();

			if (coords.lng == -117.6969 && coords.lat == 33.6969) {
				console.log('change to ', centerinit);

				map.setCenter(centerinit);
			}

			map.setProjection({ type: 'globe' });
			skyRefresh(map, darkMode);

			demSource.setupMaplibre(maplibregl);

			map.addSource('dem', {
				type: 'raster-dem',
				tiles: [demSource.sharedDemProtocolUrl],
				tileSize: 256
			});

			map.addSource('contour-source', {
				type: 'vector',
				tiles: [
					demSource.contourProtocolUrl({
						// convert meters to feet, default=1 for meters
						thresholds: {
							// zoom: [minor, major]
							11: [100, 500],
							12: [50, 250],
							14: [20, 100],
							15: [10, 50]
						},
						// optional, override vector tile parameters:
						contourLayer: 'contours',
						elevationKey: 'ele',
						levelKey: 'level',
						extent: 4096,
						buffer: 1
					})
				],
				maxzoom: 15
			});

			map.addLayer(
				{
					id: 'hillshade',
					type: 'hillshade',
					source: 'dem',
					paint: {
						'hillshade-shadow-color': darkMode
							? 'hsla(202, 37%, 0%, 30%)'
							: 'hsla(202, 37%, 20%, 60%)',
						'hillshade-highlight-color': darkMode ? 'hsla(203, 35%, 53%, 21%)' : '#ffffff33',
						'hillshade-accent-color': darkMode ? 'hsla(203, 39%, 50%, 20%)' : '#ffffff77',
						'hillshade-exaggeration': 1
					},
					layout: {
						visibility: 'none'
					}
				},
				'waterway_tunnel'
			);

			map.addLayer(
				{
					id: 'contours-layer',
					type: 'line',
					source: 'contour-source',
					'source-layer': 'contours',
					paint: {
						'line-color': darkMode ? 'rgba(140, 140, 128, 30%)' : 'rgba(0,0,0, 30%)',
						// level = highest index in thresholds array the elevation is a multiple of
						'line-width': ['match', ['get', 'level'], 1, 1.3, 0.3]
					},
					layout: {
						visibility: 'none'
					}
				},
				'waterway_tunnel'
			);

			map.addLayer(
				{
					id: 'contour-labels',
					type: 'symbol',
					source: 'contour-source',
					'source-layer': 'contours',
					filter: ['>', ['get', 'level'], 0],
					layout: {
						'symbol-placement': 'line',
						'text-size': 10,
						'text-field': ['concat', ['number-format', ['get', 'ele'], {}], 'm'],
						'text-font': get(ui_font_store).bold,
						'text-pitch-alignment': 'viewport'
					},
					paint: {
						'text-halo-color': darkMode ? 'black' : 'white',
						'text-halo-width': 1,
						'text-color': darkMode ? 'white' : 'black'
					}
				},
				'waterway_tunnel'
			);

			show_topo_global_store.subscribe((value: boolean) => {
				if (value === true) {
					//	map.setLayoutProperty('hillshade', 'visibility', 'visible');
					map.setLayoutProperty('contour-labels', 'visibility', 'visible');
					map.setLayoutProperty('contours-layer', 'visibility', 'visible');

					if (map.getLayer('terrainpolygons')) {
						map.setPaintProperty('terrainpolygons', 'fill-opacity', 1.0);

						if (!darkMode) {
							map.setPaintProperty('terrainpolygons', 'fill-color', [
								"match",
								["get", "class"],
								["shadow"],
								[
									"interpolate",
									["linear"],
									["get", "level"],
									56,
									"hsla(0, 0%, 0%, 0.05)",
									75,
									"hsla(187, 0%, 12%, 0.05)"
								],
								["highlight"],
								[
									"interpolate",
									["linear"],
									["get", "level"],
									56,
									"hsla(251, 0%, 84%, 0.4)",
									94,
									"hsla(251, 0%, 100%, 0.04)"
								],
								"#000000"
								]);
						}
					}

					//if (window.innerWidth >= 768 || window.innerHeight >= 768) {
					map.setTerrain({ source: 'dem', exaggeration: 1 });
					//}
				} else {
					map.setLayoutProperty('hillshade', 'visibility', 'none');

					//map.removeLayer('hillshade');

					map.setLayoutProperty('contour-labels', 'visibility', 'none');
					map.setLayoutProperty('contours-layer', 'visibility', 'none');

					if (map.getLayer('terrainpolygons')) {
						if (darkMode) {
							map.setPaintProperty('terrainpolygons', 'fill-opacity', [
							'interpolate',
							['linear'],
							['zoom'],
							2,
							0,
							6.16,
							1,
							10.76,
							0.66,
							22,
							0.26
						]);
						} else {
							map.setPaintProperty('terrainpolygons', 'fill-color', [
								"match",
								["get", "class"],
								["shadow"],
								[
									"interpolate",
									["linear"],
									["get", "level"],
									56,
									"hsla(0, 0%, 0%, 0.005)",
									75,
									"hsla(187, 0%, 12%, 0.01)"
								],
								["highlight"],
								[
									"interpolate",
									["linear"],
									["get", "level"],
									56,
									"hsla(251, 0%, 84%, 0.1)",
									94,
									"hsla(251, 0%, 100%, 0.01)"
								],
								"#000000"
								]);

							map.setPaintProperty('terrainpolygons', 'fill-opacity', [
							'interpolate',
							['linear'],
							['zoom'],
							2,
							0,
							6.16,
							0.2,
							10.76,
							0.1,
							22,
							0.05
						]);
						}
					}

					map.setTerrain(null);
				}
			});

			setTimeout(() => {
				let chateau_feed_results = determineFeedsUsingChateaus(map);
				chateaus_in_frame.set(Array.from(chateau_feed_results.chateaus));

				runSettingsAdapt();
			}, 0);

			setTimeout(() => {
				runSettingsAdapt();
			}, 1000);

			setTimeout(() => {
				let chateau_feed_results = determineFeedsUsingChateaus(map);
				chateaus_in_frame.set(Array.from(chateau_feed_results.chateaus));
			}, 4000);

			setTimeout(() => {
				let chateau_feed_results = determineFeedsUsingChateaus(map);
				chateaus_in_frame.set(Array.from(chateau_feed_results.chateaus));
			}, 5000);

			// Start Santa tracking during Christmas window
			startSantaTracking(map);
		});

		maplibregl.setRTLTextPlugin(
			'/mapbox-gl-rtl-text.min.js',
			true // Lazy load the plugin
		);

		mapglobal = map;

		//updates the debug window with the current map lng and lat
		function updateData() {
			mapzoom = map.getZoom();
			maplng = map.getCenter().lng;
			maplat = map.getCenter().lat;

			current_map_heading = map.getBearing();
		}

		map.on('move', (events) => {
			updateData();
			lock_on_gps_store.set(false);
		});

		map.on('moveend', (events) => {
			let chateau_feed_results = determineFeedsUsingChateaus(map);
			chateaus_in_frame.set(Array.from(chateau_feed_results.chateaus));
		});

		map.on('touchmove', (events) => {
			lasttimeofnorth = 0;
		});

		map.on('mousemove', (events) => {
			lasttimeofnorth = 0;
		});

		map.on('zoomend', (events) => {
			let chateau_feed_results = determineFeedsUsingChateaus(map);
			chateaus_in_frame.set(Array.from(chateau_feed_results.chateaus));
		});

		console.log('setting up load map');

		setup_load_map(
			map,
			runSettingsAdapt,
			darkMode,
			layerspercategory,
			chateaus_in_frame,
			layersettings,
			chateau_to_realtime_feed_lookup,
			pending_chateau_rt_request,
			recompute_map_padding,
			setSidebarOpen
		);
	}

	try {
		onMount(() => {
			new_map();

			if ('serviceWorker' in navigator) {
				navigator.serviceWorker
					.register('/sw.js', { scope: '/' })
					.then((registration) => {
						// Preload the map selection screen so it's ready when the user clicks on the map
						import('../components/MapSelectionScreen.svelte');
						import('../components/LayerSettingsBox.svelte');
						import('../components/RouteHeading.svelte');
						import('../components/RouteHeading.svelte');
						import('../components/StopScreen.svelte');
						// registration worked
						console.log('Registration succeeded.');
					})
					.catch((error) => {
						// registration failed
						console.error(`Registration failed with ${error}`);
					});
			}

			// A simple boolean check for Android
			isAndroid = /android/i.test(navigator.userAgent);
			isChrome = /chrome/i.test(navigator.userAgent);

			if (isAndroid) {
				const dismissed = localStorage.getItem('androidPopupDismissed');
				if (dismissed !== 'true') {
					console.log('This is an Android device, showing download popup.');
					showAndroidDownloadPopup = true;
					// Run Android-specific code here
				} else {
					console.log('This is an Android device, but popup was dismissed.');
				}
			} else {
				console.log('This is not an Android device.');
			}
		});
	} catch (e) {
		console.error(e);
	}
</script>

<svelte:head>
	<!-- Primary Meta Tags -->
	<title>Catenary Maps</title>
	<meta name="title" content="Catenary Maps" />
	<meta
		name="description"
		content="Realtime bus and train location tracking, stop times prediction, analysis, and routing algorithm calculations."
	/>
	<meta name="viewport" content="width=device-width, user-scalable=no" />

	<!-- Open Graph / Facebook -->
	<meta property="og:type" content="website" />
	<meta property="og:title" content="Catenary Maps" />
	<meta
		property="og:description"
		content="Realtime bus and train location tracking, stop times prediction, analysis, and routing algorithm calculations."
	/>

	<!-- Twitter -->
	<meta property="twitter:card" content="summary_large_image" />
	<meta property="twitter:title" content="Catenary Maps" />
	<meta
		property="twitter:description"
		content="Realtime bus and train location tracking, stop times prediction, analysis, and routing algorithm calculations."
	/>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin={true} />
	<link
		rel="stylesheet"
		href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@48,400,0,0"
	/>

	<!-- Google tag (gtag.js) -->
	<script async src="https://www.googletagmanager.com/gtag/js?id=G-QJRT4Q71T1"></script>
	<script>
		// Set up dataLayer and gtag function
		window.dataLayer = window.dataLayer || [];
		function gtag() {
			dataLayer.push(arguments);
		}

		// Initialize gtag and set default consent to 'denied'
		gtag('js', new Date());
		gtag('consent', 'default', {
			analytics_storage: 'denied'
		});
	</script>
</svelte:head>

<svelte:boundary>
	<div class="w-full">
		{#if showAndroidDownloadPopup || urlParams.get('androidpopup')}
			<AndroidDownloadPopup />
		{/if}

		<ConsentBanner />
		<div id="map" class="fixed top-0 left-0 w-[100vw] h-[100vh]"></div>

		{#key top_margin_collapser_sidebar}
			<div
				class="fixed hidden md:flex p-1 items-center rounded-r-md bg-white dark:bg-gray-900 text-black dark:text-white"
				role="button"
				aria-label="Toggle sidebar"
				tabindex="0"
				on:click={() => {
					if (sidebarOpen == 'full') {
						sidebarOpen = 'none';
						moveToPos({});
					} else {
						sidebarOpen = 'full';
						moveToPos({});
					}
				}}
				on:keydown={() => {
					if (sidebarOpen == 'full') {
						sidebarOpen = 'none';
						moveToPos({});
					} else {
						sidebarOpen = 'full';
						moveToPos({});
					}
				}}
				style={`left: ${collapser_left_offset}; top: ${top_margin_collapser_sidebar};`}
			>
				{#if sidebarOpen == 'none'}
					<span class="material-symbols-outlined block my-auto"> chevron_right </span>
				{/if}
				{#if sidebarOpen == 'full'}
					<span class="material-symbols-outlined block my-auto"> chevron_left </span>
				{/if}
			</div>
		{/key}

		{#if !$isLoading}
			<div
				id="catenary-sidebar"
				style="height: {sidebar_height_output}; transform: translateX({translate_x_sidebar});"
				class="z-20 rounded-t-2xl md:rounded-none fixed bottom-0 w-full sm:w-2/5 md:h-full md:w-[380px] bg-white dark:bg-gray-900 bg-opacity-70 dark:bg-opacity-70 md:bg-opacity-80 md:dark:bg-opacity-70 backdrop-blur-xs md:backdrop-blur-sm md:fixed md:left-0 md:top-0 md:bottom-0 text-black dark:text-white flex flex-col select-text"
			>
				<div
					class="flex md:hidden py-2 flex-row"
					on:mousedown={startmovesidebar}
					on:touchstart={startmovesidebar}
					aria-label="Move sidebar"
					role="none"
				>
					<div class="mx-auto rounded-lg px-8 py-1 bg-sky-500 dark:bg-sky-400"></div>
				</div>

				<SidebarInternals {usunits} {latest_item_on_stack} {darkMode} />
			</div>
		{/if}
	</div>

	<div
		class="fixed top-2 left-3 right-3 sm:right-auto z-40"
		id="search_bar_outer"
		style="transform: translateY({translate_y_searchbar}px);"
	>
		<SearchBar />
	</div>

	{#if autocomplete_focus_state_local == true}
		<div
			id="desktop_autocomplete_box"
			class="hidden md:fixed md:block z-40 top-12 left-3 w-[350px] bg-gray-100 dark:bg-gray-900 rounded-sm border border-gray-500"
		>
			<SearchAutocompleteList length={10} />
		</div>
	{/if}

	{#if autocomplete_focus_state_local == true}
		<div
			class="fixed top-0 bottom-0 left-0 right-0 sm:right-1/2 h-full md:hidden z-30 bg-gray-100 dark:bg-gray-900 px-3"
		>
			<div class="relative top-12 w-full">
				<SearchAutocompleteList length={10} />

				<p class="text-xs dark:text-gray-200">Catenary Search Beta.</p>
			</div>
		</div>
	{/if}

	{#if !$isLoading}
		<div class="fixed top-12 sm:top-4 right-4 flex flex-col gap-y-2 pointer-events-none">
			<div
				aria-label="Layers"
				on:click={togglelayerfeature}
				on:keypress={togglelayerfeature}
				role="button"
				class="!cursor-pointer bg-white z-10 h-10 w-10 rounded-full dark:bg-gray-900 dark:text-gray-50 pointer-events-auto flex justify-center items-center"
			>
				<span
					class="!cursor-pointer material-symbols-outlined align-middle my-auto mx-auto select-none"
				>
					layers
				</span>
			</div>

			<div
				on:click={gonorth}
				on:keypress={gonorth}
				on:touchstart={gonorth}
				role="button"
				aria-label="Reset Map to North"
				class="bg-white z-10 h-10 w-10 rounded-full dark:bg-gray-900 dark:text-gray-50 pointer-events-auto flex justify-center items-center"
			>
				<img
					src={current_map_heading < 7 && current_map_heading > -7
						? darkMode === true
							? '/icons/north.svg'
							: '/icons/light_north.svg'
						: '/icons/compass.svg'}
					class="h-7"
					style={`transform: rotate(${0 - current_map_heading}deg)`}
				/>
			</div>

			{#if !desktopapp}
				{#key sidebar_height_output}
					{#if geolocation != null}
						{#if typeof geolocation.coords == 'object'}
							{#if typeof geolocation.coords.speed == 'number'}
								<div
									on:click={(e) => {
										e.preventDefault();
									}}
									class="leading-tight md:text-base rounded-lg text-black bg-white dark:text-white border border-gray-500 dark:bg-gray-800 shadow-sm shadow-gray-400 dark:shadow-gray-700 px-1 py-0.5"
									style={`font-size: 0px;bottom: ${gpsbutton_bottom_offset_calc()}`}
								>
									<p class="leading-none">
										{#if geolocation}
											{#if usunits}
												<span class="font-semibold text-sm"
													>{(2.23694 * geolocation.coords.speed).toFixed(1).split('.')[0]}</span
												>
											{:else}
												<span class="font-semibold text-sm"
													>{(3.6 * geolocation.coords.speed).toFixed(1).split('.')[0]}</span
												>
											{/if}
											{#if ['fr', 'de', 'it', 'es', 'se'].includes(current_locale.split('-')[0])}
												<span class="text-sm">,</span>
											{:else}
												<span class="text-sm">.</span>
											{/if}
											{#if usunits}
												<span class="text-sm"
													>{(2.23694 * geolocation.coords.speed).toFixed(1).split('.')[1]}</span
												>
											{:else}
												<span class="text-sm"
													>{(3.6 * geolocation.coords.speed).toFixed(1).split('.')[1]}</span
												>
											{/if}
											{#if usunits}<br />
												<span class="text-xs">mph</span>
											{:else}<br />
												<span class="text-xs">km/h</span>
											{/if}
										{/if}
									</p>
								</div>
							{/if}
						{/if}
					{/if}
					<div
						on:click={gpsbutton}
						on:keydown={gpsbutton}
						on:touchstart={gpsbutton}
						style={`bottom: ${gpsbutton_bottom_offset_calc()}`}
						class="{lockongps
							? ' text-blue-500 dark:text-blue-300'
							: ' text-black dark:text-gray-50'} select-none bg-white text-gray-900 z-50 fixed right-4 h-16 w-16 rounded-full dark:bg-gray-900 dark:text-gray-50 pointer-events-auto flex justify-center items-center clickable"
					>
						<span class="material-symbols-outlined align-middle text-lg select-none">
							{#if lockongps == true}my_location{:else}location_searching{/if}
						</span>
					</div>
				{/key}
			{/if}
		</div>
	{/if}

	{#if !$isLoading}
		{#await import("../components/LayerSettingsBox.svelte") then { default: LayerSettingsBox }}
			<LayerSettingsBox
				bind:layersettingsBox
				bind:layersettings
				{runSettingsAdapt}
				{darkMode}
				{usunits}
				{current_locale}
			/>
		{/await}
	{/if}

	<style>
		body {
			font-family: var(--font-sans);
		}

		.material-symbols-outlined {
			font-family: 'Material Symbols Outlined', sans-serif;
		}

		.lineNumber {
			font-size: 1.2rem;
			font-weight: 600;
			padding: 5px;
			border-radius: var(--radius);
		}

		.lineLogo {
			margin-bottom: 15px;
		}

		.material-symbols-outlined-big {
			font-variation-settings:
				'FILL' 0,
				'wght' 400,
				'GRAD' 0,
				'opsz' 64;
		}
	</style>
</svelte:boundary>
