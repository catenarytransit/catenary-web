import type maplibregl from 'maplibre-gl';

export function addStationEntranceLayers(
	map: maplibregl.Map,
	layersByCategory: Record<string, any>,
	darkMode: boolean,
	minZoom = 16
): void {
	const beforeLayer = layersByCategory.bus?.stops;

	try {
		if (!map.getLayer('stationenter')) {
			map.addLayer(
				{
					id: 'stationenter',
					type: 'symbol',
					source: 'stationfeatures',
					filter: ['all', ['==', 2, ['get', 'location_type']]],
					'source-layer': 'data',
					layout: {
						'icon-image': 'station-enter',
						'icon-size': [
							'interpolate',
							['linear'],
							['zoom'],
							14,
							0.2,
							15,
							0.2,
							16,
							0.25,
							18,
							0.4
						],
						'icon-ignore-placement': false,
						'icon-allow-overlap': true
					},
					minzoom: minZoom
				},
				beforeLayer
			);
		}

		if (!map.getLayer('stationenterlabel')) {
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
				beforeLayer
			);
		}
	} catch (error) {
		console.error('Unable to add station entrance layers.', error);
	}
}
