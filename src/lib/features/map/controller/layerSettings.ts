import { get } from 'svelte/store';
import type maplibregl from 'maplibre-gl';
import { applyVehicleFilters } from '$components/filterState';
import { layerspercategory } from '$components/layernames';
import { interpretLabelsToCode } from '$components/rtLabelsToMapboxStyle';
import {
	bus_label_no_headsign,
	bus_label_with_headsign,
	trajectory_layerspercategory
} from '$components/addLayers/addLiveDots';
import { custom_icons_category_to_layer_id } from '$root/globalstores';

export const LAYER_SETTINGS_STORAGE_KEY = 'layersettingsv9';

export type LayerSettings = Record<string, any>;

export function createDefaultLayerSettings(): LayerSettings {
	return {
		bus: {
			visible: true,
			labelshapes: true,
			stops: true,
			shapes: true,
			stoplabels: true,
			showRoutesLabels: true,
			showStopNames: true,
			routesMinZoom: 11,
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
			showRoutesLabels: true,
			showStopNames: true,
			routesMinZoom: 5,
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
			showRoutesLabels: true,
			showStopNames: true,
			routesMinZoom: 3,
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
			showRoutesLabels: true,
			showStopNames: true,
			routesMinZoom: 3,
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
}

function migrateLayerSettings(settings: LayerSettings): LayerSettings {
	for (const category of ['bus', 'localrail', 'intercityrail', 'other']) {
		if (!settings[category]) {
			continue;
		}

		settings[category].showRoutesLabels ??= true;
		settings[category].showStopNames ??= true;
		settings[category].routesMinZoom ??=
			category === 'bus' ? 11 : category === 'localrail' ? 5 : 3;

		if (category === 'bus' && settings[category].routesMinZoom < 6) {
			settings[category].routesMinZoom = 6;
		}
	}

	return settings;
}

export function loadLayerSettings(): LayerSettings {
	const rawSettings = localStorage.getItem(LAYER_SETTINGS_STORAGE_KEY);
	if (!rawSettings) {
		return createDefaultLayerSettings();
	}

	try {
		return migrateLayerSettings(JSON.parse(rawSettings));
	} catch (error) {
		console.warn('Ignoring invalid saved layer settings.', error);
		return createDefaultLayerSettings();
	}
}

function setVisibility(
	map: maplibregl.Map,
	layerId: string | undefined,
	visible: boolean
): void {
	if (layerId && map.getLayer(layerId)) {
		map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
	}
}

function setTextField(
	map: maplibregl.Map,
	layerId: string | undefined,
	textField: unknown
): void {
	if (layerId && map.getLayer(layerId)) {
		map.setLayoutProperty(layerId, 'text-field', textField as any);
	}
}

function applyCategorySettings(
	map: maplibregl.Map,
	category: string,
	categoryLayers: Record<string, any>,
	settings: Record<string, any>,
	useUsUnits: boolean
): void {
	setVisibility(map, categoryLayers.shapes, settings.shapes);
	setVisibility(map, categoryLayers.labelshapes, settings.labelshapes);
	setVisibility(map, categoryLayers.stops, settings.stops);
	setVisibility(map, categoryLayers.labelstops, settings.stoplabels);
	setVisibility(map, categoryLayers.osmstops, settings.stops);
	setVisibility(map, categoryLayers.osmlabelstops, settings.stoplabels);

	const minZoom =
		settings.routesMinZoom ??
		(category === 'bus'
			? 11
			: category === 'metro' || category === 'tram' || category === 'localrail'
				? 5
				: 3);

	for (const layerId of [categoryLayers.shapes, categoryLayers.labelshapes]) {
		if (layerId && map.getLayer(layerId)) {
			map.setLayerZoomRange(layerId, minZoom, 24);
		}
	}

	if (category === 'other') {
		setVisibility(map, 'ferryshapes', settings.shapes);
		if (map.getLayer('ferryshapes')) {
			map.setLayerZoomRange('ferryshapes', minZoom, 24);
		}
	}

	if (category === 'intercityrail') {
		for (let rank = 1; rank <= 6; rank += 1) {
			setVisibility(map, `intercityrail-ranked-${rank}`, settings.stops);
			setVisibility(map, `intercityrail-ranked-label-${rank}`, settings.stoplabels);
		}
	}

	for (const layerId of [
		categoryLayers.pointing,
		categoryLayers.pointingshell,
		categoryLayers.labeldots,
		categoryLayers.livedots
	]) {
		setVisibility(map, layerId, settings.visible);
	}

	if (categoryLayers.labeldots === layerspercategory.bus.labeldots && map.getLayer(categoryLayers.labeldots)) {
		if (settings.label.headsign) {
			map.setLayoutProperty(categoryLayers.labeldots, 'text-size', bus_label_with_headsign);
			const shortestSide = Math.min(window.innerWidth, window.innerHeight);
			map.setLayoutProperty(categoryLayers.labeldots, 'text-font', {
				stops:
					shortestSide >= 1600
						? [
							[6, ['Arimo-Medium']],
							[12, ['Arimo-SemiBold']]
						]
						: [
							[6, ['Arimo-Regular']],
							[14.5, ['Arimo-Medium']]
						]
			});
		} else {
			map.setLayoutProperty(categoryLayers.labeldots, 'text-size', bus_label_no_headsign);
			map.setLayoutProperty(categoryLayers.labeldots, 'text-font', {
				stops: [
					[6, ['Arimo-Medium']],
					[11, ['Arimo-SemiBold']]
				]
			});
		}
	}

	const textField = interpretLabelsToCode(settings.label, useUsUnits);
	setTextField(map, categoryLayers.labeldots, textField);

	const trajectoryLayers = (trajectory_layerspercategory as Record<string, any>)[category];
	setTextField(map, trajectoryLayers?.labeldots, textField);

	const contextLabelByCategory: Record<string, string> = {
		bus: 'livedots_context_bus_major_label',
		tram: 'livedots_context_tram_major_label',
		metro: 'livedots_context_metro_major_label',
		train: 'livedots_context_train_major_label'
	};
	setTextField(map, contextLabelByCategory[category], textField);

	applyVehicleFilters(categoryLayers);
}

function applyFoamerLayers(map: maplibregl.Map, settings: LayerSettings): void {
	const foamerSettings = settings.more?.foamermode;
	if (!foamerSettings) {
		return;
	}

	setVisibility(map, 'foamershapes', foamerSettings.infra);
	setVisibility(map, 'maxspeedshapes', foamerSettings.maxspeed);
	setVisibility(map, 'signallingshapes', foamerSettings.signalling);
	setVisibility(map, 'electrificationshapes', foamerSettings.electrification);
	setVisibility(map, 'gaugeshapes', foamerSettings.gauge);
}

export function applyLayerSettings(
	map: maplibregl.Map,
	settings: LayerSettings,
	useUsUnits: boolean,
	showMyLocation: boolean
): void {
	for (const layerId of [
		'nobearing_position',
		'geolocationheadingshell',
		'km_text',
		'km_line',
		'userpositionacclayer'
	]) {
		setVisibility(map, layerId, showMyLocation);
	}

	applyFoamerLayers(map, settings);

	for (const [category, categoryLayers] of Object.entries(layerspercategory)) {
		const categorySettings =
			category === 'metro' || category === 'tram' ? settings.localrail : settings[category];
		if (categorySettings) {
			applyCategorySettings(map, category, categoryLayers, categorySettings, useUsUnits);
		}
	}

	for (const [category, layerIds] of Object.entries(
		get(custom_icons_category_to_layer_id) as Record<string, string[]>
	)) {
		const visible = settings[category]?.visible ?? true;
		for (const layerId of layerIds) {
			setVisibility(map, layerId, visible);
		}
	}

	localStorage.setItem(LAYER_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
