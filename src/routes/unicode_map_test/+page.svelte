<script lang="ts">
	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import type { ProjectionSpecification } from 'maplibre-gl';

	import { onMount } from 'svelte';

	onMount(() => {
		const map = new maplibregl.Map({
			container: 'map',

			pixelRatio: window.devicePixelRatio * 1.4,
			style: '/dark-style.json', // stylesheet location
			center: [-117.8427, 33.646], // starting position [lng, lat]
			zoom: 14 // starting zoom
		});

		map.on('load', () => {
			map.setProjection({ type: 'globe' });

			map.addSource('onepoint', {
				type: 'geojson',
				data: {
					type: 'FeatureCollection',
					features: [
						{
							type: 'Feature',
							geometry: {
								type: 'Point',
								coordinates: [-117.8427, 33.6461]
							}
						}
					]
				}
			});

			map.addLayer({
				id: 'one',
				type: 'symbol',
				source: 'onepoint',
				layout: {
					'text-size': 24,
					'text-field': '𔐃𔐈𔐀𔐄𔙆f🐟f▦✺╬∅█☹',
					'text-font': ['Arimo-Regular']
				},
				paint: {
					'text-color': 'white',
					'text-halo-color': 'black',
					'text-halo-width': 1
				}
			});

			console.log(map);
		});
	});
</script>

<div class="w-full">
	<div id="map" class="fixed top-0 left-0 w-[100vw] h-[100vh]" />
</div>
