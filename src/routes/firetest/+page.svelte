<script lang="ts">
	import * as maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import type { ProjectionSpecification } from 'maplibre-gl';

	import { onMount } from 'svelte';

	onMount(() => {
		const map = new maplibregl.Map({
			container: 'map',
			hash: 'pos',
			pixelRatio: window.devicePixelRatio * 1.4,
			style: '/light-style.json', // stylesheet location
			center: [-118, 34], // starting position [lng, lat]
			zoom: 10 // starting zoom
		});

		map.on('load', () => {
			map.setProjection({ type: 'globe' });

			console.log(map);

			const modis_url =
				'https://raw.githubusercontent.com/catenarytransit/fire-bounds-cache/refs/heads/main/data/modis.json';

			map.addSource('modis', {
				type: 'geojson',
				data: modis_url
			});

			map.addLayer({
				type: 'circle',
				id: 'modis',
				paint: {
					'circle-color': '#ff341a',
					'circle-opacity': 0.4,
					'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 1, 9, 7, 12, 15, 22, 40]
				},
				source: 'modis'
			});
		});
	});
</script>

<div class="w-full">
	<div id="map" class="fixed top-0 left-0 w-[100vw] h-[100vh]" />
</div>
