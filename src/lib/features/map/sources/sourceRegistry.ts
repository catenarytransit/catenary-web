import type maplibregl from 'maplibre-gl';

const VECTOR_SOURCES = [
	{ id: 'intercityrailshapes', url: 'https://birch1.catenarymaps.org/shapes_intercity_rail' },
	{ id: 'localcityrailshapes', url: 'https://birch2.catenarymaps.org/shapes_local_rail' },
	{ id: 'othershapes', url: 'https://birch3.catenarymaps.org/shapes_ferry' },
	{ id: 'busshapes', url: 'https://birch4.catenarymaps.org/shapes_bus' },
	{ id: 'busstops', url: 'https://birch6.catenarymaps.org/busstops' },
	{ id: 'stationfeatures', url: 'https://birch7.catenarymaps.org/station_features' },
	{ id: 'railstops', url: 'https://birch5.catenarymaps.org/unmatched_railstops' },
	{ id: 'otherstops', url: 'https://birch8.catenarymaps.org/otherstops' },
	{ id: 'osmstations', url: 'https://birch.catenarymaps.org/osm_stations' },
	{ id: 'osmstationsranked', url: 'https://birch.catenarymaps.org/osm_stations_ranked' }
] as const;

const REALTIME_SOURCES = ['buses', 'localrail', 'intercityrail', 'other'] as const;
const TRAJECTORY_SOURCES = [
	'trajectory_buses',
	'trajectory_localrail',
	'trajectory_intercityrail',
	'trajectory_other'
] as const;

type GeoJsonData = maplibregl.GeoJSONSourceSpecification['data'];

const emptyFeatureCollection: GeoJsonData = {
	type: 'FeatureCollection',
	features: []
};

function addGeoJsonSource(
	map: maplibregl.Map,
	id: string,
	data: GeoJsonData
): void {
	if (!map.getSource(id)) {
		map.addSource(id, { type: 'geojson', data });
	}
}

export async function addApplicationSources(
	map: maplibregl.Map,
	chateauData: GeoJsonData | null
): Promise<void> {
	addGeoJsonSource(map, 'motis_results', emptyFeatureCollection);
	addGeoJsonSource(map, 'chateaus', chateauData ?? emptyFeatureCollection);

	for (const { id, url } of VECTOR_SOURCES) {
		if (!map.getSource(id)) {
			map.addSource(id, { type: 'vector', url });
		}
	}

	for (const id of [...REALTIME_SOURCES, ...TRAJECTORY_SOURCES]) {
		addGeoJsonSource(map, id, emptyFeatureCollection);
	}

	let searchimage = await map.loadImage('/icons/search_option.png');
	map.addImage('searchimage', searchimage.data);

	if (!map.getLayer('motis_results_symbol')) {
		map.addLayer({
			id: 'motis_results_symbol',
			type: 'symbol',
			source: 'motis_results',
			layout: {
				'icon-image': 'searchimage',
				'icon-size': 0.2,
				'icon-allow-overlap': true,
				'icon-ignore-placement': true,
				'text-field': ['get', 'name'],
				'text-font': ['Arimo-Medium'],
				'text-size': 12,
				'text-offset': [0, 1.5],
			},
			paint: { 'icon-opacity': 0.9 }
		});
	}

	if (!map.getLayer('chateaus_calc')) {
		map.addLayer({
			id: 'chateaus_calc',
			type: 'fill',
			source: 'chateaus',
			paint: {
				'fill-color': '#ffffff',
				'fill-opacity': 0
			}
		});
	}
}
