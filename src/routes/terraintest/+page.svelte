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
			center: [-74.5, 40], // starting position [lng, lat]
			zoom: 9 // starting zoom
		});

		map.on('load', () => {
			map.setProjection({ type: 'globe' });
			skyRefresh(map, darkMode);

			const demSource = new mlcontour.DemSource({
				url: 'https://terraintiles.catenarymaps.org/{z}/{x}/{y}',
				encoding: 'terrarium',
				cacheSize: 1000,
				maxzoom: 15,
				// offload contour line computation to a web worker
				worker: true
			});

			demSource.setupMaplibre(maplibregl);

			map.addSource('hillshade', {
				type: 'raster-dem',
				tiles: [demSource.sharedDemProtocolUrl],
				tileSize: 512
			});

			map.setTerrain({ source: 'hillshade', exaggeration: 1 });

			map.addLayer(
				{
					id: 'hillshade',
					type: 'hillshade',
					source: 'hillshade',

					paint: {
						'hillshade-shadow-color': darkMode ? 'hsl(202, 37%, 10%)' : '#111111',
						'hillshade-highlight-color': darkMode ? 'hsla(203, 35%, 73%, 0.51)' : '#dddddd',
						'hillshade-accent-color': darkMode ? 'hsl(203, 39%, 12%)' : '#222222',
						'hillshade-exaggeration': 0.3
					},
					layout: {}
				},
				'aeroway_fill'
			);

			console.log(map);
		});
	});
</script>

<div class="w-full">
	<div id="map" class="fixed top-0 left-0 w-[100vw] h-[100vh]" />
</div>
