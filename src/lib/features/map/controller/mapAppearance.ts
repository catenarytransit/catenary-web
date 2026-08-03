import mlcontour from 'maplibre-contour';
import maplibregl from 'maplibre-gl';

export function applySky(map: maplibregl.Map, darkMode: boolean): void {
	const sky = darkMode
		? {
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
			}
		: {
				'sky-color': '#199EF3',
				'sky-horizon-blend': 1,
				'horizon-color': '#ffffff',
				'horizon-fog-blend': 1,
				'fog-color': '#0000ff',
				'fog-ground-blend': 1,
				'atmosphere-blend': [
					'interpolate',
					['linear'],
					['zoom'],
					0,
					0,
					10,
					0.1,
					12,
					0
				]
			};

	map.setSky(sky as any);
}

export function addTerrainSourcesAndLayers(map: maplibregl.Map, darkMode: boolean): void {
	const demSource = new mlcontour.DemSource({
		url: 'https://birchtiles123.catenarymaps.org/maptiler_terrain_tiles_proxy/{z}/{x}/{y}.webp',
		encoding: 'mapbox',
		cacheSize: 2048,
		maxzoom: 14,
		worker: true
	});

	demSource.setupMaplibre(maplibregl);

	if (!map.getSource('dem')) {
		map.addSource('dem', {
			type: 'raster-dem',
			tiles: [demSource.sharedDemProtocolUrl],
			tileSize: 256
		});
	}

	if (!map.getSource('contour-source')) {
		map.addSource('contour-source', {
			type: 'vector',
			tiles: [
				demSource.contourProtocolUrl({
					thresholds: {
						11: [100, 500],
						12: [50, 250],
						14: [20, 100],
						15: [10, 50]
					},
					contourLayer: 'contours',
					elevationKey: 'ele',
					levelKey: 'level',
					extent: 4096,
					buffer: 1
				})
			],
			maxzoom: 15
		});
	}

	const beforeLayer = map.getLayer('waterway_tunnel') ? 'waterway_tunnel' : undefined;

	if (!map.getLayer('hillshade')) {
		map.addLayer(
			{
				id: 'hillshade',
				type: 'hillshade',
				source: 'dem',
				paint: {
					'hillshade-shadow-color': darkMode
						? 'hsla(202, 37%, 0%, 30%)'
						: 'hsla(202, 37%, 20%, 60%)',
					'hillshade-highlight-color': darkMode
						? 'hsla(203, 35%, 53%, 21%)'
						: '#ffffff33',
					'hillshade-accent-color': darkMode
						? 'hsla(203, 39%, 50%, 20%)'
						: '#ffffff77',
					'hillshade-exaggeration': 1
				},
				layout: { visibility: 'none' }
			},
			beforeLayer
		);
	}

	if (!map.getLayer('contours-layer')) {
		map.addLayer(
			{
				id: 'contours-layer',
				type: 'line',
				source: 'contour-source',
				'source-layer': 'contours',
				paint: {
					'line-color': darkMode ? 'rgba(140, 140, 128, 30%)' : 'rgba(0,0,0, 30%)',
					'line-width': ['match', ['get', 'level'], 1, 1.3, 0.3]
				},
				layout: { visibility: 'none' }
			},
			beforeLayer
		);
	}

	if (!map.getLayer('contour-labels')) {
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
					'text-font': ['Arimo-Bold'],
					'text-pitch-alignment': 'viewport',
					visibility: 'none'
				},
				paint: {
					'text-halo-color': darkMode ? 'black' : 'white',
					'text-halo-width': 1,
					'text-color': darkMode ? 'white' : 'black'
				}
			},
			beforeLayer
		);
	}
}

function setLayerVisibility(map: maplibregl.Map, layerId: string, visible: boolean): void {
	if (map.getLayer(layerId)) {
		map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
	}
}

export function applyTopography(map: maplibregl.Map, enabled: boolean, darkMode: boolean): void {
	setLayerVisibility(map, 'contour-labels', enabled);
	setLayerVisibility(map, 'contours-layer', enabled);
	setLayerVisibility(map, 'hillshade', false);

	if (enabled) {
		if (map.getLayer('terrainpolygons')) {
			map.setPaintProperty('terrainpolygons', 'fill-opacity', 1);
			if (!darkMode) {
				map.setPaintProperty('terrainpolygons', 'fill-color', [
					'match',
					['get', 'class'],
					['shadow'],
					[
						'interpolate',
						['linear'],
						['get', 'level'],
						56,
						'hsla(0, 0%, 0%, 0.05)',
						75,
						'hsla(187, 0%, 12%, 0.05)'
					],
					['highlight'],
					[
						'interpolate',
						['linear'],
						['get', 'level'],
						56,
						'hsla(251, 0%, 84%, 0.4)',
						94,
						'hsla(251, 0%, 100%, 0.04)'
					],
					'#000000'
				]);
			}
		}
		map.setTerrain({ source: 'dem', exaggeration: 1 });
		return;
	}

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
				'match',
				['get', 'class'],
				['shadow'],
				[
					'interpolate',
					['linear'],
					['get', 'level'],
					56,
					'hsla(0, 0%, 0%, 0.005)',
					75,
					'hsla(187, 0%, 12%, 0.01)'
				],
				['highlight'],
				[
					'interpolate',
					['linear'],
					['get', 'level'],
					56,
					'hsla(251, 0%, 84%, 0.1)',
					94,
					'hsla(251, 0%, 100%, 0.01)'
				],
				'#000000'
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
