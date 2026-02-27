import { get, writable } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { makeFireMap } from './wildfireMap';
import maplibregl from 'maplibre-gl';
import {
	realtime_vehicle_locations_last_updated_store,
	realtime_vehicle_locations_store,
	realtime_vehicle_route_cache_hash_store,
	realtime_vehicle_route_cache_store,
	show_zombie_buses_store,
	chateaus_store
} from '../globalstores';
import { clearbottomright } from './clearbottomright';
import { determineFeedsUsingChateaus } from '../maploaddata';
import { addStopsLayers } from './addLayers/addStops';
import { garbageCollectNotInView } from './garbage_collect';
import { addGeoRadius, setUserCircles } from './userradius';
import { addShapes } from './addLayers/addShapes';
import { fetch_realtime_vehicle_locations } from './fetch_realtime_vehicle_locations';
import { add_bunny_layer, make_custom_icon_source, new_jeans_buses } from './addLayers/customIcons';
import { makeCircleLayers } from './addLayers/addLiveDots';
import { makeBearingArrowPointers } from './addLayers/makebearingarrowpointers';
import { makeGpsLayer } from './makeGpsLayer';
import { makeContextLayerDataset, makeContextLayerDots } from './addLayers/contextLayer';
import { start_location_watch, update_geolocation_source } from '../user_location_lib';
import { setup_click_handler } from '../components/mapClickHandler';
import { initSpruceWebSocket, spruce_map_data } from '../spruce_websocket';
import { process_realtime_vehicle_locations_v2 } from './process_realtime_data';

const RASTER_SOURCES = [
	{ id: 'foamertiles', url: 'standard' },
	{ id: 'maxspeedtiles', url: 'maxspeed' },
	{ id: 'signallingtiles', url: 'signals' },
	{ id: 'electrificationtiles', url: 'electrification' },
	{ id: 'gaugetiles', url: 'gauge' }
];

const SHAPES = [
	{ id: 'intercityrailshapes', url: 'https://birch1.catenarymaps.org/shapes_intercity_rail' },
	{ id: 'localcityrailshapes', url: 'https://birch2.catenarymaps.org/shapes_local_rail' },
	{ id: 'othershapes', url: 'https://birch3.catenarymaps.org/shapes_ferry' },
	{ id: 'busshapes', url: 'https://birch4.catenarymaps.org/shapes_bus' }
];

const STOP_SOURCES = [
	{ id: 'busstops', url: 'https://birch6.catenarymaps.org/busstops' },
	{ id: 'stationfeatures', url: 'https://birch7.catenarymaps.org/station_features' },
	{ id: 'railstops', url: 'https://birch5.catenarymaps.org/unmatched_railstops' },
	{ id: 'otherstops', url: 'https://birch8.catenarymaps.org/otherstops' },
	{
		id: 'osmstations',
		url: 'https://birch.catenarymaps.org/osm_stations'
	}
];

export async function setup_load_map(
	map: maplibregl.Map,
	runSettingsAdapt: () => void,
	darkMode: boolean,
	layerspercategory: Record<string, any>,
	chateaus_in_frame: Writable<string[]>,
	layersettings: Record<string, any>,
	chateau_to_realtime_feed_lookup: Record<string, any>,
	pending_chateau_rt_request: Record<string, number>,
	recompute_map_padding: () => void,
	setSidebarOpen: () => void
) {
	let updateInterval: NodeJS.Timeout;
	const minZoomThreshold = window.innerWidth >= 1023 ? 14 : 15;

	map.on('load', async () => {
		recompute_map_padding();
		clearbottomright();

		// Initialize WebSocket
		initSpruceWebSocket();

		let current_request_bounds: any = null;

		// Subscribe to map data updates from WebSocket
		// We use a singleton store, so it fires whenever data comes.
		// We need to pair it with the latest bounds we asked for (or close enough) to process it correctly.
		spruce_map_data.subscribe((data) => {
			if (data && current_request_bounds) {
				process_realtime_vehicle_locations_v2(data, map, current_request_bounds);
			}
		});

		addGeoRadius(map);
		makeGpsLayer(map);

		const emptyGeoJSON = { type: 'FeatureCollection', features: [] } as any;

		map.addSource('cypress_results', {
			type: 'geojson',
			data: emptyGeoJSON
		});

		map.addLayer({
			id: 'cypress_results_symbol',
			type: 'symbol',
			source: 'cypress_results',
			layout: {
				'icon-image': 'station-enter',
				'icon-size': 0.3,
				'icon-allow-overlap': true,
				'icon-ignore-placement': true
			},
			paint: {
				'icon-opacity': 0.9
			}
		});

		update_geolocation_source();

		if (localStorage.getItem('showzombiebuses') === 'true') {
			show_zombie_buses_store.set(true);
			runSettingsAdapt();
		}

		const chateauData = get(chateaus_store);
		map.addSource('chateaus', { type: 'geojson', data: chateauData || emptyGeoJSON });

		[...SHAPES, ...STOP_SOURCES].forEach(({ id, url }) => {
			map.addSource(id, { type: 'vector', url });
		});

		if (get(chateaus_store) !== null) {
			map.getSource('chateaus').setData(get(chateaus_store));
		}

		map.addLayer({
			id: 'chateaus_calc',
			type: 'fill',
			source: 'chateaus',
			paint: {
				'fill-color': '#ffffff',
				'fill-opacity': 0
			}
		});

		['buses', 'localrail', 'intercityrail', 'other'].forEach((category) => {
			map.addSource(category, {
				type: 'geojson',
				data: emptyGeoJSON
			});
		});

		makeFireMap(map, chateaus_in_frame);
		console.log('setup load map start');
		addShapes(map, darkMode);
		addStopsLayers(map, darkMode);
		await makeContextLayerDataset(map);
		await makeCircleLayers(map, darkMode, layerspercategory);
		await makeBearingArrowPointers(map, darkMode, layerspercategory);

		await makeContextLayerDots(map);

		console.log('setting up click handler');

		setup_click_handler(map, layerspercategory, setSidebarOpen);

		const [stationImage, geoNavImage, geoCircleImage] = await Promise.all([
			map.loadImage('/station-enter.png'),
			map.loadImage('/geo-nav.png'),
			map.loadImage('/geo-circle.png')
		]);

		if (stationImage) {
			map.addImage('station-enter', stationImage.data);
			addStationLayers(map, layerspercategory, darkMode, minZoomThreshold);
		}

		if (geoNavImage) {
			map.addImage('geonav', geoNavImage.data);
			addGeolocationLayers(map);
		}

		if (geoCircleImage) {
			map.addImage('geocircle', geoCircleImage.data);
			map.addLayer({
				id: 'nobearing_position',
				type: 'symbol',
				source: 'user_geolocation', // reference the data source
				layout: {
					'icon-image': 'geocircle', // reference the image
					'icon-size': 0.1,
					visibility: 'none',
					'icon-allow-overlap': true,
					'icon-ignore-placement': true,
					'text-allow-overlap': true,
					'text-ignore-placement': true
				},
				paint: {
					'icon-opacity': 0.8
					//'icon-emissive-strength': 1
				}
			});
		}

		const initialChateauData = determineFeedsUsingChateaus(map);
		chateaus_in_frame.set(Array.from(initialChateauData.chateaus));

		updateInterval = setInterval(() => {
			console.log('interval fetch');

			current_request_bounds = fetch_realtime_vehicle_locations(
				layersettings,
				chateaus_in_frame,
				chateau_to_realtime_feed_lookup,
				map
			);
			garbageCollectNotInView(chateaus_in_frame);
		}, 700);

		current_request_bounds = fetch_realtime_vehicle_locations(
			layersettings,
			chateaus_in_frame,
			chateau_to_realtime_feed_lookup,
			map
		);

		recompute_map_padding();
		runSettingsAdapt();

		setTimeout(() => {
			runSettingsAdapt();
		}, 500);

		setTimeout(() => {
			runSettingsAdapt();
		}, 1000);
	});

	map.on('remove', () => {
		clearInterval(updateInterval);
		RASTER_SOURCES.forEach(({ id }) => map.removeSource(id));
		RAIL_SHAPES.forEach(({ id }) => map.removeSource(id));
		STOP_SOURCES.forEach(({ id }) => map.removeSource(id));
	});
}

function addStationLayers(
	map: maplibregl.Map,
	layerspercategory: any,
	darkMode: boolean,
	minZoom: number
) {
	try {
		map.addLayer(
			{
				id: 'stationenter',
				type: 'symbol',
				source: 'stationfeatures',
				filter: ['all', ['==', 2, ['get', 'location_type']]],
				'source-layer': 'data',
				layout: {
					'icon-image': 'station-enter',
					'icon-size': ['interpolate', ['linear'], ['zoom'], 14, 0.2, 15, 0.2, 16, 0.25, 18, 0.4],
					'icon-ignore-placement': false,
					'icon-allow-overlap': true
				},

				minzoom: minZoom
			},
			layerspercategory.bus.stops
		);

		map.addLayer(
			{
				id: 'stationenterlabel',
				type: 'symbol',
				source: 'stationfeatures',
				filter: ['all', ['==', 2, ['get', 'location_type']]],
				'source-layer': 'data',
				layout: {
					'text-field': ['get', 'name'],
					'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
					'text-size': ['interpolate', ['linear'], ['zoom'], 15, 5, 17, 8, 19, 9.5],
					'text-radial-offset': 1,
					'text-allow-overlap': true,
					'text-font': ['Arimo-Bold']
				},
				paint: {
					'text-color': darkMode ? '#bae6fd' : '#1d4ed8',
					'text-halo-color': darkMode ? '#0f172a' : '#ffffff',
					'text-halo-width': darkMode ? 0.4 : 0.2
				},

				minzoom: window.innerWidth >= 1023 ? 17.5 : 17
			},
			layerspercategory.bus.stops
		);
	} catch (e) {
		console.error(e);
	}
}

function addGeolocationLayers(map: maplibregl.Map) {
	map.addSource('user_geolocation', {
		type: 'geojson',
		data: {
			type: 'FeatureCollection',
			features: [
				{
					type: 'Feature',
					geometry: { type: 'Point', coordinates: [0, 0] },
					properties: {}
				}
			]
		}
	});

	map.addLayer({
		id: 'bearing_position',
		type: 'symbol',
		source: 'user_geolocation',
		layout: {
			'icon-image': 'geonav',
			'icon-size': 0.13,
			'icon-rotate': ['get', 'heading'],
			visibility: 'none'
		},
		paint: { 'icon-opacity': 0.8 }
	});
}
