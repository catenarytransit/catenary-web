import type { Map } from 'maplibre-gl';
import { get } from 'svelte/store';
import { livedotscaling_store } from '../../fontscalingstores';
import { map_pointer_store, ui_font_store } from '../../globalstores';
import { layerspercategory as layerspercategory_main } from '../layernames';

export function textColorOfMapLabels(darkMode: boolean) {
	return ['get', darkMode === true ? 'contrastdarkmode' : 'contrastlightmode'];
}

export function changeLiveDotsTheme(map: Map, darkMode: boolean) {
	const layers = ['bus', 'other', 'tram', 'metro', 'intercityrail'];

	const layerspercategory = {
		bus: {
			livedots: 'bus',
			labeldots: 'labelbuses',
			pointingshell: 'busespointingshell'
		},
		intercityrail: {
			livedots: 'intercityrail',
			labeldots: 'labelintercityrail',
			pointingshell: 'intercityrailpointingshell'
		},
		metro: {
			livedots: 'metro',
			labeldots: 'labelmetro',
			pointingshell: 'metropointingshell'
		},
		tram: {
			livedots: 'tram',
			labeldots: 'labeltram',
			pointingshell: 'trampointingshell'
		},
		other: {
			livedots: 'other',
			labeldots: 'labelother',
			pointingshell: 'otherpointingshell'
		}
	};

	for (const category of layers) {
		map.setPaintProperty(
			layerspercategory[category].livedots,
			'circle-stroke-color',
			darkMode ? '#222222' : '#dddddd'
		);
		map.setLayoutProperty(
			layerspercategory[category].pointingshell,
			'icon-image',
			darkMode ? 'pointingshell' : 'pointingshelllight'
		);
		map.setPaintProperty(
			layerspercategory[category].labeldots,
			'text-color',
			textColorOfMapLabels(darkMode)
		);
		map.setPaintProperty(
			layerspercategory[category].labeldots,
			'text-halo-color',
			darkMode ? '#1d1d1d' : '#ededed'
		);
	}

	map.setPaintProperty(
		layerspercategory.intercityrail.livedots,
		'circle-stroke-color',
		darkMode ? ['step', ['zoom'], '#eeeeee', 6, '#ffffff'] : '#3a3a3a'
	);
}

export const bus_label_no_headsign = [
	'interpolate',
	['linear'],
	['zoom'],
	9,
	5,
	11,
	7,
	13,
	10,
	15,
	13
];
export const bus_label_with_headsign = [
	'interpolate',
	['linear'],
	['zoom'],
	9,
	4,
	11,
	5,
	13,
	9,
	15,
	11
];

const bus_label_text_size = ['interpolate', ['linear'], ['zoom'], 9, 5, 11, 7, 13, 10, 15, 13];
const other_label_text_size = ['interpolate', ['linear'], ['zoom'], 9, 8.5, 11, 13, 13, 16];
const tram_label_text_size = [
	'interpolate',
	['linear'],
	['zoom'],
	6,
	4,
	9,
	6,
	10,
	7,
	11,
	9,
	13,
	10,
	15,
	14
];
const metro_label_text_size = [
	'interpolate',
	['linear'],
	['zoom'],
	6,
	5,
	9,
	7,
	10,
	9,
	11,
	11,
	13,
	12
];
const intercityrail_label_text_size = [
	'interpolate',
	['linear'],
	['zoom'],
	6,
	8,
	9,
	8,
	11,
	14,
	13,
	15
];

const original_text_sizes = {
	bus: bus_label_text_size,
	other: other_label_text_size,
	tram: tram_label_text_size,
	metro: metro_label_text_size,
	intercityrail: intercityrail_label_text_size
};

function scaleInterpolationArray(arr: any[], scale: number) {
	const newArr = [...arr];
	for (let i = 3; i < newArr.length; i += 2) {
		if (typeof newArr[i + 1] === 'number') {
			newArr[i + 1] = arr[i + 1] * scale;
		}
	}
	return newArr;
}

export function setupLiveDotScaling() {
	livedotscaling_store.subscribe((scale) => {
		const map = get(map_pointer_store);
		if (!map || !map.isStyleLoaded()) return;

		const categories = ['bus', 'other', 'tram', 'metro', 'intercityrail'];

		for (const category of categories) {
			const layerId = layerspercategory_main[category]?.labeldots;
			if (layerId && map.getLayer(layerId)) {
				const originalSize = original_text_sizes[category];
				const newSize = scaleInterpolationArray(originalSize, scale as number);
				map.setLayoutProperty(layerId, 'text-size', newSize);
			}
		}
	});
}

export async function makeCircleLayers(map: Map, darkMode: boolean, layerspercategory: any) {
	const busbearingoffset = [
		'interpolate',
		['linear'],
		['zoom'],
		9,
		['literal', [0, -50]],
		10,
		['literal', [0, -45]],
		12,
		['literal', [0, -45]],
		13,
		['literal', [0, -50]],
		15,
		['literal', [0, -48]]
	];

	const busbearingsize = ['interpolate', ['linear'], ['zoom'], 8, 0.1, 9, 0.13, 12, 0.19, 15, 0.3];

	const railbearingiconsize = [
		'interpolate',
		['linear'],
		['zoom'],
		4,
		0.1,
		6,
		0.1,
		8,
		0.15,
		9,
		0.18,
		11,
		0.2,
		12,
		0.25,
		15,
		0.5
	];

	const railbearingoffset = [
		'interpolate',
		['linear'],
		['zoom'],
		9,
		['literal', [0, -80]],
		13,
		['literal', [0, -60]],
		15,
		['literal', [0, -60]]
	];

	const trambearingiconsize = [
		'interpolate',
		['linear'],
		['zoom'],
		6,
		0.09,
		8,
		0.11,
		9,
		0.14,
		11,
		0.15,
		12,
		0.3,
		15,
		0.4
	];

	const trambearingoffset = [
		'interpolate',
		['linear'],
		['zoom'],
		9,
		['literal', [0, -80]],
		13,
		['literal', [0, -45]],
		15,
		['literal', [0, -50]]
	];

	const [pointing_shell_light_image, pointing_filled_image, pointing_shell_image] =
		await Promise.all([
			map.loadImage('/icons/pointing-shell-light.png'),
			map.loadImage('/icons/pointing-filled.png'),
			map.loadImage('/icons/pointing-shell.png')
		]);

	map.addImage('pointingshelllight', pointing_shell_light_image.data);
	map.addImage('pointingcoloured', pointing_filled_image.data, { sdf: true });
	map.addImage('pointingshell', pointing_shell_image.data);

	console.log('shells loaded');

	let shortest_screen_width = Math.min(window.screen.width, window.screen.height);

	map.addLayer({
		id: layerspercategory.bus.livedots,
		type: 'circle',
		source: 'buses',
		paint: {
			'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 1.2, 8, 1.6, 9, 1.7, 10, 2, 16, 6],
			'circle-color': ['get', 'color'],
			'circle-stroke-color': darkMode == true ? '#ffffff' : '#3a3a3a',
			'circle-stroke-opacity': [
				'interpolate',
				['linear'],
				['zoom'],
				7.9,
				0,
				8,
				0.3,
				9,
				0.5,
				13,
				0.9
			],
			'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 9, 0.3, 15, 0.6],
			//'circle-emissive-strength': 1,
			'circle-opacity': 0.5
		},
		minzoom: 8
	});

	map.addLayer({
		id: layerspercategory.bus.pointing,
		source: 'buses',
		type: 'symbol',
		filter: ['all', ['==', true, ['get', 'has_bearing']], ['!=', ['get', 'bearing'], 0]],
		paint: {
			'icon-color': ['get', 'contrastdarkmodebearing'],
			'icon-opacity': 0.4
		},
		layout: {
			'icon-image': 'pointingcoloured',
			'icon-allow-overlap': true,
			'icon-ignore-placement': true,
			'icon-rotate': ['get', 'bearing'],
			'icon-rotation-alignment': 'map',
			'icon-offset': busbearingoffset,
			'icon-size': busbearingsize
		},
		minzoom: 9.7
	});

	map.addLayer({
		id: layerspercategory.bus.pointingshell,
		source: 'buses',
		type: 'symbol',
		filter: ['all', ['==', true, ['get', 'has_bearing']], ['!=', ['get', 'bearing'], 0]],
		paint: {
			'icon-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.1, 10, 0.2, 12, 0.2, 15, 0.5]
		},
		layout: {
			'icon-image': darkMode == true ? 'pointingshell' : 'pointingshelllight',
			'icon-allow-overlap': true,
			'icon-ignore-placement': true,
			'icon-rotate': ['get', 'bearing'],
			'icon-rotation-alignment': 'map',
			'icon-offset': busbearingoffset,
			'icon-size': busbearingsize
		},
		minzoom: 9.7
	});

	map.addLayer({
		id: layerspercategory.bus.labeldots,
		type: 'symbol',
		source: 'buses',
		layout: {
			'text-field': ['get', 'maptag'],
			'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
			'text-radial-offset': 0.2,
			'text-font': {
				stops: [
					[6, get(ui_font_store).medium],
					[11, get(ui_font_store).semibold]
				]
			},
			'text-size': bus_label_text_size,
			'text-ignore-placement': ['step', ['zoom'], false, 12.5, true]
		},
		minzoom: 11,
		paint: {
			'text-color': textColorOfMapLabels(darkMode),
			//'text-color': ['get', 'color'],
			//'text-halo-color': '#ededed',
			'text-halo-color': darkMode == true ? '#1d1d1d' : '#ededed',
			'text-halo-width': darkMode == true ? 2.4 : 1,
			'text-halo-blur': 1,
			'text-opacity': ['interpolate', ['linear'], ['zoom'], 7.9, 0, 8, 0.9, 11, 0.95, 12, 1]
		}
	});

	//OTHER

	map.addLayer({
		id: layerspercategory.other.livedots,
		type: 'circle',
		source: 'other',
		minzoom: 2,
		paint: {
			'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 5, 10, 6, 16, 10],
			'circle-color': ['get', 'color'],
			'circle-stroke-color': darkMode == true ? '#ffffff' : '#3a3a3a',
			//'circle-emissive-strength': 1,
			'circle-stroke-width': 1,
			'circle-opacity': 0.5
		}
	});

	map.addLayer({
		id: layerspercategory.other.pointing,
		source: 'other',
		type: 'symbol',
		filter: ['all', ['==', true, ['get', 'has_bearing']], ['!=', ['get', 'bearing'], 0]],
		paint: {
			'icon-color': ['get', 'contrastdarkmodebearing'],
			'icon-opacity': 0.6
		},
		layout: {
			'icon-image': 'pointingcoloured',
			'icon-allow-overlap': true,
			'icon-ignore-placement': true,
			'icon-rotate': ['get', 'bearing'],
			'icon-rotation-alignment': 'map',
			'icon-offset': railbearingoffset,
			'icon-size': railbearingiconsize
		}
	});

	map.addLayer({
		id: layerspercategory.other.pointingshell,
		source: 'other',
		type: 'symbol',
		filter: [
			'all',
			['!=', ['get', 'route_type'], 0],
			['==', true, ['get', 'has_bearing']],
			['!=', ['get', 'bearing'], 0]
		],
		paint: {
			'icon-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.3, 11.5, 0.8]
		},
		layout: {
			'icon-image': darkMode == true ? 'pointingshell' : 'pointingshelllight',
			'icon-allow-overlap': true,
			'icon-ignore-placement': true,
			'icon-rotate': ['get', 'bearing'],
			'icon-rotation-alignment': 'map',
			'icon-offset': railbearingoffset,
			'icon-size': railbearingiconsize
		}
	});

	map.addLayer({
		id: layerspercategory.other.labeldots,
		type: 'symbol',
		source: 'other',
		minzoom: 2,
		layout: {
			'text-field': ['get', 'maptag'],
			/*'text-field': [
				"concat",
				['get', 'maptag'],
				" | ",
				['get', 'vehicleId']
			],*/
			'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
			'text-radial-offset': 0.2,
			'text-font': [
				'step',
				['zoom'],
				['literal', get(ui_font_store).regular],
				9,
				['literal', get(ui_font_store).bold]
			],
			'text-size': other_label_text_size,
			'text-ignore-placement': ['step', ['zoom'], false, 9.5, true]
		},
		paint: {
			'text-color': textColorOfMapLabels(darkMode),
			//'text-halo-color': '#ededed',
			'text-halo-color': darkMode == true ? '#1d1d1d' : '#ededed',
			'text-halo-width': 2.4,
			'text-halo-blur': 1,
			//'text-emissive-strength': 1,
			'text-opacity': ['interpolate', ['linear'], ['zoom'], 2, 0, 2.5, 0.8, 10, 1]
		}
	});

	//Trams

	map.addLayer({
		id: layerspercategory.tram.livedots,
		type: 'circle',
		source: 'localrail',
		minzoom: 4,
		filter: ['all', ['any', ['==', ['get', 'route_type'], 0], ['==', ['get', 'route_type'], 5]]],
		paint: {
			//['interpolate', ['linear'], ['zoom'], 6, 3, 8, 3, 10, 4, 11, 6, 16, 12],
			'circle-radius': [
				'interpolate',
				['linear'],
				['zoom'],
				6,
				1.8,
				8,
				2.3,
				10,
				4,
				11,
				4.5,
				13,
				6,
				15,
				6,
				16,
				10
			],
			'circle-color': ['get', 'color'],
			'circle-stroke-color': darkMode == true ? '#ffffff' : '#3a3a3a',
			'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 9, 0.6, 10, 1],
			//'circle-emissive-strength': 1,
			'circle-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.5, 9, 0.7]
		}
	});

	map.addLayer({
		id: layerspercategory.tram.pointing,
		source: 'localrail',
		type: 'symbol',
		filter: [
			'all',
			['any', ['==', ['get', 'route_type'], 0], ['==', ['get', 'route_type'], 5]],
			['==', true, ['get', 'has_bearing']],
			['!=', ['get', 'bearing'], 0]
		],
		paint: {
			'icon-color': ['get', 'contrastdarkmodebearing'],
			'icon-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.2, 9, 0.4, 11, 0.5, 13, 0.6]
		},
		layout: {
			'icon-image': 'pointingcoloured',
			'icon-allow-overlap': true,
			'icon-ignore-placement': true,
			'icon-rotate': ['get', 'bearing'],
			'icon-rotation-alignment': 'map',
			'icon-offset': trambearingoffset,
			'icon-size': trambearingiconsize
		},
		minzoom: 6
	});

	map.addLayer({
		id: layerspercategory.tram.pointingshell,
		source: 'localrail',
		type: 'symbol',
		filter: [
			'all',
			['any', ['==', ['get', 'route_type'], 0], ['==', ['get', 'route_type'], 5]],
			['==', true, ['get', 'has_bearing']],
			['!=', ['get', 'bearing'], 0]
		],
		paint: {
			'icon-opacity': [
				'interpolate',
				['linear'],
				['zoom'],
				6,
				0.1,
				9.8,
				0.3,
				11,
				0.3,
				11.5,
				0.4,
				12,
				0.5
			]
		},
		layout: {
			'icon-image': darkMode == true ? 'pointingshell' : 'pointingshelllight',
			'icon-allow-overlap': true,
			'icon-ignore-placement': true,
			'icon-rotate': ['get', 'bearing'],
			'icon-rotation-alignment': 'map',
			'icon-offset': trambearingoffset,
			'icon-size': trambearingiconsize
		},
		minzoom: 5.5
	});

	map.addLayer({
		id: layerspercategory.tram.labeldots,
		type: 'symbol',
		source: 'localrail',
		minzoom: 6,
		filter: ['all', ['any', ['==', ['get', 'route_type'], 0], ['==', ['get', 'route_type'], 5]]],
		layout: {
			'text-field': ['get', 'maptag'],
			/*'text-field': [
				"concat",
				['get', 'maptag'],
				" | ",
				['get', 'vehicleId']
			],*/
			'text-variable-anchor': ['top'],
			'text-radial-offset': 0,
			'text-font': ['literal', get(ui_font_store).medium],
			'text-size': tram_label_text_size,
			'text-ignore-placement': ['step', ['zoom'], false, 9.5, true]
		},
		paint: {
			'text-color': textColorOfMapLabels(darkMode),
			//'text-halo-color': '#ededed',
			'text-halo-color': darkMode == true ? '#1d1d1d' : '#ededed',
			'text-halo-width': 2.4,
			'text-halo-blur': 1,
			//'text-emissive-strength': 1,
			'text-opacity': ['interpolate', ['linear'], ['zoom'], 2, 0, 2.5, 0.8, 10, 1]
		}
	});

	//Metros

	map.addLayer({
		id: layerspercategory.metro.livedots,
		type: 'circle',
		source: 'localrail',
		minzoom: 4,
		filter: ['all', ['==', ['get', 'route_type'], 1]],
		paint: {
			'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 3, 8, 3, 10, 4, 11, 6, 16, 12],
			'circle-color': ['get', 'color'],
			'circle-stroke-color': darkMode == true ? '#ffffff' : '#3a3a3a',
			'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 10, 1.2],
			//'circle-emissive-strength': 1,
			'circle-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.5, 9, 0.7]
		}
	});

	map.addLayer({
		id: layerspercategory.metro.pointing,
		source: 'localrail',
		type: 'symbol',
		filter: [
			'all',
			['==', ['get', 'route_type'], 1],
			['!=', ['get', 'route_type'], 0],
			['==', true, ['get', 'has_bearing']],
			['!=', ['get', 'bearing'], 0]
		],
		paint: {
			'icon-color': ['get', 'contrastdarkmodebearing'],
			'icon-opacity': 0.6
		},
		layout: {
			'icon-image': 'pointingcoloured',
			'icon-allow-overlap': true,
			'icon-ignore-placement': true,
			'icon-rotate': ['get', 'bearing'],
			'icon-rotation-alignment': 'map',
			'icon-offset': railbearingoffset,
			'icon-size': railbearingiconsize
		},
		minzoom: 4.5
	});

	map.addLayer({
		id: layerspercategory.metro.pointingshell,
		source: 'localrail',
		type: 'symbol',
		filter: [
			'all',
			['==', ['get', 'route_type'], 1],
			['==', true, ['get', 'has_bearing']],
			['!=', ['get', 'bearing'], 0]
		],
		paint: {
			'icon-opacity': ['interpolate', ['linear'], ['zoom'], 9.8, 0.3, 11, 0.4, 11.5, 0.8]
		},
		layout: {
			'icon-image': darkMode == true ? 'pointingshell' : 'pointingshelllight',
			'icon-allow-overlap': true,
			'icon-ignore-placement': true,
			'icon-rotate': ['get', 'bearing'],
			'icon-rotation-alignment': 'map',
			'icon-offset': railbearingoffset,
			'icon-size': railbearingiconsize
		},
		minzoom: 4.5
	});

	map.addLayer({
		id: layerspercategory.metro.labeldots,
		type: 'symbol',
		source: 'localrail',
		minzoom: 6,
		filter: ['all', ['==', ['get', 'route_type'], 1]],
		layout: {
			'text-field': ['get', 'maptag'],
			/*'text-field': [
				"concat",
				['get', 'maptag'],
				" | ",
				['get', 'vehicleId']
			],*/
			'text-variable-anchor': ['top'],
			'text-radial-offset': 0,
			'text-font': ['literal', get(ui_font_store).medium],
			'text-size': metro_label_text_size,
			'text-ignore-placement': ['step', ['zoom'], false, 9.5, true]
		},
		paint: {
			'text-color': textColorOfMapLabels(darkMode),
			//'text-halo-color': '#ededed',
			'text-halo-color': darkMode == true ? '#1d1d1d' : '#ededed',
			'text-halo-width': 2.4,
			'text-halo-blur': 1,
			//'text-emissive-strength': 1,
			'text-opacity': ['interpolate', ['linear'], ['zoom'], 2, 0, 2.5, 0.8, 10, 1]
		}
	});

	//INTERCITY
	map.addLayer({
		id: layerspercategory.intercityrail.livedots,
		type: 'circle',
		source: 'intercityrail',
		minzoom: 1.2,
		paint: {
			'circle-radius': [
				'interpolate',
				['linear'],
				['zoom'],
				1,
				1,
				3,
				2.5,
				6,
				2.8,
				8,
				4,
				11,
				6,
				16,
				10
			],
			'circle-color': ['get', 'color'],
			'circle-stroke-color':
				darkMode == true ? ['step', ['zoom'], '#eeeeee', 6, '#ffffff'] : '#3a3a3a',
			'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 3, 0.6, 5, 0.7, 7, 0.8],
			//'circle-emissive-strength': 1,
			'circle-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.4, 7, 0.6, 11, 0.7]
		}
	});

	map.addLayer({
		id: layerspercategory.intercityrail.pointing,
		source: 'intercityrail',
		type: 'symbol',
		filter: ['all', ['==', true, ['get', 'has_bearing']], ['!=', ['get', 'bearing'], 0]],
		paint: {
			'icon-color': ['get', 'contrastdarkmodebearing'],
			'icon-opacity': 1
		},
		minzoom: 2,
		layout: {
			'icon-image': 'pointingcoloured',
			'icon-allow-overlap': true,
			'icon-ignore-placement': true,
			'icon-rotate': ['get', 'bearing'],
			'icon-rotation-alignment': 'map',
			'icon-offset': railbearingoffset,
			'icon-size': railbearingiconsize
		}
	});

	map.addLayer({
		id: layerspercategory.intercityrail.pointingshell,
		source: 'intercityrail',
		type: 'symbol',
		filter: ['all', ['==', true, ['get', 'has_bearing']], ['!=', ['get', 'bearing'], 0]],
		paint: {
			'icon-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.3, 11.5, 0.8]
		},
		minzoom: 2,
		layout: {
			'icon-image': darkMode == true ? 'pointingshell' : 'pointingshelllight',
			'icon-allow-overlap': true,
			'icon-ignore-placement': true,
			'icon-rotate': ['get', 'bearing'],
			'icon-rotation-alignment': 'map',
			'icon-offset': railbearingoffset,
			'icon-size': railbearingiconsize
		}
	});

	map.addLayer({
		id: layerspercategory.intercityrail.labeldots,
		type: 'symbol',
		source: 'intercityrail',
		minzoom: 3,
		layout: {
			'text-field': ['get', 'maptag'],
			/*'text-field': [
				"concat",
				['get', 'maptag'],
				" | ",
				['get', 'vehicleId']
			],*/
			'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
			'text-radial-offset': 0,
			'text-font': ['literal', get(ui_font_store).medium],
			'text-size': intercityrail_label_text_size,
			'text-ignore-placement': ['step', ['zoom'], false, 9.5, true]
		},
		paint: {
			'text-color': textColorOfMapLabels(darkMode),
			'text-halo-color': darkMode == true ? '#1d1d1d' : '#ededed',
			'text-halo-width': 2.4,
			'text-halo-blur': 1,
			//'text-emissive-strength': 1,
			'text-opacity': ['interpolate', ['linear'], ['zoom'], 2, 0, 2.5, 0.8, 10, 1]
		}
	});

	setupLiveDotScaling();
}
