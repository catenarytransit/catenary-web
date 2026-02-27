import { get, writable } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { determineDarkModeToBool } from './determineDarkModeToBool';

async function make_fire_names(map: maplibregl.Map) {
	const image = await map.loadImage('/fire_1f525.png');

	map.addImage('fireicon', image.data);

	const image_greyed = await map.loadImage('/fire_1f525_greyed.png');

	map.addImage('fireicongreyed', image_greyed.data);

	const darkMode = determineDarkModeToBool();

	/*
	map.addLayer({
		'id': 'firenameslabel',
		'type': 'symbol',
		'source': 'firenames',
		'layout': {
			'icon-image': 'fireicon',
			'icon-size': 0.04,
			'text-field': ['get', 'name'],
			'text-offset': [0, 1],
			'text-anchor': 'top',
			'text-size': ['interpolate', ['linear'], ['zoom'], 6, 6, 12, 14],
			'text-font': ['Arimo-Medium'],
			'text-ignore-placement': true,
			"icon-ignore-placement": true
		},
		paint: {
			'text-color': darkMode ? '#ffaaaa' : '#aa0000',
		},
		minzoom: 6,
	});*/

	map.addLayer({
		id: 'firenameslabelwd',
		type: 'symbol',
		source: 'firenames_wd',
		layout: {
			'icon-image': [
				'case',
				['has', 'containment'],
				['case', ['>=', ['get', 'containment'], 80], 'fireicongreyed', 'fireicon'],
				'fireicon'
			],
			'icon-size': [
				'interpolate',
				['linear'],
				['get', 'ha'],
				0,
				0.03,
				100,
				0.04,
				1000,
				0.05,
				5000,
				0.06
			],
			'text-field': ['concat', ['get', 'name'], ' ', ['get', 'ha_rounded'], 'ha'],
			'text-offset': [0, 1.5],
			'text-anchor': 'top',
			'text-size': ['interpolate', ['linear'], ['zoom'], 6, 6, 12, 14],
			'text-font': ['Arimo-Medium'],
			'text-ignore-placement': true,
			'icon-ignore-placement': true
		},
		paint: {
			'text-color': darkMode ? '#ffaaaa' : '#aa0000'
		},
		minzoom: 5.5
	});
}

function generateArrayInFormat(key: string, array: string[]) {
	/*[
  "in",
  [
	"get",
	"name"
  ],
	[
	"literal",
	["Kenneth Fire"]
  ]
]
  */

	return ['in', ['get', key], ['literal', array]];
}

export function makeFireMap(map: maplibregl.Map, chateaus_in_frame: Writable<string[]>) {
	//console.log('load wildfire data');

	const darkMode = determineDarkModeToBool();

	const watchduty_proxy = 'https://birchfire.catenarymaps.org/watchduty_tiles_proxy/{z}/{x}/{y}';

	const evacuation_fire_url = 'https://fireboundscache.catenarymaps.org/data/evac_california.json';

	const modis_url =
		'https://raw.githubusercontent.com/catenarytransit/fire-bounds-cache/refs/heads/main/data/modis.json';

	const viirs_mw_url =
		'https://raw.githubusercontent.com/catenarytransit/fire-bounds-cache/refs/heads/main/data/viirs_nw.json';
	//const national_usa_fire_arcgis_url =	'https://raw.githubusercontent.com/catenarytransit/fire-bounds-cache/refs/heads/main/data/wfigs_fire_bounds.json';
	const california_firis_arcgis_url =
		'https://raw.githubusercontent.com/catenarytransit/fire-bounds-cache/refs/heads/main/data/ca_fire_bounds.json';

	const los_angeles_fire_evac =
		'https://fireboundscache.catenarymaps.org/data/los_angeles_evac.json';

	const firenamesmanual_url = 'https://fireboundscache.catenarymaps.org/manual_data/firenames.json';

	const fire_evac_manual = 'https://fireboundscache.catenarymaps.org/manual_data/evac.json';

	const fire_evac_codes_california =
		'https://fireboundscache.catenarymaps.org/data/watchduty_events.json';

	//	map.addSource('arcgisfire', {
	//		type: 'geojson',
	//		data: national_usa_fire_arcgis_url
	//});
	/*
	map.addSource("watchduty_proxy", {
		'type': 'vector',
		'tiles': [watchduty_proxy],
		maxzoom: 10,
		minzoom: 5,
		// left, bottom, right, top
		"bounds": [-180, 11, -63, 50]
	});
	*/
	function refresh_watchduty_source() {
		/*
		map.removeSource('watchduty_proxy');

		map.addSource("watchduty_proxy", {
			'type': 'vector',
			'tiles': [watchduty_proxy + '?t=' + Date.now()],
		});

		*/
	}

	function refresh_watchduty_evacs() {
		fetch(fire_evac_codes_california)
			.then(async (data) => await data.json())
			.then((cleaned_data: any) => {
				//combine all evacuation_orders_arr in every object in the array into a single array

				//console.log('refreshing evac sources from watchduty')

				let combined_evacuation_orders_arr = cleaned_data
					.map((fire) => fire.evacuation_orders_arr)
					.flat()
					.filter((x) => typeof x === 'string');

				let combined_evacuation_warnings_arr = cleaned_data
					.map((fire) => fire.evacuation_warnings_arr)
					.flat()
					.filter((x) => typeof x === 'string');

				//console.log('set evac to ',  generateArrayInFormat("zone_name", combined_evacuation_orders_arr))

				map.setFilter(
					'zones-fill-watchduty-go',
					generateArrayInFormat('zone_name', combined_evacuation_orders_arr)
				);
				map.setFilter(
					'zones-fill-watchduty-warning',
					generateArrayInFormat('zone_name', combined_evacuation_warnings_arr)
				);

				map.setFilter(
					'zones-fill-watchduty-go-txt',
					generateArrayInFormat('zone_name', combined_evacuation_orders_arr)
				);

				map.setFilter(
					'zones-fill-watchduty-warning-txt',
					generateArrayInFormat('zone_name', combined_evacuation_warnings_arr)
				);

				const fires_points = cleaned_data
					.filter((fire) => fire.is_active == true)
					.filter((fire) => fire.data != null && fire.data.manual_deactivation_started != true)
					.map((fire) => {
						return {
							type: 'Feature',
							geometry: {
								type: 'Point',
								coordinates: [fire.lng, fire.lat]
							},
							properties: {
								name: fire.name,
								acreage: fire.data.acreage,
								ha: fire.data.acreage * 0.4046,
								ha_rounded: (fire.data.acreage * 0.4046).toFixed(1),
								containment: fire.data.containment
							}
						};
					});

				//console.log('fire points', fires_points)

				map.getSource('firenames_wd').setData({
					type: 'FeatureCollection',
					features: fires_points
				});
			});
	}
	/*
	map.addLayer({
		'id': 'zones-fill-watchduty-go',
		source: "watchduty_proxy",
		'source-layer': 'zones',
		'type': 'fill',
		'paint': {
			'fill-color': '#dd3300',
			"fill-opacity": 0.35
		},
		filter: ["==", "a", "b"]
	});

	map.addLayer({
		'id': 'zones-fill-watchduty-warning',
		source: "watchduty_proxy",
		'source-layer': 'zones',
		'type': 'fill',
		'paint': {
			'fill-color': '#cc9900',
			"fill-opacity": 0.35
		},
		filter: ["==", "a", "b"]
	});*/

	function fetch_and_update_layer(source_id: string, url: string) {
		fetch(url)
			.then(async (data) => await data.json())
			.then((cleaned_data: any) => {
				const source = map.getSource(source_id);

				if (source) {
					source.setData(cleaned_data);
				}
			})
			.catch((err) => console.error(err));
	}

	map.addSource('evacuation_ca_fire', {
		type: 'geojson',
		data: evacuation_fire_url
	});

	map.addSource('los_angeles_city_fire_evac', {
		type: 'geojson',
		data: los_angeles_fire_evac
	});

	map.addSource('californiafireperims', {
		type: 'geojson',
		data: california_firis_arcgis_url
	});

	map.addSource('modis', {
		type: 'geojson',
		data: modis_url
	});

	map.addSource('viirs_nw', {
		type: 'geojson',
		data: viirs_mw_url
	});

	/*

	map.addSource('firenames', {
		type: 'geojson',
		data: firenamesmanual_url
	})*/

	map.addSource('firenames_wd', {
		type: 'geojson',
		data: {
			type: 'FeatureCollection',
			features: []
		}
	});

	/*
	map.addSource('fire_evac_manual', {
		type: 'geojson',
		data: fire_evac_manual
	})*/

	make_fire_names(map);

	/*
	async function fetch_and_update_bounds_usa() {
		fetch(national_usa_fire_arcgis_url)
				.then(async (data) => await data.json())
				.then((cleaned_data: any) => {
					let arcgis_fire_source =map.getSource('arcgisfire');

					if (arcgis_fire_source) {
						arcgis_fire_source.setData(cleaned_data);
					}

				})
				.catch((err) => console.error(err));	
}*/

	refresh_watchduty_evacs();

	setInterval(() => {
		refresh_watchduty_evacs();
		fetch_and_update_layer('evacuation_ca_fire', evacuation_fire_url);

		fetch_and_update_layer('los_angeles_city_fire_evac', los_angeles_fire_evac);

		//	fetch_and_update_layer('firenames', firenamesmanual_url);

		fetch_and_update_layer('fire_evac_manual', fire_evac_manual);

		refresh_watchduty_source();
	}, 30_000);

	setInterval(() => {
		fetch_and_update_layer('modis', modis_url);

		fetch_and_update_layer('viirs_nw', viirs_mw_url);
	}, 120_000);

	/*
	map.addLayer({
		source: 'arcgisfire',
		id: 'arcgisfire',
		type: 'fill',
		filter: [
			'all',
			['!=', ['get', 'attr_FireBehaviorGeneral'], null],
			['!=', ['get', 'attr_FireBehaviorGeneral'], 'Minimal'],
			['!=', ['get', 'attr_IncidentName'], 'LINE']
		],
		paint: {
			'fill-color': '#dd3300',
			'fill-opacity': 0.2
		},
		minzoom: 5
	});

	map.addLayer({
		source: 'arcgisfire',
		id: 'arcgisfireborder',
		filter: [
			'all',
			['!=', ['get', 'attr_FireBehaviorGeneral'], null],
			['!=', ['get', 'attr_FireBehaviorGeneral'], 'Minimal'],
			['!=', ['get', 'attr_IncidentName'], 'LINE']
		],
		type: 'line',
		paint: {
			'line-color': '#ee0000',
			'line-width': 3
		},
		minzoom: 5
	});*/

	map.addLayer({
		type: 'circle',
		minzoom: 5,
		id: 'modis',
		paint: {
			'circle-color': [
				'interpolate',
				['linear'],
				['get', 'BRIGHTNESS'],
				310.64,
				'#ff751f',
				508.63,
				'#ff1a1a'
			],
			'circle-opacity': [
				'interpolate',
				['linear'],
				['get', 'BRIGHTNESS'],
				310.64,
				0.3,
				508.63,
				0.5
			],
			'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 1, 9, 5, 12, 15, 15, 40, 22, 50]
		},
		source: 'modis'
	});

	map.addLayer({
		type: 'circle',
		minzoom: 5,
		id: 'viirs_nw',
		paint: {
			'circle-color': ['interpolate', ['linear'], ['get', 'frp'], 3, '#ff751f', 100, '#ff1a1a'],
			'circle-opacity': ['interpolate', ['linear'], ['get', 'frp'], 3, 0.1, 10, 0.3, 100, 0.4],
			'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 0.3, 9, 1.6, 12, 5, 15, 13, 22, 16]
		},
		source: 'viirs_nw'
	});

	map.addLayer({
		source: 'fire_evac_manual',
		id: 'fire_evac_manual_bounds',
		type: 'fill',
		paint: {
			'fill-color': [
				'case',
				['==', ['get', 'status'], 'go'],
				'#dd3300',
				['==', ['get', 'status'], 'set'],
				'#cc9900',
				'#ff0000'
			],
			'fill-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.3, 12, 0.2, 15, 0.2, 16, 0.15]
		},
		minzoom: 5
	});

	map.addLayer({
		source: 'evacuation_ca_fire',
		id: 'evacuation_ca_fire_bounds',
		type: 'fill',
		paint: {
			'fill-color': [
				'case',
				['==', ['get', 'STATUS'], 'Evacuation Order'],
				'#dd3300',
				['==', ['get', 'STATUS'], 'Evacuation Warning'],
				'#cc9900',
				['==', ['get', 'STATUS'], 'Evacuation/Advisory Lifted'],
				'#10b000',
				'#cc9900'
			],
			'fill-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.3, 12, 0.2, 15, 0.2, 16, 0.15]
		},
		minzoom: 5
	});

	map.addLayer({
		source: 'los_angeles_city_fire_evac',
		id: 'los_angeles_city_fire_evac_bounds',
		type: 'fill',
		paint: {
			'fill-color': [
				'case',
				['==', ['get', 'Label'], 'Mandatory'],
				'#dd3300',
				['==', ['get', 'Label'], 'Warning'],
				'#cc9900',
				'#ff0000'
			],
			'fill-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.2, 12, 0.1, 15, 0.1]
		},
		minzoom: 5
	});

	map.addLayer({
		source: 'californiafireperims',
		id: 'californiafireperims_new',
		type: 'fill',
		filter: ['all', ['>', ['/', ['get', 'poly_DateCurrent'], 1000], Date.now() - 86400 * 7]],
		paint: {
			'fill-color': '#ff0000',
			'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.1, 12, 0.06, 15, 0.04]
		},
		minzoom: 5
	});

	map.addLayer({
		source: 'californiafireperims',
		id: 'californiafireperims_old',
		type: 'fill',
		filter: ['all', ['<', ['/', ['get', 'poly_DateCurrent'], 1000], Date.now() - 86400 * 7]],
		paint: {
			'fill-color': '#ff0000',
			'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.005, 12, 0.01, 15, 0.01]
		},
		minzoom: 5
	});

	map.addLayer({
		source: 'californiafireperims',
		id: 'californiafireperimslines',
		type: 'line',
		paint: {
			'line-color': '#ff0000',
			'line-opacity': 0.5,
			'line-width': 1.2,
			'line-dasharray': [2, 2]
		},
		minzoom: 6
	});

	/*
	map.addLayer({
		source: 'arcgisfire',
		id: 'arcgisfirepoint',
		type: 'symbol',
		filter: [
			'all',
			['!=', ['get', 'attr_FireBehaviorGeneral'], null],
			['!=', ['get', 'attr_FireBehaviorGeneral'], 'Minimal'],
			['!=', ['get', 'attr_IncidentName'], 'LINE']
		],
		paint: {
			'text-color': darkMode ? '#ffaaaa' : '#aa0000'
		},
		layout: {
			'text-field': ['concat', ['get', 'attr_IncidentName'], ' FIRE'],
			'text-size': 10,
			'text-font': ['Arimo-Medium']
		},
		minzoom: 5
	});
*/

	map.addLayer({
		source: 'evacuation_ca_fire',
		id: 'evacuation_ca_fire_txt',
		type: 'symbol',
		paint: {
			'text-color': darkMode ? '#ccaaaa' : '#cc0000'
		},
		layout: {
			'text-field': ['concat', ['get', 'STATUS'], ''],
			'text-size': ['interpolate', ['linear'], ['zoom'], 7, 8, 9, 13],
			'text-font': ['Arimo-Bold']
		},
		minzoom: 6
	});

	map.addLayer({
		source: 'los_angeles_city_fire_evac',
		id: 'los_angeles_city_fire_evac_txt',
		type: 'symbol',
		paint: {
			'text-color': darkMode ? '#ccaaaa' : '#cc0000'
		},
		layout: {
			'text-field': [
				'case',
				['==', ['get', 'Label'], 'Mandatory'],
				'Mandatory Evacuation',
				['==', ['get', 'Label'], 'Warning'],
				'Evacuation Warning',
				' '
			],
			'text-size': ['interpolate', ['linear'], ['zoom'], 7, 8, 9, 12.5],
			'text-font': ['Arimo-Bold']
		},
		minzoom: 6
	});
	/*
	map.addLayer({
		'id': 'zones-fill-watchduty-warning-txt',
		source: "watchduty_proxy",
		'source-layer': 'zones',
		type: 'symbol',
		'layout': {
			'text-field': "Evacuation Warning",
			'text-size': [
				"interpolate",
				["linear"],
				['zoom'],
				9,
				4,
				12,
				10
			  ],
			'text-font': ['Arimo-Bold']
		},
		paint: {
			'text-color': darkMode ? '#ccaaaa' : '#cc0000'
		},
		filter: ["==", "a", "b"]
	});
	
	map.addLayer({
		'id': 'zones-fill-watchduty-go-txt',
		source: "watchduty_proxy",
		'source-layer': 'zones',
		type: 'symbol',
		'layout': {
			'text-field': "Mandatory Evacuation",
			'text-size': [
				"interpolate",
				["linear"],
				['zoom'],
				9,
				5,
				12,
				13
			  ],
			'text-font': ['Arimo-Bold']
		},
		paint: {
			'text-color': darkMode ? '#ccaaaa' : '#cc0000'
		},
		filter: ["==", "a", "b"]
	});*/

	map.addLayer({
		source: 'fire_evac_manual',
		id: 'fire_evac_manual_txt',
		type: 'symbol',
		paint: {
			'text-color': darkMode ? '#ccaaaa' : '#cc0000'
		},
		layout: {
			'text-field': [
				'case',
				['==', ['get', 'status'], 'go'],
				'Mandatory Evacuation',
				['==', ['get', 'status'], 'set'],
				'Evacuation Warning',
				' '
			],
			'text-size': ['interpolate', ['linear'], ['zoom'], 7, 9, 9, 13],
			'text-font': ['Arimo-Bold']
		},
		minzoom: 6
	});
}
