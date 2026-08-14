import {
	ui_theme_store,
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
	show_gtfs_ids_store
} from '../globalstores';
import { changeContextTheme } from './addLayers/contextLayer';
import { add_image_pedestrian_pattern } from './pedestrian_layer';
import { changeStopsTheme } from './addLayers/addStops';
import { changeLiveDotsTheme } from './addLayers/addLiveDots';
import { get } from 'svelte/store';

export function refreshUIMaplibre() {
	const map = get(map_pointer_store);
	if (!map) return;

	add_image_pedestrian_pattern(map);

	let darkMode = false;
	if (get(ui_theme_store) === 'system') {
		darkMode = window?.matchMedia?.('(prefers-color-scheme:dark)')?.matches ?? false;
	} else {
		darkMode = get(ui_theme_store) === 'dark';
	}

	const currentLayers = map.getStyle().layers ?? [];
	const url = darkMode ? '/dark-style.json' : '/light-style.json';
	const oppositeUrl = darkMode ? '/light-style.json' : '/dark-style.json';

	Promise.all([
		fetch(url).then((response) => {
			if (!response.ok) throw new Error(`HTTP ${response.status} loading ${url}`);
			return response.json();
		}),
		fetch(oppositeUrl)
			.then((response) => {
				if (!response.ok) throw new Error(`HTTP ${response.status} loading ${oppositeUrl}`);
				return response.json();
			})
			.catch(() => ({ layers: [], sources: {} }))
	])
		.then(async ([data, oppositeData]) => {
			const targetLayers = (data.layers ?? []) as any[];
			const targetById: Record<string, any> = {};
			const oppositeLayerIds = new Set<string>();

			for (const layer of targetLayers) targetById[layer.id] = layer;
			for (const layer of oppositeData.layers ?? []) oppositeLayerIds.add(layer.id);

			// The light and dark style files can use different sprite resources.
			// Layer-only mutation cannot fully switch themes, so update the root
			// sprite through MapLibre's Style API when it is available.
			const styleApi = (map as any).style;
			if (data.sprite !== undefined && styleApi?.setSprite) {
				await new Promise<void>((resolve) => {
					styleApi.setSprite(data.sprite, {}, (error?: Error) => {
						if (error) console.warn('[theme transition] could not update sprite', error);
						resolve();
					});
				});
			}

			// Add target-style sources that were absent from the initially-loaded
			// base style. Runtime sources are deliberately left untouched.
			for (const [sourceId, sourceDefinition] of Object.entries(data.sources ?? {})) {
				if (!map.getSource(sourceId)) {
					try {
						map.addSource(sourceId, sourceDefinition as any);
					} catch (error) {
						console.warn(`[theme transition] could not add source ${sourceId}`, error);
					}
				}
			}

			for (const currentLayer of currentLayers) {
				const targetLayer = targetById[currentLayer.id];

				if (targetLayer) {
					const targetLayout = targetLayer.layout ?? {};
					const targetPaint = targetLayer.paint ?? {};

					for (const key of Object.keys(currentLayer.layout ?? {})) {
						if (!(key in targetLayout)) map.setLayoutProperty(currentLayer.id, key, null);
					}
					for (const key of Object.keys(currentLayer.paint ?? {})) {
						if (!(key in targetPaint)) map.setPaintProperty(currentLayer.id, key, null);
					}

					for (const [key, value] of Object.entries(targetLayout)) {
						map.setLayoutProperty(currentLayer.id, key, value as any);
					}
					for (const [key, value] of Object.entries(targetPaint)) {
						map.setPaintProperty(currentLayer.id, key, value as any);
					}
				} else if (oppositeLayerIds.has(currentLayer.id)) {
					// Runtime layers are absent from both base styles, so preserve them.
					map.setLayoutProperty(currentLayer.id, 'visibility', 'none');
				}
			}

			const runtimeLayerIds = currentLayers
				.map((layer) => layer.id)
				.filter((id) => !targetById[id] && !oppositeLayerIds.has(id));
			const firstRuntimeLayerId = runtimeLayerIds.find((id) => map.getLayer(id));

			// Add target-only layers in target-style order. Keep runtime transit
			// overlays above the basemap when the target's last base layers are new.
			for (let i = targetLayers.length - 1; i >= 0; i--) {
				const targetLayer = targetLayers[i];
				if (map.getLayer(targetLayer.id)) continue;

				let beforeId: string | undefined;
				for (let j = i + 1; j < targetLayers.length; j++) {
					if (map.getLayer(targetLayers[j].id)) {
						beforeId = targetLayers[j].id;
						break;
					}
				}
				if (!beforeId && firstRuntimeLayerId && map.getLayer(firstRuntimeLayerId)) {
					beforeId = firstRuntimeLayerId;
				}

				try {
					map.addLayer(targetLayer, beforeId);
				} catch (error) {
					console.warn(`[theme transition] could not add layer ${targetLayer.id}`, error);
				}
			}

			if (map.getLayer('pedestrian_area_pattern')) {
				map.setPaintProperty(
					'pedestrian_area_pattern',
					'fill-pattern',
					darkMode ? null : 'pattern-ped'
				);
			}
		})
		.catch((error) => {
			console.error('[theme transition] failed to load/apply style', error);
		})
		.finally(() => {
			// Re-theme runtime layers after the asynchronous base-style mutation.
			changeContextTheme(map, darkMode);
			changeLiveDotsTheme(map, darkMode);
			changeStopsTheme(map, darkMode);
		});
}
