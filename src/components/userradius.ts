import { get } from 'svelte/store';
import { createGeoJSONCircleFeature } from '../geoMathsAssist';
import { ui_theme_store, usunits_store, show_my_location_store } from '../globalstores';
import { determineDarkModeToBool } from './determineDarkModeToBool';

import { ui_font_store } from '../globalstores';

/**
 * Initializes the GeoJSON sources and layers for radius circles.
 * @param map The MapLibre GL Map instance.
 */
export function addGeoRadius(map: maplibregl.Map) {
	const dark_mode = determineDarkModeToBool();

	try {
		// Initialize KM Source
		map.addSource('km_source', {
			type: 'geojson',
			data: {
				type: 'FeatureCollection',
				features: []
			}
		});

		map.addLayer({
			id: 'km_line',
			type: 'line',
			source: 'km_source',
			paint: {
				'line-color': dark_mode ? '#dddddd' : '#121212',
				'line-width': 1.2,
				'line-opacity': 0.8
			}
		});

		map.addLayer({
			id: 'km_text',
			type: 'symbol',
			source: 'km_source',
			layout: {
				'text-field': ['get', 'label'],
				'text-font': get(ui_font_store).bold,
				'symbol-placement': 'line',
				'text-size': 8,
				'symbol-spacing': 150,
				'text-ignore-placement': true,
				'text-allow-overlap': true
			},
			paint: {
				'text-color': dark_mode ? '#ffffff' : '#121212',
				'text-halo-color': dark_mode ? '#000030' : '#eeeeee',
				'text-halo-width': 2,
				'text-opacity': 0.8
			}
		});

		// Initialize Miles Source
		map.addSource('miles_source', {
			type: 'geojson',
			data: {
				type: 'FeatureCollection',
				features: []
			}
		});

		map.addLayer({
			id: 'miles_line',
			type: 'line',
			source: 'miles_source',
			paint: {
				'line-color': dark_mode ? '#dddddd' : '#121212',
				'line-width': 1.5
			}
		});

		map.addLayer({
			id: 'miles_text',
			type: 'symbol',
			source: 'miles_source',
			layout: {
				'text-field': ['get', 'label'],
				'text-font': get(ui_font_store).bold,
				'symbol-placement': 'line',
				'text-size': 8,
				'symbol-spacing': 150,
				'text-ignore-placement': true,
				'text-allow-overlap': true
			},
			paint: {
				'text-color': dark_mode ? '#ffffff' : '#121212',
				'text-halo-color': dark_mode ? '#000030' : '#eeeeee',
				'text-halo-width': 2
			}
		});
	} catch (err) {
		console.error('Error initializing geo radius layers:', err);
	}
}

/**
 * Updates the position and data of the radius circles.
 * Fixed "blinking" by ensuring only the active source is updated with features.
 */
export function setUserCircles(map: maplibregl.Map, lng: number, lat: number) {
	const km_source = map.getSource('km_source') as maplibregl.GeoJSONSource;
	const miles_source = map.getSource('miles_source') as maplibregl.GeoJSONSource;

	if (!km_source || !miles_source) return;

	const show_my_location = get(show_my_location_store);

	// If user location display is disabled, hide all radius circles
	if (!show_my_location) {
		if (map.getLayer('km_line')) map.setLayoutProperty('km_line', 'visibility', 'none');
		if (map.getLayer('km_text')) map.setLayoutProperty('km_text', 'visibility', 'none');
		if (map.getLayer('miles_line')) map.setLayoutProperty('miles_line', 'visibility', 'none');
		if (map.getLayer('miles_text')) map.setLayoutProperty('miles_text', 'visibility', 'none');

		km_source.setData({ type: 'FeatureCollection', features: [] });
		miles_source.setData({ type: 'FeatureCollection', features: [] });
		return;
	}

	const numberofpoints: number = 256;
	const use_us_units = get(usunits_store);

	if (use_us_units) {
		// 1. Ensure KM layers are hidden before updating data to prevent flicker
		if (map.getLayer('km_line')) map.setLayoutProperty('km_line', 'visibility', 'none');
		if (map.getLayer('km_text')) map.setLayoutProperty('km_text', 'visibility', 'none');

		// 2. Clear KM source to free resources
		km_source.setData({ type: 'FeatureCollection', features: [] });

		// 3. Generate and set Miles data
		const miles_distances = [0.25, 0.5, 1, 2, 3, 5, 10, 20, 50];
		const miles_feature_list = miles_distances.map((dist) => {
			const distInKm = dist * 1.60934;
			const feature = createGeoJSONCircleFeature([lng, lat], distInKm, numberofpoints);
			if (feature.properties) {
				feature.properties.label = `${dist} mi`;
			}
			return feature;
		});

		miles_source.setData({
			type: 'FeatureCollection',
			features: miles_feature_list as any
		});

		// 4. Ensure Miles layers are visible
		if (map.getLayer('miles_line')) map.setLayoutProperty('miles_line', 'visibility', 'visible');
		if (map.getLayer('miles_text')) map.setLayoutProperty('miles_text', 'visibility', 'visible');
	} else {
		// 1. Ensure Miles layers are hidden
		if (map.getLayer('miles_line')) map.setLayoutProperty('miles_line', 'visibility', 'none');
		if (map.getLayer('miles_text')) map.setLayoutProperty('miles_text', 'visibility', 'none');

		// 2. Clear Miles source
		miles_source.setData({ type: 'FeatureCollection', features: [] });

		// 3. Generate and set KM data
		const km_distances = [0.5, 1, 2, 5, 10, 20, 50];
		const km_feature_list = km_distances.map((dist) =>
			createGeoJSONCircleFeature([lng, lat], dist, numberofpoints)
		);

		km_source.setData({
			type: 'FeatureCollection',
			features: km_feature_list as any
		});

		// 4. Ensure KM layers are visible
		if (map.getLayer('km_line')) map.setLayoutProperty('km_line', 'visibility', 'visible');
		if (map.getLayer('km_text')) map.setLayoutProperty('km_text', 'visibility', 'visible');
	}
}
