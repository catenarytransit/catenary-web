<script lang="ts">
	import { Map } from 'maplibre-gl';
	import { onMount } from 'svelte';

	let centerinit: [number, number] = [-118, 33.9];
	let zoominit = 8.1;

	onMount(() => {
		const urlParams = new URLSearchParams(window.location.search);
		const chateauFilter = urlParams.get('chateau');

		const map = new Map({
			container: 'map',
			crossSourceCollisions: true,
			hash: 'pos',
			//	antialias: true,
			style: '/dark-style.json', // stylesheet location
			center: centerinit, // starting position [lng, lat]
			//keep the centre at Los Angeles, since that is our primary user base currently
			//switch to IP geolocation and on the fly rendering for this soon
			zoom: zoominit, // starting zoom (must be greater than 8.1)
			fadeDuration: 0
		});

		map.on('load', () => {
			map.addSource('chateaus', {
				type: 'geojson',
				data: {
					features: [],
					type: 'FeatureCollection'
				}
			});

			fetch('https://birch.catenarymaps.org/getchateaus').then(async (resp) => {
				let json = await resp.json();

				let colour_pool = [
					'#ef4444',
					'#f97316',
					'#f59e0b',
					'#eab308',
					'#84cc16',
					'#22c55e',
					'#10b981',
					'#14b8a6',
					'#06b6d4',
					'#0ea5e9',
					'#3b82f6',
					'#6366f1',
					'#8b5cf6',
					'#a855f7',
					'#d946ef',
					'#ec4899',
					'#f43f5e'
				];

				let i = 0;

				let new_features = json.features.map((x: any) => {
					x.properties.color = colour_pool[i % colour_pool.length];
					i = i + 1;

					return x;
				});

				map.getSource('chateaus').setData({
					features: new_features,
					type: 'FeatureCollection'
				});
			});

			map.addLayer({
				id: 'static_hull_calc_line',
				type: 'line',
				source: 'chateaus',
				filter: chateauFilter ? ['==', 'chateau', chateauFilter] : ['all'],
				paint: {
					'line-color': ['get', 'color'],
					'line-opacity': 1,
					//'line-emissive-strength': 1,
					'line-width': 2
				}
			});

			map.addLayer({
				id: 'static_hull_calc_shape',
				type: 'fill',
				source: 'chateaus',
				filter: chateauFilter ? ['==', 'chateau', chateauFilter] : ['all'],
				paint: {
					'fill-color': ['get', 'color'],
					'fill-opacity': 0.03
					//	'fill-emissive-strength': 1
				}
			});
			map.addLayer({
				id: 'static_feed_calc_names',
				type: 'symbol',
				source: 'chateaus',
				filter: chateauFilter ? ['==', 'chateau', chateauFilter] : ['all'],
				layout: {
					'text-field': ['get', 'chateau'],
					'text-size': 9,
					//'text-allow-overlap': true,
					//'text-ignore-placement': true,
					'text-justify': 'center',
					'text-anchor': 'center',
					'text-padding': 0,
					'text-line-height': 1.2,
					'text-letter-spacing': 0.01,
					'text-max-width': 10,
					'text-font': ['Arimo-Medium'],
					'text-offset': [0, 0]
				},
				paint: {
					'text-color': ['get', 'color'],
					'text-halo-color': '#000000',
					'text-halo-width': 2,
					'text-halo-blur': 5
				}
			});
		});
	});
</script>

<title>Catenary Maps - Chateaus</title>

<div id="map" class="fixed top-0 left-0 w-[100vw] h-[100vh]" />
