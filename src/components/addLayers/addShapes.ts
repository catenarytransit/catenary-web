import { layerspercategory } from '../layernames';

export function addShapes(map: maplibregl.Map, darkMode: boolean) {
	const urlParams = new URLSearchParams(window.location.search);

	//BUS

	map.addLayer({
		id: layerspercategory.bus.shapes,
		type: 'line',
		source: 'busshapes',
		'source-layer': 'data',
		filter: [
			'all',
			[
				'!',
				[
					'all',
					['==', 'f-9mu-mts', ['get', 'onestop_feed_id']],
					['==', ['coalesce', ['get', 'route_label']], '950']
				]
			],
			[
				'!',
				[
					'all',
					['==', 'f-9mu-mts', ['get', 'onestop_feed_id']],
					['==', ['coalesce', ['get', 'route_label']], 'Old Town to Airport Shuttle']
				]
			],
			[
				'!',
				[
					'all',
					[
						'any',
						['==', 'autobús~interurbano~de~cataluña', ['get', 'chateau']],
						['==', 'flixbus~europe', ['get', 'chateau']],
						['==', 'f-ahverkehrsverbund~schleswig~holstein~nah', ['get', 'chateau']]
					],
					['==', true, ['get', 'stop_to_stop_generated']]
				]
			],
			['!=', ['get', 'onestop_feed_id'], 'f-u0-blablacar']
		],
		paint: {
			'line-color': ['concat', '#', ['get', 'color']],
			'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.4, 10, 0.7, 12, 1, 14, 1.2, 15, 1.5],
			'line-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.05, 11, 0.3, 14, 0.5]

			////'line-emissive-strength': 1
			//'line-opacity': ['interpolate', ['linear'], ['zoom'], 6.5, 0.5, 7.2, 0.5, 10, 0.5, 10, 0.5],
			// 'line-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.2, 10, 0.4]
		},
		minzoom: 8
	});

	map.addLayer({
		id: layerspercategory.bus.labelshapes,
		type: 'symbol',
		source: 'busshapes',
		'source-layer': 'data',
		filter: [
			'all',
			[
				'!',
				[
					'all',
					['==', 'f-9mu-mts', ['get', 'onestop_feed_id']],
					['==', ['coalesce', ['get', 'route_label']], '950']
				]
			],
			[
				'!',
				[
					'all',
					['==', 'f-9mu-mts', ['get', 'onestop_feed_id']],
					['==', ['coalesce', ['get', 'route_label']], 'Old Town to Airport Shuttle']
				]
			],
			[
				'!',
				[
					'all',
					[
						'any',
						['==', 'autobús~interurbano~de~cataluña', ['get', 'chateau']],
						['==', 'flixbus~europe', ['get', 'chateau']],
						['==', 'f-ahverkehrsverbund~schleswig~holstein~nah', ['get', 'chateau']]
					],
					['==', true, ['get', 'stop_to_stop_generated']]
				]
			],
			//   ['!=', ['get', 'onestop_feed_id'], 'f-9-flixbus'],
			['!=', ['get', 'onestop_feed_id'], 'f-u0-blablacar']
		],
		layout: {
			'symbol-placement': 'line',
			//'text-field': ['coalesce', ['get', 'route_label']],
			'text-field': urlParams.get('debug')
				? [
						'concat',
						['get', 'onestop_feed_id'],
						'|',
						['get', 'shape_id'],
						'|',
						['coalesce', ['get', 'route_label']]
					]
				: ['coalesce', ['get', 'route_label']],
			//'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
			'text-font': ['literal', ['Arimo-Regular']],
			'text-size': ['interpolate', ['linear'], ['zoom'], 10, 5, 11, 7, 13, 10],
			'text-ignore-placement': false,
			'text-allow-overlap': false,
			'text-pitch-alignment': 'viewport',
			'symbol-spacing':
				window?.innerWidth > 750
					? ['step', ['zoom'], 200, 12, 100, 13, 100, 15, 120, 20, 150]
					: ['step', ['zoom'], 200, 12, 80, 13, 100, 15, 100, 20, 150],
			visibility: 'none'
		},
		paint: {
			'text-color': ['concat', '#', ['get', 'text_color']],
			'text-halo-color': ['concat', '#', ['get', 'color']],
			'text-halo-width': 2,
			'text-halo-blur': 0
			//'line-emissive-strength': 1
		},
		minzoom: 11
	});

	//OTHER SHAPES
	map.addLayer({
		id: layerspercategory.other.shapes,
		type: 'line',
		source: 'othershapes',
		'source-layer': 'data',
		filter: [
			'all',
			[
				'!',
				[
					'all',
					['==', 'schweiz', ['get', 'chateau']],
					['==', true, ['get', 'stop_to_stop_generated']]
				]
			],
			['any', ['==', 6, ['get', 'route_type']], ['==', 7, ['get', 'route_type']]]
		],
		paint: {
			'line-color': ['concat', '#', ['get', 'color']],
			'line-width': ['interpolate', ['linear'], ['zoom'], 7, 2, 9, 3],
			'line-opacity': 1
			//'line-emissive-strength': 1
		},
		minzoom: 3
	});

	map.addLayer({
		id: layerspercategory.other.labelshapes,
		type: 'symbol',

		source: 'othershapes',
		'source-layer': 'data',
		filter: [
			'all',
			[
				'any',
				['==', 4, ['get', 'route_type']],
				['==', 6, ['get', 'route_type']],
				['==', 7, ['get', 'route_type']]
			],
			[
				'!',
				[
					'all',
					['==', 'schweiz', ['get', 'chateau']],
					['==', true, ['get', 'stop_to_stop_generated']]
				]
			]
		],
		layout: {
			'symbol-placement': 'line',
			'text-field': ['coalesce', ['get', 'route_label']],
			//'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
			'text-font': ['Arimo-Medium'],
			'text-size': ['interpolate', ['linear'], ['zoom'], 3, 7, 9, 9, 13, 11],
			'text-ignore-placement': false,

			'symbol-spacing': ['step', ['zoom'], 20, 6, 40, 9, 70, 13, 80, 15, 100],
			'text-allow-overlap': false,
			visibility: 'none'
		},
		paint: {
			'text-color': ['concat', '#', ['get', 'text_color']],
			'text-halo-color': ['concat', '#', ['get', 'color']],
			'text-halo-width': 2,
			'text-halo-blur': 1
			//'line-emissive-strength': 1
			//'text-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0, 3.5, 0.8, 4, 1]
		},
		minzoom: 3
	});

	map.addLayer({
		id: 'ferryshapes',
		type: 'line',
		source: 'othershapes',
		'source-layer': 'data',
		filter: ['all', ['==', 4, ['get', 'route_type']]],
		paint: {
			'line-dasharray': [1, 2],
			'line-color': ['concat', '#', ['get', 'color']],
			'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 7, 1, 10, 1.5, 14, 3],
			'line-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.8, 7, 0.9]
			//'line-emissive-strength': 1
		},
		minzoom: 3
	});

	map.addLayer({
		id: layerspercategory.intercityrail.shapes,
		type: 'line',
		source: 'intercityrailshapes',
		'source-layer': 'data',
		filter: [
			'all',
			['any', ['==', 2, ['get', 'route_type']]],
			['!', ['all', ['==', ['get', 'chateau'], 'gotransit'], ['==', ['get', 'shape_id'], 'UNGL']]],
			[
				'!',
				[
					'all',
					['==', 'amtrak', ['get', 'chateau']],
					['==', true, ['get', 'stop_to_stop_generated']]
				]
			],
			[
				'!',
				[
					'all',
					['==', 'f-renfe~media~larga~distancia~y~ave', ['get', 'chateau']],
					['==', 'f-ahverkehrsverbund~schleswig~holstein~nah', ['get', 'chateau']],
					['==', true, ['get', 'stop_to_stop_generated']]
				]
			]
			//  ['!=', ['get', 'chateau'], "amtrak"],
		],
		paint: {
			'line-color': ['concat', '#', ['get', 'color']],
			'line-width': [
				'interpolate',
				['linear'],
				['zoom'],
				3,
				0.4,
				5,
				0.7,
				7,
				1,
				9,
				2,
				11,
				2.5,
				15,
				3,
				18,
				4
			],
			'line-opacity': ['case', ['==', true, ['get', 'stop_to_stop_generated']], 0.2, 0.9]
			//'line-emissive-strength': 1
		},
		minzoom: 3
	});

	//metro
	map.addLayer({
		id: layerspercategory.metro.shapes,
		type: 'line',
		source: 'localcityrailshapes',
		'source-layer': 'data',
		filter: [
			'all',
			['any', ['==', 1, ['get', 'route_type']], ['==', 12, ['get', 'route_type']]],
			[
				'!',
				['all', ['==', 'nyct', ['get', 'chateau']], ['==', true, ['get', 'stop_to_stop_generated']]]
			]
		],
		paint: {
			'line-color': ['concat', '#', ['get', 'color']],
			'line-width': [
				'interpolate',
				['linear'],
				['zoom'],
				6,
				0.5,
				7,
				1,
				9,
				2,
				11,
				2,
				15,
				2.5,
				18,
				3.5
			],
			'line-opacity': 1
			//'line-emissive-strength': 1
		},
		minzoom: 5
	});

	map.addLayer({
		id: layerspercategory.metro.labelshapes,
		type: 'symbol',
		source: 'localcityrailshapes',
		'source-layer': 'data',
		filter: ['all', ['any', ['==', 1, ['get', 'route_type']], ['==', 12, ['get', 'route_type']]]],
		layout: {
			'symbol-placement': 'line',
			'text-field': ['coalesce', ['get', 'route_label']],
			//'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
			'text-font': ['Arimo-Bold'],
			'text-size': ['interpolate', ['linear'], ['zoom'], 3, 7, 9, 9, 13, 11],
			'text-ignore-placement': false,
			'symbol-spacing': ['step', ['zoom'], 20, 6, 40, 9, 70, 13, 80, 15, 100],
			'text-allow-overlap': false,
			'text-pitch-alignment': 'viewport',
			visibility: 'none'
		},
		paint: {
			'text-color': [
				'case',
				['==', ['get', 'color'], '000000'],
				'#ffffff',
				['concat', '#', ['get', 'text_color']]
			],
			//'text-emissive-strength': 1,
			'text-halo-color': ['concat', '#', ['get', 'color']],
			'text-halo-width': 1,
			'text-halo-blur': 1
			//'text-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0, 3.5, 0.8, 4, 1]
		},
		minzoom: 6
	});

	//tram
	map.addLayer({
		id: layerspercategory.tram.shapes,
		type: 'line',
		source: 'localcityrailshapes',
		'source-layer': 'data',
		filter: [
			'all',
			['any', ['==', 0, ['get', 'route_type']], ['==', 5, ['get', 'route_type']]],
			[
				'!',
				[
					'all',
					['==', 'f-9mu-mts', ['get', 'onestop_feed_id']],
					['==', ['coalesce', ['get', 'route_label']], 'Event']
				]
			],
			[
				'!',
				[
					'all',
					['==', 'f-9mu-mts', ['get', 'onestop_feed_id']],
					['==', ['coalesce', ['get', 'route_label']], 'Silver']
				]
			],
			[
				'!',
				['all', ['==', 'nyct', ['get', 'chateau']], ['==', true, ['get', 'stop_to_stop_generated']]]
			]
		],
		paint: {
			'line-color': ['concat', '#', ['get', 'color']],
			'line-width': [
				'interpolate',
				['linear'],
				['zoom'],
				6,
				0.5,
				7,
				1,
				9,
				2,
				11,
				2,
				15,
				2.2,
				18,
				3.3
			],
			'line-opacity': 1
			//'line-emissive-strength': 1
		},
		minzoom: 5
	});

	map.addLayer({
		id: layerspercategory.tram.labelshapes,
		type: 'symbol',
		source: 'localcityrailshapes',
		'source-layer': 'data',
		filter: [
			'all',
			['any', ['==', 0, ['get', 'route_type']], ['==', 5, ['get', 'route_type']]],
			[
				'!',
				[
					'all',
					['==', 'f-9mu-mts', ['get', 'onestop_feed_id']],
					['==', ['coalesce', ['get', 'route_label']], 'Event']
				]
			],
			[
				'!',
				[
					'all',
					['==', 'f-9mu-mts', ['get', 'onestop_feed_id']],
					['==', ['coalesce', ['get', 'route_label']], 'Silver']
				]
			]
		],
		layout: {
			'symbol-placement': 'line',
			'text-field': ['coalesce', ['get', 'route_label']],
			//'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
			'text-font': ['Arimo-Bold'],
			'text-size': ['interpolate', ['linear'], ['zoom'], 3, 7, 9, 9, 13, 11],
			'text-ignore-placement': false,
			'symbol-spacing': ['step', ['zoom'], 20, 6, 40, 9, 70, 13, 80, 15, 100],
			'text-allow-overlap': false,
			'text-pitch-alignment': 'viewport',
			visibility: 'none'
		},
		paint: {
			'text-color': ['concat', '#', ['get', 'text_color']],
			//'text-emissive-strength': 1,
			'text-halo-color': ['concat', '#', ['get', 'color']],
			'text-halo-width': 1,
			'text-halo-blur': 1
			//'text-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0, 3.5, 0.8, 4, 1]
		},
		minzoom: 6
	});

	//INTERCITY RAIL

	map.addLayer({
		id: layerspercategory.intercityrail.labelshapes,
		type: 'symbol',
		source: 'intercityrailshapes',
		'source-layer': 'data',
		filter: [
			'all',
			['any', ['==', 2, ['get', 'route_type']]],
			['!', ['all', ['==', ['get', 'chateau'], 'gotransit'], ['==', ['get', 'shape_id'], 'UNGL']]],
			[
				'!',
				[
					'all',
					['==', 'amtrak', ['get', 'chateau']],
					['==', true, ['get', 'stop_to_stop_generated']]
				]
			],
			[
				'!',
				[
					'all',
					['==', 'f-renfe~media~larga~distancia~y~ave', ['get', 'chateau']],
					['==', 'f-ahverkehrsverbund~schleswig~holstein~nah', ['get', 'chateau']],
					['==', true, ['get', 'stop_to_stop_generated']]
				]
			]
			//     ['!=', ['get', 'chateau'], "amtrak"]
		],
		layout: {
			'symbol-placement': 'line',
			'text-field': urlParams.get('debug')
				? ['concat', ['get', 'onestop_feed_id'], '|', ['coalesce', ['get', 'route_label']]]
				: ['get', 'route_label'],
			//'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
			'text-font': [
				'step',
				['zoom'],
				['literal', ['Arimo-SemiBold']],
				7,
				['literal', ['Arimo-Bold']]
			],
			'text-size': ['interpolate', ['linear'], ['zoom'], 3, 6, 6, 7, 9, 9, 13, 11],
			'text-ignore-placement': false,

			'symbol-spacing': ['step', ['zoom'], 30, 6, 40, 9, 70, 13, 80, 15, 100],
			'text-allow-overlap': false,
			visibility: 'none',

			'text-pitch-alignment': 'viewport'
		},
		paint: {
			'text-color': ['concat', '#', ['get', 'text_color']],
			//'text-emissive-strength': 1,
			'text-halo-color': ['concat', '#', ['get', 'color']],
			'text-halo-width': 1,
			'text-halo-blur': 1
			//'text-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0, 3.5, 0.8, 4, 1]
		},
		minzoom: 5.5
	});
}
