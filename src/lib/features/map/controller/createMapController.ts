import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { get, writable, type Readable, type Writable } from 'svelte/store';
import { isChromiumDesktop } from '$root/browserinfo';
import { getOptimalPixelRatio } from '$components/maplibre_starter';
import { setupMap } from './setupMap';
import { layerspercategory } from '$components/layernames';
import { checkClockSync } from '$components/checkClockSync';
import { deep_link_url_reader } from '$components/deeplinkreader';
import { add_image_pedestrian_pattern } from '$components/pedestrian_layer';
import { switch_orm_layers } from '$components/openrailwaymap';
import { startSantaTracking } from '$components/santa_tracker';
import { additional_filter_for_vehicles_store } from '$components/filterState';
import {
	current_orm_layer_type_store,
	geolocation_store,
	lock_on_gps_store,
	map_pointer_store,
	show_my_location_store,
	show_topo_global_store,
	usunits_store
} from '$root/globalstores';
import { darkMode } from '$lib/shared/theme/theme';
import {
	applyLayerSettings,
	createDefaultLayerSettings,
	loadLayerSettings,
	type LayerSettings
} from './layerSettings';
import { addTerrainSourcesAndLayers, applySky, applyTopography } from './mapAppearance';
import {
	addOpenRailwayMapSources,
	fetchChateaus,
	getInitialCenter,
	getMapStyle,
	getMarkedPoint,
	updateCenterFromIp
} from './mapConfiguration';

export interface MapControllerDependencies {
	recomputeSidebarPadding(): void;
	openSidebar(): void;
}

export interface MapController {
	heading: Readable<number>;
	layerSettingsOpen: Writable<boolean>;
	layerSettings: LayerSettings;
	desktopApp: Readable<boolean>;
	start(container: HTMLElement): void;
	destroy(): void;
	getMap(): maplibregl.Map | null;
	resetNorth(): void;
	focusUserLocation(): void;
	applyLayerSettings(): void;
	setLayerSettings(settings: LayerSettings): void;
}

let rtlPluginConfigured = false;

function replaceObject(target: Record<string, any>, source: Record<string, any>): void {
	for (const key of Object.keys(target)) {
		delete target[key];
	}
	Object.assign(target, source);
}

function configureWorkers(): void {
	maplibregl.setWorkerCount(navigator.hardwareConcurrency > 10 ? navigator.hardwareConcurrency : 4);
}

export function createMapController(
	dependencies: MapControllerDependencies
): MapController {
	const heading = writable(0);
	const layerSettingsOpen = writable(false);
	const desktopApp = writable(false);
	const layerSettings = createDefaultLayerSettings();
	const chateausInFrame = writable<string[]>([]);
	const subscriptions: Array<() => void> = [];
	const timeouts = new Set<number>();

	let map: maplibregl.Map | null = null;
	let started = false;
	let loaded = false;
	let currentDarkMode = false;
	let useUsUnits = false;
	let showMyLocation = true;
	let lastNorthResetAt = 0;
	let resolutionMedia: MediaQueryList | null = null;
	let resolutionListener: (() => void) | null = null;

	function getMap(): maplibregl.Map | null {
		return map;
	}

	function runLayerSettings(): void {
		if (!map) {
			return;
		}
		applyLayerSettings(map, layerSettings, useUsUnits, showMyLocation);
	}

	function setLayerSettings(settings: LayerSettings): void {
		if (settings !== layerSettings) {
			replaceObject(layerSettings, settings);
		}
		runLayerSettings();
	}

	function schedule(callback: () => void, delay: number): void {
		const timeout = window.setTimeout(() => {
			timeouts.delete(timeout);
			callback();
		}, delay);
		timeouts.add(timeout);
	}

	function subscribeToRuntimeState(): void {
		subscriptions.push(
			darkMode.subscribe((value) => {
				currentDarkMode = value;
				if (map && loaded) {
					applySky(map, value);
					applyTopography(map, get(show_topo_global_store), value);
					switch_orm_layers(map, get(current_orm_layer_type_store), value);
				}
			}),
			usunits_store.subscribe((value) => {
				useUsUnits = value;
				if (loaded) runLayerSettings();
			}),
			show_my_location_store.subscribe((value) => {
				showMyLocation = value;
				if (loaded) runLayerSettings();
			}),
			additional_filter_for_vehicles_store.subscribe(() => {
				if (loaded) runLayerSettings();
			}),
			current_orm_layer_type_store.subscribe((value) => {
				if (map && loaded) {
					switch_orm_layers(map, value, currentDarkMode);
				}
			}),
			show_topo_global_store.subscribe((value) => {
				if (map && loaded) {
					applyTopography(map, value, currentDarkMode);
				}
			})
		);
	}

	function configureResolutionListener(currentMap: maplibregl.Map): void {
		resolutionMedia = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
		resolutionListener = () => currentMap.setPixelRatio(getOptimalPixelRatio());
		resolutionMedia.addEventListener('change', resolutionListener);
	}

	function addMarkedPoint(currentMap: maplibregl.Map, searchParams: URLSearchParams): void {
		const point = getMarkedPoint(searchParams);
		if (point) {
			new maplibregl.Marker().setLngLat(point).addTo(currentMap);
		}
	}

	function configureMapLoad(currentMap: maplibregl.Map): void {
		currentMap.on('load', async () => {
			loaded = true;
			checkClockSync();
			deep_link_url_reader();
			add_image_pedestrian_pattern(currentMap);

			currentMap.setProjection({ type: 'globe' });
			applySky(currentMap, currentDarkMode);
			addTerrainSourcesAndLayers(currentMap, currentDarkMode);
			applyTopography(currentMap, get(show_topo_global_store), currentDarkMode);

			await addOpenRailwayMapSources(currentMap);
			if (map === currentMap) {
				switch_orm_layers(
					currentMap,
					get(current_orm_layer_type_store),
					currentDarkMode
				);
			}

			schedule(runLayerSettings, 0);
			schedule(runLayerSettings, 1000);
			startSantaTracking(currentMap);
		});
	}

	function configureMapEvents(currentMap: maplibregl.Map): void {
		currentMap.on('move', () => {
			heading.set(currentMap.getBearing());
			lock_on_gps_store.set(false);
		});

		currentMap.on('touchmove', () => {
			lastNorthResetAt = 0;
		});
		currentMap.on('mousemove', () => {
			lastNorthResetAt = 0;
		});
		currentMap.on('webglcontextlost', () => {
			console.warn('Map WebGL context was lost; waiting for MapLibre to restore it.');
		});
		currentMap.on('webglcontextrestored', () => {
			console.info('Map WebGL context was restored.');
		});
	}

	function start(container: HTMLElement): void {
		if (started) {
			return;
		}
		started = true;
		currentDarkMode = get(darkMode);
		useUsUnits = get(usunits_store);
		showMyLocation = get(show_my_location_store);
		replaceObject(layerSettings, loadLayerSettings());

		const searchParams = new URLSearchParams(window.location.search);
		desktopApp.set(searchParams.get('desktop') === 'true');
		configureWorkers();

		const desynchronized = !(
			navigator.userAgent.match(/Chrome\/\d+/) !== null && isChromiumDesktop()
		);
		const isLowSpec = getOptimalPixelRatio() === 1;

		map = new maplibregl.Map({
			canvasContextAttributes: {
				antialias: !isLowSpec,
				powerPreference: 'high-performance',
				desynchronized
			},
			container,
			localIdeographFontFamily: false,
			light: { anchor: 'viewport', color: 'white', intensity: 0.4 },
			hash: 'map',
			pixelRatio: getOptimalPixelRatio(),
			maxPitch: window.innerHeight / window.innerWidth > 1.5 ? 60 : 85,
			validateStyle: true,
			fadeDuration: 100,
			style: getMapStyle(searchParams, currentDarkMode),
			center: getInitialCenter(),
			zoom: 10
		} as any);

		const currentMap = map;
		map_pointer_store.set(currentMap);
		subscribeToRuntimeState();
		configureResolutionListener(currentMap);
		configureMapLoad(currentMap);
		configureMapEvents(currentMap);
		addMarkedPoint(currentMap, searchParams);

		if (searchParams.has('tilebounds')) {
			currentMap.showTileBoundaries = true;
		}

		if (!rtlPluginConfigured) {
			maplibregl.setRTLTextPlugin('/mapbox-gl-rtl-text.min.js', true);
			rtlPluginConfigured = true;
		}

		void fetchChateaus(currentMap);
		void updateCenterFromIp(currentMap);

		void setupMap(
			currentMap,
			runLayerSettings,
			currentDarkMode,
			layerspercategory,
			chateausInFrame,
			layerSettings,
			dependencies.recomputeSidebarPadding,
			dependencies.openSidebar
		).catch((error) => {
			console.error('Unable to finish map feature setup.', error);
		});
	}

	function destroy(): void {
		if (!started) {
			return;
		}
		started = false;
		loaded = false;

		for (const unsubscribe of subscriptions.splice(0)) {
			unsubscribe();
		}
		for (const timeout of timeouts) {
			window.clearTimeout(timeout);
		}
		timeouts.clear();

		if (resolutionMedia && resolutionListener) {
			resolutionMedia.removeEventListener('change', resolutionListener);
		}
		resolutionMedia = null;
		resolutionListener = null;

		const oldMap = map;
		map = null;
		map_pointer_store.set(null);
		oldMap?.remove();
	}

	function resetNorth(): void {
		if (!map) {
			return;
		}
		lastNorthResetAt = performance.now();
		map.resetNorth();
	}

	function focusUserLocation(): void {
		const geolocation = get(geolocation_store);
		if (!map || !geolocation) {
			return;
		}

		lock_on_gps_store.set(true);
		map.flyTo({
			center: [geolocation.coords.longitude, geolocation.coords.latitude],
			zoom: 14.5,
			bearing: lastNorthResetAt > performance.now() - 6000 ? 0 : undefined,
			essential: true
		});
	}

	return {
		heading: { subscribe: heading.subscribe },
		layerSettingsOpen,
		layerSettings,
		desktopApp: { subscribe: desktopApp.subscribe },
		start,
		destroy,
		getMap,
		resetNorth,
		focusUserLocation,
		applyLayerSettings: runLayerSettings,
		setLayerSettings
	};
}
