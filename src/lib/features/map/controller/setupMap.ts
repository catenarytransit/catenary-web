import { get } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { makeFireMap } from '$components/wildfireMap';
import maplibregl from 'maplibre-gl';
import { show_zombie_buses_store, chateaus_store } from '$root/globalstores';
import { clearbottomright } from '$components/clearbottomright';
import { addStopsLayers } from '$components/addLayers/addStops';
import { addGeoRadius } from '$components/userradius';
import { addShapes } from '$components/addLayers/addShapes';
import { fetch_realtime_vehicle_locations } from '$components/fetch_realtime_vehicle_locations';
import type { RealtimeLayerSettings } from '$components/fetch_realtime_vehicle_locations';
import type { BoundsInputV3 } from '$lib/types/backend/spruce';
import { makeCircleLayers, makeTrajectoryCircleLayers } from '$components/addLayers/addLiveDots';
import { makeBearingArrowPointers } from '$components/addLayers/makebearingarrowpointers';
import { makeGpsLayer } from '$components/makeGpsLayer';
import { makeContextLayerDataset, makeContextLayerDots } from '$components/addLayers/contextLayer';
import { update_geolocation_source } from '$root/user_location_lib';
import {
	applyPendingSourceData,
	fetch_trajectories,
	startTrajectoryManager,
	stopTrajectoryManager
} from '$components/trajectory_manager';
import { destroyTrajectoryOverlay, setupTrajectoryOverlay } from '$components/trajectory_overlay';
import { setup_click_handler } from '$components/mapClickHandler';
import { initSpruceWebSocket, spruce_map_data } from '$root/spruce_websocket';
import { initRamondaWebSocket } from '$root/ramonda_websocket';
import { process_realtime_vehicle_locations_v2 } from '$components/process_realtime_data';
import { addApplicationSources } from '../sources/sourceRegistry';
import { addStationEntranceLayers } from '../layers/stationEntrances';
import {
	addGeolocationFallbackLayer,
	addGeolocationSourceAndBearingLayer
} from '../layers/geolocation';

export async function setupMap(
	map: maplibregl.Map,
	runSettingsAdapt: () => void,
	darkMode: boolean,
	layerspercategory: Record<string, any>,
	chateaus_in_frame: Writable<string[]>,
	layersettings: RealtimeLayerSettings & Record<string, unknown>,
	recompute_map_padding: () => void,
	setSidebarOpen: () => void
) {
	let unsubscribeSpruce: (() => void) | null = null;
	const settingsTimeouts: number[] = [];

	// Start WebSocket and trajectory manager early, before the style / map load event
	initSpruceWebSocket();
	initRamondaWebSocket();
	setupTrajectoryOverlay(map);
	startTrajectoryManager(map);
	fetch_trajectories(layersettings, map);

	const updateInterval = window.setInterval(() => {
		fetch_trajectories(layersettings, map);
	}, 700);

	map.on('load', async () => {
		recompute_map_padding();
		clearbottomright();

		let current_request_bounds: BoundsInputV3 | null = null;

		// Subscribe to map data updates from WebSocket
		// We use a singleton store, so it fires whenever data comes.
		// We need to pair it with the latest bounds we asked for (or close enough) to process it correctly.
		unsubscribeSpruce = spruce_map_data.subscribe((data) => {
			if (data && current_request_bounds) {
				process_realtime_vehicle_locations_v2(data, map, current_request_bounds);
			}
		});

		addGeoRadius(map);
		makeGpsLayer(map);

		update_geolocation_source();

		if (localStorage.getItem('showzombiebuses') === 'true') {
			show_zombie_buses_store.set(true);
			runSettingsAdapt();
		}

		const chateauData = get(chateaus_store) as
			| maplibregl.GeoJSONSourceSpecification['data']
			| null;
		addApplicationSources(map, chateauData);
		applyPendingSourceData(map);

		makeFireMap(map, chateaus_in_frame);
		console.log('setup load map start');
		addShapes(map, darkMode);
		addStopsLayers(map, darkMode);
		await makeContextLayerDataset(map);
		await makeCircleLayers(map, darkMode, layerspercategory);
		await makeTrajectoryCircleLayers(map, darkMode);
		await makeBearingArrowPointers(map, darkMode, layerspercategory);

		await makeContextLayerDots(map);

		console.log('setting up click handler');

		setup_click_handler(map, layerspercategory, setSidebarOpen);

		const [stationImage, geoNavImage, geoCircleImage] = await Promise.all([
			map.loadImage('/station-enter.png'),
			map.loadImage('/geo-nav.png'),
			map.loadImage('/geo-circle.png')
		]);

		if (stationImage && !map.hasImage('station-enter')) {
			map.addImage('station-enter', stationImage.data);
		}
		if (stationImage) {
			addStationEntranceLayers(map, layerspercategory, darkMode);
		}

		if (geoNavImage && !map.hasImage('geonav')) {
			map.addImage('geonav', geoNavImage.data);
		}
		if (geoNavImage) {
			addGeolocationSourceAndBearingLayer(map);
		}

		if (geoCircleImage && !map.hasImage('geocircle')) {
			map.addImage('geocircle', geoCircleImage.data);
		}
		if (geoCircleImage) {
			addGeolocationFallbackLayer(map);
		}

		map.on('moveend', () => {
			current_request_bounds = fetch_realtime_vehicle_locations(layersettings, map);
		});

		current_request_bounds = fetch_realtime_vehicle_locations(layersettings, map);

		recompute_map_padding();
		runSettingsAdapt();

		settingsTimeouts.push(
			window.setTimeout(runSettingsAdapt, 500),
			window.setTimeout(runSettingsAdapt, 1000)
		);
	});

	map.on('remove', () => {
		window.clearInterval(updateInterval);
		settingsTimeouts.forEach((timeout) => window.clearTimeout(timeout));
		unsubscribeSpruce?.();
		unsubscribeSpruce = null;
		destroyTrajectoryOverlay();
		stopTrajectoryManager();
	});
}
