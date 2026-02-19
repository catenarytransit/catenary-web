import type { Map } from 'maplibre-gl';
import { layerspercategory } from '../layernames';
import {
	default_interrail_filter,
	default_bus_filter,
	default_metro_filter,
	default_tram_filter,
	default_osm_interrail_filter
} from '../makeFiltersForStop';
import { ui_font_store } from '../../globalstores';
import { get } from 'svelte/store';

const internationalIntercityLabelSize = ['interpolate', ['linear'], ['zoom'], 6, 6, 13, 12];
const internationalIntercityCircleSize = [
	'interpolate',
	['linear'],
	['zoom'],
	7,
	1,
	8,
	2,
	9,
	3,
	12,
	5,
	15,
	8
];

function getCircleInside(darkMode: boolean) {
	return darkMode ? '#1c2636' : '#ffffff';
}

function getCircleOutside(darkMode: boolean) {
	return darkMode ? '#ffffff' : '#1c2636';
}

export function changeStopsTheme(map: Map, darkMode: boolean) {
	// Bus stops
	map.setPaintProperty(
		layerspercategory.bus.stops,
		'circle-stroke-color',
		bus_stop_stop_color(darkMode)
	);
	map.setPaintProperty(
		layerspercategory.bus.labelstops,
		'text-color',
		darkMode ? '#eee6fe' : '#2a2a2a'
	);
	map.setPaintProperty(
		layerspercategory.bus.labelstops,
		'text-halo-color',
		darkMode ? '#0f172a' : '#ffffff'
	);

	// Metro stops
	map.setPaintProperty(layerspercategory.metro.stops, 'circle-color', getCircleInside(darkMode));
	map.setPaintProperty(
		layerspercategory.metro.stops,
		'circle-stroke-color',
		getCircleOutside(darkMode)
	);
	map.setPaintProperty(
		layerspercategory.metro.labelstops,
		'text-color',
		darkMode ? '#ffffff' : '#2a2a2a'
	);
	map.setPaintProperty(
		layerspercategory.metro.labelstops,
		'text-halo-color',
		darkMode ? '#0f172a' : '#ffffff'
	);

	// Metro osm stops
	map.setPaintProperty(
		layerspercategory.metro.osmstops,
		'circle-color',
		getCircleInside(darkMode)
	);
	map.setPaintProperty(
		layerspercategory.metro.osmstops,
		'circle-stroke-color',
		getCircleOutside(darkMode)
	);
	map.setPaintProperty(
		layerspercategory.metro.osmlabelstops,
		'text-color',
		darkMode ? '#ffffff' : '#2a2a2a'
	);
	map.setPaintProperty(
		layerspercategory.metro.osmlabelstops,
		'text-halo-color',
		darkMode ? '#0f172a' : '#ffffff'
	);

	// Tram stops
	map.setPaintProperty(layerspercategory.tram.stops, 'circle-color', getCircleInside(darkMode));
	map.setPaintProperty(
		layerspercategory.tram.stops,
		'circle-stroke-color',
		getCircleOutside(darkMode)
	);
	map.setPaintProperty(
		layerspercategory.tram.labelstops,
		'text-color',
		darkMode ? '#ffffff' : '#2a2a2a'
	);
	map.setPaintProperty(
		layerspercategory.tram.labelstops,
		'text-halo-color',
		darkMode ? '#0f172a' : '#ffffff'
	);

	// Tram osm stops
	map.setPaintProperty(
		layerspercategory.tram.osmstops,
		'circle-color',
		getCircleInside(darkMode)
	);
	map.setPaintProperty(
		layerspercategory.tram.osmstops,
		'circle-stroke-color',
		getCircleOutside(darkMode)
	);
	map.setPaintProperty(
		layerspercategory.tram.osmlabelstops,
		'text-color',
		darkMode ? '#ffffff' : '#2a2a2a'
	);
	map.setPaintProperty(
		layerspercategory.tram.osmlabelstops,
		'text-halo-color',
		darkMode ? '#0f172a' : '#ffffff'
	);

	// Intercity rail stops
	map.setPaintProperty(
		layerspercategory.intercityrail.stops,
		'circle-color',
		getCircleInside(darkMode)
	);
	map.setPaintProperty(
		layerspercategory.intercityrail.stops,
		'circle-stroke-color',
		getCircleOutside(darkMode)
	);
	map.setPaintProperty(
		layerspercategory.intercityrail.labelstops,
		'text-color',
		darkMode ? '#ffffff' : '#2a2a2a'
	);
	map.setPaintProperty(
		layerspercategory.intercityrail.labelstops,
		'text-halo-color',
		darkMode ? '#0f172a' : '#ffffff'
	);

	// Other stops
	map.setPaintProperty(layerspercategory.other.stops, 'circle-color', getCircleInside(darkMode));
	map.setPaintProperty(
		layerspercategory.other.stops,
		'circle-stroke-color',
		getCircleOutside(darkMode)
	);
	map.setPaintProperty(
		layerspercategory.other.labelstops,
		'text-color',
		darkMode ? '#eee6fe' : '#2a2a2a'
	);
	map.setPaintProperty(
		layerspercategory.other.labelstops,
		'text-halo-color',
		darkMode ? '#0f172a' : '#ffffff'
	);
}

export function bus_stop_stop_color(darkMode: boolean) {
	return darkMode ? ['step', ['zoom'], '#e0e0e0', 14, '#dddddd'] : '#333333';
}

export function addStopsLayers(map: Map, darkMode: boolean) {
	//BUS

	map.addLayer({
		id: layerspercategory.bus.stops,
		type: 'circle',
		source: 'busstops',
		'source-layer': 'data',
		layout: {},
		paint: {
			'circle-color': '#1c2636',
			'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 0.9, 12, 1.2, 13, 2],
			'circle-stroke-color': bus_stop_stop_color(darkMode),
			'circle-stroke-width': ['step', ['zoom'], 0.8, 12, 1.2, 13.2, 1.5],
			'circle-stroke-opacity': ['step', ['zoom'], 0.5, 15, 0.6],
			'circle-opacity': 0.1
			//'circle-emissive-strength': 1
		},
		minzoom: window?.innerWidth >= 768 ? 13 : 11.5,
		filter: default_bus_filter
	});

	map.addLayer({
		id: layerspercategory.bus.labelstops,
		type: 'symbol',
		source: 'busstops',
		'source-layer': 'data',
		filter: default_bus_filter,
		layout: {
			'text-field': ['get', 'displayname'],
			//'text-field': ['coalesce', ['get', 'route_types']],
			'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
			'text-size': ['interpolate', ['linear'], ['zoom'], 13, 7, 15, 8, 16, 10],
			'text-radial-offset': 0.5,
			//'text-ignore-placement': false,
			//'icon-ignore-placement': false,
			//'text-allow-overlap': true,
			//'symbol-avoid-edges': false,
			'text-font': get(ui_font_store).medium
		},
		paint: {
			'text-color': darkMode ? '#eee6fe' : '#2a2a2a',
			'text-halo-color': darkMode ? '#0f172a' : '#ffffff',
			'text-halo-width': 0.4
			//'text-emissive-strength': 1
		},
		minzoom: window?.innerWidth >= 768 ? 14.7 : 13.7
	});

	//LOCAL RAIL

	map.addLayer({
		id: layerspercategory.metro.stops,
		type: 'circle',
		source: 'railstops',
		'source-layer': 'data',
		layout: {},
		paint: {
			'circle-color': getCircleInside(darkMode),
			'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 12, 3.5, 15, 5],
			'circle-stroke-color': getCircleOutside(darkMode),
			'circle-stroke-width': ['step', ['zoom'], 0.4, 10.5, 0.8, 11, 1.2, 13.2, 1.5],
			'circle-stroke-opacity': ['step', ['zoom'], 0.5, 15, 0.6],
			'circle-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.7, 16, 0.8]
			//'circle-emissive-strength': 1
		},
		minzoom: 9,
		filter: default_metro_filter
	});

	map.addLayer({
		id: layerspercategory.metro.labelstops,
		type: 'symbol',
		source: 'railstops',
		'source-layer': 'data',
		layout: {
			'text-field': [
				'concat',
				['get', 'displayname'],
				['case', ['has', 'level_id'], '; ', ''],
				['get', 'level_id'],
				['case', ['has', 'platform_code'], '; ', ''],
				['get', 'platform_code']
			],
			'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
			'text-size': ['interpolate', ['linear'], ['zoom'], 11, 8, 12, 10, 14, 12],
			'text-radial-offset': ['interpolate', ['linear'], ['zoom'], 7, 0.1, 10, 0.3, 12, 0.6],
			//'text-ignore-placement': true,
			//'icon-ignore-placement': false,
			//'text-allow-overlap': true,
			//'symbol-avoid-edges': false,
			'text-font': [
				'step',
				['zoom'],
				['literal', get(ui_font_store).regular],
				12,
				['literal', get(ui_font_store).medium]
			]
		},
		paint: {
			'text-color': darkMode ? '#ffffff' : '#2a2a2a',
			'text-halo-color': darkMode ? '#0f172a' : '#ffffff',
			'text-halo-width': 1
			//'text-emissive-strength': 1
		},
		filter: default_metro_filter,
		minzoom: 11
	});

	map.addLayer({
		id: layerspercategory.metro.osmstops,
		type: 'circle',
		source: 'osmstations',
		'source-layer': 'data',
		layout: {},
		paint: {
			'circle-color': getCircleInside(darkMode),
			'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 12, 3.5, 15, 5, 16, 6],
			'circle-stroke-color': getCircleOutside(darkMode),
			'circle-stroke-width': ['step', ['zoom'], 0.4, 10.5, 0.8, 11, 1.2, 13.2, 1.5],
			'circle-stroke-opacity': ['step', ['zoom'], 0.5, 15, 0.6],
			'circle-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.7, 16, 0.8]
			//'circle-emissive-strength': 1
		},
		minzoom: 9,
		filter: [
			"all",
			["==", ["get", "local_ref"], null],
			["==", ["get", "station_type"], "station"],
			['==', ['get', 'mode_type'], 'subway']
		],
	});

	map.addLayer({
		id: layerspercategory.metro.osmlabelstops,
		type: 'symbol',
		source: 'osmstations',
		'source-layer': 'data',
		layout: {
			'text-field': ['get', 'name'],
			'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
			'text-size': ['interpolate', ['linear'], ['zoom'], 11, 8, 12, 10, 14, 12, 16, 14],
			'text-radial-offset': ['interpolate', ['linear'], ['zoom'], 7, 0.1, 10, 0.3, 12, 0.6],
			//'text-ignore-placement': true,
			//'icon-ignore-placement': false,
			//'text-allow-overlap': true,
			//'symbol-avoid-edges': false,
			'text-font': [
				'step',
				['zoom'],
				['literal', get(ui_font_store).regular],
				12,
				['literal', get(ui_font_store).medium],
				15,
				['literal', get(ui_font_store).semibold]
			]
		},
		paint: {
			'text-color': darkMode ? '#ffffff' : '#2a2a2a',
			'text-halo-color': darkMode ? '#0f172a' : '#ffffff',
			'text-halo-width': 1
			//'text-emissive-strength': 1
		},
		filter: [
			"all",
			["==", ["get", "local_ref"], null],
			["==", ["get", "station_type"], "station"],
			['==', ['get', 'mode_type'], 'subway']
		],
		minzoom: 11
	});

	// TRAMS

	map.addLayer({
		id: layerspercategory.tram.stops,
		type: 'circle',
		source: 'railstops',
		'source-layer': 'data',
		layout: {},
		paint: {
			'circle-color': getCircleInside(darkMode),
			'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 0.9, 10, 1, 12, 3, 15, 4],
			'circle-stroke-color': getCircleOutside(darkMode),
			'circle-stroke-width': ['step', ['zoom'], 1.2, 13.2, 1.5],
			'circle-stroke-opacity': ['step', ['zoom'], 0.4, 11, 0.5, 15, 0.6],
			'circle-opacity': 0.8
			//'circle-emissive-strength': 1
		},
		minzoom: 9,
		filter: default_tram_filter
	});

	map.addLayer({
		id: layerspercategory.tram.labelstops,
		type: 'symbol',
		source: 'railstops',
		'source-layer': 'data',
		layout: {
			'text-field': [
				'concat',
				['get', 'displayname'],
				['case', ['has', 'level_id'], '; ', ''],
				['get', 'level_id'],
				['case', ['has', 'platform_code'], '; ', ''],
				['get', 'platform_code']
			],
			'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
			'text-size': ['interpolate', ['linear'], ['zoom'], 9, 7, 11, 7, 12, 9, 14, 10],
			'text-radial-offset': ['interpolate', ['linear'], ['zoom'], 7, 0.2, 10, 0.3, 12, 0.5],
			//'text-ignore-placement': true,
			//'icon-ignore-placement': false,
			//'text-allow-overlap': true,
			//'symbol-avoid-edges': false,
			'text-font': [
				'step',
				['zoom'],
				['literal', get(ui_font_store).regular],
				12,
				['literal', get(ui_font_store).medium]
			]
		},
		paint: {
			'text-color': darkMode ? '#ffffff' : '#2a2a2a',
			'text-halo-color': darkMode ? '#0f172a' : '#ffffff',
			'text-halo-width': 1
			//'text-emissive-strength': 1
		},
		filter: default_tram_filter,
		minzoom: 12
	});

	map.addLayer({
		id: layerspercategory.tram.osmstops,
		type: 'circle',
		source: 'osmstations',
		'source-layer': 'data',
		layout: {},
		paint: {
			'circle-color': getCircleInside(darkMode),
			'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 0.9, 10, 1, 12, 3, 15, 4, 16, 5],
			'circle-stroke-color': getCircleOutside(darkMode),
			'circle-stroke-width': ['step', ['zoom'], 1.2, 13.2, 1.5],
			'circle-stroke-opacity': ['step', ['zoom'], 0.4, 11, 0.5, 15, 0.6],
			'circle-opacity': 0.8
		},
		minzoom: 9,
		filter: [
			"all",
			["==", ["get", "local_ref"], null],
			[
				'any',
				["==", ["get", "station_type"], "station"],
				["==", ["get", "station_type"], "tram_stop"],
			],
			['any',
				['==', ['get', 'mode_type'], 'tram'],
				['==', ['get', 'mode_type'], 'light_rail']
			]
		],
	});

	map.addLayer({
		id: layerspercategory.tram.osmlabelstops,
		type: 'symbol',
		source: 'osmstations',
		'source-layer': 'data',
		layout: {
			'text-field': ['get', 'name'],
			'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
			'text-size': ['interpolate', ['linear'], ['zoom'], 9, 7, 11, 7, 12, 9, 14, 10, 16, 12, 18, 14],
			'text-radial-offset': ['interpolate', ['linear'], ['zoom'], 7, 0.2, 10, 0.3, 12, 0.5],
			'text-font': [
				'step',
				['zoom'],
				['literal', get(ui_font_store).regular],
				12,
				['literal', get(ui_font_store).medium],
				16,
				['literal', get(ui_font_store).semibold]
			]
		},
		paint: {
			'text-color': darkMode ? '#ffffff' : '#2a2a2a',
			'text-halo-color': darkMode ? '#0f172a' : '#ffffff',
			'text-halo-width': 1
		},
		filter: [
			"all",
			["==", ["get", "local_ref"], null],
			[
				'any',
				["==", ["get", "station_type"], "station"],
				["==", ["get", "station_type"], "tram_stop"],
			],
			['any',
				['==', ['get', 'mode_type'], 'tram'],
				['==', ['get', 'mode_type'], 'light_rail']
			]
		],
		minzoom: 13
	});

	//INTERCITY RAIL

	map.addLayer({
		id: layerspercategory.intercityrail.stops,
		type: 'circle',
		source: 'railstops',
		'source-layer': 'data',
		layout: {},
		paint: {
			'circle-color': getCircleInside(darkMode),
			'circle-radius': internationalIntercityCircleSize,
			'circle-stroke-color': getCircleOutside(darkMode),
			'circle-stroke-width': ['step', ['zoom'], 1.2, 13.2, 1.5],
			'circle-stroke-opacity': ['step', ['zoom'], 0.5, 15, 0.6],
			'circle-opacity': ['step', ['zoom'], 0.6, 13, 0.8]
			//'circle-emissive-strength': 1
		},
		minzoom: 7.5,
		filter: default_interrail_filter
	});

	map.addLayer({
		id: layerspercategory.intercityrail.labelstops,
		type: 'symbol',
		source: 'railstops',
		'source-layer': 'data',
		layout: {
			'text-field': [
				'concat',
				['get', 'displayname'],
				['case', ['has', 'level_id'], '; ', ''],
				['get', 'level_id'],
				['case', ['has', 'platform_code'], '; ', ''],
				['get', 'platform_code']
			],
			'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
			'text-size': internationalIntercityLabelSize,
			'text-radial-offset': 0.2,
			//'text-ignore-placement': true,
			//'icon-ignore-placement': false,
			//'text-allow-overlap': true,
			//'symbol-avoid-edges': false,
			'text-font': [
				'step',
				['zoom'],
				['literal', get(ui_font_store).regular],
				8.5,
				['literal', get(ui_font_store).medium]
			]
		},
		paint: {
			'text-color': darkMode ? '#ffffff' : '#2a2a2a',
			'text-halo-color': darkMode ? '#0f172a' : '#ffffff',
			'text-halo-width': 1
			//'text-emissive-strength': 1
		},
		filter: default_interrail_filter,
		minzoom: 8
	});

	//INTERCITY RAIL OSM

	map.addLayer({
		id: layerspercategory.intercityrail.osmstops,
		type: 'circle',
		source: 'osmstations',
		'source-layer': 'data',
		layout: {},
		paint: {
			'circle-color': getCircleInside(darkMode),
			'circle-radius': internationalIntercityCircleSize,
			'circle-stroke-color': getCircleOutside(darkMode),
			'circle-stroke-width': ['step', ['zoom'], 1.2, 13.2, 1.5],
			'circle-stroke-opacity': ['step', ['zoom'], 0.5, 15, 0.6],
			'circle-opacity': ['step', ['zoom'], 0.6, 13, 0.8]
			//'circle-emissive-strength': 1
		},
		filter: [
			"all",
			["==", ["get", "local_ref"], null],
			['any',
				["==", ["get", "station_type"], "station"],
				["==", ["get", "station_type"], "halt"]
			],
			['==', ['get', 'mode_type'], 'rail']
		],
		minzoom: 7.5
	});

	map.addLayer({
		id: layerspercategory.intercityrail.osmlabelstops,
		type: 'symbol',
		source: 'osmstations',
		'source-layer': 'data',
		layout: {
			'text-field': ['get', 'name'],
			'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
			'text-size': internationalIntercityLabelSize,
			'text-radial-offset': 0.2,
			//'text-ignore-placement': true,
			//'icon-ignore-placement': false,
			//'text-allow-overlap': true,
			//'symbol-avoid-edges': false,
			'text-font': [
				'step',
				['zoom'],
				['literal', get(ui_font_store).regular],
				12.5,
				['literal', get(ui_font_store).medium],
				13.5,
				['literal', get(ui_font_store).bold]
			]
		},
		paint: {
			'text-color': darkMode ? '#ffffff' : '#2a2a2a',
			'text-halo-color': darkMode ? '#0f172a' : '#ffffff',
			'text-halo-width': 1
			//'text-emissive-strength': 1
		},
		filter: [
			"all",
			["==", ["get", "local_ref"], null],
			['any',
				["==", ["get", "station_type"], "station"],
				["==", ["get", "station_type"], "halt"]
			],
			['==', ['get', 'mode_type'], 'rail']
		],
		minzoom: 8
	});

	let urlParams = new URLSearchParams(window.location.search);
	let debugmode = !!urlParams.get('debug');

	if (debugmode) {

		map.addLayer({
			id: 'debugosmpoint',
			type: 'circle',
			source: 'osmstations',
			'source-layer': 'data',
			layout: {},
			paint: {
				'circle-color': "#ffffff",
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 12, 3.5, 15, 5],
				'circle-stroke-color': "#41ffca",
				'circle-stroke-width': ['step', ['zoom'], 0.4, 10.5, 0.8, 11, 1.2, 13.2, 1.5],
				'circle-stroke-opacity': ['step', ['zoom'], 0.5, 15, 0.6],
				'circle-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.7, 16, 0.8]
				//'circle-emissive-strength': 1
			},
			minzoom: 9,
		});

		map.addLayer({
			id: 'debugosmlabel',
			type: 'symbol',
			source: 'osmstations',
			'source-layer': 'data',
			layout: {
				'text-field': [
					'concat',
					['get', 'station_type'],
					" - ",
					['get', 'mode_type'],
					" - ",
					['get', 'local_ref'],
					" - ",
					['get', "parent_osm_id"]
				],
				'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
				'text-size': internationalIntercityLabelSize,
				'text-radial-offset': 0.2,
				//'text-ignore-placement': true,
				//'icon-ignore-placement': false,
				//'text-allow-overlap': true,
				//'symbol-avoid-edges': false,
				'text-font': ['literal', get(ui_font_store).medium]
			},
			paint: {
				'text-color': darkMode ? '#ffffff' : '#2a2a2a',
				'text-halo-color': darkMode ? '#0f172a' : '#ffffff',
				'text-halo-width': 1
				//'text-emissive-strength': 1
			},
			minzoom: 8
		});
	}

	/*map.addLayer({
		id: "MODEDEBUG",
		type: 'symbol',
		source: 'osmstations',
		'source-layer': 'data',
		layout: {
			'text-field': ['get', 'mode_type'],
			'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
			'text-size': internationalIntercityLabelSize,
			'text-radial-offset': 0.2,
			//'text-ignore-placement': true,
			//'icon-ignore-placement': false,
			//'text-allow-overlap': true,
			//'symbol-avoid-edges': false,
			'text-font': [
				'step',
				['zoom'],
				['literal', get(ui_font_store).italic],
				12.5,
				['literal', get(ui_font_store).medium],
				13.5,
				['literal', get(ui_font_store).bold]
			]
		},
		paint: {
			'text-color': darkMode ? '#ffffff' : '#2a2a2a',
			'text-halo-color': darkMode ? '#0f172a' : '#ffffff',
			'text-halo-width': 1
			//'text-emissive-strength': 1
		},
		filter: [
			"all",
			["==", ["get", "local_ref"], null],
			["==", ["get", "station_type"], "station"],
			['!=', ['get', 'mode_type'], 'rail']
		],
		minzoom: 8
	});*/

	map.addLayer({
		id: "platformlabels_osm_intercity",
		type: 'symbol',
		source: 'osmstations',
		'source-layer': 'data',
		layout: {
			'text-field': [
				'case',
				['has', 'local_ref'],
				['get', 'local_ref'],
				['get', 'ref']
			],
			'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
			'text-size': ['interpolate', ['linear'], ['zoom'], 14, 4, 15, 6, 16, 11, 17, 14, 18, 18],
			'text-radial-offset': 0,
			"text-allow-overlap": true,
			'text-ignore-placement': true,
			//'icon-ignore-placement': false,
			//'symbol-avoid-edges': false,
			'text-font': [
				'step',
				['zoom'],
				['literal', get(ui_font_store).medium],
				8.5,
				['literal', get(ui_font_store).bold],
			]
		},
		paint: {
			'text-color': "#ffffff",
			'text-halo-color': "#2d327d",
			'text-halo-width': 10,
			//'text-emissive-strength': 1
		},
		filter: [
			"all",
			["==", ["get", "station_type"], "stop_position"],
			[
				'any',
				['has', 'local_ref'],
				['has', 'ref']
			],
			['==', ['get', 'mode_type'], 'rail'],
		],
		minzoom: 14
	});

	//OTHER

	map.addLayer({
		id: layerspercategory.other.stops,
		type: 'circle',
		source: 'otherstops',
		'source-layer': 'data',
		layout: {},
		paint: {
			'circle-color': getCircleInside(darkMode),
			'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 1, 12, 4, 15, 5],
			'circle-stroke-color': getCircleOutside(darkMode),
			'circle-stroke-width': ['step', ['zoom'], 1.2, 13.2, 1.5],
			'circle-stroke-opacity': ['step', ['zoom'], 0.5, 15, 0.6],
			'circle-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.7, 16, 0.8]
			//'circle-emissive-strength': 1
		},
		filter: ['all', ['any', ['>', ['zoom'], 16], ['==', null, ['get', 'parent_station']]]],
		minzoom: 9
	});
	map.addLayer({
		id: layerspercategory.other.labelstops,
		type: 'symbol',
		source: 'otherstops',
		'source-layer': 'data',
		layout: {
			'text-field': ['get', 'displayname'],
			'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
			'text-size': ['interpolate', ['linear'], ['zoom'], 9, 6, 15, 9, 17, 10],
			'text-radial-offset': 1,
			//'text-ignore-placement': true,
			//'icon-ignore-placement': false,
			//'text-allow-overlap': true,
			//'symbol-avoid-edges': false,
			'text-font': ['literal', get(ui_font_store).bold]
		},
		paint: {
			'text-color': darkMode ? '#eee6fe' : '#2a2a2a',
			'text-halo-color': darkMode ? '#0f172a' : '#ffffff',
			'text-halo-width': 1
			//'text-emissive-strength': 1
		},
		filter: ['all', ['any', ['>', ['zoom'], 16], ['==', null, ['get', 'parent_station']]]],
		minzoom: 9
	});
}
