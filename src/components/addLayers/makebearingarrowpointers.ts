import * as maplibregl from 'maplibre-gl';

const geobearingiconsize = [
	'interpolate',
	['linear'],
	['zoom'],
	6,
	0.12,
	8,
	0.15,
	9,
	0.18,
	11,
	0.22,
	12,
	0.3,
	15,
	0.5
];

const geobearingoffset = [
	'interpolate',
	['linear'],
	['zoom'],
	9,
	['literal', [0, -80]],
	13,
	['literal', [0, -60]],
	15,
	['literal', [0, -60]],
	17,
	['literal', [0, -50]]
];

export async function makeBearingArrowPointers(
	map: maplibregl.Map,
	darkMode: boolean,
	layerspercategory: any
) {
	// const busbearingiconsize = ['interpolate', ['linear'], ['zoom'], 9, 0.18, 10.5, 0.25, 12, 0.47, 15, 1];

	//USER LOCATION

	map.addLayer({
		id: 'geolocationheadingfill',
		source: 'geolocation',
		type: 'symbol',
		paint: {
			'icon-color': '#2563EB',
			'icon-opacity': 0.8
		},
		filter: ['==', true, ['get', 'has_bearing']],
		layout: {
			'icon-image': 'pointingcoloured',
			'icon-allow-overlap': true,
			'icon-ignore-placement': true,
			'icon-rotate': ['get', 'heading'],
			'icon-rotation-alignment': 'map',
			'icon-offset': geobearingoffset,
			'icon-size': geobearingiconsize
		}
	});

	//usergeo

	map.addLayer({
		id: 'geolocationheadingshell',
		source: 'geolocation',
		type: 'symbol',
		filter: ['==', true, ['get', 'has_bearing']],
		paint: {
			'icon-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.3, 11.5, 0.8]
		},
		layout: {
			'icon-image': darkMode == true ? 'pointingshell' : 'pointingshelllight',
			'icon-allow-overlap': true,
			'icon-ignore-placement': true,
			'icon-rotate': ['get', 'heading'],
			'icon-rotation-alignment': 'map',
			'icon-offset': geobearingoffset,
			'icon-size': geobearingiconsize
		}
	});
}
