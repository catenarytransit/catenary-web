<script lang="ts">
	import * as maplibregl from 'maplibre-gl';
	import { onMount } from 'svelte';

	let centerinit: [number, number] = [6, 48];
	let zoominit = 6;

	onMount(() => {
		const urlParams = new URLSearchParams(window.location.search);
		const chateauFilter = urlParams.get('chateau');

		const map = new maplibregl.Map({
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
			map.addSource('busshapes', {
				type: 'vector',
				url: 'https://birch4.catenarymaps.org/shapes_bus'
			});

			map.addLayer({
				id: 'busshapes',
				type: 'line',
				source: 'busshapes',
				'source-layer': 'data',
				filter: [
					'all',
					//   ['!=', ['get', 'onestop_feed_id'], 'f-9-flixbus'],
					['==', ['get', 'chateau'], 'schweiz']
				],
				paint: {
					'line-color': ['concat', '#', ['get', 'color']],
					'line-width': 1,
					'line-opacity': 0.5
					////'line-emissive-strength': 1
					//'line-opacity': ['interpolate', ['linear'], ['zoom'], 6.5, 0.5, 7.2, 0.5, 10, 0.5, 10, 0.5],
					// 'line-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.2, 10, 0.4]
				},
				minzoom: 5
			});

			map.addSource('swiss_bounds', {
				type: 'geojson',
				data: {
					type: 'Feature',
					geometry: {
						type: 'Polygon',
						coordinates: [
							[
								[5.6216, 45.44223],
								[10.88867, 45.44223],
								[10.88867, 48.3833],
								[5.6216, 48.3833],
								[5.6216, 45.44223]
							]
						]
					},
					properties: {}
				}
			});

			map.addLayer({
				id: 'swiss_bounds_outline',
				type: 'line',
				source: 'swiss_bounds',
				layout: {},
				paint: {
					'line-color': '#FF0000',
					'line-width': 3
				}
			});
		});
	});
</script>

<title>Catenary Maps - SBB bounds</title>

<div id="map" class="fixed top-0 left-0 w-[100vw] h-[100vh]" />
