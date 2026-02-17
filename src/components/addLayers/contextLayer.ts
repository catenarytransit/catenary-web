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
	ui_font_store
} from '../../globalstores';
import { determineDarkModeToBool } from '../determineDarkModeToBool';
import { textColorOfMapLabels } from './addLiveDots';
import { writable, get } from 'svelte/store';

export async function makeContextLayerDataset(map: maplibregl.Map) {
	let darkMode = determineDarkModeToBool();

	const urlParams =
		typeof window !== 'undefined'
			? new URLSearchParams(window.location.search)
			: new URLSearchParams();

	map.addSource('walking_shape_context', {
		type: 'geojson',
		data: {
			type: 'FeatureCollection',
			features: []
		}
	});

	map.addSource('stops_context', {
		type: 'geojson',
		data: {
			type: 'FeatureCollection',
			features: []
		}
	});

	map.addSource('transit_shape_context', {
		type: 'geojson',
		data: {
			type: 'FeatureCollection',
			features: []
		}
	});

	map.addSource('transit_shape_context_for_stop', {
		type: 'geojson',
		data: {
			type: 'FeatureCollection',
			features: []
		}
	});

	map.addSource('transit_shape_context_detour', {
		type: 'geojson',
		data: {
			type: 'FeatureCollection',
			features: []
		}
	});

	map.addSource('livedots_context', {
		type: 'geojson',
		data: {
			type: 'FeatureCollection',
			features: []
		}
	});

	map.addLayer({
		id: 'contextlinebackingdetour',
		type: 'line',
		source: 'transit_shape_context_detour',
		paint: {
			'line-color': '#fb9cac',
			'line-width': ['interpolate', ['linear'], ['zoom'], 7, 3, 14, 6],
			'line-opacity': 0.5
			//'line-emissive-strength': 1
			// 'line-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.2, 10, 0.4]
		},
		minzoom: 3
	});

	map.addLayer({
		id: 'contextlinedetour',
		type: 'line',
		source: 'transit_shape_context_detour',
		paint: {
			'line-color': ['get', 'color'],
			'line-width': ['interpolate', ['linear'], ['zoom'], 7, 3.2, 14, 5],
			'line-dasharray': [1, 2],
			'line-opacity': 0.9
			//'line-opacity': ['step', ['zoom'], 0.7, 7, 0.8, 8, 0.9]
			//'line-emissive-strength': 1
			//'line-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.2, 10, 0.4]
		},
		minzoom: 3
	});

	map.addLayer({
		id: 'contextlinebacking',
		type: 'line',
		source: 'transit_shape_context',
		paint: {
			'line-color': '#ffffff',
			'line-width': ['interpolate', ['linear'], ['zoom'], 7, 4, 14, 8],
			'line-opacity': 0.9
			//'line-emissive-strength': 1
			// 'line-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.2, 10, 0.4]
		},
		minzoom: 3
	});

	map.addLayer({
		id: 'contextline',
		type: 'line',
		source: 'transit_shape_context',
		paint: {
			'line-color': ['get', 'color'],
			'line-width': ['interpolate', ['linear'], ['zoom'], 7, 3.5, 14, 6]
			//'line-opacity': ['step', ['zoom'], 0.7, 7, 0.8, 8, 0.9]
			//'line-emissive-strength': 1
			//'line-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.2, 10, 0.4]
		},
		minzoom: 3
	});

	map.addLayer({
		id: 'contextlinebackingforstop',
		type: 'line',
		source: 'transit_shape_context_for_stop',
		paint: {
			'line-color': '#ffffff',
			'line-width': ['interpolate', ['linear'], ['zoom'], 7, 4, 11, 5, 14, 7],
			'line-opacity': 0.8
			//'line-emissive-strength': 1
			// 'line-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.2, 10, 0.4]
		},
		minzoom: 3
	});

	map.addLayer({
		id: 'contextlineforstop',
		type: 'line',
		source: 'transit_shape_context_for_stop',
		paint: {
			'line-color': ['get', 'color'],
			'line-width': ['interpolate', ['linear'], ['zoom'], 7, 2.8, 11, 4, 14, 5]
			//'line-opacity': ['step', ['zoom'], 0.7, 7, 0.8, 8, 0.9]
			//'line-emissive-strength': 1
			//'line-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.2, 10, 0.4]
		},
		minzoom: 3
	});

	map.addLayer({
		id: 'contextlinelabel',
		type: 'symbol',
		source: 'transit_shape_context',
		layout: {
			'symbol-placement': 'line',
			//'text-field': ['coalesce', ['get', 'route_label']],
			'text-field': ['get', 'route_label'],
			//'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
			'text-font': ['literal', get(ui_font_store).regular],
			'text-size': ['interpolate', ['linear'], ['zoom'], 5, 9, 9, 10, 11, 12, 13, 15],
			'text-ignore-placement': false,
			'text-allow-overlap': false,
			'text-pitch-alignment': 'viewport',
			'symbol-spacing':
				window?.innerWidth > 750
					? ['step', ['zoom'], 200, 12, 100, 13, 100, 15, 120, 20, 150]
					: ['step', ['zoom'], 200, 12, 80, 13, 100, 15, 100, 20, 150],
			visibility: 'none'
		},
		paint: {
			'text-color': ['get', 'text_color'],
			'text-halo-color': ['get', 'color'],
			'text-halo-width': 2,
			'text-halo-blur': 0
			//'line-emissive-strength': 1
		},
		minzoom: 3
	});

	//add png icon cancelledstops.png

	let cancelled_stops_image = await map.loadImage('/icons/cancelledstop.png');

	map.addImage('cancelledstops', cancelled_stops_image.data);

	map.addLayer({
		id: 'contextbusstopscancelled',
		type: 'symbol',
		source: 'stops_context',
		paint: {},
		layout: {
			'icon-image': 'cancelledstops',
			'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.02, 10, 0.03, 13, 0.05],
			'icon-allow-overlap': true,
			'icon-ignore-placement': true,
			'icon-rotation-alignment': 'viewport',
			'icon-pitch-alignment': 'viewport',
			'icon-offset': [0, 0],
			'icon-rotate': 0,
			'icon-optional': false,
			'icon-keep-upright': false
		},
		filter: ['all', ['==', 3, ['get', 'stop_route_type']], ['==', true, ['get', 'cancelled']]],
		minzoom: 9.5
	});

	map.addLayer({
		id: 'contextbusstops',
		type: 'circle',
		source: 'stops_context',
		layout: {},
		paint: {
			'circle-color': '#ffffff',
			'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 1, 10, 2, 13, 4],
			'circle-stroke-color': '#1a1a1a',
			'circle-stroke-width': ['step', ['zoom'], 1.2, 13.2, 1.5],
			'circle-stroke-opacity': 0.9,
			'circle-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.7, 12, 1]
			//'circle-emissive-strength': 1
		},
		filter: ['all', ['==', 3, ['get', 'stop_route_type']], ['!=', true, ['get', 'cancelled']]],
		minzoom: 9.5
	});

	map.addLayer({
		id: 'contextbusstops_label',
		type: 'symbol',
		source: 'stops_context',
		layout: {
			'text-field': ['get', 'label'],
			//'text-field': ['coalesce', ['get', 'route_types']],
			'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
			'text-size': ['interpolate', ['linear'], ['zoom'], 11, 10, 13, 10, 14, 13],
			'text-radial-offset': 0.3,
			//'text-ignore-placement': false,
			//'icon-ignore-placement': false,
			//'text-allow-overlap': true,
			//'symbol-avoid-edges': false,

			'text-font': [
				'step',
				['zoom'],
				['literal', get(ui_font_store).regular],
				13,
				['literal', get(ui_font_store).medium]
			]
		},
		paint: {
			'text-color': darkMode ? '#ffffff' : '#1a1a1a',
			'text-halo-color': darkMode ? '#1a1a1a' : '#dadada',
			'text-halo-width': 1
			//'text-emissive-strength': 1
		},
		filter: ['all', ['==', 3, ['get', 'stop_route_type']]],
		minzoom: 12.5
	});

	map.addLayer({
		id: 'contextmetrostops',
		type: 'circle',
		source: 'stops_context',
		layout: {},
		paint: {
			'circle-color': '#ffffff',
			'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 1.3, 10, 3, 13, 5],
			'circle-stroke-color': '#1a1a1a',
			'circle-stroke-width': ['step', ['zoom'], 1.2, 13.2, 1.5],
			'circle-stroke-opacity': 0.9,
			'circle-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.7, 12, 1]
			//'circle-emisive-strength': 1
		},
		filter: ['all', ['!=', 3, ['get', 'stop_route_type']], ['!=', 2, ['get', 'stop_route_type']]],
		minzoom: 6
	});

	map.addLayer({
		id: 'contextmetrostops_label',
		type: 'symbol',
		source: 'stops_context',
		layout: {
			'text-field': ['get', 'label'],
			//'text-field': ['coalesce', ['get', 'route_types']],
			'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
			'text-size': ['interpolate', ['linear'], ['zoom'], 6, 4.5, 8, 9, 9, 12],
			'text-radial-offset': 0.2,
			'text-ignore-placement': false,
			//'icon-ignore-placement': false,
			//'text-allow-overlap': true,
			//'symbol-avoid-edges': false,
			'text-font': get(ui_font_store).medium
		},
		paint: {
			'text-color': darkMode ? '#ffffff' : '#1a1a1a',
			'text-halo-color': darkMode ? '#1a1a1a' : '#dadada',
			'text-halo-width': 1
			//'text-emissive-strength': 1
		},
		filter: ['all', ['!=', 3, ['get', 'stop_route_type']], ['!=', 2, ['get', 'stop_route_type']]],
		minzoom: 9
	});

	map.addLayer({
		id: 'contextrailstops',
		type: 'circle',
		source: 'stops_context',
		layout: {},
		paint: {
			'circle-color': '#ffffff',
			'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 3, 10, 4, 13, 5],
			'circle-stroke-color': '#1a1a1a',
			'circle-stroke-width': ['step', ['zoom'], 1.2, 13.2, 1.5],
			'circle-stroke-opacity': 0.9,
			'circle-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.7, 12, 1]
			//'circle-emissive-strength': 1
		},
		filter: ['all', ['==', 2, ['get', 'stop_route_type']]],
		minzoom: 4
	});

	map.addLayer({
		id: 'contextrailstops_label',
		type: 'symbol',
		source: 'stops_context',
		layout: {
			'text-field': ['get', 'label'],
			//'text-field': ['coalesce', ['get', 'route_types']],
			'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
			'text-size': ['interpolate', ['linear'], ['zoom'], 4, 9, 6, 10, 9, 12, 10, 14],
			'text-radial-offset': 0.2,
			//'text-ignore-placement': true,
			//'icon-ignore-placement': false,
			//'text-allow-overlap': true,
			//'symbol-avoid-edges': false,
			'text-font': [
				'step',
				['zoom'],
				['literal', get(ui_font_store).regular],
				6,
				['literal', get(ui_font_store).medium]
			]
		},
		paint: {
			'text-color': darkMode ? '#ffffff' : '#1a1a1a',
			'text-halo-color': darkMode ? '#1a1a1a' : '#dadada',
			'text-halo-width': 1
			//'text-emissive-strength': 1
		},
		filter: ['all', ['==', 2, ['get', 'stop_route_type']]],
		minzoom: 3
	});

	map.addSource('redpin', {
		type: 'geojson',
		data: {
			type: 'FeatureCollection',
			features: []
		}
	});

	const pinimg = await map.loadImage('/icons/newpin.png');

	map.addImage('pinimg', pinimg.data);

	map.addLayer({
		id: 'pinicon',
		type: 'symbol',
		source: 'redpin',
		layout: {
			'icon-image': 'pinimg',
			'icon-size': 0.15,
			'icon-offset': [0, -100],
			'icon-ignore-placement': true,
			'icon-allow-overlap': true
		}
	});

	//context live dots section
}

export async function makeContextLayerDots(map: maplibregl.Map) {
	let darkMode = determineDarkModeToBool();

	const urlParams =
		typeof window !== 'undefined'
			? new URLSearchParams(window.location.search)
			: new URLSearchParams();

	const contextBusSymbol = await map.loadImage('/icons/bus_context_symbol_v2.png');

	map.addImage('bus_context_symbol', contextBusSymbol.data);

	/*
	map.addLayer({
		'id': "livedots_context_bus_major_dot",
		'type': "circle",
		'source': "livedots_context",
		'layout': {},
		paint: {
			'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 2, 8, 3, 9, 5, 10, 5, 16, 8],
			'circle-color': ['get', 'color'],
			'circle-stroke-color': darkMode == true ? '#ffffff': '#333333' ,
			'circle-stroke-opacity': [
				'interpolate',
				['linear'],
				['zoom'],
				7.9,
				0.5,
				8,
				0.6,
				9,
				0.8,
				13,
				0.9
			],
			'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 9, 1, 13, 1.5],
			//'circle-emissive-strength': 1,
			'circle-opacity': 0.8
		},
		filter: ['all', ['any', ['==', ['get', 'route_type'], 3]]],
		minzoom: 5
	});*/

	map.addLayer({
		id: 'livedots_context_bus_major_dot_context',
		type: 'symbol',
		source: 'livedots_context',
		paint: {
			'icon-opacity': 0.85
		},
		layout: {
			'icon-image': 'bus_context_symbol',
			'icon-size': 0.2,

			'icon-allow-overlap': true,
			'icon-ignore-placement': true,
			'icon-offset': [0, 0]
		},
		filter: ['all', ['any', ['==', ['get', 'route_type'], 3]]],
		minzoom: 5
	});

	map.addLayer({
		id: 'livedots_context_bus_major_label',
		type: 'symbol',
		source: 'livedots_context',
		layout: {
			'text-field': ['get', 'maptag'],
			'text-variable-anchor': ['left', 'right'],
			'text-radial-offset': 0.5,
			'text-allow-overlap': false,
			'text-font': get(ui_font_store).semibold,
			'text-size': ['interpolate', ['linear'], ['zoom'], 9, 9, 11, 11, 13, 12, 15, 14],
			'text-ignore-placement': ['step', ['zoom'], false, 10.5, true]
		},
		minzoom: 7,
		paint: {
			'text-color': ['get', 'text_color'],
			//'text-color': ['get', 'color'],
			//'text-halo-color': '#ededed',
			'text-halo-color': ['get', 'color'],
			'text-halo-width': 4,
			'text-halo-blur': 0.6,
			'text-opacity': ['interpolate', ['linear'], ['zoom'], 7.9, 0.4, 8, 0.9, 11, 0.95, 12, 1]
		},
		filter: ['all', ['any', ['==', ['get', 'route_type'], 3]]]
	});
}

export function changeContextTheme(map: maplibregl.Map, darkMode: boolean) {
	map.setPaintProperty('contextlinebacking', 'line-color', darkMode ? '#111133' : '#ffffff');
	map.setPaintProperty('contextbusstops_label', 'text-color', darkMode ? '#ffffff' : '#1a1a1a');
	map.setPaintProperty(
		'contextbusstops_label',
		'text-halo-color',
		darkMode ? '#1a1a1a' : '#dadada'
	);
}
